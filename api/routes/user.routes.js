const router = require('express').Router();
const userController = require('../controller/user.controller');
const { requireAuth, allowRoles, allowSelfOrAdmin } = require('../middleware/auth');

router.get('/user', requireAuth, allowRoles('admin'), userController.getAll);
router.get('/user/:id', requireAuth, allowSelfOrAdmin(), userController.getOne);
router.put('/user/:id', requireAuth, allowSelfOrAdmin(), userController.update);
router.delete('/user/:id', requireAuth, allowRoles('admin'), userController.remove);

module.exports = router;
