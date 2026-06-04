const path = require('path');
process.env.PUPPETEER_CACHE_DIR = path.join(__dirname, '.cache', 'puppeteer');

// Global error handlers to prevent async crashes from taking down the Express web service
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Unhandled Rejection Alert]:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[Uncaught Exception Alert]:', err.message || err);
});

const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

// WhatsApp Bot & AI Imports
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage, isJidGroup } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const TARGET_GROUP = "120363427181556541@g.us";

let whatsappClient = null;
let currentSaveCreds = null;

let whatsappStatus = {
    status: 'disconnected',
    qr: null,
    qrDataUrl: null,
    phone: null,
    pushname: null,
    lastConnected: null,
    lastStateChange: Date.now(),
    initAttempt: 0
};

// Reconnect cooldown to prevent infinite loops
let lastReconnectTime = 0;
const RECONNECT_COOLDOWN_MS = 15000;
let authTimeoutHandle = null;
const AUTH_TIMEOUT_MS = 120000; // 2 minutes max in authenticating state

// Gemini API Rate Limit Tracker (15 RPM Free Tier limit)
let geminiRequestTimestamps = [];
let lastBroadcastLimit = -1;
const GEMINI_RPM_LIMIT = 15;

function clearAuthTimeout() {
    if (authTimeoutHandle) {
        clearTimeout(authTimeoutHandle);
        authTimeoutHandle = null;
    }
}

function startAuthTimeout() {
    clearAuthTimeout();
    authTimeoutHandle = setTimeout(async () => {
        if (whatsappStatus.status === 'authenticating') {
            console.log('[WhatsApp Watchdog] Stuck in authenticating for too long. Forcing re-init...');
            whatsappStatus.status = 'disconnected';
            whatsappStatus.lastStateChange = Date.now();
            if (whatsappClient) {
                try { whatsappClient.end(new Error('Auth Timeout')); } catch (e) {}
            }
        }
    }, AUTH_TIMEOUT_MS);
}

async function safeInitialize() {
    const now = Date.now();
    if (now - lastReconnectTime < RECONNECT_COOLDOWN_MS) {
        const waitMs = RECONNECT_COOLDOWN_MS - (now - lastReconnectTime);
        console.log(`[WhatsApp] Reconnect cooldown active, waiting ${Math.ceil(waitMs / 1000)}s...`);
        await new Promise(r => setTimeout(r, waitMs));
    }
    lastReconnectTime = Date.now();
    whatsappStatus.initAttempt++;
    
    console.log(`[WhatsApp] Initializing Baileys client (attempt #${whatsappStatus.initAttempt})...`);
    try {
        const { state, saveCreds } = await useMultiFileAuthState('./.auth_info_baileys');
        const { version, isLatest } = await fetchLatestBaileysVersion();
        
        whatsappClient = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,
            browser: ['Factory AI', 'Chrome', '1.0.0'],
            generateHighQualityLinkPreview: true,
            syncFullHistory: false
        });
        
        currentSaveCreds = saveCreds;
        whatsappClient.ev.on('creds.update', saveCreds);
        
        setupBaileysEvents(whatsappClient);
    } catch (err) {
        console.error('[WhatsApp] Initialize failed:', err.message);
        whatsappStatus.status = 'disconnected';
        whatsappStatus.lastStateChange = Date.now();
    }
}

const app = express();
const PORT = process.env.PORT || 5000;

const http = require('http');
const { Server } = require('socket.io');
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*" }
});
global.io = io; // Expose globally to broadcast from anywhere

io.on('connection', (socket) => {
    console.log('[Socket.IO] New dashboard client connected:', socket.id);
    
    // Immediately send current API limits on new connection
    const currentCount = geminiRequestTimestamps.length;
    socket.emit('api_limit_update', { count: currentCount, limit: GEMINI_RPM_LIMIT });

    socket.on('disconnect', () => console.log('[Socket.IO] Client disconnected:', socket.id));
});

// Periodic broadcast of API limit decay
setInterval(() => {
    const now = Date.now();
    geminiRequestTimestamps = geminiRequestTimestamps.filter(t => now - t < 60000);
    const currentCount = geminiRequestTimestamps.length;
    
    // Only broadcast if the count changed (e.g. decayed)
    if (currentCount !== lastBroadcastLimit && global.io) {
        global.io.emit('api_limit_update', { count: currentCount, limit: GEMINI_RPM_LIMIT });
        lastBroadcastLimit = currentCount;
    }
}, 2000);

app.use(cors());
app.use(express.json());

// Initialize Neon DB Postgres Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function ensureWhatsappGroupsTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_groups (
                id SERIAL PRIMARY KEY,
                group_id VARCHAR(100) UNIQUE,
                group_name VARCHAR(255),
                active BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Database table "whatsapp_groups" verified/created successfully.');
    } catch (err) {
        console.error('Error verifying/creating "whatsapp_groups" table:', err);
    }
}

// =============================================================================
// WhatsApp Bot & AI Helper Functions
// =============================================================================

async function savePendingRequest(item, senderName = 'WhatsApp User') {
    try {
        const id = Date.now() + '-' + Math.floor(Math.random() * 1000);
        const receivedAt = new Date().toISOString();

        const queryText = `
            INSERT INTO pending_requests (
                id, part_name, qty, size, material, machine, vendor, requested_by, 
                demand_timestamp, received_at, rate, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11)
        `;

        const values = [
            id,
            item["Part Name"] || item.partName || '',
            item["Qty Required"] || item.qty || '',
            item["Size"] || item.size || '',
            item["Material"] || item.material || '',
            item["For Machine"] || item.machine || '',
            item["Vendor"] || item.vendor || '',
            senderName,
            receivedAt,
            item["Price"] || item.price || '',
            'pending_review'
        ];

        console.log('--- SQL DIRECT BOT INSERTION ---');
        console.log('Parameters:', JSON.stringify(values, null, 2));
        console.log('---------------------------------');

        await pool.query(queryText, values);
        console.log(`Saved pending request successfully inside NeonDB: ID=${id}`);
        if (global.io) global.io.emit('dashboard_update');
        return { success: true, id };
    } catch (err) {
        console.error('Error saving pending request directly to DB:', err);
        return { success: false, error: err.message };
    }
}

async function fetchInventoryContext() {
    try {
        const res = await pool.query('SELECT part_name, sku, material, detail1, detail2, available_qty, unit, price, vendor FROM inventory ORDER BY part_name ASC');
        
        let context = "Master Inventory (Part Name | SKU | Material | Size Details | Stock Qty | Unit | Price | Preferred Vendor):\n";
        res.rows.forEach(row => {
            const size = [row.detail1, row.detail2].filter(Boolean).join(" / ");
            context += `- "${row.part_name}" | SKU: ${row.sku} | Mat: ${row.material || 'N/A'} | Size: ${size || 'N/A'} | Stock: ${row.available_qty} ${row.unit || 'Pcs.'} | Price: $${row.price || '0.00'} | Vendor: ${row.vendor || 'N/A'}\n`;
        });
        return context;
    } catch (err) {
        console.error("Error fetching inventory context for Gemini:", err);
        return "No inventory database context available due to error.";
    }
}

