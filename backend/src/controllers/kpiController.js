const pool = require('../config/db');

// GET /api/approver-kpis
exports.getKpis = async (req, res) => {
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
};
