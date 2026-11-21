require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');

const connectDB = require('./config/db');
const createSessionMiddleware = require('./config/session');
const flashMiddleware = require('./middleware/flashMiddleware');
const csrfMiddleware = require('./middleware/csrfMiddleware');
const User = require('./models/User');

// Route handlers
const indexRoutes = require('./routes/indexRoutes');
const authRoutes = require('./routes/authRoutes');
const twoFactorRoutes = require('./routes/twoFactorRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy for secure cookies in production environments
app.set('trust proxy', 1);

// Connect to MongoDB
connectDB();

// 1. Security Headers with Helmet (Customized for QR Code Data URLs and Google Fonts)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// 2. Request Parsers
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(express.json({ limit: '10kb' }));

// 3. Static Files
app.use(express.static(path.join(__dirname, 'public')));

// 4. View Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 5. Session Management (MongoDB backed via connect-mongo)
app.use(createSessionMiddleware());

// 6. Flash Messages
app.use(flashMiddleware);

// 7. CSRF Protection
app.use(csrfMiddleware);

// 8. Global Template Variables & User Loader
app.use(async (req, res, next) => {
  res.locals.appName = process.env.APP_NAME || '2FA Demo App';
  res.locals.currentPath = req.path;
  res.locals.currentUser = null;

  if (req.session && req.session.userId && req.session.is2FAVerified === true) {
    try {
      const user = await User.findById(req.session.userId);
      if (user) {
        req.user = user;
        res.locals.currentUser = user;
      }
    } catch (err) {
      console.error('[UserLoader] Error:', err);
    }
  }
  next();
});

// 9. Application Routes
app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/2fa', twoFactorRoutes);
app.use('/dashboard', dashboardRoutes);

// 10. 404 Handler
app.use((req, res) => {
  res.status(404).render('error', {
    statusCode: 404,
    title: '404 - Page Not Found',
    message: 'The page you are looking for does not exist or has been moved.',
    currentUser: res.locals.currentUser || null,
  });
});

// 11. Global Error Handler
app.use((err, req, res, next) => {
  console.error('[ServerError]', err);
  const statusCode = err.status || 500;
  res.status(statusCode).render('error', {
    statusCode,
    title: `${statusCode} - Server Error`,
    message:
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred. Please try again later.'
        : err.message || 'Internal Server Error',
    currentUser: res.locals.currentUser || null,
  });
});

// Start Server when run directly
let server;
if (require.main === module) {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`  Two-Factor Authentication (2FA) Demo Running`);
    console.log(`  Server: http://localhost:${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`====================================================`);
  });
}

module.exports = { app, server };
