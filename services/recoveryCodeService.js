const crypto = require('crypto');
const bcrypt = require('bcrypt');

const CODE_COUNT = 10;
const HASH_ROUNDS = 10;

/**
 * Generates a clean, readable recovery code in format: XXXX-XXXX
 * Using uppercase alphanumeric characters (excluding ambiguous 0, O, 1, I).
 */
function generateSingleCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let part1 = '';
  let part2 = '';
  const bytes = crypto.randomBytes(8);

  for (let i = 0; i < 4; i++) {
    part1 += chars[bytes[i] % chars.length];
  }
  for (let i = 4; i < 8; i++) {
    part2 += chars[bytes[i] % chars.length];
  }

  return `${part1}-${part2}`;
}

/**
 * Generates a list of distinct plain recovery codes and their corresponding hashed objects for database storage.
 * @returns {Promise<{ plainCodes: string[], hashedCodes: Array<{ codeHash: string, used: boolean, usedAt: null }> }>}
 */
async function generateRecoveryCodes() {
  const codeSet = new Set();
  while (codeSet.size < CODE_COUNT) {
    codeSet.add(generateSingleCode());
  }

  const plainCodes = Array.from(codeSet);
  const hashedCodes = await Promise.all(
    plainCodes.map(async (code) => {
      const codeHash = await bcrypt.hash(code, HASH_ROUNDS);
      return {
        codeHash,
        used: false,
        usedAt: null,
      };
    })
  );

  return { plainCodes, hashedCodes };
}

/**
 * Verifies a submitted recovery code against a user's list of recovery codes.
 * If valid and unused, marks it as used and returns the matched index.
 * @param {Array} recoveryCodesList - User's recoveryCodes array from document
 * @param {string} candidateCode - User-supplied code
 * @returns {Promise<{ matched: boolean, matchedCodeId?: any }>}
 */
async function verifyAndConsumeRecoveryCode(recoveryCodesList, candidateCode) {
  if (!candidateCode || !Array.isArray(recoveryCodesList) || recoveryCodesList.length === 0) {
    return { matched: false };
  }

  const cleanCandidate = candidateCode.trim().toUpperCase();

  for (const item of recoveryCodesList) {
    if (!item.used) {
      const isMatch = await bcrypt.compare(cleanCandidate, item.codeHash);
      if (isMatch) {
        item.used = true;
        item.usedAt = new Date();
        return { matched: true, matchedCodeId: item._id };
      }
    }
  }

  return { matched: false };
}

/**
 * Returns statistics about recovery codes: total, remaining, used.
 */
function getRecoveryCodeStats(recoveryCodesList) {
  if (!Array.isArray(recoveryCodesList)) {
    return { total: 0, remaining: 0, used: 0 };
  }
  const total = recoveryCodesList.length;
  const used = recoveryCodesList.filter((c) => c.used).length;
  const remaining = total - used;
  return { total, remaining, used };
}

module.exports = {
  generateRecoveryCodes,
  verifyAndConsumeRecoveryCode,
  getRecoveryCodeStats,
};
