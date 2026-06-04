const pool = require('../config/db');

// GET /api/inventory
exports.getInventory = async (req, res) => {
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
