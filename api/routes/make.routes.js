const router = require('express').Router();
const makeController = require('../controller/make.controller');
const { requireAuth, allowRoles } = require('../middleware/auth');

router.get('/make', makeController.getAll);
router.get('/make/:id', makeController.getOne);
router.post('/make', requireAuth, makeController.create);
router.put('/make/:id', requireAuth, allowRoles('admin'), makeController.update);
router.delete('/make/:id', requireAuth, allowRoles('admin'), makeController.remove);

module.exports = router;