async function generateWithRetry(prompt, isAudio = false, audioBase64 = null) {
    const models = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];
    const maxRetries = 3;
    const delays = [2000, 4000, 6000];

    for (const modelName of models) {
        console.log(`Attempting Gemini request using model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Track this request for RPM limiting
                geminiRequestTimestamps.push(Date.now());
                if (global.io) {
                    lastBroadcastLimit = geminiRequestTimestamps.length;
                    global.io.emit('api_limit_update', { count: lastBroadcastLimit, limit: GEMINI_RPM_LIMIT });
                }

                let result;
                if (isAudio) {
                    result = await model.generateContent([
                        prompt,
                        {
                            inlineData: {
                                mimeType: "audio/ogg",
                                data: audioBase64
                            }
                        }
                    ]);
                } else {
                    result = await model.generateContent(prompt);
                }

                const text = result.response.text();
                if (text) {
                    return text; // Success!
                }
            } catch (err) {
                const errMessage = err.message || '';
                const isTemporaryError = errMessage.includes('503') || 
                                         errMessage.includes('high demand') || 
                                         errMessage.includes('overload') || 
                                         errMessage.includes('Unavailable') ||
                                         errMessage.includes('fetch');

                if (attempt < maxRetries && isTemporaryError) {
                    const delay = delays[attempt];
                    console.log(`Gemini retry attempt ${attempt + 1} for ${modelName} after ${delay}ms... (Error: ${errMessage})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    console.log(`Request failed for model ${modelName} on attempt ${attempt + 1}. Error: ${errMessage}`);
                    break; // Fallback to next model or exit loop
                }
            }
        }
    }
    return null; // All retries and models failed
}

function extractJsonFromResponse(raw) {
    if (!raw) return null;
    
    const startIdx = raw.indexOf('[');
    const endIdx = raw.lastIndexOf(']');
    
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        try {
            const parsed = JSON.parse(raw.substring(startIdx, endIdx + 1));
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
            console.error("Failed to parse extracted JSON array:", e.message);
        }
    }
    
    const startObjIdx = raw.indexOf('{');
    const endObjIdx = raw.lastIndexOf('}');
    if (startObjIdx !== -1 && endObjIdx !== -1 && endObjIdx > startObjIdx) {
        try {
            const parsed = JSON.parse(raw.substring(startObjIdx, endObjIdx + 1));
            return [parsed];
        } catch (e) {
            console.error("Failed to parse extracted JSON object:", e.message);
        }
    }
    
    return null;
}

async function processText(text) {
    const inventoryContext = await fetchInventoryContext();

const prompt = `
CRITICAL INSTRUCTION: First, determine if the message contains a clear, deliberate request for a factory machine part, tool, or material. 
If the message is empty, unintelligible, gibberish, or just random chatter, you MUST IMMEDIATELY return an empty JSON array: []

Only if there is a valid request, proceed with the following:
Translate to English.

The message may contain ONE or MULTIPLE items/parts being requested by factory workers.
Cross-reference each request against the provided company's Master Inventory List below.

INVENTORY MATCHING RULES:
1. Match the requested part to the closest matching item in the Master Inventory.
2. If an inventory match is found (even with spelling variations, informal names, abbreviations, or Hindi/Punjabi terms):
   - Use the canonical "Part Name" from the inventory.
   - Populate "SKU" with the inventory's SKU.
   - Populate "Size", "Material", and "Vendor" with details from the matched inventory item if not explicitly overridden by the worker's message.
   - Populate "Available Stock", "Price", and "Category" from the matched inventory item.
   - If the requested quantity (Qty Required) exceeds the matched inventory item's stock (Stock), generate a detailed warning in the "stockWarning" field (e.g., "Requested 5, but only 2 available in stock").
3. If no match is found:
   - Perform standard extraction (leave SKU, Available Stock, Price, stockWarning empty).
   - If there is a similar item in the inventory that might be what they wanted, suggest it in the "suggestedMatch" field (e.g., "Did you mean back gauge pc (SKU: 137)?").

MASTER INVENTORY:
${inventoryContext}

For EACH item extract:
- Part Name (canonical matched name or parsed name)
- SKU (blank if not matched)
- Qty Required (plain number only, e.g., "1", "20")
- Size (use detail1/detail2 format from inventory if matched)
- Material
- Category (blank if not matched)
- For Machine
- Vendor
- Price (blank if not matched)
- Available Stock (blank if not matched)
- stockWarning (blank if no stock issue)
- suggestedMatch (blank if no suggestion)

Rules:
- If Vendor is mentioned once for multiple items, apply it to ALL items
- If "For Machine" is mentioned once for multiple items, apply it to ALL items
- If Size or Material is not mentioned, leave it empty
- Qty should be just the number (e.g. "1", "20", "12")
- CRITICAL: If the message is empty, gibberish, or does NOT explicitly request a factory machine part, tool, or material, you MUST return an empty JSON array: []

Return ONLY a raw JSON array with NO markdown, NO code fences, NO explanation.
Example format:
[
  {
    "Part Name": "",
    "SKU": "",
    "Qty Required": "",
    "Size": "",
    "Material": "",
    "Category": "",
    "For Machine": "",
    "Vendor": "",
    "Price": "",
    "Available Stock": "",
    "stockWarning": "",
    "suggestedMatch": ""
  }
]

Message:
${text}
`;

    const raw = await generateWithRetry(prompt, false, null);
    if (!raw) {
        console.error("Gemini failed completely after retries and fallback. Skipping text request safely.");
        return [];
    }

    console.log("RAW GEMINI RESPONSE (text):", raw);

    const parsed = extractJsonFromResponse(raw);
    if (parsed) {
        return parsed;
    }

    console.log("PARSE FAILED. Raw:", raw);
        return [{
            "Part Name": raw,
            "SKU": "",
            "Qty Required": "",
            "Size": "",
            "Material": "",
            "Category": "",
            "For Machine": "",
            "Vendor": "",
            "Price": "",
            "Available Stock": "",
            "stockWarning": "",
            "suggestedMatch": ""
        }];
}

