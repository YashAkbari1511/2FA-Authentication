const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const speakeasy = require('speakeasy');
const {
  getTOTPAuthUrl,
  generateTOTPSecret,
  generateQRCodeDataURL,
  verifyTOTPToken,
} = require('../services/twoFactorService');

describe('Two-Factor Service', () => {
  it('should generate valid base32 secret and otpauth url with issuer', () => {
    const email = 'tester@example.com';
    const secretData = generateTOTPSecret(email);

    assert.ok(secretData.base32);
    assert.strictEqual(secretData.base32.length, 32);
    assert.ok(secretData.otpauth_url.startsWith('otpauth://totp/'));
    assert.ok(secretData.otpauth_url.includes('issuer=2FA'));
  });

  it('should verify a valid TOTP token generated with speakeasy', () => {
    const secretData = generateTOTPSecret('user@example.com');
    const currentToken = speakeasy.totp({
      secret: secretData.base32,
      encoding: 'base32',
    });

    const isValid = verifyTOTPToken(secretData.base32, currentToken);
    assert.strictEqual(isValid, true);
  });

  it('should reject invalid or malformed tokens', () => {
    const secretData = generateTOTPSecret('user@example.com');
    assert.strictEqual(verifyTOTPToken(secretData.base32, '000000'), false);
    assert.strictEqual(verifyTOTPToken(secretData.base32, 'abc'), false);
    assert.strictEqual(verifyTOTPToken(secretData.base32, null), false);
    assert.strictEqual(verifyTOTPToken(null, '123456'), false);
  });

  it('should generate a valid QR code Data URL', async () => {
    const url = getTOTPAuthUrl('test@example.com', 'JBSWY3DPEHPK3PXP');
    const qrDataUrl = await generateQRCodeDataURL(url);

    assert.ok(qrDataUrl.startsWith('data:image/png;base64,'));
    assert.ok(qrDataUrl.length > 500);
  });
});
