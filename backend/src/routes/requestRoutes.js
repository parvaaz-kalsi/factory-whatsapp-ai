const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');

router.get('/requests', requestController.getApprovedRequests);
router.get('/pending', requestController.getPending);
router.post('/pending', requestController.createPending);
router.post('/pending/:id/approve', requestController.approve);
router.post('/pending/:id/receive', requestController.receive);
router.post('/pending/:id/edit', requestController.edit);
router.post('/pending/:id/forward', requestController.forward);
router.post('/pending/:id/reject', requestController.reject);
router.post('/test/simulate-message', requestController.simulateMessage);

module.exports = router;
