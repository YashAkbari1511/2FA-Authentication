/**
 * Input validation utilities
 */

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim().toLowerCase());
}

function isValidPassword(password) {
  if (typeof password !== 'string') return false;
  // At least 8 characters, at least one letter and at least one number
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password);
}

function isValidOTP(otp) {
  if (!otp) return false;
  const cleanOtp = String(otp).trim();
  return /^\d{6}$/.test(cleanOtp);
}

function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim();
}

function normalizeRecoveryCode(code) {
  if (typeof code !== 'string') return '';
  const clean = code.trim().toUpperCase().replace(/[\s-]+/g, '');
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  }
  return clean;
}

module.exports = {
  isValidEmail,
  isValidPassword,
  isValidOTP,
  sanitizeString,
  normalizeRecoveryCode,
};
