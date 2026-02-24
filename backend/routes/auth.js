import express from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from '../config/config.js';
import User from '../models/User.js';
import { authenticateToken, generateToken, generateRefreshToken } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Configure Passport Google Strategy
passport.use(new GoogleStrategy({
    clientID: config.auth.googleClientId,
    clientSecret: config.auth.googleClientSecret,
    callbackURL: config.auth.googleCallbackUrl,
    scope: ['profile', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await User.findOrCreateFromGoogle(profile);
      return done(null, user);
    } catch (error) {
      console.error('Google OAuth error:', error);
      return done(error, null);
    }
  }
));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

/**
 * @route   GET /api/auth/google
 * @desc    Initiate Google OAuth login
 * @access  Public
 */
router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account' // Always show account selector
  })
);

/**
 * @route   GET /api/auth/google/callback
 * @desc    Google OAuth callback
 * @access  Public
 */
router.get('/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${config.auth.frontendUrl}/#/login?error=auth_failed`
  }),
  (req, res) => {
    try {
      // Generate tokens
      const token = generateToken(req.user);
      const refreshToken = generateRefreshToken(req.user);
      
      // Redirect to frontend with token (using hash routing for HashRouter)
      const baseUrl = config.auth.frontendUrl;
      const redirectUrl = `${baseUrl}/#/auth/callback?token=${encodeURIComponent(token)}&refreshToken=${encodeURIComponent(refreshToken)}`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(`${config.auth.frontendUrl}/#/login?error=token_generation_failed`);
    }
  }
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get('/me', authenticateToken, (req, res) => {
  // req.user may be a lean object (from cache) without Mongoose methods
  const user = req.user.toSafeObject ? req.user.toSafeObject() : {
    id: req.user._id,
    googleId: req.user.googleId,
    email: req.user.email,
    name: req.user.name,
    picture: req.user.picture,
    role: req.user.role,
    isActive: req.user.isActive,
    preferences: req.user.preferences,
    lastLogin: req.user.lastLogin,
    createdAt: req.user.createdAt
  };
  res.json({
    success: true,
    user
  });
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public (with refresh token)
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    const decoded = jwt.verify(refreshToken, config.auth.jwtSecret);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }
    
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
router.post('/logout', authenticateToken, (req, res) => {
  // In a stateless JWT setup, logout is handled client-side
  // This endpoint can be used to invalidate tokens if using a token blacklist
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * @route   PUT /api/auth/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const { theme, language, notifications } = req.body;
    
    const updateData = {};
    if (theme) updateData['preferences.theme'] = theme;
    if (language) updateData['preferences.language'] = language;
    if (typeof notifications === 'boolean') updateData['preferences.notifications'] = notifications;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateData },
      { new: true }
    );

    res.json({
      success: true,
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences'
    });
  }
});

/**
 * @route   GET /api/auth/status
 * @desc    Check authentication status (public)
 * @access  Public
 */
router.get('/status', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.json({
      success: true,
      authenticated: false
    });
  }

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    res.json({
      success: true,
      authenticated: true,
      userId: decoded.userId
    });
  } catch {
    res.json({
      success: true,
      authenticated: false
    });
  }
});

export { passport };
export default router;
