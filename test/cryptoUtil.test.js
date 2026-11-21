const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { encrypt, decrypt } = require('../utils/cryptoUtil');

describe('Crypto Utility', () => {
  it('should encrypt and decrypt a plain text string correctly', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const encrypted = encrypt(secret);

    assert.ok(encrypted);
    assert.notEqual(encrypted, secret);
    assert.strictEqual(encrypted.split(':').length, 3); // iv:authTag:ciphertext

    const decrypted = decrypt(encrypted);
    assert.strictEqual(decrypted, secret);
  });

  it('should return null when encrypting null or empty string', () => {
    assert.strictEqual(encrypt(null), null);
    assert.strictEqual(encrypt(''), null);
  });

  it('should return null when decrypting null or empty string', () => {
    assert.strictEqual(decrypt(null), null);
    assert.strictEqual(decrypt(''), null);
  });

  it('should fail decryption if ciphertext or auth tag is corrupted', () => {
    const encrypted = encrypt('MYSECRETKEY');
    const parts = encrypted.split(':');
    // Corrupt the ciphertext
    const corruptedCiphertext = parts[0] + ':' + parts[1] + ':' + 'deadbeef';

    assert.throws(() => {
      decrypt(corruptedCiphertext);
    });
  });
});
