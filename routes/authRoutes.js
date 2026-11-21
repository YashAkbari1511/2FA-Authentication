const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isGuest } = require('../middleware/authMiddleware');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');

// Registration routes
router.get('/register', isGuest, authController.getRegister);
router.post('/register', isGuest, registerLimiter, authController.postRegister);

// Login routes
router.get('/login', isGuest, authController.getLogin);
router.post('/login', isGuest, loginLimiter, authController.postLogin);

// Logout route
router.post('/logout', authController.postLogout);
router.get('/logout', authController.postLogout);

module.exports = router;
