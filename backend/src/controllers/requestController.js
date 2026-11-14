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
            where: { status: { in: ['approved', 'received'] } },
            orderBy: { demand_timestamp: 'desc' }
        });
        
        let requests = dbResult.map((row) => {
            const rawRate = row.rate || row.price || '';
            const qtyNum = parseFloat(String(row.qty || '').replace(/[^0-9.]/g, ''));
            const rateNum = parseFloat(String(rawRate).replace(/[^0-9.]/g, ''));
            const calculatedAmount = (!isNaN(qtyNum) && !isNaN(rateNum) && qtyNum > 0 && rateNum > 0)
                ? (qtyNum * rateNum).toFixed(2).replace(/\.00$/, '')
                : '';
            const cleanAmt = (row.amount !== null && row.amount !== undefined)
                ? String(row.amount).replace(/[\$Rs\s]/g, '').trim()
                : '';

            return {
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
                price: rawRate,
                amount: cleanAmt !== '' ? cleanAmt : calculatedAmount,
                unit: row.unit || '',
                status: row.status || 'received',
                isOrdered: row.is_ordered || false
            };
        });

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
            prisma.inventory.findMany({
                where: {
                    OR: [
                        { is_deleted: false },
                        { is_deleted: null }
                    ]
                }
            })
        ]);

        const inventory = inventoryResult;

        // Helper for in-memory inventory matching
        const findInventoryMatchMem = (partName, sku, size) => {
            if (sku && sku.trim() !== '') {
                const skuMatch = inventory.find(i => i.sku === sku.trim());
                if (skuMatch) return skuMatch;
            }
            if (partName && partName.trim() !== '') {
                const trimmed = partName.trim().toLowerCase();
                const trimmedSize = (size || '').trim().toLowerCase();
                
                // 1. Exact match (name and size)
                let match = inventory.find(i => 
                    (i.part_name || '').toLowerCase() === trimmed && 
                    (i.detail1 || '').toLowerCase() === trimmedSize
                );
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
            const match = findInventoryMatchMem(row.part_name, row.sku, row.size);

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

                const parsedReqMatch = (row.qty || '').match(/[\d.]+/);
                const reqQty = parsedReqMatch ? parseFloat(parsedReqMatch[0]) : 0;
                const stock = match.available_qty !== null ? match.available_qty : 0;

                if (isNaN(reqQty) || reqQty === 0) {
                    stockWarning = stock > 0 ? 'Stock Available' : 'Insufficient Stock';
                } else if (stock >= reqQty) {
                    stockWarning = 'Stock Available';
                } else {
                    stockWarning = 'Insufficient Stock';
                }
            }

            const qtyNum = parseFloat(String(row.qty || '').replace(/[^0-9.]/g, ''));
            const rateNum = parseFloat(String(priceVal || '').replace(/[^0-9.]/g, ''));
            const calculatedAmount = (!isNaN(qtyNum) && !isNaN(rateNum) && qtyNum > 0 && rateNum > 0)
                ? (qtyNum * rateNum).toFixed(2).replace(/\.00$/, '')
                : '';

            const cleanAmt = (row.amount !== null && row.amount !== undefined)
                ? String(row.amount).replace(/[\$Rs\s]/g, '').trim()
                : '';

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
                unit: row.unit || '',
                category: categoryValue,
                price: priceVal,
                amount: cleanAmt !== '' ? cleanAmt : calculatedAmount,
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

        const reqQty = parseFloat(String(item.qty || '').replace(/[^0-9.]/g, ''));
        const reqRate = parseFloat(String(item.price || item.rate || '').replace(/[^0-9.]/g, ''));
        const defaultAmt = (!isNaN(reqQty) && !isNaN(reqRate) && reqQty > 0 && reqRate > 0)
            ? (reqQty * reqRate).toFixed(2).replace(/\.00$/, '')
            : '';
        const cleanAmt = (item.amount !== undefined && item.amount !== null)
            ? String(item.amount).replace(/[\$Rs\s]/g, '').trim()
            : '';
        const finalAmt = cleanAmt !== '' ? cleanAmt : defaultAmt;

        await prisma.pending_requests.create({
            data: {
                id,
                part_name: item.partName || '',
                qty: item.qty || '',
                unit: item.unit || '',
                size: item.size || '',
                material: item.material || '',
                category: item.category || '',
                machine: item.machine || '',
                vendor: item.vendor || '',
                requested_by: item.requestedBy || 'WhatsApp User',
                demand_timestamp: new Date(),
                received_at: receivedAt,
                rate: item.price || '',
                amount: finalAmt,
                status: 'pending_review'
            }
        });

        const newItem = { id, partName: item.partName || '', qty: item.qty || '', unit: item.unit || '', size: item.size || '',
            material: item.material || '', machine: item.machine || '', vendor: item.vendor || '',
            requestedBy: item.requestedBy || 'WhatsApp User', receivedAt: receivedAt.toISOString(),
            sku: item.sku || '', category: item.category || '', price: item.price || '',
            amount: finalAmt,
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

        const rawRate = approvedData.price || approvedData.rate || dbRow.rate || '';
        const qNum = parseFloat(String(approvedData.qty || dbRow.qty || '').replace(/[^0-9.]/g, ''));
        const rNum = parseFloat(String(rawRate).replace(/[^0-9.]/g, ''));
        const fallbackAmt = (!isNaN(qNum) && !isNaN(rNum) && qNum > 0 && rNum > 0)
            ? (qNum * rNum).toFixed(2).replace(/\.00$/, '')
            : '';
        const cleanAmt = (approvedData.amount !== undefined && approvedData.amount !== null)
            ? String(approvedData.amount).replace(/[\$Rs\s]/g, '').trim()
            : '';
        const cleanDbAmt = (dbRow.amount !== null && dbRow.amount !== undefined)
            ? String(dbRow.amount).replace(/[\$Rs\s]/g, '').trim()
            : '';
        const finalAmt = cleanAmt !== '' ? cleanAmt : (cleanDbAmt !== '' ? cleanDbAmt : fallbackAmt);

        await prisma.pending_requests.update({
            where: { id },
            data: {
                status: 'approved',
                approved_by: approvedData.approvedBy || 'Manager',
                approved_at: new Date(),
                part_name: approvedData.partName || dbRow.part_name || '',
                qty: approvedData.qty || dbRow.qty || '',
                unit: approvedData.unit || dbRow.unit || '',
                size: approvedData.size || dbRow.size || '',
                material: approvedData.material || dbRow.material || '',
                category: approvedData.category || dbRow.category || '',
                machine: approvedData.machine || dbRow.machine || '',
                vendor: approvedData.vendor || dbRow.vendor || '',
                rate: rawRate,
                amount: finalAmt
            }
        });

        // Check/Create inventory item with stock = 0 if it doesn't exist
        const partNameToCheck = approvedData.partName || dbRow.part_name || '';
        const searchName = partNameToCheck.trim();
        const sizeToCheck = approvedData.size || dbRow.size || '';
        const searchSize = sizeToCheck.trim();
        const itemCheck = await prisma.inventory.findFirst({
            where: { 
                part_name: { equals: searchName, mode: 'insensitive' },
                detail1: { equals: searchSize, mode: 'insensitive' },
                OR: [
                    { is_deleted: false },
                    { is_deleted: null }
                ]
            }
        });

        if (!itemCheck) {
            const parsedPrice = parseFloat(approvedData.price || approvedData.rate || dbRow.rate || '0') || 0.00;
            const finalPNo = (approvedData.sku || dbRow.sku || '').trim();

            await prisma.inventory.create({
                data: {
                    part_name: partNameToCheck,
                    part_group: approvedData.machine || dbRow.machine || 'General Compatibility',
                    material: approvedData.material || dbRow.material || '',
                    detail1: approvedData.size || dbRow.size || '',
                    detail2: '',
                    sku: (finalPNo && finalPNo !== '—') ? finalPNo : '',
                    reg_no: approvedData.regNo || dbRow.reg_no || '',
                    vendor: approvedData.vendor || dbRow.vendor || '',
                    available_qty: 0,
                    unit: approvedData.unit || dbRow.unit || '',
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

        let dbRow = await prisma.pending_requests.findUnique({ where: { id } });
        if (!dbRow) return res.status(404).json({ error: 'Request not found' });

        // If request body contains updated parameters from the receiver, save them first
        if (req.body && Object.keys(req.body).length > 0) {
            const b = req.body;
            const updatedRate = (b.price !== undefined ? String(b.price) : (b.rate !== undefined ? String(b.rate) : dbRow.rate)) || '';
            const qNum = parseFloat(String(b.qty !== undefined ? b.qty : dbRow.qty || '').replace(/[^0-9.]/g, ''));
            const rNum = parseFloat(String(updatedRate).replace(/[^0-9.]/g, ''));
            const fallbackAmt = (!isNaN(qNum) && !isNaN(rNum) && qNum > 0 && rNum > 0)
                ? (qNum * rNum).toFixed(2).replace(/\.00$/, '')
                : '';
            const cleanAmt = (b.amount !== undefined && b.amount !== null)
                ? String(b.amount).replace(/[\$Rs\s]/g, '').trim()
                : '';
            const cleanDbAmt = (dbRow.amount !== null && dbRow.amount !== undefined)
                ? String(dbRow.amount).replace(/[\$Rs\s]/g, '').trim()
                : '';
            const updatedAmt = cleanAmt !== '' ? cleanAmt : (cleanDbAmt !== '' ? cleanDbAmt : fallbackAmt);

            await prisma.pending_requests.update({
                where: { id },
                data: {
                    part_name: (b.partName !== undefined ? b.partName : dbRow.part_name) || '',
                    sku: (b.sku !== undefined ? b.sku : dbRow.sku) || '',
                    reg_no: (b.regNo !== undefined ? b.regNo : dbRow.reg_no) || '',
                    qty: (b.qty !== undefined ? String(b.qty) : dbRow.qty) || '',
                    unit: (b.unit !== undefined ? b.unit : dbRow.unit) || '',
                    size: (b.size !== undefined ? b.size : dbRow.size) || '',
                    material: (b.material !== undefined ? b.material : dbRow.material) || '',
                    machine: (b.machine !== undefined ? b.machine : dbRow.machine) || '',
                    category: (b.category !== undefined ? b.category : dbRow.category) || '',
                    vendor: (b.vendor !== undefined ? b.vendor : dbRow.vendor) || '',
                    rate: updatedRate,
                    amount: updatedAmt,
                    edited_by: 'Receiver',
                    edited_at: new Date()
                }
            });
            dbRow = await prisma.pending_requests.findUnique({ where: { id } });
        }

        // Mark demand as received
        await prisma.pending_requests.update({
            where: { id },
            data: { status: 'received', received_at: new Date() }
        });

        // Parse received quantity
        const parsedReceivedMatch = (dbRow.qty || '').match(/[\d.]+/);
        const receivedQtyNum = parsedReceivedMatch ? parseFloat(parsedReceivedMatch[0]) : 0;

        // Parse price / rate
        const rawPriceStr = String(dbRow.rate || dbRow.price || '').replace(/[^0-9.]/g, '');
        const parsedPrice = parseFloat(rawPriceStr) || 0.00;

        // Robust matching to check if item already exists in inventory
        let itemCheck = null;

        // 1. Try matching by SKU (P.No.) if provided and not placeholder
        if (dbRow.sku && dbRow.sku.trim() && dbRow.sku.trim() !== '—') {
            itemCheck = await prisma.inventory.findFirst({
                where: { 
                    sku: { equals: dbRow.sku.trim(), mode: 'insensitive' },
                    OR: [{ is_deleted: false }, { is_deleted: null }]
                }
            });
        }

        // 2. Try matching by Reg No. if not found by SKU
        if (!itemCheck && dbRow.reg_no && dbRow.reg_no.trim() && dbRow.reg_no.trim() !== '—') {
            itemCheck = await prisma.inventory.findFirst({
                where: { 
                    reg_no: { equals: dbRow.reg_no.trim(), mode: 'insensitive' },
                    OR: [{ is_deleted: false }, { is_deleted: null }]
                }
            });
        }

        // 3. Try matching by Part Name (case-insensitive)
        if (!itemCheck && dbRow.part_name && dbRow.part_name.trim()) {
            const searchName = dbRow.part_name.trim();
            const matchedByName = await prisma.inventory.findMany({
                where: { 
                    part_name: { equals: searchName, mode: 'insensitive' },
                    OR: [{ is_deleted: false }, { is_deleted: null }]
                }
            });

            if (matchedByName.length === 1) {
                itemCheck = matchedByName[0];
            } else if (matchedByName.length > 1) {
                // If multiple parts share the same name, disambiguate with size or SKU
                const searchSize = (dbRow.size || '').trim().toLowerCase();
                const matchedBySize = matchedByName.find(i => 
                    (i.detail1 && searchSize && i.detail1.toLowerCase() === searchSize) ||
                    (i.detail1 && searchSize && searchSize.includes(i.detail1.toLowerCase())) ||
                    (i.sku && dbRow.sku && i.sku.toLowerCase() === dbRow.sku.toLowerCase())
                );
                itemCheck = matchedBySize || matchedByName[0];
            }
        }

        if (itemCheck) {
            // ITEM EXISTS: Increase stock quantity AND synchronize all updated parameters
            const currentQty = itemCheck.available_qty || 0;
            const newQty = currentQty + receivedQtyNum;

            const updateData = {
                available_qty: newQty,
                part_name: (dbRow.part_name || itemCheck.part_name || '').trim(),
                price: parsedPrice > 0 ? parsedPrice : (itemCheck.price ? Number(itemCheck.price) : 0.00),
                rate: parsedPrice > 0 ? parsedPrice : (itemCheck.rate ? Number(itemCheck.rate) : (itemCheck.price ? Number(itemCheck.price) : 0.00))
            };

            if (dbRow.sku && dbRow.sku.trim() && dbRow.sku.trim() !== '—') {
                updateData.sku = dbRow.sku.trim();
            }
            if (dbRow.reg_no && dbRow.reg_no.trim() && dbRow.reg_no.trim() !== '—') {
                updateData.reg_no = dbRow.reg_no.trim();
            }
            if (dbRow.size && dbRow.size.trim() && dbRow.size.trim() !== '—') {
                updateData.detail1 = dbRow.size.trim();
            }
            if (dbRow.material && dbRow.material.trim() && dbRow.material.trim() !== '—') {
                updateData.material = dbRow.material.trim();
            }
            if (dbRow.machine && dbRow.machine.trim() && dbRow.machine.trim() !== 'General Compatibility') {
                updateData.part_group = dbRow.machine.trim();
            }
            if (dbRow.vendor && dbRow.vendor.trim() && dbRow.vendor.trim() !== '—') {
                updateData.vendor = dbRow.vendor.trim();
            }
            if (dbRow.category && dbRow.category.trim() && dbRow.category.trim() !== '—') {
                updateData.category = dbRow.category.trim();
            }
            if (dbRow.unit && dbRow.unit.trim()) {
                updateData.unit = dbRow.unit.trim();
            }

            await prisma.inventory.update({
                where: { id: itemCheck.id },
                data: updateData
            });
            console.log(`[Inventory Stock & Param Update] Updated "${updateData.part_name}" (ID: ${itemCheck.id}), Stock: ${currentQty} -> ${newQty}`);
        } else {
            // ITEM DOES NOT EXIST: Create a new inventory record with the demand's details & quantity
            const finalSku = (dbRow.sku && dbRow.sku.trim() && dbRow.sku.trim() !== '—')
                ? dbRow.sku.trim()
                : '';

            const newInventoryItem = await prisma.inventory.create({
                data: {
                    part_name: (dbRow.part_name || 'Unnamed Item').trim(),
                    sku: finalSku,
                    reg_no: (dbRow.reg_no && dbRow.reg_no.trim() !== '—' ? dbRow.reg_no.trim() : '').trim(),
                    detail1: (dbRow.size && dbRow.size.trim() !== '—' ? dbRow.size.trim() : '').trim(),
                    material: (dbRow.material && dbRow.material.trim() !== '—' ? dbRow.material.trim() : '').trim(),
                    part_group: (dbRow.machine && dbRow.machine.trim() !== 'General' ? dbRow.machine.trim() : 'General Compatibility').trim(),
                    vendor: (dbRow.vendor && dbRow.vendor.trim() !== '—' ? dbRow.vendor.trim() : '').trim(),
                    unit: (dbRow.unit && dbRow.unit.trim() ? dbRow.unit.trim() : 'Pcs.').trim(),
                    category: (dbRow.category && dbRow.category.trim() !== '—' ? dbRow.category.trim() : 'mechanical').trim(),
                    price: parsedPrice,
                    rate: parsedPrice,
                    available_qty: receivedQtyNum
                }
            });
            console.log(`[Inventory Creation] Created new inventory item "${newInventoryItem.part_name}" (P.No.: ${finalSku || 'none'}), Stock: ${receivedQtyNum}`);
        }

        // Write to Google Sheets
        const finalReceivedRow = {
            partName: dbRow.part_name || '', qty: dbRow.qty || '', size: dbRow.size || '',
            material: dbRow.material || '', machine: dbRow.machine || '', vendor: dbRow.vendor || '',
            requestedBy: dbRow.requested_by || '', receivedAt: new Date().toISOString(),
            demandTimestamp: dbRow.demand_timestamp ? new Date(dbRow.demand_timestamp).toISOString() : ''
        };
        await appendToSheet(finalReceivedRow);

        console.log('Received demand written to sheet and inventory updated:', finalReceivedRow.partName);
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

        const editorRoleName = editData.role === 'manager' ? 'Manager' : (editData.role === 'receiver' ? 'Receiver' : 'Reviewer');

        const editRate = editData.price || editData.rate || '';
        const qNum = parseFloat(String(editData.qty !== undefined ? editData.qty : '').replace(/[^0-9.]/g, ''));
        const rNum = parseFloat(String(editRate).replace(/[^0-9.]/g, ''));
        const fallbackAmt = (!isNaN(qNum) && !isNaN(rNum) && qNum > 0 && rNum > 0)
            ? (qNum * rNum).toFixed(2).replace(/\.00$/, '')
            : '';
        const cleanAmt = (editData.amount !== undefined && editData.amount !== null)
            ? String(editData.amount).replace(/[\$Rs\s]/g, '').trim()
            : '';
        const finalAmt = cleanAmt !== '' ? cleanAmt : fallbackAmt;

        const result = await prisma.pending_requests.update({
            where: { id },
            data: {
                part_name: editData.partName || '',
                qty: editData.qty !== undefined ? String(editData.qty) : '',
                unit: editData.unit || '',
                size: editData.size || '',
                material: editData.material || '',
                category: editData.category || '',
                machine: editData.machine || '',
                vendor: editData.vendor || '',
                rate: editRate,
                amount: finalAmt,
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

        const fwdRate = editData.price || editData.rate || '';
        const qNum = parseFloat(String(editData.qty || '').replace(/[^0-9.]/g, ''));
        const rNum = parseFloat(String(fwdRate).replace(/[^0-9.]/g, ''));
        const fallbackAmt = (!isNaN(qNum) && !isNaN(rNum) && qNum > 0 && rNum > 0)
            ? (qNum * rNum).toFixed(2).replace(/\.00$/, '')
            : '';
        const cleanAmt = (editData.amount !== undefined && editData.amount !== null)
            ? String(editData.amount).replace(/[\$Rs\s]/g, '').trim()
            : '';
        const finalAmt = cleanAmt !== '' ? cleanAmt : fallbackAmt;

        const result = await prisma.pending_requests.update({
            where: { id },
            data: {
                part_name: editData.partName || '',
                qty: editData.qty || '',
                unit: editData.unit || '',
                size: editData.size || '',
                material: editData.material || '',
                category: editData.category || '',
                machine: editData.machine || '',
                vendor: editData.vendor || '',
                rate: fwdRate,
                amount: finalAmt,
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
        if (global.io) global.io.emit('dashboard_update');
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

        const custRate = item.price || item.rate || '';
        const qNum = parseFloat(String(item.qty || '').replace(/[^0-9.]/g, ''));
        const rNum = parseFloat(String(custRate).replace(/[^0-9.]/g, ''));
        const fallbackAmt = (!isNaN(qNum) && !isNaN(rNum) && qNum > 0 && rNum > 0)
            ? (qNum * rNum).toFixed(2).replace(/\.00$/, '')
            : '';
        const cleanAmt = (item.amount !== undefined && item.amount !== null)
            ? String(item.amount).replace(/[\$Rs\s]/g, '').trim()
            : '';
        const finalAmt = cleanAmt !== '' ? cleanAmt : fallbackAmt;

        await prisma.pending_requests.create({
            data: {
                id,
                part_name: item.partName || '',
                qty: item.qty || '',
                size: item.size || '',
                material: item.material || '',
                category: item.category || '',
                machine: item.machine || '',
                vendor: item.vendor || '',
                requested_by: item.editorName || 'Editor',
                demand_timestamp: new Date(),
                received_at: receivedAt,
                rate: custRate,
                amount: finalAmt,
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
