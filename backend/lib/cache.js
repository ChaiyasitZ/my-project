/**
 * Backend Performance Optimization Utilities
 * Implements caching, query optimization, and response compression
 */

import NodeCache from 'node-cache';

// In-memory cache with TTL (Time To Live)
// stdTTL: 60 seconds default, checkperiod: 120 seconds
const cache = new NodeCache({ 
  stdTTL: 60, 
  checkperiod: 120,
  useClones: false, // Better performance, but be careful with object mutations
  maxKeys: 1000 // Limit cache size
});

/**
 * Cache key generators for consistent key naming
 */
export const CacheKeys = {
  // Device cache keys
  devices: (userId) => `devices:${userId}`,
  device: (userId, deviceId) => `device:${userId}:${deviceId}`,
  deviceStats: (userId) => `deviceStats:${userId}`,
  
  // Configuration cache keys
  configurations: (userId) => `configurations:${userId}`,
  configHistory: (userId, filter) => `configHistory:${userId}:${filter || 'all'}`,
  configAnalytics: (userId, days) => `configAnalytics:${userId}:${days}`,
  
  // Backup cache keys
  backups: (userId) => `backups:${userId}`,
  backupsByDevice: (userId, deviceId) => `backups:${userId}:${deviceId}`,
  
  // YANG models cache keys
  yangModels: (userId) => `yangModels:${userId}`,
  yangModel: (userId, modelId) => `yangModel:${userId}:${modelId}`,
};

/**
 * Get cached data or execute query and cache result
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Async function to fetch data if not cached
 * @param {number} ttl - Time to live in seconds (optional, uses default if not specified)
 * @returns {Promise<any>} - Cached or fresh data
 */
export async function getOrSetCache(key, fetchFn, ttl = 60) {
  const cached = cache.get(key);
  if (cached !== undefined) {
    console.log(`📦 Cache HIT: ${key}`);
    return cached;
  }
  
  console.log(`🔍 Cache MISS: ${key}`);
  const data = await fetchFn();
  cache.set(key, data, ttl);
  return data;
}

/**
 * Invalidate cache entries by pattern
 * @param {string} pattern - Pattern to match (e.g., 'devices:userId123')
 */
export function invalidateCache(pattern) {
  const keys = cache.keys();
  const matchedKeys = keys.filter(key => key.startsWith(pattern));
  matchedKeys.forEach(key => cache.del(key));
  console.log(`🗑️ Cache invalidated: ${matchedKeys.length} keys matching "${pattern}"`);
}

/**
 * Invalidate all cache for a user
 * @param {string} userId - User ID
 */
export function invalidateUserCache(userId) {
  invalidateCache(`devices:${userId}`);
  invalidateCache(`device:${userId}`);
  invalidateCache(`configurations:${userId}`);
  invalidateCache(`configHistory:${userId}`);
  invalidateCache(`configAnalytics:${userId}`);
  invalidateCache(`backups:${userId}`);
  invalidateCache(`yangModels:${userId}`);
}

/**
 * Get cache statistics
 * @returns {Object} - Cache statistics
 */
export function getCacheStats() {
  return {
    keys: cache.keys().length,
    hits: cache.getStats().hits,
    misses: cache.getStats().misses,
    hitRate: cache.getStats().hits / (cache.getStats().hits + cache.getStats().misses) || 0
  };
}

/**
 * Clear all cache
 */
export function clearAllCache() {
  cache.flushAll();
  console.log('🗑️ All cache cleared');
}

export default cache;
