const router = require('express').Router();
const roleController = require('../controller/role.controller');
const { requireAuth, allowRoles } = require('../middleware/auth');

router.get('/role', roleController.getAll);
router.post('/role', requireAuth, allowRoles('admin'), roleController.create);
router.delete('/role/:id', requireAuth, allowRoles('admin'), roleController.remove);

module.exports = router;
