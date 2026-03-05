import User from '../models/User.js';
import jwt from 'jsonwebtoken';

const authCookieName = 'authToken';

const getCookieOptions = (maxAgeMs) => {
  const secure = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';
  const sameSite = process.env.COOKIE_SAMESITE || (secure ? 'None' : 'Lax');
  const domain = process.env.COOKIE_DOMAIN || undefined;
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    domain,
    maxAge: maxAgeMs,
  };
};

const signAuthToken = (user, expiresIn) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn });

const sanitizeUser = (userDoc) => {
  const user = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete user.password;
  return user;
};

const register = async (req, res) => {
  const { username, password, dealerId, city, phone, email } = req.body;
  try {
    const user = new User({ username, dealerId, password, phone, email, city });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const login = async (req, res) => {
  const { dealerId, password } = req.body;
  try {
    const user = await User.findOne({ dealerId });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = signAuthToken(user, '7d');
    res.cookie(authCookieName, token, getCookieOptions(7 * 24 * 60 * 60 * 1000));
    return res.json({
      message: 'User logged in successfully',
      user: sanitizeUser(user),
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const adminLogin = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    const passwordMatches = await user.comparePassword(password);
    if (!passwordMatches || user.role !== 'admin') {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = signAuthToken(user, '1d');
    res.cookie(authCookieName, token, getCookieOptions(24 * 60 * 60 * 1000));
    return res.status(200).json({
      message: 'Admin logged in successfully',
      user: sanitizeUser(user),
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const logout = async (req, res) => {
  try {
    const clearOptions = getCookieOptions(1);
    delete clearOptions.maxAge;
    // Express clearCookie already expires immediately; keep only matching cookie attributes.
    res.clearCookie(authCookieName, clearOptions);
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error during logout process',
      error: error.message,
    });
  }
};

const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json({ user });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export {
  adminLogin,
  register,
  login,
  logout,
  me,
};
