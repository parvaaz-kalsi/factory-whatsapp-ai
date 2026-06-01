const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Neon DB Postgres Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});


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

// Serve frontend in production (compiled dist folder)
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*splat', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

// Start Server
app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`  Express Dashboard Backend running on port ${PORT}`);
    console.log(`  API Access: http://localhost:${PORT}/api/requests`);
    console.log(`==================================================`);
});
