const pool = require('../config/db');
const { getSheetRows, appendToSheet } = require('../services/googleSheetsService');
const { processText, processAudio, savePendingRequest } = require('../services/aiService');
const fs = require('fs');
const path = require('path');

// --------------------------------------------------
// Helpers
// --------------------------------------------------
async function findInventoryMatch(partName, sku) {
    try {
        if (sku && sku.trim() !== '') {
            const res = await pool.query('SELECT * FROM inventory WHERE sku = $1', [sku.trim()]);
            if (res.rows.length > 0) return res.rows[0];
        }
        if (partName && partName.trim() !== '') {
            const trimmed = partName.trim();
            const resExact = await pool.query('SELECT * FROM inventory WHERE part_name ILIKE $1', [trimmed]);
            if (resExact.rows.length > 0) return resExact.rows[0];

            const resFuzzy1 = await pool.query('SELECT * FROM inventory WHERE part_name ILIKE $1 OR product_description ILIKE $1 LIMIT 1', [`%${trimmed}%`]);
            if (resFuzzy1.rows.length > 0) return resFuzzy1.rows[0];

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

// --------------------------------------------------
// GET /api/requests – Approved requests from Google Sheets
// --------------------------------------------------
exports.getApprovedRequests = async (req, res) => {
    try {
        const rows = await getSheetRows();
        if (rows.length === 0) return res.json([]);

        const dataRows = rows.slice(1);
        const requests = dataRows.map((row, index) => ({
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
        })).filter(item => item.partName || item.qty || item.machine);

        console.log('--- API RESPONSE SENT TO APPROVED SECTION ---');
        console.log('Total Approved Requests:', requests.length);
        console.log('---------------------------------------------');
        res.json(requests);
    } catch (err) {
        console.error('Error fetching sheet rows:', err);
        res.status(500).json({ error: 'Failed to fetch data from Google Sheets' });
    }
};

// --------------------------------------------------
// GET /api/pending
// --------------------------------------------------
exports.getPending = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM pending_requests WHERE status IS NULL OR status IN ('pending_review', 'reviewed', 'approved') ORDER BY demand_timestamp DESC");

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
                availableStock,
                stockWarning,
                suggestedMatch,
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
};

// --------------------------------------------------
// POST /api/pending
// --------------------------------------------------
exports.createPending = async (req, res) => {
    try {
        const item = req.body;
        if (!item) return res.status(400).json({ error: 'Empty payload' });

        const id = Date.now() + '-' + Math.floor(Math.random() * 1000);
        const receivedAt = new Date().toISOString();

        const queryText = `
            INSERT INTO pending_requests (
                id, part_name, qty, size, material, machine, vendor, requested_by, 
                demand_timestamp, received_at, rate, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11)
        `;

        const values = [id, item.partName || '', item.qty || '', item.size || '', item.material || '',
            item.machine || '', item.vendor || '', item.requestedBy || 'WhatsApp User',
            receivedAt, item.price || '', 'pending_review'];

        await pool.query(queryText, values);

        const newItem = { id, partName: item.partName || '', qty: item.qty || '', size: item.size || '',
            material: item.material || '', machine: item.machine || '', vendor: item.vendor || '',
            requestedBy: item.requestedBy || 'WhatsApp User', receivedAt,
            sku: item.sku || '', category: item.category || '', price: item.price || '',
            availableStock: item.availableStock || '', stockWarning: item.stockWarning || '',
            suggestedMatch: item.suggestedMatch || '' };

        console.log('Queued pending WhatsApp demand request to DB:', newItem.partName);
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true, item: newItem });
    } catch (err) {
        console.error('Error queuing request to DB:', err);
        res.status(500).json({ error: 'Failed to queue pending request' });
    }
};

