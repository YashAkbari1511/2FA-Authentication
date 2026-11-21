const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  generateRecoveryCodes,
  verifyAndConsumeRecoveryCode,
  getRecoveryCodeStats,
} = require('../services/recoveryCodeService');

describe('Recovery Code Service', () => {
  it('should generate 10 unique plain codes and their corresponding hashes', async () => {
    const { plainCodes, hashedCodes } = await generateRecoveryCodes();

    assert.strictEqual(plainCodes.length, 10);
    assert.strictEqual(hashedCodes.length, 10);

    const uniqueSet = new Set(plainCodes);
    assert.strictEqual(uniqueSet.size, 10);

    // Each code should be format XXXX-XXXX
    plainCodes.forEach((code) => {
      assert.match(code, /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    });
  });

  it('should verify and consume an unused recovery code exactly once', async () => {
    const { plainCodes, hashedCodes } = await generateRecoveryCodes();
    const candidate = plainCodes[0];

    // First use: should match and be marked used
    const firstCheck = await verifyAndConsumeRecoveryCode(hashedCodes, candidate);
    assert.strictEqual(firstCheck.matched, true);
    assert.strictEqual(hashedCodes[0].used, true);
    assert.ok(hashedCodes[0].usedAt instanceof Date);

    // Second use of the same code: should FAIL
    const secondCheck = await verifyAndConsumeRecoveryCode(hashedCodes, candidate);
    assert.strictEqual(secondCheck.matched, false);
  });

  it('should calculate accurate recovery code statistics', () => {
    const mockList = [
      { used: false },
      { used: true },
      { used: false },
      { used: false },
    ];
    const stats = getRecoveryCodeStats(mockList);

    assert.strictEqual(stats.total, 4);
    assert.strictEqual(stats.used, 1);
    assert.strictEqual(stats.remaining, 3);
  });
});
