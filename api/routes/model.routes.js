const router = require('express').Router();
const modelController = require('../controller/model.controller');
const { requireAuth, allowRoles } = require('../middleware/auth');

router.get('/model', modelController.getAll);
router.get('/model/:id', modelController.getOne);
router.post('/model', requireAuth, modelController.create);
router.put('/model/:id', requireAuth, allowRoles('admin'), modelController.update);
router.delete('/model/:id', requireAuth, allowRoles('admin'), modelController.remove);

module.exports = router;
