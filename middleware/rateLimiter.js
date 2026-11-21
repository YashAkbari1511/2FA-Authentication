const rateLimit = require('express-rate-limit');

/**
 * Safely resolves Referrer header ensuring it does not trigger open redirects
 */
function getSafeReferer(req, fallbackRedirect) {
  const referer = req.get('Referrer');
  if (!referer) return fallbackRedirect || '/';
  try {
    const url = new URL(referer);
    const host = req.get('host');
    if (url.host === host) {
      return url.pathname + url.search;
    }
  } catch {
    if (referer.startsWith('/') && !referer.startsWith('//')) {
      return referer;
    }
  }
  return fallbackRedirect || '/';
}

/**
 * Custom handler for rate limits that preserves flash message and redirects back gracefully
 */
const createLimiterHandler = (message, fallbackRedirect) => (req, res) => {
  if (req.flash) {
    req.flash('error', message);
  }
  return res.redirect(getSafeReferer(req, fallbackRedirect));
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterHandler('Too many login attempts from this IP. Please try again after 15 minutes.', '/auth/login'),
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 OTP attempts per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterHandler('Too many incorrect OTP attempts. For your security, verification is paused for 15 minutes.', '/2fa/verify'),
});

const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Strict limit for recovery code attempts
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterHandler('Too many recovery code attempts. Access is temporarily locked for 15 minutes.', '/2fa/verify'),
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 registrations per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterHandler('Too many accounts created from this IP. Please try again later.', '/auth/register'),
});

const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createLimiterHandler('Too many security requests. Please wait a few minutes.', '/dashboard'),
});

module.exports = {
  loginLimiter,
  otpLimiter,
  recoveryLimiter,
  registerLimiter,
  sensitiveActionLimiter,
};
