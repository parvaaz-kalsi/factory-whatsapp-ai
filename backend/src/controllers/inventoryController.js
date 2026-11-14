const prisma = require('../config/db');

// GET /api/inventory
exports.getInventory = async (req, res) => {
    try {
        const { machine, trash } = req.query;
        const isTrash = trash === 'true';
        let result;

        console.log(`[Inventory API] Fetching live inventory. Filter: "${machine || 'none'}", Trash: ${isTrash}`);

        const whereCondition = isTrash 
            ? { is_deleted: true }
            : { OR: [{ is_deleted: false }, { is_deleted: null }] };

        if (machine && machine.trim() !== '') {
            const search = machine.trim();
            result = await prisma.inventory.findMany({
                where: {
                    AND: [
                        whereCondition,
                        {
                            OR: [
                                { part_name: { contains: search, mode: 'insensitive' } },
                                { part_group: { contains: search, mode: 'insensitive' } },
                                { product_description: { contains: search, mode: 'insensitive' } }
                            ]
                        }
                    ]
                },
                orderBy: isTrash ? { deleted_at: 'desc' } : { part_name: 'asc' }
            });
        } else {
            result = await prisma.inventory.findMany({
                where: whereCondition,
                orderBy: isTrash ? { deleted_at: 'desc' } : { part_name: 'asc' }
            });
        }

        const items = result.map(row => ({
            id: row.id,
            partName: row.part_name || '',
            machine: row.part_group || 'General Compatibility',
            stockQuantity: row.available_qty !== null ? row.available_qty : 0,
            unit: row.unit || 'Pcs.',
            size: [row.detail1, row.detail2].filter(Boolean).join(' / ') || '—',
            material: row.material || '—',
            category: row.category || '—',
            sku: row.sku || '',
            regNo: row.reg_no || '—',
            price: row.price ? row.price.toString() : '0.00',
            rate: row.rate !== null ? row.rate.toString() : (row.price ? row.price.toString() : '0.00'),
            vendor: row.vendor || '—',
            isDeleted: row.is_deleted || false,
            deletedAt: row.deleted_at,
            deletedBy: row.deleted_by || ''
        }));

        console.log(`[Inventory API] Returned ${items.length} matched inventory records (trash=${isTrash}).`);
        res.json(items);
    } catch (err) {
        console.error('Error fetching live inventory from DB:', err);
        res.status(500).json({ error: 'Failed to retrieve live inventory database' });
    }
};

// POST /api/inventory/reload
exports.reloadInventory = async (req, res) => {
    try {
        console.log('Admin triggered inventory reload via API...');
        const { dbInit } = require('../../dbInit');
        await dbInit();
        res.json({ success: true, message: 'Inventory database reloaded from Excel file successfully' });
    } catch (err) {
        console.error('Error reloading inventory:', err);
        res.status(500).json({ error: 'Failed to reload inventory database' });
    }
};

// POST /api/inventory/add
exports.addInventoryItem = async (req, res) => {
    try {
        const {
            partName, sku, regNo, material, size, machine,
            vendor, unit, price, availableQty, category
        } = req.body;

        if (!partName || !partName.trim()) {
            return res.status(400).json({ error: 'Part Name is required' });
        }

        // Use provided P.No. or leave empty
        const finalSku = (sku && sku.trim() && sku.trim() !== '—') ? sku.trim() : '';

        // Check for duplicate P.No. if provided
        if (finalSku) {
            const existing = await prisma.inventory.findFirst({
                where: { sku: finalSku }
            });

            if (existing) {
                return res.status(409).json({ error: `An inventory item with P.No. "${finalSku}" already exists.` });
            }
        }

        const parsedPrice = parseFloat(price) || 0.00;
        const parsedQty = parseFloat(availableQty) || 0;

        const result = await prisma.inventory.create({
            data: {
                part_name: partName.trim(),
                sku: finalSku,
                reg_no: (regNo || '').trim(),
                material: (material || '').trim(),
                detail1: (size || '').trim(),
                part_group: (machine || 'General Compatibility').trim(),
                vendor: (vendor || '').trim(),
                unit: (unit || 'Pcs.').trim(),
                price: parsedPrice,
                rate: parsedPrice,
                available_qty: parsedQty,
                category: (category || '').trim()
            }
        });

        console.log(`[Inventory] New item added: "${partName}" (P.No.: ${finalSku || 'none'})`);
        res.json({ success: true, item: result });
    } catch (err) {
        console.error('Error adding inventory item:', err);
        res.status(500).json({ error: 'Failed to add inventory item' });
    }
};

