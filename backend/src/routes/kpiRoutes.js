const express = require('express');
const router = express.Router();
const kpiController = require('../controllers/kpiController');

router.get('/approver-kpis', kpiController.getKpis);

module.exports = router;
