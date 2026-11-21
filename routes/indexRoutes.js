const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const isAuth = !!(req.session && req.session.userId && req.session.is2FAVerified);
  res.render('index', {
    title: 'Two-Factor Authentication (2FA) Demo - Node.js & MongoDB',
    isAuth,
  });
});

// Info tab: How 2FA Works, Packages Used, and Step-by-Step Implementation Guide
router.get(['/info', '/how-it-works'], (req, res) => {
  const isAuth = !!(req.session && req.session.userId && req.session.is2FAVerified);
  res.render('info', {
    title: 'How 2FA Works & Implementation Guide - SecureAuth 2FA',
    isAuth,
  });
});

module.exports = router;
