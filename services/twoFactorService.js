const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const APP_NAME = process.env.APP_NAME || '2FA Demo App';

/**
 * Builds an RFC 6238 compliant otpauth:// URL with issuer parameter.
 * @param {string} userEmail
 * @param {string} base32Secret
 * @returns {string}
 */
function getTOTPAuthUrl(userEmail, base32Secret) {
  return speakeasy.otpauthURL({
    secret: base32Secret,
    label: `${APP_NAME} (${userEmail})`,
    issuer: APP_NAME,
    encoding: 'base32',
  });
}

/**
 * Generate a new TOTP secret for a user.
 * @param {string} userEmail
 * @returns {object} { base32, otpauth_url }
 */
function generateTOTPSecret(userEmail) {
  const secret = speakeasy.generateSecret({
    length: 20,
    name: `${APP_NAME} (${userEmail})`,
    issuer: APP_NAME,
  });

  return {
    base32: secret.base32,
    otpauth_url: getTOTPAuthUrl(userEmail, secret.base32),
  };
}

/**
 * Generate a QR code Data URL from an otpauth:// URL.
 * @param {string} otpauthUrl
 * @returns {Promise<string>} Base64 Data URL for image rendering
 */
async function generateQRCodeDataURL(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 6,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

/**
 * Verify a 6-digit TOTP token against a base32 secret.
 * Allows a small window (window: 1) for clock differences.
 * @param {string} secret - base32 encoded TOTP secret
 * @param {string} token - 6 digit OTP entered by user
 * @returns {boolean}
 */
function verifyTOTPToken(secret, token) {
  if (!secret || !token) return false;

  const cleanToken = String(token).trim();
  if (!/^\d{6}$/.test(cleanToken)) return false;

  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: cleanToken,
    window: 1, // +/- 1 step of 30 seconds (allows 90 seconds validity window)
  });
}

module.exports = {
  getTOTPAuthUrl,
  generateTOTPSecret,
  generateQRCodeDataURL,
  verifyTOTPToken,
};
