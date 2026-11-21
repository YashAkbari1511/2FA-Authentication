const crypto = require('crypto');

function csrfMiddleware(req, res, next) {
  // Ensure session exists
  if (!req.session) {
    return next(new Error('Session middleware must be mounted before CSRF middleware'));
  }

  // Generate or retrieve CSRF token for this session
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  // Expose token to all templates
  res.locals.csrfToken = req.session.csrfToken;

  // Safe HTTP methods do not require CSRF token validation
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Extract token from body or headers
  const submittedToken =
    (req.body && req.body._csrf) ||
    req.headers['x-csrf-token'] ||
    req.headers['csrf-token'];

  if (!submittedToken || submittedToken !== req.session.csrfToken) {
    console.warn(`[Security] CSRF verification failed for ${req.method} ${req.originalUrl} from IP ${req.ip}`);
    if (req.flash) {
      req.flash('error', 'Form submission expired or invalid security token. Please try again.');
    }
    // Redirect back if safe referer exists on the same host, otherwise render 403 error
    const referer = req.get('Referrer');
    if (referer && !referer.includes(req.originalUrl)) {
      try {
        const url = new URL(referer);
        if (url.host === req.get('host')) {
          return res.redirect(url.pathname + url.search);
        }
      } catch {
        if (referer.startsWith('/') && !referer.startsWith('//')) {
          return res.redirect(referer);
        }
      }
    }
    return res.status(403).render('error', {
      statusCode: 403,
      title: '403 Forbidden - CSRF Error',
      message: 'Invalid or missing security token (CSRF). For your security, this request was blocked.',
      currentUser: res.locals.currentUser || null,
    });
  }

  next();
}

module.exports = csrfMiddleware;