async function processAudio(filename) {
    const inventoryContext = await fetchInventoryContext();
    const audioBase64 = fs.readFileSync(filename).toString('base64');

const prompt = `
CRITICAL INSTRUCTION: First, determine if the audio contains a clear, deliberate human voice requesting a factory machine part, tool, or material. 
If the audio is empty, contains only background noise, silence, or just random chatter, you MUST IMMEDIATELY return an empty JSON array: []

Only if there is a valid request, proceed with the following:
Translate to English.

The message may contain ONE or MULTIPLE items/parts being requested by factory workers.
Cross-reference each request against the provided company's Master Inventory List below.

INVENTORY MATCHING RULES:
1. Match the requested part to the closest matching item in the Master Inventory.
2. If an inventory match is found (even with spelling variations, informal names, abbreviations, or Hindi/Punjabi terms):
   - Use the canonical "Part Name" from the inventory.
   - Populate "SKU" with the inventory's SKU.
   - Populate "Size", "Material", and "Vendor" with details from the matched inventory item if not explicitly overridden by the worker's message.
   - Populate "Available Stock", "Price", and "Category" from the matched inventory item.
   - If the requested quantity (Qty Required) exceeds the matched inventory item's stock (Stock), generate a detailed warning in the "stockWarning" field (e.g., "Requested 5, but only 2 available in stock").
3. If no match is found:
   - Perform standard extraction (leave SKU, Available Stock, Price, stockWarning empty).
   - If there is a similar item in the inventory that might be what they wanted, suggest it in the "suggestedMatch" field (e.g., "Did you mean back gauge pc (SKU: 137)?").

MASTER INVENTORY:
${inventoryContext}

For EACH item extract:
- Part Name (canonical matched name or parsed name)
- SKU (blank if not matched)
- Qty Required (plain number only, e.g., "1", "20")
- Size (use detail1/detail2 format from inventory if matched)
- Material
- Category (blank if not matched)
- For Machine
- Vendor
- Price (blank if not matched)
- Available Stock (blank if not matched)
- stockWarning (blank if no stock issue)
- suggestedMatch (blank if no suggestion)

Rules:
- If Vendor is mentioned once for multiple items, apply it to ALL items
- If "For Machine" is mentioned once for multiple items, apply it to ALL items
- If Size or Material is not mentioned, leave it empty
- Qty should be just the number (e.g. "1", "20", "12")
- CRITICAL: If the audio is empty, just background noise, gibberish, or does NOT explicitly request a factory machine part, tool, or material, you MUST return an empty JSON array: []

Return ONLY a raw JSON array with NO markdown, NO code fences, NO explanation.
Example format:
[
  {
    "Part Name": "",
    "SKU": "",
    "Qty Required": "",
    "Size": "",
    "Material": "",
    "Category": "",
    "For Machine": "",
    "Vendor": "",
    "Price": "",
    "Available Stock": "",
    "stockWarning": "",
    "suggestedMatch": ""
  }
]
`;

    const raw = await generateWithRetry(prompt, true, audioBase64);
    if (!raw) {
        console.error("Gemini failed completely after retries and fallback. Skipping audio request safely.");
        return [];
    }

    console.log("RAW GEMINI RESPONSE (audio):", raw);

    const parsed = extractJsonFromResponse(raw);
    if (parsed) {
        return parsed;
    }

    console.log("PARSE FAILED. Raw:", raw);
        return [{
            "Part Name": raw,
            "SKU": "",
            "Qty Required": "",
            "Size": "",
            "Material": "",
            "Category": "",
            "For Machine": "",
            "Vendor": "",
            "Price": "",
            "Available Stock": "",
            "stockWarning": "",
            "suggestedMatch": ""
        }];
}


// Serve local voice note audio files as static resources
app.use('/audio', express.static(path.join(__dirname)));

// Configure Google Sheets API
const SPREADSHEET_ID = '14QSTB1DJeaY44Ec2WTA12znOW6L5AsLALhLLEedwVpI';
const RANGE = 'Sheet1!A:I';

async function getSheetsClient() {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    return google.sheets({ version: 'v4', auth });
}

// -----------------------------------------------------------------------------
// API Endpoints
// -----------------------------------------------------------------------------

// Server Health Check Endpoint
app.get('/health', async (req, res) => {
    const healthStatus = {
        uptime: process.uptime(),
        status: 'UP',
        timestamp: new Date().toISOString(),
        database: 'unhealthy',
        whatsapp: whatsappStatus.status
    };

    try {
        const dbCheck = await pool.query('SELECT NOW()');
        if (dbCheck && dbCheck.rows.length > 0) {
            healthStatus.database = 'healthy';
        }
    } catch (dbErr) {
        console.error('[Health Check] Database check failed:', dbErr.message);
        healthStatus.status = 'DOWN';
        healthStatus.database = dbErr.message;
        return res.status(500).json(healthStatus);
    }

    res.json(healthStatus);
});

app.get('/api/health', (req, res) => {
    res.redirect('/health');
});

// Fetch demand requests from Google Sheets
app.get('/api/requests', async (req, res) => {
    try {
        const sheets = await getSheetsClient();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: RANGE
        });

        const rows = response.data.values || [];
        if (rows.length === 0) {
            return res.json([]);
        }

        // Headers row: ['PART NAME', 'QTY REQD', 'SIZE', 'MATERIAL', 'FOR MACHINE', 'VENDOR', 'REQUESTED BY', 'RECEIVED AT', 'DEMAND TIMESTAMP']
        const headers = rows[0].map(h => h.toUpperCase());
        const dataRows = rows.slice(1);

        const requests = dataRows.map((row, index) => {
            return {
                id: index + 1,
                partName: row[0] || '',
                qty: row[1] || '',
                size: row[2] || '',
                material: row[3] || '',
                machine: row[4] || '',
                vendor: row[5] || '',
                requestedBy: row[6] || '',
                receivedAt: row[7] || '',
                demandTimestamp: row[8] || ''
            };
        }).filter(item => item.partName || item.qty || item.machine); // Filter out entirely empty rows

        console.log('--- API RESPONSE SENT TO APPROVED SECTION ---');
        console.log('Total Approved Requests:', requests.length);
        if (requests.length > 0) {
            console.log('Sample Approved Request Object:', JSON.stringify(requests[0], null, 2));
        }
        console.log('---------------------------------------------');

        res.json(requests);
    } catch (err) {
        console.error('Error fetching sheet rows:', err);
        res.status(500).json({ error: 'Failed to fetch data from Google Sheets' });
    }
});

// Fetch Approver KPIs from Neon DB
app.get('/api/approver-kpis', async (req, res) => {
    try {
        const queryText = `
            SELECT 
                COUNT(CASE WHEN status = 'pending_review' OR status IS NULL THEN 1 END)::int as new_worker_demands,
                COUNT(CASE WHEN status = 'reviewed' THEN 1 END)::int as pending_approval,
                COUNT(CASE WHEN status = 'approved' THEN 1 END)::int as approved_not_received
            FROM pending_requests
        `;
        const result = await pool.query(queryText);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching Approver KPIs:', err);
        res.status(500).json({ error: 'Failed to fetch Approver KPIs from database' });
    }
});

// -----------------------------------------------------------------------------
// Pending Queue (PostgreSQL Persistence)
// -----------------------------------------------------------------------------