// --------------------------------------------------
// POST /api/pending/:id/approve
// --------------------------------------------------
exports.approve = async (req, res) => {
    try {
        const { id } = req.params;
        const approvedData = req.body;

        const checkResult = await pool.query('SELECT * FROM pending_requests WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) return res.status(404).json({ error: 'Pending request not found' });

        const dbRow = checkResult.rows[0];

        const updateQueryText = `
            UPDATE pending_requests 
            SET status = 'approved', approved_by = 'Manager', approved_at = NOW(),
                part_name = $1, qty = $2, size = $3, material = $4, machine = $5, vendor = $6, rate = $7
            WHERE id = $8
            RETURNING *
        `;
        const updateValues = [
            approvedData.partName || dbRow.part_name || '', approvedData.qty || dbRow.qty || '',
            approvedData.size || dbRow.size || '', approvedData.material || dbRow.material || '',
            approvedData.machine || dbRow.machine || '', approvedData.vendor || dbRow.vendor || '',
            approvedData.price || approvedData.rate || dbRow.rate || '', id
        ];
        await pool.query(updateQueryText, updateValues);

        // Check/Create inventory item with stock = 0 if it doesn't exist
        const partNameToCheck = approvedData.partName || dbRow.part_name || '';
        const itemCheck = await pool.query('SELECT * FROM inventory WHERE part_name ILIKE $1', [partNameToCheck.trim()]);
        if (itemCheck.rows.length === 0) {
            const cleanName = partNameToCheck.trim().substring(0, 5).toUpperCase().replace(/[^A-Z0-9]/g, '');
            const generatedSku = 'GEN-' + cleanName + '-' + Math.floor(Math.random() * 10000);

            await pool.query(`
                INSERT INTO inventory (
                    part_name, part_group, material, detail1, detail2, sku, reg_no, vendor, available_qty, price, rate, category
                ) VALUES ($1, $2, $3, $4, '', $5, $6, $7, 0, $8, $8, $9)
            `, [
                partNameToCheck,
                approvedData.machine || dbRow.machine || 'General Compatibility',
                approvedData.material || dbRow.material || '',
                approvedData.size || dbRow.size || '',
                approvedData.sku || generatedSku,
                approvedData.regNo || dbRow.reg_no || '',
                approvedData.vendor || dbRow.vendor || '',
                parseFloat(approvedData.price || approvedData.rate || dbRow.rate || '0') || 0.00,
                dbRow.category || ''
            ]);
        }

        console.log('Approved demand processed:', partNameToCheck);
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true });
    } catch (err) {
        console.error('Error approving request:', err);
        res.status(500).json({ error: 'Failed to approve demand' });
    }
};

// --------------------------------------------------
// POST /api/pending/:id/receive
// --------------------------------------------------
exports.receive = async (req, res) => {
    try {
        const { id } = req.params;

        const checkResult = await pool.query('SELECT * FROM pending_requests WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) return res.status(404).json({ error: 'Request not found' });

        const dbRow = checkResult.rows[0];

        await pool.query(`UPDATE pending_requests SET status = 'received', received_at = NOW() WHERE id = $1`, [id]);

        // Increase inventory stock quantity
        const partNameToCheck = dbRow.part_name || '';
        const itemCheck = await pool.query('SELECT * FROM inventory WHERE part_name ILIKE $1', [partNameToCheck.trim()]);
        const receivedQtyNum = parseInt((dbRow.qty || '').replace(/[^0-9]/g, ''), 10) || 0;

        if (itemCheck.rows.length > 0) {
            const currentQty = itemCheck.rows[0].available_qty || 0;
            const newQty = currentQty + receivedQtyNum;
            await pool.query('UPDATE inventory SET available_qty = $1 WHERE id = $2', [newQty, itemCheck.rows[0].id]);
            console.log(`[Inventory Stock Update] Increased stock of "${partNameToCheck}" from ${currentQty} to ${newQty}`);
        }

        // Write to Google Sheets
        const finalReceivedRow = {
            partName: dbRow.part_name || '', qty: dbRow.qty || '', size: dbRow.size || '',
            material: dbRow.material || '', machine: dbRow.machine || '', vendor: dbRow.vendor || '',
            requestedBy: dbRow.requested_by || '', receivedAt: new Date().toISOString(),
            demandTimestamp: dbRow.demand_timestamp ? new Date(dbRow.demand_timestamp).toISOString() : ''
        };
        await appendToSheet(finalReceivedRow);

        console.log('Received demand written to sheet and stock updated:', finalReceivedRow.partName);
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true });
    } catch (err) {
        console.error('Error marking request as received:', err);
        res.status(500).json({ error: 'Failed to mark request as received' });
    }
};

