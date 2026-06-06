const router = require('express').Router();
const adController = require('../controller/ad.controller');
const { requireAuth, optionalAuth, allowRoles } = require('../middleware/auth');

router.post('/ad', requireAuth, adController.create);
router.get('/ad', optionalAuth, adController.getAll);
router.get('/ad/:id', optionalAuth, adController.getOne);
router.put('/ad/:id', requireAuth, adController.update);
router.put('/ad/:id/moderation', requireAuth, allowRoles('manager', 'admin'), adController.moderate);
router.delete('/ad/:id', requireAuth, adController.remove);

module.exports = router;
