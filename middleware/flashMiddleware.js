/**
 * Lightweight session-based flash messaging middleware
 * Supports both same-request rendering and post-redirect-get patterns.
 */
function flashMiddleware(req, res, next) {
  if (!req.session) {
    res.locals.messages = { success: [], error: [], info: [], warning: [] };
    req.flash = () => {};
    return next();
  }

  // 1. Pull flash messages stored in session from a previous request
  const sessionMessages = req.session.flashMessages || {
    success: [],
    error: [],
    info: [],
    warning: [],
  };

  // Reset session flash storage for this turn
  req.session.flashMessages = {
    success: [],
    error: [],
    info: [],
    warning: [],
  };

  // 2. Initialize res.locals.messages with messages carried over from previous request
  res.locals.messages = {
    success: Array.isArray(sessionMessages.success) ? [...sessionMessages.success] : [],
    error: Array.isArray(sessionMessages.error) ? [...sessionMessages.error] : [],
    info: Array.isArray(sessionMessages.info) ? [...sessionMessages.info] : [],
    warning: Array.isArray(sessionMessages.warning) ? [...sessionMessages.warning] : [],
  };

  // 3. Track messages added during this request
  const newMessages = {
    success: [],
    error: [],
    info: [],
    warning: [],
  };

  // Flash helper method on req
  req.flash = function (type, message) {
    if (!type || !message) return;
    if (!newMessages[type]) {
      newMessages[type] = [];
    }
    newMessages[type].push(message);

    // Also make immediately available to res.locals for immediate rendering!
    if (!res.locals.messages[type]) {
      res.locals.messages[type] = [];
    }
    res.locals.messages[type].push(message);
  };

  // 4. Intercept res.redirect: If redirecting, persist newMessages into req.session.flashMessages
  const originalRedirect = res.redirect.bind(res);
  res.redirect = function (...args) {
    if (req.session) {
      if (!req.session.flashMessages) {
        req.session.flashMessages = { success: [], error: [], info: [], warning: [] };
      }
      for (const [type, msgs] of Object.entries(newMessages)) {
        if (!req.session.flashMessages[type]) {
          req.session.flashMessages[type] = [];
        }
        req.session.flashMessages[type].push(...msgs);
      }
    }
    return originalRedirect(...args);
  };

  next();
}

module.exports = flashMiddleware;
