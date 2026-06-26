const prisma = require('../config/db');

// GET /api/approver-kpis
exports.getKpis = async (req, res) => {
    try {
        const new_worker_demands = await prisma.pending_requests.count({
            where: {
                OR: [
                    { status: 'pending_review' },
                    { status: null }
                ]
            }
        });

        const pending_approval = await prisma.pending_requests.count({
            where: { status: 'reviewed' }
        });

        const approved_not_received = await prisma.pending_requests.count({
            where: { status: 'approved' }
        });

        res.json({
            new_worker_demands,
            pending_approval,
            approved_not_received
        });
    } catch (err) {
        console.error('Error fetching Approver KPIs:', err);
        res.status(500).json({ error: 'Failed to fetch Approver KPIs from database' });
    }
};
