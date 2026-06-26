const prisma = require('../config/db');

// GET /api/inventory
exports.getInventory = async (req, res) => {
    try {
        const { machine } = req.query;
        let result;

        console.log(`[Inventory API] Fetching live inventory. Filter: "${machine || 'none'}"`);

        if (machine && machine.trim() !== '') {
            const filterPattern = `%${machine.trim()}%`;
            // For ILIKE across multiple columns, Prisma has `contains` with `mode: 'insensitive'`
            const search = machine.trim();
            result = await prisma.inventory.findMany({
                where: {
                    OR: [
                        { part_name: { contains: search, mode: 'insensitive' } },
                        { part_group: { contains: search, mode: 'insensitive' } },
                        { product_description: { contains: search, mode: 'insensitive' } }
                    ]
                },
                orderBy: { part_name: 'asc' }
            });
        } else {
            result = await prisma.inventory.findMany({
                orderBy: { part_name: 'asc' }
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
            vendor: row.vendor || '—'
        }));

        console.log(`[Inventory API] Returned ${items.length} matched inventory records.`);
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

        // Generate a SKU if none provided
        const finalSku = (sku && sku.trim())
            ? sku.trim()
            : 'GEN-' + partName.trim().substring(0, 5).toUpperCase().replace(/[^A-Z0-9]/g, '') + '-' + Math.floor(Math.random() * 10000);

        // Check for duplicate SKU
        const existing = await prisma.inventory.findFirst({
            where: { sku: finalSku }
        });

        if (existing) {
            return res.status(409).json({ error: `An inventory item with SKU "${finalSku}" already exists.` });
        }

        const parsedPrice = parseFloat(price) || 0.00;
        const parsedQty = parseInt(availableQty) || 0;

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

        console.log(`[Inventory] New item added: "${partName}" (SKU: ${finalSku})`);
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
        const parsedQty = parseInt(stockQuantity) || 0;

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