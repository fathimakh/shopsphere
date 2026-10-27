import jwt from 'jsonwebtoken';
import env from '../config/env.js';

/**
 * Signs a JWT for a user. `tv` (token version) lets the server revoke every token
 * issued before a password change or a "log out of all devices".
 */
const generateToken = (user) =>
  jwt.sign({ id: user._id.toString(), role: user.role, tv: user.tokenVersion ?? 0 }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });

export default generateToken;