// Helper to search inventory table for matching item
async function findInventoryMatch(partName, sku) {
    try {
        if (sku && sku.trim() !== '') {
            const res = await pool.query('SELECT * FROM inventory WHERE sku = $1', [sku.trim()]);
            if (res.rows.length > 0) return res.rows[0];
        }
        if (partName && partName.trim() !== '') {
            const trimmed = partName.trim();
            // 1. Exact match
            const resExact = await pool.query('SELECT * FROM inventory WHERE part_name ILIKE $1', [trimmed]);
            if (resExact.rows.length > 0) return resExact.rows[0];
            
            // 2. Partial/fuzzy match
            const resFuzzy1 = await pool.query('SELECT * FROM inventory WHERE part_name ILIKE $1 OR product_description ILIKE $1 LIMIT 1', [`%${trimmed}%`]);
            if (resFuzzy1.rows.length > 0) return resFuzzy1.rows[0];

            // 3. Match on first word
            const words = trimmed.split(/\s+/).filter(w => w.length > 2);
            if (words.length > 0) {
                const pattern = `%${words[0]}%`;
                const resFuzzy2 = await pool.query('SELECT * FROM inventory WHERE part_name ILIKE $1 LIMIT 1', [pattern]);
                if (resFuzzy2.rows.length > 0) return resFuzzy2.rows[0];
            }
        }
    } catch (err) {
        console.error('Error in findInventoryMatch helper:', err);
    }
    return null;
}

// GET all pending demands
app.get('/api/pending', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM pending_requests WHERE status IS NULL OR status IN ('pending_review', 'reviewed', 'approved') ORDER BY demand_timestamp DESC");
        
        // Map database columns to camelCase properties and resolve dynamic live stock matching
        const requests = await Promise.all(result.rows.map(async (row) => {
            const match = await findInventoryMatch(row.part_name, row.sku);
            
            let availableStock = '0';
            let skuValue = row.sku || '';
            let suggestedMatch = 'No Match';
            let stockWarning = 'No Inventory Match';
            let priceVal = row.rate || '';

            if (match) {
                availableStock = (match.available_qty !== undefined ? match.available_qty : 0).toString();
                skuValue = match.sku || skuValue;
                suggestedMatch = match.part_name || '';
                priceVal = match.price || priceVal;

                // Extract quantity as numeric for comparison
                const reqQty = parseInt((row.qty || '').replace(/[^0-9]/g, ''), 10);
                const stock = match.available_qty !== undefined ? match.available_qty : 0;

                if (isNaN(reqQty) || reqQty === 0) {
                    stockWarning = stock > 0 ? 'Stock Available' : 'Insufficient Stock';
                } else if (stock >= reqQty) {
                    stockWarning = 'Stock Available';
                } else {
                    stockWarning = 'Insufficient Stock';
                }
            }

            return {
                id: row.id,
                partName: row.part_name || '',
                qty: row.qty || '',
                size: row.size || '',
                material: row.material || '',
                machine: row.machine || '',
                vendor: row.vendor || '',
                requestedBy: row.requested_by || 'WhatsApp User',
                receivedAt: row.received_at || row.demand_timestamp,
                sku: skuValue,
                regNo: match ? (match.reg_no || '') : '',
                category: row.category || (match ? match.category : ''),
                price: priceVal,
                availableStock: availableStock,
                stockWarning: stockWarning,
                suggestedMatch: suggestedMatch,
                editedAt: row.edited_at,
                approvedAt: row.approved_at,
                status: row.status || 'pending_review',
                editedBy: row.edited_by || '',
                approvedBy: row.approved_by || ''
            };
        }));
        
        res.json(requests);
    } catch (err) {
        console.error('Error fetching pending requests from DB:', err);
        res.status(500).json({ error: 'Failed to fetch pending requests from database' });
    }
});

// POST a new parsed demand from WhatsApp Bot
app.post('/api/pending', async (req, res) => {
    try {
        const item = req.body;
        if (!item) {
            return res.status(400).json({ error: 'Empty payload' });
        }

        const id = Date.now() + '-' + Math.floor(Math.random() * 1000);
        const receivedAt = new Date().toISOString();

        // Exact SQL Query aligned with DB schema columns
        const queryText = `
            INSERT INTO pending_requests (
                id, part_name, qty, size, material, machine, vendor, requested_by, 
                demand_timestamp, received_at, rate, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11)
        `;

        const values = [
            id,
            item.partName || '',
            item.qty || '',
            item.size || '',
            item.material || '',
            item.machine || '',
            item.vendor || '',
            item.requestedBy || 'WhatsApp User',
            receivedAt,
            item.price || '',
            'pending_review'
        ];

        // Dynamic console log of the SQL payload before query execution
        console.log('--- SQL INSERTION PAYLOAD ---');
        console.log('Query:', queryText.trim().replace(/\s+/g, ' '));
        console.log('Parameters:', JSON.stringify(values, null, 2));
        console.log('-----------------------------');

        await pool.query(queryText, values);

        const newItem = {
            id,
            partName: item.partName || '',
            qty: item.qty || '',
            size: item.size || '',
            material: item.material || '',
            machine: item.machine || '',
            vendor: item.vendor || '',
            requestedBy: item.requestedBy || 'WhatsApp User',
            receivedAt,
            sku: item.sku || '',
            category: item.category || '',
            price: item.price || '',
            availableStock: item.availableStock || '',
            stockWarning: item.stockWarning || '',
            suggestedMatch: item.suggestedMatch || ''
        };

        console.log('Queued pending WhatsApp demand request to DB:', newItem.partName);
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true, item: newItem });
    } catch (err) {
        console.error('Error queuing request to DB:', err);
        res.status(500).json({ error: 'Failed to queue pending request' });
    }
});

