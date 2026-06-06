const router = require('express').Router();
const bodyTypeController = require('../controller/bodyType.controller');
const { requireAuth, allowRoles } = require('../middleware/auth');

router.get('/body-type', bodyTypeController.getAll);
router.get('/body-type/:id', bodyTypeController.getOne);
router.post('/body-type', requireAuth, allowRoles('admin'), bodyTypeController.create);
router.put('/body-type/:id', requireAuth, allowRoles('admin'), bodyTypeController.update);
router.delete('/body-type/:id', requireAuth, allowRoles('admin'), bodyTypeController.remove);

module.exports = router;