// POST /api/inventory/:id/edit
exports.editInventoryItem = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            partName, sku, regNo, material, size, machine,
            vendor, unit, price, stockQuantity, category
        } = req.body;

        const parsedPrice = parseFloat(price) || 0.00;
        const parsedQty = parseFloat(stockQuantity) || 0;

        const result = await prisma.inventory.update({
            where: { id: parseInt(id) },
            data: {
                part_name: (partName || '').trim(),
                sku: (sku || '').trim(),
                reg_no: (regNo || '').trim(),
                material: (material || '').trim(),
                detail1: (size || '').trim(),
                part_group: (machine || 'General Compatibility').trim(),
                vendor: (vendor || '').trim(),
                unit: (unit || 'Pcs.').trim(),
                price: parsedPrice,
                rate: parsedPrice,
                available_qty: parsedQty,
                category: (category || '').trim()
            }
        });

        console.log(`[Inventory] Item updated: "${partName}" (ID: ${id})`);
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true, item: result });
    } catch (err) {
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'Inventory item not found' });
        }
        console.error('Error editing inventory item:', err);
        res.status(500).json({ error: 'Failed to edit inventory item' });
    }
};

// POST /api/inventory/:id/delete (Soft Delete -> Move to Recycle Bin)
exports.deleteInventoryItem = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedBy = req.body.deletedBy || req.body.role || 'Editor';

        const result = await prisma.inventory.update({
            where: { id: parseInt(id) },
            data: {
                is_deleted: true,
                deleted_at: new Date(),
                deleted_by: deletedBy
            }
        });

        console.log(`[Inventory Recycle Bin] Item "${result.part_name}" (ID: ${id}) moved to Recycle Bin by ${deletedBy}`);
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true, message: 'Item moved to Recycle Bin', item: result });
    } catch (err) {
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'Inventory item not found' });
        }
        console.error('Error moving item to Recycle Bin:', err);
        res.status(500).json({ error: 'Failed to move item to Recycle Bin' });
    }
};

// POST /api/inventory/:id/restore (Restore from Recycle Bin)
exports.restoreInventoryItem = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await prisma.inventory.update({
            where: { id: parseInt(id) },
            data: {
                is_deleted: false,
                deleted_at: null,
                deleted_by: null
            }
        });

        console.log(`[Inventory Recycle Bin] Item "${result.part_name}" (ID: ${id}) restored to active inventory`);
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true, message: 'Item restored to active inventory', item: result });
    } catch (err) {
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'Inventory item not found' });
        }
        console.error('Error restoring inventory item:', err);
        res.status(500).json({ error: 'Failed to restore inventory item' });
    }
};

// DELETE or POST /api/inventory/:id/permanent (Permanent Hard Delete)
exports.permanentDeleteInventoryItem = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await prisma.inventory.delete({
            where: { id: parseInt(id) }
        });

        console.log(`[Inventory Permanent Delete] Item "${result.part_name}" (ID: ${id}) permanently removed from database`);
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true, message: 'Item permanently deleted from database' });
    } catch (err) {
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'Inventory item not found' });
        }
        console.error('Error permanently deleting inventory item:', err);
        res.status(500).json({ error: 'Failed to permanently delete inventory item' });
    }
};

// POST /api/inventory/empty-trash (Empty all items in Recycle Bin)
exports.emptyTrash = async (req, res) => {
    try {
        const result = await prisma.inventory.deleteMany({
            where: { is_deleted: true }
        });

        console.log(`[Inventory Recycle Bin] Purged ${result.count} items from Recycle Bin`);
        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true, count: result.count, message: `Permanently removed ${result.count} items` });
    } catch (err) {
        console.error('Error emptying Recycle Bin:', err);
        res.status(500).json({ error: 'Failed to empty Recycle Bin' });
    }
};