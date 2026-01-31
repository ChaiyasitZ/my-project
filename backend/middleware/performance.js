/**
 * Response Compression and Optimization Middleware
 * Improves API response times through compression
 */

import compression from 'compression';

/**
 * Compression middleware configuration
 * Compresses responses > 1KB, with smart filtering
 */
export const compressionMiddleware = compression({
  // Only compress responses larger than 1KB
  threshold: 1024,
  
  // Compression level (1-9, higher = more compression but slower)
  level: 6,
  
  // Filter function - decide which responses to compress
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    
    // Skip compression for SSE/streaming endpoints
    if (req.path.includes('/console/stream')) {
      return false;
    }
    
    // Use default compression filter
    return compression.filter(req, res);
  }
});

/**
 * Response time tracking middleware
 * Adds X-Response-Time header for debugging
 */
export function responseTimeMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    
    // Log slow requests (> 500ms)
    if (durationMs > 500) {
      console.warn(`⚠️ Slow request: ${req.method} ${req.path} took ${durationMs.toFixed(2)}ms`);
    }
  });
  
  // Add response time header
  const originalSend = res.send;
  res.send = function(body) {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    res.set('X-Response-Time', `${durationMs.toFixed(2)}ms`);
    return originalSend.call(this, body);
  };
  
  next();
}

/**
 * ETag middleware for caching
 * Returns 304 Not Modified if content hasn't changed
 */
export function etagMiddleware(req, res, next) {
  // Only for GET requests
  if (req.method !== 'GET') {
    return next();
  }
  
  const originalJson = res.json;
  
  res.json = function(body) {
    // Generate simple ETag from response body
    const crypto = require('crypto');
    const etag = crypto
      .createHash('md5')
      .update(JSON.stringify(body))
      .digest('hex');
    
    res.set('ETag', `"${etag}"`);
    
    // Check if client has matching ETag
    const clientEtag = req.headers['if-none-match'];
    if (clientEtag === `"${etag}"`) {
      return res.status(304).end();
    }
    
    return originalJson.call(this, body);
  };
  
  next();
}

/**
 * Cache-Control headers middleware
 * Sets appropriate caching headers based on route
 */
export function cacheControlMiddleware(maxAge = 60) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method === 'GET') {
      res.set('Cache-Control', `private, max-age=${maxAge}`);
    } else {
      res.set('Cache-Control', 'no-store');
    }
    next();
  };
}

export default {
  compressionMiddleware,
  responseTimeMiddleware,
  etagMiddleware,
  cacheControlMiddleware
};