// POST Approve a pending demand and write it to Google Sheets
app.post('/api/pending/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const approvedData = req.body;

        // Verify item exists in database
        const checkResult = await pool.query('SELECT * FROM pending_requests WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Pending request not found' });
        }

        const dbRow = checkResult.rows[0];

        // Print original DB row before approval to console
        console.log('--- DB ROW BEFORE APPROVAL ---');
        console.log(JSON.stringify(dbRow, null, 2));
        console.log('------------------------------');

        // Set approved_at = NOW(), status = 'approved', approved_by = 'Manager' in database
        console.log(`[Database Approval] Setting approved_at = NOW(), status = 'approved', approved_by = 'Manager' for request ID: ${id}`);
        const updateQueryText = `
            UPDATE pending_requests 
            SET status = 'approved', approved_by = 'Manager', approved_at = NOW(),
                part_name = $1, qty = $2, size = $3, material = $4, machine = $5, vendor = $6, rate = $7
            WHERE id = $8
            RETURNING *
        `;
        const updateValues = [
            approvedData.partName || dbRow.part_name || '',
            approvedData.qty || dbRow.qty || '',
            approvedData.size || dbRow.size || '',
            approvedData.material || dbRow.material || '',
            approvedData.machine || dbRow.machine || '',
            approvedData.vendor || dbRow.vendor || '',
            approvedData.price || approvedData.rate || dbRow.rate || '',
            id
        ];
        await pool.query(updateQueryText, updateValues);

        // Check/Create inventory item with stock = 0 if it doesn't exist
        const partNameToCheck = approvedData.partName || dbRow.part_name || '';
        const itemCheck = await pool.query('SELECT * FROM inventory WHERE part_name ILIKE $1', [partNameToCheck.trim()]);
        if (itemCheck.rows.length === 0) {
            const cleanName = partNameToCheck.trim().substring(0, 5).toUpperCase().replace(/[^A-Z0-9]/g, '');
            const generatedSku = 'GEN-' + cleanName + '-' + Math.floor(Math.random() * 10000);
            
            console.log(`[Inventory Creation] Creating new inventory catalog entry for "${partNameToCheck}" with SKU "${approvedData.sku || generatedSku}", Reg No: "${approvedData.regNo || ''}", stock quantity = 0, rate = ${approvedData.price || approvedData.rate || '0.00'}`);
            
            await pool.query(`
                INSERT INTO inventory (
                    part_name, part_group, material, detail1, detail2, sku, reg_no, vendor, available_qty, price, rate, category
                ) VALUES ($1, $2, $3, $4, '', $5, $6, $7, 0, $8, $8, $9)
            `, [
                partNameToCheck,
                approvedData.machine || dbRow.machine || 'General Compatibility',
                approvedData.material || dbRow.material || '',
                approvedData.size || dbRow.size || '', // detail1
                approvedData.sku || generatedSku,      // P No. (sku)
                approvedData.regNo || dbRow.reg_no || '', // Reg No.
                approvedData.vendor || dbRow.vendor || '',
                parseFloat(approvedData.price || approvedData.rate || dbRow.rate || '0') || 0.00,
                dbRow.category || ''
            ]);
        }

        console.log('Approved demand processed and status set to approved in DB:', partNameToCheck);
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true });
    } catch (err) {
        console.error('Error approving request:', err);
        res.status(500).json({ error: 'Failed to approve demand' });
    }
});

// POST Mark a request as received, increase inventory stock, and write to Google Sheets
app.post('/api/pending/:id/receive', async (req, res) => {
    try {
        const { id } = req.params;

        // Verify item exists in database
        const checkResult = await pool.query('SELECT * FROM pending_requests WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const dbRow = checkResult.rows[0];

        // Print original DB row before receiving to console
        console.log('--- DB ROW BEFORE RECEIVING ---');
        console.log(JSON.stringify(dbRow, null, 2));
        console.log('------------------------------');

        // Set status = 'received', received_at = NOW() in database
        const updateQueryText = `
            UPDATE pending_requests 
            SET status = 'received', received_at = NOW()
            WHERE id = $1
            RETURNING *
        `;
        const updatedRowResult = await pool.query(updateQueryText, [id]);
        const updatedRow = updatedRowResult.rows[0];

        // Increase inventory stock quantity
        const partNameToCheck = dbRow.part_name || '';
        const itemCheck = await pool.query('SELECT * FROM inventory WHERE part_name ILIKE $1', [partNameToCheck.trim()]);
        
        const receivedQtyNum = parseInt((dbRow.qty || '').replace(/[^0-9]/g, ''), 10) || 0;
        if (itemCheck.rows.length > 0) {
            const currentQty = itemCheck.rows[0].available_qty || 0;
            const newQty = currentQty + receivedQtyNum;
            await pool.query('UPDATE inventory SET available_qty = $1 WHERE id = $2', [newQty, itemCheck.rows[0].id]);
            console.log(`[Inventory Stock Update] Increased stock quantity of "${partNameToCheck}" from ${currentQty} to ${newQty}`);
        } else {
            console.warn(`[Inventory Stock Update Warning] No inventory record found for "${partNameToCheck}" to increase stock by ${receivedQtyNum}!`);
        }

        // Construct final historical log and write to Google Sheets
        const finalReceivedRow = {
            partName: dbRow.part_name || '',
            qty: dbRow.qty || '',
            size: dbRow.size || '',
            material: dbRow.material || '',
            machine: dbRow.machine || '',
            vendor: dbRow.vendor || '',
            requestedBy: dbRow.requested_by || '',
            receivedAt: new Date().toISOString(),
            demandTimestamp: dbRow.demand_timestamp ? new Date(dbRow.demand_timestamp).toISOString() : ''
        };

        // Append approved values (columns A-I) to Google Sheets
        const sheets = await getSheetsClient();
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: RANGE,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[
                    finalReceivedRow.partName,
                    finalReceivedRow.qty,
                    finalReceivedRow.size,
                    finalReceivedRow.material,
                    finalReceivedRow.machine,
                    finalReceivedRow.vendor,
                    finalReceivedRow.requestedBy,
                    finalReceivedRow.receivedAt,
                    finalReceivedRow.demandTimestamp
                ]]
            }
        });

        console.log('Received demand written to sheet and stock quantity updated in DB:', finalReceivedRow.partName);
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true });
    } catch (err) {
        console.error('Error marking request as received:', err);
        res.status(500).json({ error: 'Failed to mark request as received' });
    }
});

// POST Edit/Review a pending request and update it in Neon DB (edited_at = NOW())
app.post('/api/pending/:id/edit', async (req, res) => {
    try {
        const { id } = req.params;
        const editData = req.body;

        if (!editData) {
            return res.status(400).json({ error: 'Empty edit payload' });
        }

        const editorRoleName = editData.role === 'manager' ? 'Manager' : 'Reviewer';

        const queryText = `
            UPDATE pending_requests 
            SET part_name = $1, qty = $2, size = $3, material = $4, machine = $5, vendor = $6, rate = $7, 
                edited_by = $8, edited_at = NOW()
            WHERE id = $9
            RETURNING *
        `;

        const values = [
            editData.partName || '',
            editData.qty || '',
            editData.size || '',
            editData.material || '',
            editData.machine || '',
            editData.vendor || '',
            editData.price || editData.rate || '',
            editorRoleName,
            id
        ];

        console.log('--- SQL EDIT PAYLOAD ---');
        console.log('Query:', queryText.trim().replace(/\s+/g, ' '));
        console.log('Parameters:', JSON.stringify(values, null, 2));
        console.log('------------------------');

        const result = await pool.query(queryText, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pending request not found' });
        }

        console.log(`Successfully edited request by ${editorRoleName} and updated in DB:`, result.rows[0].part_name);
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true, item: result.rows[0] });
    } catch (err) {
        console.error('Error editing request in DB:', err);
        res.status(500).json({ error: 'Failed to edit pending request in database' });
    }
});

