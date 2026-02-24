import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import User from '../models/User.js';

/**
 * In-memory user cache to avoid hitting MongoDB on every authenticated request.
 * When Dashboard fires 7 parallel API calls, this prevents 7 separate User.findById queries.
 * TTL: 60 seconds — balances freshness with performance.
 */
const userCache = new Map();
const USER_CACHE_TTL = 60 * 1000; // 60 seconds

function getCachedUser(userId) {
  const entry = userCache.get(userId);
  if (entry && Date.now() - entry.timestamp < USER_CACHE_TTL) {
    return entry.user;
  }
  if (entry) userCache.delete(userId); // Expired
  return null;
}

function setCachedUser(userId, user) {
  userCache.set(userId, { user, timestamp: Date.now() });
  // Prevent memory leak: cap at 500 entries
  if (userCache.size > 500) {
    const oldestKey = userCache.keys().next().value;
    userCache.delete(oldestKey);
  }
}

/** Invalidate cached user (call on profile update, deactivation, etc.) */
export function invalidateUserAuthCache(userId) {
  userCache.delete(userId?.toString());
}

/**
 * Middleware to verify JWT token and attach user to request
 */
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, config.auth.jwtSecret);
    
    // Try cache first — avoids DB hit on every request
    let user = getCachedUser(decoded.userId);
    
    if (!user) {
      // Cache miss — fetch from database and cache the result
      user = await User.findById(decoded.userId).lean();
      if (user) {
        setCachedUser(decoded.userId, user);
      }
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Attach user to request object
    req.user = user;
    req.userId = user._id;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token, just doesn't attach user
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, config.auth.jwtSecret);
      
      let user = getCachedUser(decoded.userId);
      if (!user) {
        user = await User.findById(decoded.userId).lean();
        if (user) setCachedUser(decoded.userId, user);
      }
      
      if (user && user.isActive) {
        req.user = user;
        req.userId = user._id;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

/**
 * Middleware to check if user has admin role
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  next();
};

/**
 * Generate JWT token for user
 */
export const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user._id,
      email: user.email,
      role: user.role 
    },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn || '7d' }
  );
};

/**
 * Generate refresh token for user
 */
export const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user._id, type: 'refresh' },
    config.auth.jwtSecret,
    { expiresIn: '30d' }
  );
};

export default {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  generateToken,
  generateRefreshToken,
  invalidateUserAuthCache
};
