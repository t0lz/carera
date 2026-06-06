const router = require('express').Router();
const authController = require('../controller/auth.controller');
const { requireAuth } = require('../middleware/auth');

router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/profile', requireAuth, authController.profile);

module.exports = router;
