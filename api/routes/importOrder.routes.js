const router = require('express').Router();
const importOrderController = require('../controller/importOrder.controller');
const { requireAuth, allowRoles } = require('../middleware/auth');

router.get('/import-order/rates', importOrderController.getRates);
router.post('/import-order/calculate', importOrderController.calculate);
router.post('/import-order', requireAuth, importOrderController.create);
router.get('/import-order', requireAuth, importOrderController.getAll);
router.get('/import-order/:id', requireAuth, importOrderController.getOne);
router.put(
  '/import-order/:id/status',
  requireAuth,
  allowRoles('manager', 'admin'),
  importOrderController.updateStatus
);

module.exports = router;