// POST Forward a pending request from Reviewer stage to Manager stage (status = 'reviewed')
app.post('/api/pending/:id/forward', async (req, res) => {
    try {
        const { id } = req.params;
        const editData = req.body;

        if (!editData) {
            return res.status(400).json({ error: 'Empty payload' });
        }

        const queryText = `
            UPDATE pending_requests 
            SET part_name = $1, qty = $2, size = $3, material = $4, machine = $5, vendor = $6, rate = $7,
                status = 'reviewed', edited_by = 'Reviewer', edited_at = NOW(), forwarded_at = NOW()
            WHERE id = $8
            RETURNING *
        `;

        const values = [
            editData.partName || '',
            editData.qty || '',
            editData.size || '',
            editData.material || '',
            editData.machine || '',
            editData.vendor || '',
            editData.price || editData.rate || '',
            id
        ];

        console.log('--- SQL FORWARD PAYLOAD ---');
        console.log('Query:', queryText.trim().replace(/\s+/g, ' '));
        console.log('Parameters:', JSON.stringify(values, null, 2));
        console.log('---------------------------');

        const result = await pool.query(queryText, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pending request not found' });
        }

        console.log('Successfully forwarded request to Manager stage in DB:', result.rows[0].part_name);
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true, item: result.rows[0] });
    } catch (err) {
        console.error('Error forwarding request in DB:', err);
        res.status(500).json({ error: 'Failed to forward pending request in database' });
    }
});

// POST Reject a pending request (status = 'rejected')
app.post('/api/pending/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query("UPDATE pending_requests SET status = 'rejected' WHERE id = $1 RETURNING part_name", [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pending request not found' });
        }

        console.log('Rejected and updated status to rejected in DB:', result.rows[0].part_name);
        res.json({ success: true });
    } catch (err) {
        console.error('Error rejecting request:', err);
        res.status(500).json({ error: 'Failed to reject pending request' });
    }
});

// -----------------------------------------------------------------------------
// Live Inventory API Endpoints
// -----------------------------------------------------------------------------

// GET Live Inventory with optional machine filtering
app.get('/api/inventory', async (req, res) => {
    try {
        const { machine } = req.query;
        let result;

        console.log(`[Inventory API] Fetching live inventory. Filter: "${machine || 'none'}"`);

        if (machine && machine.trim() !== '') {
            const filterPattern = `%${machine.trim()}%`;
            result = await pool.query(`
                SELECT * FROM inventory 
                WHERE part_name ILIKE $1 
                   OR part_group ILIKE $1 
                   OR product_description ILIKE $1 
                ORDER BY part_name ASC
            `, [filterPattern]);
        } else {
            result = await pool.query('SELECT * FROM inventory ORDER BY part_name ASC');
        }

        // Map database columns to clean properties for the dashboard
        const items = result.rows.map(row => ({
            id: row.id,
            partName: row.part_name || '',
            machine: row.part_group || 'General Compatibility',
            stockQuantity: row.available_qty !== undefined ? row.available_qty : 0,
            unit: row.unit || 'Pcs.',
            size: [row.detail1, row.detail2].filter(Boolean).join(' / ') || '—',
            material: row.material || '—',
            category: row.category || '—',
            sku: row.sku || '',
            regNo: row.reg_no || '—',
            price: row.price || '0.00',
            rate: row.rate !== null && row.rate !== undefined ? row.rate : (row.price || '0.00'),
            vendor: row.vendor || '—'
        }));


        console.log(`[Inventory API] Returned ${items.length} matched inventory records.`);
        res.json(items);
    } catch (err) {
        console.error('Error fetching live inventory from DB:', err);
        res.status(500).json({ error: 'Failed to retrieve live inventory database' });
    }
});

// POST Trigger Excel import to reload inventory
app.post('/api/inventory/reload', async (req, res) => {
    try {
        console.log('Admin triggered inventory reload via API...');

        const { dbInit } = require('./dbInit');

        await dbInit();

        res.json({
            success: true,
            message: 'Inventory database reloaded from Excel file successfully'
        });

    } catch (err) {

        console.error('Error reloading inventory:', err);

        res.status(500).json({
            error: 'Failed to reload inventory database'
        });
    }
});

const bcrypt = require('bcrypt');

// POST Login verification using profiles in users.json and bcrypt
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const usersData = fs.readFileSync(path.join(__dirname, 'users.json'), 'utf8');
        const users = JSON.parse(usersData);

        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log(`[Authentication] User "${user.username}" logged in successfully under role "${user.role}"`);
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                displayName: user.displayName
            }
        });
    } catch (err) {
        console.error('Error during login API handler:', err);
        res.status(500).json({ error: 'Internal server login error' });
    }
});

// Fetch saved voice notes library
app.get('/api/voice-notes', (req, res) => {
    try {
        const files = fs.readdirSync(__dirname);
        const voiceNotes = files
            .filter(file => file.startsWith('voice_') && file.endsWith('.ogg'))
            .map(file => {
                const timestampStr = file.replace('voice_', '').replace('.ogg', '');
                const timestamp = parseInt(timestampStr, 10);
                const stats = fs.statSync(path.join(__dirname, file));
                return {
                    filename: file,
                    url: `/audio/${file}`,
                    timestamp: timestamp,
                    date: isNaN(timestamp) ? stats.birthtime : new Date(timestamp),
                    sizeBytes: stats.size
                };
            })
            // Sort newest first
            .sort((a, b) => b.timestamp - a.timestamp);

        res.json(voiceNotes);
    } catch (err) {
        console.error('Error listing voice notes:', err);
        res.status(500).json({ error: 'Failed to scan voice notes' });
    }
});

// WhatsApp Integration API Endpoints
app.get('/api/whatsapp/status', (req, res) => {
    res.json({
        status: whatsappStatus.status,
        qr: whatsappStatus.qr,
        qrDataUrl: whatsappStatus.qrDataUrl,
        phone: whatsappStatus.phone,
        pushname: whatsappStatus.pushname,
        lastConnected: whatsappStatus.lastConnected,
        initAttempt: whatsappStatus.initAttempt
    });
});

// Instant QR image endpoint (returns base64 PNG data URL)
app.get('/api/whatsapp/qr-image', async (req, res) => {
    if (!whatsappStatus.qr) {
        return res.status(404).json({ error: 'No QR code available', status: whatsappStatus.status });
    }
    try {
        const dataUrl = await QRCode.toDataURL(whatsappStatus.qr, {
            width: 300,
            margin: 2,
            color: { dark: '#0f172a', light: '#ffffff' }
        });
        res.json({ qrDataUrl: dataUrl });
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate QR image' });
    }
});

// Debug endpoint to diagnose chat loading issues
app.get('/api/whatsapp/debug-chats', async (req, res) => {
    try {
        if (whatsappStatus.status !== 'connected') {
            return res.json({ error: 'Not connected', status: whatsappStatus.status });
        }
        const chats = await whatsappClient.getChats();
        const summary = chats.map(c => ({
            name: c.name || c.id?._serialized || 'Unknown',
            isGroup: c.isGroup,
            id: c.id?._serialized
        }));
        const groups = summary.filter(c => c.isGroup);
        res.json({
            totalChats: chats.length,
            totalGroups: groups.length,
            groups: groups,
            sampleChats: summary.slice(0, 10)
        });
    } catch (err) {
        res.json({ error: err.message });
    }
});

