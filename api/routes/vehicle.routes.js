const router = require('express').Router();
const vehicleController = require('../controller/vehicle.controller');
const { requireAuth } = require('../middleware/auth');

router.get('/vehicle', vehicleController.getAll);
router.get('/vehicle/:id', vehicleController.getOne);
router.post('/vehicle', requireAuth, vehicleController.create);
router.put('/vehicle/:id', requireAuth, vehicleController.update);
router.delete('/vehicle/:id', requireAuth, vehicleController.remove);

module.exports = router;
