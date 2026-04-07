'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: {
      type: String,
      enum: ['admin', 'analyst', 'viewer'],
      default: 'analyst',
    },
    last_login:    { type: Date, default: null },
    is_active:     { type: Boolean, default: true },
    avatar_initials: { type: String }, // derived from name
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Hash password before save ────────────────────────────────────────────────
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
  
  if (this.name) {
    this.avatar_initials = this.name
      .split(' ')
      .filter(n => n.length > 0)
      .map(n => n[0].toUpperCase())
      .slice(0, 2)
      .join('');
  }
});

// ── Instance method: compare password ────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Instance method: toSafeObject (strip password) ───────────────────────────
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