app.get('/api/whatsapp/groups', async (req, res) => {
    try {
        // 1. Get groups from DB (gracefully handle DB errors)
        let dbGroups = [];
        const dbMap = new Map();
        try {
            const dbResult = await pool.query('SELECT * FROM whatsapp_groups');
            dbGroups = dbResult.rows;
            dbGroups.forEach(g => {
                dbMap.set(g.group_id, { name: g.group_name, active: g.active });
            });
            console.log(`[WhatsApp Groups] Loaded ${dbGroups.length} groups from database.`);
        } catch (dbErr) {
            console.error('[WhatsApp Groups] DB query failed (continuing with live chats only):', dbErr.message);
        }

        let combinedGroups = [];

        // 2. Get live chats if connected
        if (whatsappStatus.status === 'connected') {
            try {
                // Prevent overlapping getChats calls and cache results for 30s
                if (!global.whatsappChatsCache) {
                    global.whatsappChatsCache = { data: [], lastFetch: 0, fetching: false };
                }
                
                const now = Date.now();
                if (now - global.whatsappChatsCache.lastFetch > 30000 && !global.whatsappChatsCache.fetching) {
                    global.whatsappChatsCache.fetching = true;
                    console.log('[WhatsApp Groups] Fetching live chats from WhatsApp client (uncached)...');
                    
                    // Fire and forget or await with timeout
                    whatsappClient.getChats().then(chats => {
                        console.log(`[WhatsApp Groups] Total chats fetched: ${chats.length}`);
                        global.whatsappChatsCache.data = chats.filter(c => c.isGroup);
                        global.whatsappChatsCache.lastFetch = Date.now();
                        global.whatsappChatsCache.fetching = false;
                        console.log(`[WhatsApp Groups] Group chats found and cached: ${global.whatsappChatsCache.data.length}`);
                    }).catch(err => {
                        console.error('[WhatsApp Groups] Error fetching live chats:', err.message);
                        global.whatsappChatsCache.fetching = false;
                    });
                }
                
                // Use cached group chats
                const groupChats = global.whatsappChatsCache.data || [];
                
                groupChats.forEach(chat => {
                    const dbEntry = dbMap.get(chat.id._serialized);
                    combinedGroups.push({
                        id: chat.id._serialized,
                        name: chat.name || dbEntry?.name || 'Unnamed Group',
                        active: dbEntry ? dbEntry.active : false
                    });
                    dbMap.delete(chat.id._serialized);
                });
            } catch (clientErr) {
                console.error('[WhatsApp Groups] Error processing live chats:', clientErr.message);
            }
        } else {
            console.log(`[WhatsApp Groups] WhatsApp not connected (status: ${whatsappStatus.status}), skipping live chat fetch.`);
        }

        // 3. For anything remaining in the DB (historical groups not in recent chats)
        dbMap.forEach((val, key) => {
            combinedGroups.push({
                id: key,
                name: val.name || 'Unnamed Group',
                active: val.active
            });
        });

        console.log(`[WhatsApp Groups] Returning ${combinedGroups.length} total groups to frontend.`);
        res.json({
            groups: combinedGroups,
            isSyncing: global.whatsappChatsCache ? global.whatsappChatsCache.fetching : false
        });
    } catch (err) {
        console.error('Error in GET /api/whatsapp/groups:', err);
        // Return empty array instead of 500 to prevent frontend from breaking
        res.json({ groups: [], isSyncing: false });
    }
});

app.post('/api/whatsapp/groups/active', async (req, res) => {
    try {
        const { groupId, active, name } = req.body;
        if (!groupId) {
            return res.status(400).json({ error: 'groupId is required' });
        }
        const targetActive = !!active;
        const targetName = name || 'Unnamed Group';

        const queryText = `
            INSERT INTO whatsapp_groups (group_id, group_name, active)
            VALUES ($1, $2, $3)
            ON CONFLICT (group_id) 
            DO UPDATE SET active = EXCLUDED.active, group_name = EXCLUDED.group_name
            RETURNING *
        `;
        const result = await pool.query(queryText, [groupId, targetName, targetActive]);
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true, group: result.rows[0] });
    } catch (err) {
        console.error('Error in POST /api/whatsapp/groups/active:', err);
        res.status(500).json({ error: 'Failed to update WhatsApp group active state' });
    }
});

app.post('/api/whatsapp/logout', async (req, res) => {
    try {
        console.log('[WhatsApp Admin] Logging out WhatsApp client manually...');
        clearAuthTimeout();
        
        whatsappStatus.status = 'disconnected';
        whatsappStatus.qr = null;
        whatsappStatus.qrDataUrl = null;
        whatsappStatus.phone = null;
        whatsappStatus.pushname = null;
        whatsappStatus.lastStateChange = Date.now();

        if (whatsappClient) {
            try { await whatsappClient.logout(); } catch (e) {
                console.log('Client logout notice:', e.message);
            }
            try { whatsappClient.end(new Error('Manual Logout')); } catch (e) { /* ignore */ }
        }

        // Delete auth session so a fresh QR is generated
        const authPath = path.join(__dirname, '.auth_info_baileys');
        if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
        
        // Respond immediately, init in background
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true, message: 'Logged out. Generating new QR code...' });
        setTimeout(() => safeInitialize(), 2000);
    } catch (err) {
        console.error('Error logging out WhatsApp client:', err);
        res.status(500).json({ error: 'Failed to logout client', details: err.message });
    }
});

app.post('/api/whatsapp/reconnect', async (req, res) => {
    try {
        console.log('[WhatsApp Admin] Re-initializing WhatsApp client manually...');
        clearAuthTimeout();
        
        whatsappStatus.status = 'initializing';
        whatsappStatus.qr = null;
        whatsappStatus.qrDataUrl = null;
        whatsappStatus.lastStateChange = Date.now();
        
        if (whatsappClient) {
            try { whatsappClient.end(new Error('Manual Reconnect')); } catch (e) { /* ignore */ }
        }
        
        // Respond immediately, init in background
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true, message: 'Re-initialization started. QR code will appear shortly.' });
        setTimeout(() => safeInitialize(), 2000);
    } catch (err) {
        console.error('Error re-initializing WhatsApp client:', err);
        res.status(500).json({ error: 'Failed to re-initialize client', details: err.message });
    }
});

// Serve frontend in production (compiled dist folder)
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*splat', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

// =============================================================================
// WhatsApp Bot Event Listeners & Simulation Endpoint
// =============================================================================

