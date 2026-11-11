const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

router.get('/inventory', inventoryController.getInventory);
router.post('/inventory/reload', inventoryController.reloadInventory);
router.post('/inventory/add', inventoryController.addInventoryItem);
router.post('/inventory/:id/edit', inventoryController.editInventoryItem);
router.post('/inventory/:id/delete', inventoryController.deleteInventoryItem);
router.post('/inventory/:id/restore', inventoryController.restoreInventoryItem);
router.delete('/inventory/:id/permanent', inventoryController.permanentDeleteInventoryItem);
router.post('/inventory/:id/permanent', inventoryController.permanentDeleteInventoryItem);
router.post('/inventory/empty-trash', inventoryController.emptyTrash);

module.exports = router;