// --------------------------------------------------
// POST /api/pending/:id/edit
// --------------------------------------------------
exports.edit = async (req, res) => {
    try {
        const { id } = req.params;
        const editData = req.body;
        if (!editData) return res.status(400).json({ error: 'Empty edit payload' });

        const editorRoleName = editData.role === 'manager' ? 'Manager' : 'Reviewer';

        const queryText = `
            UPDATE pending_requests 
            SET part_name = $1, qty = $2, size = $3, material = $4, machine = $5, vendor = $6, rate = $7, 
                edited_by = $8, edited_at = NOW()
            WHERE id = $9
            RETURNING *
        `;
        const values = [editData.partName || '', editData.qty || '', editData.size || '',
            editData.material || '', editData.machine || '', editData.vendor || '',
            editData.price || editData.rate || '', editorRoleName, id];

        const result = await pool.query(queryText, values);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Pending request not found' });

        console.log(`Edited request by ${editorRoleName}:`, result.rows[0].part_name);
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true, item: result.rows[0] });
    } catch (err) {
        console.error('Error editing request in DB:', err);
        res.status(500).json({ error: 'Failed to edit pending request in database' });
    }
};

// --------------------------------------------------
// POST /api/pending/:id/forward
// --------------------------------------------------
exports.forward = async (req, res) => {
    try {
        const { id } = req.params;
        const editData = req.body;
        if (!editData) return res.status(400).json({ error: 'Empty payload' });

        const queryText = `
            UPDATE pending_requests 
            SET part_name = $1, qty = $2, size = $3, material = $4, machine = $5, vendor = $6, rate = $7,
                status = 'reviewed', edited_by = 'Reviewer', edited_at = NOW(), forwarded_at = NOW()
            WHERE id = $8
            RETURNING *
        `;
        const values = [editData.partName || '', editData.qty || '', editData.size || '',
            editData.material || '', editData.machine || '', editData.vendor || '',
            editData.price || editData.rate || '', id];

        const result = await pool.query(queryText, values);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Pending request not found' });

        console.log('Forwarded request to Manager stage:', result.rows[0].part_name);
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true, item: result.rows[0] });
    } catch (err) {
        console.error('Error forwarding request in DB:', err);
        res.status(500).json({ error: 'Failed to forward pending request in database' });
    }
};

// --------------------------------------------------
// POST /api/pending/:id/reject
// --------------------------------------------------
exports.reject = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("UPDATE pending_requests SET status = 'rejected' WHERE id = $1 RETURNING part_name", [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Pending request not found' });

        console.log('Rejected:', result.rows[0].part_name);
        res.json({ success: true });
    } catch (err) {
        console.error('Error rejecting request:', err);
        res.status(500).json({ error: 'Failed to reject pending request' });
    }
};

// --------------------------------------------------
// POST /api/test/simulate-message
// --------------------------------------------------
exports.simulateMessage = async (req, res) => {
    try {
        const { text, senderName, isAudio, audioFilename } = req.body;
        const resolvedSender = senderName || 'Mock WhatsApp Tester';

        console.log('--- MOCK MESSAGE SIMULATION TRIGGERED ---');
        let extractedItems = [];

        if (isAudio) {
            if (!audioFilename) return res.status(400).json({ error: 'audioFilename parameter is required for audio mock' });
            const filePath = path.join(process.cwd(), audioFilename);
            if (!fs.existsSync(filePath)) return res.status(404).json({ error: `Mock audio file not found at: ${filePath}` });
            extractedItems = await processAudio(filePath);
        } else {
            if (!text || text.trim() === '') return res.status(400).json({ error: 'text parameter is required for text mock' });
            extractedItems = await processText(text);
        }

        const savedResults = [];
        for (const item of extractedItems) {
            const dbResult = await savePendingRequest(item, resolvedSender);
            savedResults.push({ item, dbResult });
        }

        res.json({ success: true, sender: resolvedSender, extractedCount: extractedItems.length, results: savedResults });
    } catch (err) {
        console.error('Error during message simulation API:', err);
        res.status(500).json({ error: 'Failed to simulate message processing', details: err.message });
    }
};