// POST Simulate an incoming WhatsApp message for developer testing without launching a browser
app.post('/api/test/simulate-message', async (req, res) => {
    try {
        const { text, senderName, isAudio, audioFilename } = req.body;
        const resolvedSender = senderName || 'Mock WhatsApp Tester';

        console.log('--- MOCK MESSAGE SIMULATION TRIGGERED ---');
        console.log('Sender:', resolvedSender);
        console.log('Type:', isAudio ? 'Audio Note' : 'Text Message');
        console.log('Content:', isAudio ? `File: ${audioFilename}` : text);
        console.log('-----------------------------------------');

        let extractedItems = [];

        if (isAudio) {
            if (!audioFilename) {
                return res.status(400).json({ error: 'audioFilename parameter is required for audio mock' });
            }
            const filePath = path.join(__dirname, audioFilename);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: `Mock audio file not found at: ${filePath}` });
            }
            extractedItems = await processAudio(filePath);
        } else {
            if (!text || text.trim() === '') {
                return res.status(400).json({ error: 'text parameter is required for text mock' });
            }
            extractedItems = await processText(text);
        }

        console.log('Simulation AI parsed results:', JSON.stringify(extractedItems, null, 2));

        const savedResults = [];
        for (const item of extractedItems) {
            const dbResult = await savePendingRequest(item, resolvedSender);
            savedResults.push({
                item,
                dbResult
            });
        }

        res.json({
            success: true,
            sender: resolvedSender,
            extractedCount: extractedItems.length,
            results: savedResults
        });
    } catch (err) {
        console.error('Error during message simulation API:', err);
        res.status(500).json({ error: 'Failed to simulate message processing', details: err.message });
    }
});

function setupBaileysEvents(sock) {
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('==================================================');
            console.log('  Scan QR Code below to connect WhatsApp:');
            console.log('==================================================');
            qrTerminal.generate(qr, { small: true });

            clearAuthTimeout();
            whatsappStatus.status = 'qr';
            whatsappStatus.qr = qr;
            whatsappStatus.phone = null;
            whatsappStatus.pushname = null;
            whatsappStatus.lastStateChange = Date.now();

            try {
                whatsappStatus.qrDataUrl = await QRCode.toDataURL(qr, {
                    width: 512, margin: 3,
                    errorCorrectionLevel: 'M',
                    color: { dark: '#000000', light: '#ffffff' }
                });
                console.log('[WhatsApp] QR data URL generated locally (instant)');
                if (global.io) global.io.emit('dashboard_update');
            } catch (err) {
                console.error('[WhatsApp] QR image generation failed:', err.message);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('[WhatsApp] Connection closed due to', lastDisconnect?.error?.message || lastDisconnect?.error, 'reconnecting:', shouldReconnect);
            
            clearAuthTimeout();
            whatsappStatus.status = 'disconnected';
            whatsappStatus.qr = null;
            whatsappStatus.qrDataUrl = null;
            whatsappStatus.phone = null;
            whatsappStatus.pushname = null;
            whatsappStatus.lastStateChange = Date.now();
            if (global.io) global.io.emit('dashboard_update');

            if (shouldReconnect) {
                safeInitialize();
            } else {
                console.log('[WhatsApp] Connection closed. You are logged out. Generating new QR...');
                const authPath = path.join(__dirname, '.auth_info_baileys');
                if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
                // Auto-generate a new QR after logout so user can re-scan
                setTimeout(() => safeInitialize(), 2000);
            }
        } else if (connection === 'open') {
            console.log('==================================================');
            console.log('  WhatsApp Connected & ready for message events!');
            console.log('==================================================');
            clearAuthTimeout();
            whatsappStatus.status = 'connected';
            whatsappStatus.qr = null;
            whatsappStatus.qrDataUrl = null;
            whatsappStatus.lastConnected = new Date().toISOString();
            whatsappStatus.lastStateChange = Date.now();
            whatsappStatus.phone = sock.user?.id?.split(':')[0] || null;
            whatsappStatus.pushname = sock.user?.name || null;
            whatsappStatus.initAttempt = 0;
            if (global.io) global.io.emit('dashboard_update');
        }
    });

    const processedMessageIds = new Set();

    sock.ev.on('messages.upsert', async (m) => {
        try {
            if (m.type !== 'notify') return;
            for (const msg of m.messages) {
                if (!msg.message || msg.key.fromMe) continue;
                
                const jid = msg.key.remoteJid;
                if (!isJidGroup(jid)) continue;

                if (msg.key.id) {
                    if (processedMessageIds.has(msg.key.id)) continue;
                    processedMessageIds.add(msg.key.id);
                    if (processedMessageIds.size > 1000) {
                        const iterator = processedMessageIds.values();
                        processedMessageIds.delete(iterator.next().value);
                    }
                }

                // Query database to see if this group is active
                const activeCheck = await pool.query(
                    'SELECT 1 FROM whatsapp_groups WHERE group_id = $1 AND active = TRUE',
                    [jid]
                );
                if (activeCheck.rows.length === 0) continue;

                let senderName = msg.pushName || msg.key.participant?.split('@')[0] || 'WhatsApp User';
                senderName = senderName.toString().trim();

                console.log("\n==================");
                console.log("Factory Group JID:", jid);
                console.log("Resolved Sender JID:", senderName);
                console.log("==================");

                const messageType = Object.keys(msg.message)[0];
                const textBody = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

                if (textBody && textBody.trim() !== "") {
                    console.log("Text:", textBody);
                    const items = await processText(textBody);
                    console.log("\nExtracted:", items);
                    for (const item of items) {
                        console.log(`[WhatsApp Bot] Dispatching text request directly to DB. Sender: "${senderName}"`);
                        await savePendingRequest(item, senderName);
                    }
                } else if (messageType === 'audioMessage' || messageType === 'ptvMessage') {
                    console.log("Voice note received");
                    const buffer = await downloadMediaMessage(msg, 'buffer', { }, { logger: pino({ level: 'silent' }) });
                    const filename = `voice_${Date.now()}.ogg`;
                    fs.writeFileSync(filename, buffer);
                    console.log("Saved audio file:", filename);

                    const items = await processAudio(filename);
                    console.log("\nExtracted:", items);

                    for (const item of items) {
                        console.log(`[WhatsApp Bot] Dispatching audio request directly to DB. Sender: "${senderName}"`);
                        await savePendingRequest(item, senderName);
                    }

                    try { fs.unlinkSync(filename); } catch (cleanupErr) {
                        console.error("Error cleaning up audio file:", cleanupErr.message);
                    }
                }
            }
        } catch (err) {
            console.log("\nERROR inside messages.upsert listener:", err);
        }
    });
}

// Start Server
httpServer.listen(PORT, async () => {
    console.log(`==================================================`);
    console.log(`  Express Dashboard Backend running on port ${PORT}`);
    console.log(`  API Access: http://localhost:${PORT}/api/requests`);
    console.log(`==================================================`);
    
    // Ensure whatsapp_groups table exists
    await ensureWhatsappGroupsTable();
    
    // Start WhatsApp Bot Singleton in the same process!
    console.log('Initializing WhatsApp Client singleton...');
    safeInitialize();
});
