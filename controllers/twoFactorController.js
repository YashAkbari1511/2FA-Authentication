const User = require('../models/User');
const {
  getTOTPAuthUrl,
  generateTOTPSecret,
  generateQRCodeDataURL,
  verifyTOTPToken,
} = require('../services/twoFactorService');
const {
  generateRecoveryCodes,
  verifyAndConsumeRecoveryCode,
  getRecoveryCodeStats,
} = require('../services/recoveryCodeService');
const { isValidOTP, normalizeRecoveryCode } = require('../utils/validationUtil');

/**
 * Display 2FA setup wizard (QR code, manual secret, instructions)
 */
exports.getSetup = async (req, res, next) => {
  try {
    const user = req.user;

    if (user.twoFactorEnabled) {
      req.flash('info', 'Two-Factor Authentication is already active on your account.');
      return res.redirect('/dashboard');
    }

    // Reuse existing temporary secret if valid so page refreshes/typos don't invalidate scanned QR codes
    let base32Secret = user.getTemporaryTwoFactorSecret();
    const shouldRegenerate = req.query.regenerate === '1' || req.method === 'POST' || !base32Secret;

    if (shouldRegenerate) {
      const secretData = generateTOTPSecret(user.email);
      base32Secret = secretData.base32;
      user.setTemporaryTwoFactorSecret(base32Secret);
      await user.save();
    }

    const otpauthUrl = getTOTPAuthUrl(user.email, base32Secret);
    const qrCodeDataUrl = await generateQRCodeDataURL(otpauthUrl);

    res.render('2fa/setup', {
      title: 'Setup Two-Factor Authentication',
      secret: base32Secret,
      qrCode: qrCodeDataUrl,
      userEmail: user.email,
    });
  } catch (error) {
    console.error('[getSetup] Error:', error);
    next(error);
  }
};

/**
 * Verify first OTP code and finalize 2FA activation
 */
exports.postVerifySetup = async (req, res, next) => {
  try {
    const user = req.user;
    const token = req.body.token || req.body.otp;

    if (!isValidOTP(token)) {
      req.flash('error', 'Please enter a valid 6-digit numeric OTP code.');
      return res.redirect('/2fa/setup');
    }

    const tempSecret = user.getTemporaryTwoFactorSecret();
    if (!tempSecret) {
      req.flash('error', 'Setup session expired. Please start 2FA setup again.');
      return res.redirect('/2fa/setup');
    }

    // Verify token
    const isValid = verifyTOTPToken(tempSecret, token);
    if (!isValid) {
      req.flash('error', 'Invalid verification code. Please check your authenticator app and try again.');
      return res.redirect('/2fa/setup');
    }

    // Enable 2FA: promote temporary secret to permanent secret
    user.twoFactorSecret = user.temporaryTwoFactorSecret;
    user.temporaryTwoFactorSecret = null;
    user.twoFactorEnabled = true;

    // Generate 10 initial recovery codes
    const { plainCodes, hashedCodes } = await generateRecoveryCodes();
    user.recoveryCodes = hashedCodes;

    await user.save();

    // Store unhashed recovery codes in session to display ONCE
    req.session.newRecoveryCodes = plainCodes;

    req.flash('success', 'Two-Factor Authentication is now enabled! Save your recovery codes below.');
    req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);
      return res.redirect('/2fa/recovery-codes');
    });
  } catch (error) {
    console.error('[postVerifySetup] Error:', error);
    next(error);
  }
};

/**
 * Display newly generated recovery codes (one-time view)
 */
exports.getRecoveryCodes = (req, res) => {
  const codes = req.session.newRecoveryCodes;
  if (!codes || !Array.isArray(codes) || codes.length === 0) {
    req.flash('info', 'Recovery codes are only displayed once upon generation for security.');
    return res.redirect('/dashboard');
  }

  // Render codes
  res.render('2fa/recovery-codes', {
    title: 'Your 2FA Recovery Codes',
    recoveryCodes: codes,
  });
};

/**
 * Acknowledge recovery codes and clear them from temporary session
 */
exports.postConfirmRecoveryCodes = (req, res, next) => {
  delete req.session.newRecoveryCodes;
  req.flash('success', 'Recovery codes saved. Your account is fully protected!');
  req.session.save((err) => {
    if (err) return next(err);
    return res.redirect('/dashboard');
  });
};

/**
 * Display 2FA verification page during login
 */
exports.getVerify = (req, res) => {
  res.render('2fa/verify', {
    title: 'Two-Factor Authentication - Verify Code',
    pendingEmail: req.pendingUser.email,
  });
};

/**
 * Verify OTP during login
 */
exports.postVerifyLogin = async (req, res, next) => {
  try {
    const user = req.pendingUser;
    const token = req.body.token || req.body.otp;

    if (!isValidOTP(token)) {
      req.flash('error', 'Please enter a valid 6-digit code.');
      return res.status(400).render('2fa/verify', {
        title: 'Two-Factor Authentication - Verify Code',
        pendingEmail: user.email,
      });
    }

    const secret = user.getTwoFactorSecret();
    if (!secret) {
      req.flash('error', '2FA configuration error. Please contact support or use recovery codes.');
      return res.redirect('/2fa/verify');
    }

    const isValid = verifyTOTPToken(secret, token);
    if (!isValid) {
      req.flash('error', 'Invalid verification code. Please ensure your device clock is synchronized.');
      return res.status(400).render('2fa/verify', {
        title: 'Two-Factor Authentication - Verify Code',
        pendingEmail: user.email,
      });
    }

    // Success! Upgrade session to fully authenticated
    const userId = user._id.toString();
    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.userId = userId;
      req.session.is2FAVerified = true;

      req.flash('success', `Two-Factor verification successful. Welcome back, ${user.name}!`);
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        return res.redirect('/dashboard');
      });
    });
  } catch (error) {
    console.error('[postVerifyLogin] Error:', error);
    next(error);
  }
};

