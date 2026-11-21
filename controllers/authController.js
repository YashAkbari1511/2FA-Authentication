const User = require('../models/User');
const { isValidEmail, isValidPassword, sanitizeString } = require('../utils/validationUtil');

/**
 * Display registration page
 */
exports.getRegister = (req, res) => {
  res.render('auth/register', {
    title: 'Create Account - Two-Factor Authentication Demo',
    formData: {},
  });
};

/**
 * Handle user registration
 */
exports.postRegister = async (req, res, next) => {
  try {
    const name = sanitizeString(req.body.name);
    const email = sanitizeString(req.body.email).toLowerCase();
    const password = req.body.password || '';
    const confirmPassword = req.body.confirmPassword || '';

    const formData = { name, email };

    // Validation
    if (!name || name.length < 2) {
      req.flash('error', 'Full name must be at least 2 characters.');
      return res.status(400).render('auth/register', {
        title: 'Create Account - Two-Factor Authentication Demo',
        formData,
      });
    }

    if (!isValidEmail(email)) {
      req.flash('error', 'Please provide a valid email address.');
      return res.status(400).render('auth/register', {
        title: 'Create Account - Two-Factor Authentication Demo',
        formData,
      });
    }

    if (!isValidPassword(password)) {
      req.flash(
        'error',
        'Password must be at least 8 characters long and contain both letters and numbers.'
      );
      return res.status(400).render('auth/register', {
        title: 'Create Account - Two-Factor Authentication Demo',
        formData,
      });
    }

    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match.');
      return res.status(400).render('auth/register', {
        title: 'Create Account - Two-Factor Authentication Demo',
        formData,
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash('error', 'An account with this email address already exists.');
      return res.status(409).render('auth/register', {
        title: 'Create Account - Two-Factor Authentication Demo',
        formData,
      });
    }

    // Create and save new user
    const newUser = new User({
      name,
      email,
      password,
    });

    await newUser.save();

    req.flash('success', 'Registration successful! You can now log in.');
    return res.redirect('/auth/login');
  } catch (error) {
    console.error('[postRegister] Error:', error);
    next(error);
  }
};

/**
 * Display login page
 */
exports.getLogin = (req, res) => {
  res.render('auth/login', {
    title: 'Sign In - Two-Factor Authentication Demo',
    formData: {},
  });
};

/**
 * Handle login submission
 */
exports.postLogin = async (req, res, next) => {
  try {
    const email = sanitizeString(req.body.email).toLowerCase();
    const password = req.body.password || '';

    if (!email || !password) {
      req.flash('error', 'Please enter both email and password.');
      return res.status(400).render('auth/login', {
        title: 'Sign In - Two-Factor Authentication Demo',
        formData: { email },
      });
    }

    // Lookup user
    const user = await User.findOne({ email });
    if (!user) {
      req.flash('error', 'Invalid email or password.');
      return res.status(401).render('auth/login', {
        title: 'Sign In - Two-Factor Authentication Demo',
        formData: { email },
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      req.flash('error', 'Invalid email or password.');
      return res.status(401).render('auth/login', {
        title: 'Sign In - Two-Factor Authentication Demo',
        formData: { email },
      });
    }

    // If 2FA is enabled: create a restricted temporary login session
    if (user.twoFactorEnabled) {
      req.session.regenerate((err) => {
        if (err) return next(err);

        req.session.pendingUserId = user._id.toString();
        req.session.is2FAVerified = false;

        req.flash('info', 'Two-Factor Authentication required. Enter the 6-digit code from your authenticator app.');
        req.session.save((saveErr) => {
          if (saveErr) return next(saveErr);
          return res.redirect('/2fa/verify');
        });
      });
      return;
    }

    // If 2FA is disabled: log the user in directly with fully authenticated session
    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.userId = user._id.toString();
      req.session.is2FAVerified = true;

      req.flash('success', `Welcome back, ${user.name}!`);
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        return res.redirect('/dashboard');
      });
    });
  } catch (error) {
    console.error('[postLogin] Error:', error);
    next(error);
  }
};

/**
 * Handle user logout
 */
exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[postLogout] Error destroying session:', err);
      return next(err);
    }
    res.clearCookie('session_id');
    res.redirect('/auth/login');
  });
};
