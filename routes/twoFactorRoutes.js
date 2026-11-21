const express = require('express');
const router = express.Router();
const twoFactorController = require('../controllers/twoFactorController');
const { isAuthenticated, isPending2FA } = require('../middleware/authMiddleware');
const {
  otpLimiter,
  recoveryLimiter,
  sensitiveActionLimiter,
} = require('../middleware/rateLimiter');

// 2FA Setup
router.get('/setup', isAuthenticated, twoFactorController.getSetup);
router.post('/setup', isAuthenticated, twoFactorController.getSetup);
router.post('/verify-setup', isAuthenticated, otpLimiter, twoFactorController.postVerifySetup);

// Recovery codes display and acknowledge
router.get('/recovery-codes', isAuthenticated, twoFactorController.getRecoveryCodes);
router.post('/confirm-recovery', isAuthenticated, twoFactorController.postConfirmRecoveryCodes);

// 2FA Login Verification (for users with 2FA enabled logging in)
router.get('/verify', isPending2FA, twoFactorController.getVerify);
router.post('/verify-login', isPending2FA, otpLimiter, twoFactorController.postVerifyLogin);
router.post('/verify-recovery', isPending2FA, recoveryLimiter, twoFactorController.postVerifyRecovery);

// Disable 2FA
router.get('/disable', isAuthenticated, twoFactorController.getDisable);
router.post('/disable', isAuthenticated, sensitiveActionLimiter, twoFactorController.postDisable);

// Regenerate recovery codes
router.post('/recovery-codes', isAuthenticated, sensitiveActionLimiter, twoFactorController.postRegenerateRecoveryCodes);

module.exports = router;
