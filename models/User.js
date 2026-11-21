const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { encrypt, decrypt } = require('../utils/cryptoUtil');

const recoveryCodeSchema = new mongoose.Schema(
  {
    codeHash: {
      type: String,
      required: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    twoFactorSecret: {
      type: String,
      default: null,
    },
    temporaryTwoFactorSecret: {
      type: String,
      default: null,
    },
    recoveryCodes: [recoveryCodeSchema],
  },
  {
    timestamps: true,
  }
);

/**
 * Pre-save middleware to hash password if modified.
 */
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Instance method to compare plain candidate password with stored hash.
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Encrypt and store 2FA secret (active).
 */
userSchema.methods.setTwoFactorSecret = function (plainSecret) {
  if (!plainSecret) {
    this.twoFactorSecret = null;
  } else {
    this.twoFactorSecret = encrypt(plainSecret);
  }
};

/**
 * Decrypt active 2FA secret.
 */
userSchema.methods.getTwoFactorSecret = function () {
  if (!this.twoFactorSecret) return null;
  try {
    return decrypt(this.twoFactorSecret);
  } catch (err) {
    console.error('[User] Failed to decrypt twoFactorSecret:', err.message);
    return null;
  }
};

/**
 * Encrypt and store temporary 2FA secret (during setup).
 */
userSchema.methods.setTemporaryTwoFactorSecret = function (plainSecret) {
  if (!plainSecret) {
    this.temporaryTwoFactorSecret = null;
  } else {
    this.temporaryTwoFactorSecret = encrypt(plainSecret);
  }
};

/**
 * Decrypt temporary 2FA secret.
 */
userSchema.methods.getTemporaryTwoFactorSecret = function () {
  if (!this.temporaryTwoFactorSecret) return null;
  try {
    return decrypt(this.temporaryTwoFactorSecret);
  } catch (err) {
    console.error('[User] Failed to decrypt temporaryTwoFactorSecret:', err.message);
    return null;
  }
};

/**
 * Clear all 2FA data (disable 2FA).
 */
userSchema.methods.disableTwoFactor = function () {
  this.twoFactorEnabled = false;
  this.twoFactorSecret = null;
  this.temporaryTwoFactorSecret = null;
  this.recoveryCodes = [];
};

const User = mongoose.model('User', userSchema);

module.exports = User;
