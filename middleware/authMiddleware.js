const User = require('../models/User');

/**
 * Middleware ensuring the user is fully authenticated AND 2FA verified.
 */
async function isAuthenticated(req, res, next) {
  try {
    if (!req.session.userId || req.session.is2FAVerified !== true) {
      if (req.session.pendingUserId) {
        req.flash('info', 'Please complete your two-factor verification to continue.');
        return res.redirect('/2fa/verify');
      }
      req.flash('error', 'Please log in to access this page.');
      return res.redirect('/auth/login');
    }

    // Reuse loaded user if already populated by global middleware
    let user = req.user;
    if (!user || user._id.toString() !== req.session.userId) {
      user = await User.findById(req.session.userId);
    }

    if (!user) {
      // User was deleted or session is stale
      req.session.destroy(() => {
        res.clearCookie('session_id');
        res.redirect('/auth/login');
      });
      return;
    }

    req.user = user;
    res.locals.currentUser = user;
    next();
  } catch (error) {
    console.error('[AuthMiddleware] Error:', error);
    next(error);
  }
}

/**
 * Middleware ensuring the session is in a pending 2FA state (credentials passed, awaiting OTP).
 */
async function isPending2FA(req, res, next) {
  try {
    if (!req.session.pendingUserId || req.session.is2FAVerified === true) {
      if (req.session.userId && req.session.is2FAVerified === true) {
        return res.redirect('/dashboard');
      }
      req.flash('error', 'Session expired. Please log in again.');
      return res.redirect('/auth/login');
    }

    const user = await User.findById(req.session.pendingUserId);
    if (!user || !user.twoFactorEnabled) {
      req.session.destroy(() => {
        res.clearCookie('session_id');
        res.redirect('/auth/login');
      });
      return;
    }

    req.pendingUser = user;
    res.locals.pendingUser = user;
    next();
  } catch (error) {
    console.error('[isPending2FA] Error:', error);
    next(error);
  }
}

/**
 * Middleware ensuring guest-only access (for login and register pages).
 */
function isGuest(req, res, next) {
  if (req.session.userId && req.session.is2FAVerified === true) {
    return res.redirect('/dashboard');
  }
  if (req.session.pendingUserId) {
    return res.redirect('/2fa/verify');
  }
  next();
}

module.exports = {
  isAuthenticated,
  isPending2FA,
  isGuest,
};