/**
 * Verify Recovery Code as alternative to OTP during login
 */
exports.postVerifyRecovery = async (req, res, next) => {
  try {
    const user = req.pendingUser;
    const rawCode = req.body.recoveryCode || '';
    const cleanCode = normalizeRecoveryCode(rawCode);

    if (!cleanCode) {
      req.flash('error', 'Please enter a valid recovery code.');
      return res.redirect('/2fa/verify');
    }

    const { matched } = await verifyAndConsumeRecoveryCode(user.recoveryCodes, cleanCode);
    if (!matched) {
      req.flash('error', 'Invalid or already used recovery code. Please check and try again.');
      return res.redirect('/2fa/verify');
    }

    // Save user with updated code status
    user.markModified('recoveryCodes');
    await user.save();

    const { remaining } = getRecoveryCodeStats(user.recoveryCodes);

    // Upgrade session to fully authenticated
    const userId = user._id.toString();
    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.userId = userId;
      req.session.is2FAVerified = true;

      req.flash(
        'warning',
        `Logged in with recovery code. You have ${remaining} recovery codes remaining. We recommend regenerating codes if you are running low.`
      );
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        return res.redirect('/dashboard');
      });
    });
  } catch (error) {
    console.error('[postVerifyRecovery] Error:', error);
    next(error);
  }
};

/**
 * Display Disable 2FA page
 */
exports.getDisable = (req, res) => {
  const user = req.user;
  if (!user.twoFactorEnabled) {
    req.flash('info', 'Two-Factor Authentication is currently not enabled.');
    return res.redirect('/dashboard');
  }

  res.render('2fa/disable', {
    title: 'Disable Two-Factor Authentication',
  });
};

/**
 * Handle Disable 2FA with password and OTP/Recovery Code verification
 */
exports.postDisable = async (req, res, next) => {
  try {
    const user = req.user;
    const password = req.body.password || '';
    const token = req.body.token || req.body.otp || req.body.recoveryCode || '';

    if (!user.twoFactorEnabled) {
      req.flash('info', '2FA is not active.');
      return res.redirect('/dashboard');
    }

    if (!password) {
      req.flash('error', 'Password is required to disable 2FA.');
      return res.redirect('/2fa/disable');
    }

    if (!token) {
      req.flash('error', 'A valid 6-digit OTP code or emergency recovery code is required to disable 2FA.');
      return res.redirect('/2fa/disable');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      req.flash('error', 'Incorrect password. 2FA was not disabled.');
      return res.redirect('/2fa/disable');
    }

    // Verify 2FA via OTP or Recovery Code
    let is2FAValid = false;
    const secret = user.getTwoFactorSecret();

    if (isValidOTP(token) && secret) {
      is2FAValid = verifyTOTPToken(secret, token);
    }

    // If OTP check was not met, check if token matches an unused recovery code
    if (!is2FAValid) {
      const cleanRecovery = normalizeRecoveryCode(token);
      if (cleanRecovery) {
        const { matched } = await verifyAndConsumeRecoveryCode(user.recoveryCodes, cleanRecovery);
        if (matched) {
          is2FAValid = true;
        }
      }
    }

    if (!is2FAValid) {
      req.flash('error', 'Invalid verification code or recovery code. 2FA was not disabled.');
      return res.redirect('/2fa/disable');
    }

    // Disable 2FA and remove secrets + recovery codes
    user.disableTwoFactor();
    await user.save();

    req.flash('success', 'Two-Factor Authentication has been successfully disabled.');
    res.redirect('/dashboard');
  } catch (error) {
    console.error('[postDisable] Error:', error);
    next(error);
  }
};

/**
 * Regenerate recovery codes (requires password and current OTP confirmation)
 */
exports.postRegenerateRecoveryCodes = async (req, res, next) => {
  try {
    const user = req.user;
    const password = req.body.password || '';
    const token = req.body.token || req.body.otp || req.body.recoveryCode || '';

    if (!user.twoFactorEnabled) {
      req.flash('error', '2FA must be active to regenerate recovery codes.');
      return res.redirect('/dashboard');
    }

    if (!password || !isValidOTP(token)) {
      req.flash('error', 'Both current password and 6-digit OTP code are required to regenerate recovery codes.');
      return res.redirect('/dashboard');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      req.flash('error', 'Incorrect password. Recovery codes were not regenerated.');
      return res.redirect('/dashboard');
    }

    // Verify OTP
    const secret = user.getTwoFactorSecret();
    const isTokenValid = verifyTOTPToken(secret, token);
    if (!isTokenValid) {
      req.flash('error', 'Invalid OTP code. Recovery codes were not regenerated.');
      return res.redirect('/dashboard');
    }

    // Generate new recovery codes and invalidate old ones
    const { plainCodes, hashedCodes } = await generateRecoveryCodes();
    user.recoveryCodes = hashedCodes;
    await user.save();

    // Store in session for one-time display
    req.session.newRecoveryCodes = plainCodes;

    req.flash('success', 'New recovery codes generated! Your old recovery codes are no longer valid.');
    req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);
      return res.redirect('/2fa/recovery-codes');
    });
  } catch (error) {
    console.error('[postRegenerateRecoveryCodes] Error:', error);
    next(error);
  }
};
