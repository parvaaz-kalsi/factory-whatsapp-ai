const express = require('express');
const router = express.Router();
const issueController = require('../controllers/issueController');

router.post('/issue', issueController.issuePart);
router.get('/issue', issueController.getIssuedHistory);

module.exports = router;
