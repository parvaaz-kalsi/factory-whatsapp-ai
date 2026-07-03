const prisma = require('../config/db');

exports.issuePart = async (req, res) => {
    try {
        const { inventory_id, part_name, qty_issued, issued_to, machine } = req.body;

        if (!part_name || !qty_issued || !issued_to || !machine) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const qty = parseInt(qty_issued, 10);
        if (isNaN(qty) || qty <= 0) {
            return res.status(400).json({ error: 'Invalid quantity' });
        }

        // Perform in a transaction to ensure atomicity
        const result = await prisma.$transaction(async (prisma) => {
            // Find the inventory item if inventory_id is provided
            if (inventory_id) {
                const item = await prisma.inventory.findUnique({
                    where: { id: parseInt(inventory_id, 10) }
                });

                if (item) {
                    // Update inventory
                    await prisma.inventory.update({
                        where: { id: item.id },
                        data: {
                            available_qty: {
                                decrement: qty
                            }
                        }
                    });
                }
            }

            // Create issued item record
            const issuedItem = await prisma.issued_items.create({
                data: {
                    inventory_id: inventory_id ? parseInt(inventory_id, 10) : null,
                    part_name,
                    qty_issued: qty,
                    issued_to,
                    machine
                }
            });

            return issuedItem;
        });

        res.json(result);
    } catch (err) {
        console.error('Error issuing part:', err);
        res.status(500).json({ error: 'Failed to issue part' });
    }
};

exports.getIssuedHistory = async (req, res) => {
    try {
        const history = await prisma.issued_items.findMany({
            orderBy: {
                issued_at: 'desc'
            }
        });
        res.json(history);
    } catch (err) {
        console.error('Error fetching issued history:', err);
        res.status(500).json({ error: 'Failed to fetch issued history' });
    }
};
