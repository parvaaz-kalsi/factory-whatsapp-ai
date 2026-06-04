const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

router.get('/whatsapp/status', whatsappController.getStatus);
router.get('/whatsapp/qr-image', whatsappController.getQrImage);
router.get('/whatsapp/groups', whatsappController.getGroups);
router.post('/whatsapp/groups/active', whatsappController.setGroupActive);
router.post('/whatsapp/logout', whatsappController.logout);
router.post('/whatsapp/reconnect', whatsappController.reconnect);

module.exports = router;
