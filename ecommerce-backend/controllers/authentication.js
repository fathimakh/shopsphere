import bcrypt from 'bcryptjs';
import User from '../models/user.js';
import ApiError from '../utils/ApiError.js';
import generateToken from '../utils/generateToken.js';
import { normalizeEmail } from '../utils/strings.js';

// Compared against when the email is unknown, so a failed login takes the same time
// whether or not the account exists (no user enumeration through response timing).
const DUMMY_HASH = bcrypt.hashSync('timing-safe-placeholder', 10);

/** POST /api/auth/register — creates a shopper account (role is always "user"). */
export const register = async (req, res) => {
  const { name, email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (await User.exists({ email: normalizedEmail })) {
    throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  }

  const user = await User.create({ name: name.trim(), email: normalizedEmail, password });
  res.status(201).json({ success: true, token: generateToken(user), user });
};

/** POST /api/auth/login — returns a fresh JWT for valid credentials. */
export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: normalizeEmail(email) }).select('+password +tokenVersion');

  const passwordMatches = user ? await user.comparePassword(password) : await bcrypt.compare(String(password), DUMMY_HASH);
  if (!user || !passwordMatches) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  res.json({ success: true, token: generateToken(user), user });
};

/** GET /api/auth/me — the user behind the token (used by the SPA to validate a stored session). */
export const getMe = (req, res) => {
  res.json({ success: true, user: req.user });
};

/**
 * POST /api/auth/logout — JWTs are stateless, so a normal logout only needs the client to drop
 * its token. { allDevices: true } bumps tokenVersion, which revokes every token issued so far.
 */
export const logout = async (req, res) => {
  if (req.body?.allDevices === true) {
    await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
    res.json({ success: true, message: 'Logged out from all devices' });
    return;
  }
  res.json({ success: true, message: 'Logged out successfully' });
};
