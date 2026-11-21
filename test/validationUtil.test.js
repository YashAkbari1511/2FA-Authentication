const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isValidEmail,
  isValidPassword,
  isValidOTP,
  sanitizeString,
  normalizeRecoveryCode,
} = require('../utils/validationUtil');

describe('Validation Utility', () => {
  it('should validate email addresses correctly', () => {
    assert.strictEqual(isValidEmail('user@example.com'), true);
    assert.strictEqual(isValidEmail('user.name+tag@sub.domain.co'), true);
    assert.strictEqual(isValidEmail('invalid-email'), false);
    assert.strictEqual(isValidEmail('@nodomain.com'), false);
    assert.strictEqual(isValidEmail(null), false);
  });

  it('should validate password criteria (>=8 chars, letter + number)', () => {
    assert.strictEqual(isValidPassword('Password123'), true);
    assert.strictEqual(isValidPassword('short1'), false);
    assert.strictEqual(isValidPassword('allletterslowercaseandupper'), false);
    assert.strictEqual(isValidPassword('1234567890'), false);
  });

  it('should validate 6-digit OTP codes', () => {
    assert.strictEqual(isValidOTP('123456'), true);
    assert.strictEqual(isValidOTP('012345'), true);
    assert.strictEqual(isValidOTP('12345'), false);
    assert.strictEqual(isValidOTP('1234567'), false);
    assert.strictEqual(isValidOTP('12345a'), false);
    assert.strictEqual(isValidOTP(null), false);
  });

  it('should normalize recovery codes (handle dashes, spaces, case)', () => {
    assert.strictEqual(normalizeRecoveryCode('ABCD-1234'), 'ABCD-1234');
    assert.strictEqual(normalizeRecoveryCode('abcd1234'), 'ABCD-1234');
    assert.strictEqual(normalizeRecoveryCode('  abcd 1234  '), 'ABCD-1234');
    assert.strictEqual(normalizeRecoveryCode('abcd - 1234'), 'ABCD-1234');
    assert.strictEqual(normalizeRecoveryCode(null), '');
  });
});
