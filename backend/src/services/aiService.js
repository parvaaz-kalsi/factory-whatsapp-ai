const fs = require('fs');
const genAI = require('../config/gemini');
const prisma = require('../config/db');
const standardizeUnit = require('../utils/unitStandardizer');

// Gemini API Rate Limit Tracker (15 RPM Free Tier limit)
let geminiRequestTimestamps = [];
let lastBroadcastLimit = -1;
const GEMINI_RPM_LIMIT = 15;

function getApiLimitInfo() {
    return { count: geminiRequestTimestamps.length, limit: GEMINI_RPM_LIMIT };
}

function decayTimestamps() {
    const now = Date.now();
    geminiRequestTimestamps = geminiRequestTimestamps.filter(t => now - t < 60000);
    const currentCount = geminiRequestTimestamps.length;

    if (currentCount !== lastBroadcastLimit && global.io) {
        global.io.emit('api_limit_update', { count: currentCount, limit: GEMINI_RPM_LIMIT });
        lastBroadcastLimit = currentCount;
    }
}

async function fetchInventoryContext() {
    try {
        const rows = await prisma.inventory.findMany({
            select: {
                part_name: true,
                sku: true,
                material: true,
                detail1: true,
                detail2: true,
                available_qty: true,
                unit: true,
                price: true,
                vendor: true
            },
            orderBy: { part_name: 'asc' }
        });
        
        let context = "Master Inventory (Part Name | SKU | Material | Size Details | Stock Qty | Unit | Price | Preferred Vendor):\n";
        rows.forEach(row => {
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
    const models = ["gemini-2.5-flash", "gemini-2.5-pro"];
    const maxRetries = 3;
    const delays = [2000, 4000, 6000];

    for (const modelName of models) {
        console.log(`Attempting Gemini request using model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
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
                    // Track successful request for RPM limiting
                    geminiRequestTimestamps.push(Date.now());
                    if (global.io) {
                        lastBroadcastLimit = geminiRequestTimestamps.length;
                        global.io.emit('api_limit_update', { count: lastBroadcastLimit, limit: GEMINI_RPM_LIMIT });
                    }
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

function buildPrompt(inventoryContext, contentPlaceholder, isAudio = false) {
    const mediaType = isAudio ? 'audio' : 'message';
    const extraCheck = isAudio 
        ? 'If the audio is empty, contains only background noise, silence, or just random chatter'
        : 'If the message is empty, unintelligible, gibberish, or just random chatter';

    return `
CRITICAL INSTRUCTION: First, determine if the ${mediaType} contains a clear, deliberate request for a factory machine part, tool, or material. 
${extraCheck}, you MUST IMMEDIATELY return an empty JSON array: []

Only if there is a valid request, proceed with the following:
Translate to English.

The message may contain ONE or MULTIPLE items/parts being requested by factory workers.
Cross-reference each request against the provided company's Master Inventory List below.

INVENTORY MATCHING RULES:
1. You MUST extract the EXACT item name the worker requested into the "Part Name" field (translate to English if needed). Do NOT forcefully change their requested name to an inventory item.
2. Cross-reference the requested item against the Master Inventory. If there is a very similar or exact matching item:
   - Put the inventory item's exact name in the "suggestedMatch" field.
   - Populate "SKU" with the inventory's SKU.
   - Populate "Size", "Material", and "Vendor" with details from the matched inventory item if not explicitly overridden by the worker's message.
   - Populate "Available Stock", "Price", and "Category" from the matched inventory item.
   - If the requested quantity (Qty Required) exceeds the matched inventory item's stock (Stock), generate a detailed warning in the "stockWarning" field (e.g., "Requested 5, but only 2 available in stock").
3. If no match is found:
   - Perform standard extraction (leave SKU, Available Stock, Price, stockWarning, and suggestedMatch empty).

MASTER INVENTORY:
${inventoryContext}

For EACH item extract:
- Part Name (The exact name the worker asked for, translated to English)
- SKU (blank if not matched)
- Qty Required (strictly a plain number only, NO units, e.g., "1", "20.5")
- Unit (extract the unit separately, e.g., "pcs", "meter", "kg", "box". Blank if not matched/specified)
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
- CRITICAL: "Qty Required" must be STRICTLY numeric. Do NOT include any units in this field.
- CRITICAL: If the ${mediaType} is empty, ${isAudio ? 'just background noise, ' : ''}gibberish, or does NOT explicitly request a factory machine part, tool, or material, you MUST return an empty JSON array: []

Return ONLY a raw JSON array with NO markdown, NO code fences, NO explanation.
Example format:
[
  {
    "Part Name": "",
    "SKU": "",
    "Qty Required": "",
    "Unit": "",
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

${contentPlaceholder}`;
}

function makeFallbackItem(raw) {
    return {
        "Part Name": raw,
        "SKU": "",
        "Qty Required": "",
        "Unit": "",
        "Size": "",
        "Material": "",
        "Category": "",
        "For Machine": "",
        "Vendor": "",
        "Price": "",
        "Available Stock": "",
        "stockWarning": "",
        "suggestedMatch": ""
    };
}

async function processText(text) {
    const inventoryContext = await fetchInventoryContext();
    const prompt = buildPrompt(inventoryContext, `Message:\n${text}`, false);

    const raw = await generateWithRetry(prompt, false, null);
    if (!raw) {
        console.error("Gemini failed completely after retries and fallback. Skipping text request safely.");
        return [];
    }

    console.log("RAW GEMINI RESPONSE (text):", raw);
    const parsed = extractJsonFromResponse(raw);
    if (parsed) return parsed;

    console.log("PARSE FAILED. Raw:", raw);
    return [makeFallbackItem(raw)];
}

async function processAudio(filename) {
    const inventoryContext = await fetchInventoryContext();
    const audioBase64 = fs.readFileSync(filename).toString('base64');
    const prompt = buildPrompt(inventoryContext, '', true);

    const raw = await generateWithRetry(prompt, true, audioBase64);
    if (!raw) {
        console.error("Gemini failed completely after retries and fallback. Skipping audio request safely.");
        return [];
    }

    console.log("RAW GEMINI RESPONSE (audio):", raw);
    const parsed = extractJsonFromResponse(raw);
    if (parsed) return parsed;

    console.log("PARSE FAILED. Raw:", raw);
    return [makeFallbackItem(raw)];
}

async function savePendingRequest(item, senderName = 'WhatsApp User') {
    try {
        const id = Date.now() + '-' + Math.floor(Math.random() * 1000);
        const receivedAt = new Date();

        await prisma.pending_requests.create({
            data: {
                id,
                part_name: item["Part Name"] || item.partName || '',
                qty: String(item["Qty Required"] || item.qty || '').replace(/[^\d.]/g, ''),
                size: item["Size"] || item.size || '',
                material: item["Material"] || item.material || '',
                machine: item["For Machine"] || item.machine || '',
                vendor: item["Vendor"] || item.vendor || '',
                requested_by: senderName,
                demand_timestamp: new Date(),
                received_at: receivedAt,
                rate: item["Price"] || item.price || '',
                status: 'pending_review',
                unit: standardizeUnit(item["Unit"] || item.unit || '')
            }
        });

        console.log(`Saved pending request successfully inside NeonDB: ID=${id}`);
        if (global.io) global.io.emit('dashboard_update');
        return { success: true, id };
    } catch (err) {
        console.error('Error saving pending request directly to DB:', err);
        return { success: false, error: err.message };
    }
}

module.exports = {
    processText,
    processAudio,
    savePendingRequest,
    getApiLimitInfo,
    decayTimestamps,
    GEMINI_RPM_LIMIT
};
