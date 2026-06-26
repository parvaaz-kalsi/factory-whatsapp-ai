const prisma = require('../config/db');
const { getSheetRows, appendToSheet } = require('../services/googleSheetsService');
const { processText, processAudio, savePendingRequest } = require('../services/aiService');
const fs = require('fs');
const path = require('path');

// --------------------------------------------------
// GET /api/requests – Approved requests from Google Sheets
// --------------------------------------------------
exports.getApprovedRequests = async (req, res) => {
    try {
        // Primary: Fetch received items from the database
        const dbResult = await prisma.pending_requests.findMany({
            where: { status: 'received' },
            orderBy: { demand_timestamp: 'desc' }
        });
        
        let requests = dbResult.map((row) => ({
            id: row.id,
            partName: row.part_name || '',
            qty: row.qty || '',
            size: row.size || '',
            material: row.material || '',
            machine: row.machine || '',
            vendor: row.vendor || '',
            requestedBy: row.requested_by || '',
            receivedAt: row.received_at || row.demand_timestamp,
            demandTimestamp: row.demand_timestamp || '',
            sku: row.sku || '',
            regNo: row.reg_no || '',
            category: row.category || '',
            price: row.rate || row.price || '',
            unit: row.unit || '',
            isOrdered: row.is_ordered || false
        }));

        // Fallback: If DB is empty, try fetching from Google Sheets (legacy data support)
        if (requests.length === 0) {
            try {
                const rows = await getSheetRows();
                if (rows && rows.length > 1) {
                    requests = rows.slice(1).map((row, index) => ({
                        id: 'sheet-' + index,
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
                }
            } catch (sheetErr) {
                console.warn('Google Sheets fetch skipped or failed.');
            }
        }

        console.log('--- API RESPONSE SENT TO APPROVED SECTION ---');
        console.log('Total Approved/Received Requests:', requests.length);
        console.log('---------------------------------------------');
        res.json(requests);
    } catch (err) {
        console.error('Error fetching approved requests:', err);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
};

// --------------------------------------------------
// GET /api/pending
// --------------------------------------------------
exports.getPending = async (req, res) => {
    try {
        const [result, inventoryResult] = await Promise.all([
            prisma.pending_requests.findMany({
                where: {
                    OR: [
                        { status: null },
                        { status: { in: ['pending_review', 'reviewed', 'approved', 'draft'] } }
                    ]
                },
                orderBy: { demand_timestamp: 'desc' }
            }),
            prisma.inventory.findMany()
        ]);

        const inventory = inventoryResult;

        // Helper for in-memory inventory matching
        const findInventoryMatchMem = (partName, sku) => {
            if (sku && sku.trim() !== '') {
                const skuMatch = inventory.find(i => i.sku === sku.trim());
                if (skuMatch) return skuMatch;
            }
            if (partName && partName.trim() !== '') {
                const trimmed = partName.trim().toLowerCase();
                
                // 1. Exact match
                let match = inventory.find(i => (i.part_name || '').toLowerCase() === trimmed);
                if (match) return match;

                // 2. Partial/fuzzy match
                match = inventory.find(i => 
                    (i.part_name || '').toLowerCase().includes(trimmed) || 
                    (i.product_description || '').toLowerCase().includes(trimmed)
                );
                if (match) return match;

                // 3. Match on first word
                const words = trimmed.split(/\s+/).filter(w => w.length > 2);
                if (words.length > 0) {
                    const firstWord = words[0];
                    match = inventory.find(i => (i.part_name || '').toLowerCase().includes(firstWord));
                    if (match) return match;
                }
            }
            return null;
        };

        const requests = result.map((row) => {
            const match = findInventoryMatchMem(row.part_name, row.sku);

            let availableStock = '0';
            let skuValue = row.sku || '';
            let regNoValue = row.reg_no || '';
            let categoryValue = row.category || '';
            let priceVal = row.rate || '';
            let suggestedMatch = 'No Match';
            let stockWarning = 'No Inventory Match';

            if (match) {
                availableStock = (match.available_qty !== null ? match.available_qty : 0).toString();
                
                // Prioritize explicit row values over the inventory match
                skuValue = row.sku || match.sku || '';
                priceVal = row.rate || (match.price ? match.price.toString() : '');
                regNoValue = row.reg_no || match.reg_no || '';
                categoryValue = row.category || match.category || '';
                
                suggestedMatch = match.part_name || '';

                const reqQty = parseInt((row.qty || '').replace(/[^0-9]/g, ''), 10);
                const stock = match.available_qty !== null ? match.available_qty : 0;

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
                regNo: regNoValue,
                category: categoryValue,
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
        });

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
        const receivedAt = new Date();

        await prisma.pending_requests.create({
            data: {
                id,
                part_name: item.partName || '',
                qty: item.qty || '',
                size: item.size || '',
                material: item.material || '',
                machine: item.machine || '',
                vendor: item.vendor || '',
                requested_by: item.requestedBy || 'WhatsApp User',
                demand_timestamp: new Date(),
                received_at: receivedAt,
                rate: item.price || '',
                status: 'pending_review'
            }
        });

        const newItem = { id, partName: item.partName || '', qty: item.qty || '', size: item.size || '',
            material: item.material || '', machine: item.machine || '', vendor: item.vendor || '',
            requestedBy: item.requestedBy || 'WhatsApp User', receivedAt: receivedAt.toISOString(),
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

        const dbRow = await prisma.pending_requests.findUnique({ where: { id } });
        if (!dbRow) return res.status(404).json({ error: 'Pending request not found' });

        await prisma.pending_requests.update({
            where: { id },
            data: {
                status: 'approved',
                approved_by: approvedData.approvedBy || 'Manager',
                approved_at: new Date(),
                part_name: approvedData.partName || dbRow.part_name || '',
                qty: approvedData.qty || dbRow.qty || '',
                size: approvedData.size || dbRow.size || '',
                material: approvedData.material || dbRow.material || '',
                machine: approvedData.machine || dbRow.machine || '',
                vendor: approvedData.vendor || dbRow.vendor || '',
                rate: approvedData.price || approvedData.rate || dbRow.rate || ''
            }
        });

        // Check/Create inventory item with stock = 0 if it doesn't exist
        const partNameToCheck = approvedData.partName || dbRow.part_name || '';
        const searchName = partNameToCheck.trim();
        const itemCheck = await prisma.inventory.findFirst({
            where: { part_name: { equals: searchName, mode: 'insensitive' } }
        });

        if (!itemCheck) {
            const cleanName = partNameToCheck.trim().substring(0, 5).toUpperCase().replace(/[^A-Z0-9]/g, '');
            const generatedSku = 'GEN-' + cleanName + '-' + Math.floor(Math.random() * 10000);
            const parsedPrice = parseFloat(approvedData.price || approvedData.rate || dbRow.rate || '0') || 0.00;

            await prisma.inventory.create({
                data: {
                    part_name: partNameToCheck,
                    part_group: approvedData.machine || dbRow.machine || 'General Compatibility',
                    material: approvedData.material || dbRow.material || '',
                    detail1: approvedData.size || dbRow.size || '',
                    detail2: '',
                    sku: approvedData.sku || generatedSku,
                    reg_no: approvedData.regNo || dbRow.reg_no || '',
                    vendor: approvedData.vendor || dbRow.vendor || '',
                    available_qty: 0,
                    price: parsedPrice,
                    rate: parsedPrice,
                    category: dbRow.category || ''
                }
            });
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

        const dbRow = await prisma.pending_requests.findUnique({ where: { id } });
        if (!dbRow) return res.status(404).json({ error: 'Request not found' });

        await prisma.pending_requests.update({
            where: { id },
            data: { status: 'received' }
        });

        // Increase inventory stock quantity
        const partNameToCheck = dbRow.part_name || '';
        const searchName = partNameToCheck.trim();
        const itemCheck = await prisma.inventory.findFirst({
            where: { part_name: { equals: searchName, mode: 'insensitive' } }
        });
        
        const receivedQtyNum = parseInt((dbRow.qty || '').replace(/[^0-9]/g, ''), 10) || 0;

        if (itemCheck) {
            const currentQty = itemCheck.available_qty || 0;
            const newQty = currentQty + receivedQtyNum;
            await prisma.inventory.update({
                where: { id: itemCheck.id },
                data: { available_qty: newQty }
            });
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

        const result = await prisma.pending_requests.update({
            where: { id },
            data: {
                part_name: editData.partName || '',
                qty: editData.qty || '',
                size: editData.size || '',
                material: editData.material || '',
                machine: editData.machine || '',
                vendor: editData.vendor || '',
                rate: editData.price || editData.rate || '',
                sku: editData.sku || '',
                reg_no: editData.regNo || '',
                edited_by: editorRoleName,
                edited_at: new Date()
            }
        });

        console.log(`Edited request by ${editorRoleName}:`, result.part_name);
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true, item: result });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Pending request not found' });
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

        const result = await prisma.pending_requests.update({
            where: { id },
            data: {
                part_name: editData.partName || '',
                qty: editData.qty || '',
                size: editData.size || '',
                material: editData.material || '',
                machine: editData.machine || '',
                vendor: editData.vendor || '',
                rate: editData.price || editData.rate || '',
                status: 'reviewed',
                edited_by: 'Reviewer',
                edited_at: new Date(),
                forwarded_at: new Date()
            }
        });

        console.log('Forwarded request to Manager stage:', result.part_name);
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true, item: result });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Pending request not found' });
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
        const result = await prisma.pending_requests.update({
            where: { id },
            data: { status: 'rejected' }
        });

        console.log('Rejected:', result.part_name);
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Pending request not found' });
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

// --------------------------------------------------
// POST /api/pending/custom – Editor creates a custom demand
// --------------------------------------------------
exports.createCustomDemand = async (req, res) => {
    try {
        const item = req.body;
        if (!item || !item.partName) return res.status(400).json({ error: 'Part Name is required' });

        const id = Date.now() + '-' + Math.floor(Math.random() * 1000);
        const receivedAt = new Date();
        const status = item.status || 'pending_review';

        await prisma.pending_requests.create({
            data: {
                id,
                part_name: item.partName || '',
                qty: item.qty || '',
                size: item.size || '',
                material: item.material || '',
                machine: item.machine || '',
                vendor: item.vendor || '',
                requested_by: item.editorName || 'Editor',
                demand_timestamp: new Date(),
                received_at: receivedAt,
                rate: item.price || '',
                status,
                unit: item.unit || '',
                sku: item.sku || '',
                reg_no: item.regNo || '',
                edited_by: item.editorName || 'Editor',
                edited_at: new Date()
            }
        });

        console.log(`Custom demand created by ${item.editorName || 'Editor'}: "${item.partName}" (status: ${status})`);
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true, id });
    } catch (err) {
        console.error('Error creating custom demand:', err);
        res.status(500).json({ error: 'Failed to create custom demand' });
    }
};

// --------------------------------------------------
// POST /api/pending/:id/order – Toggle ordered status
// --------------------------------------------------
exports.toggleOrdered = async (req, res) => {
    try {
        const { id } = req.params;
        const { isOrdered } = req.body;

        const result = await prisma.pending_requests.update({
            where: { id },
            data: { is_ordered: !!isOrdered }
        });

        console.log(`Order status toggled for "${result.part_name}": ${result.is_ordered}`);
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true, isOrdered: result.is_ordered });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Pending request not found' });
        console.error('Error toggling ordered status:', err);
        res.status(500).json({ error: 'Failed to update ordered status' });
    }
};
