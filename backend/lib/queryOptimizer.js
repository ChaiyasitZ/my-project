/**
 * Query Optimization Utilities
 * Provides helper functions for optimized MongoDB queries
 */

import mongoose from 'mongoose';

/**
 * Pagination helper - creates skip/limit with validation
 * @param {Object} query - Query params with limit and offset
 * @param {number} maxLimit - Maximum allowed limit (default 100)
 * @returns {Object} - { skip, limit }
 */
export function getPagination(query, maxLimit = 100) {
  let limit = parseInt(query.limit) || 20;
  let offset = parseInt(query.offset) || 0;
  
  // Enforce limits
  limit = Math.min(Math.max(1, limit), maxLimit);
  offset = Math.max(0, offset);
  
  return { skip: offset, limit };
}

/**
 * Build sort object from query params
 * @param {Object} query - Query params with sort_by and sort_order
 * @param {string[]} allowedFields - Allowed sort fields
 * @param {string} defaultField - Default sort field
 * @returns {Object} - MongoDB sort object
 */
export function buildSortObject(query, allowedFields, defaultField = 'createdAt') {
  const sortField = allowedFields.includes(query.sort_by) ? query.sort_by : defaultField;
  const sortDirection = query.sort_order?.toLowerCase() === 'asc' ? 1 : -1;
  return { [sortField]: sortDirection };
}

/**
 * Optimized projection - only select needed fields
 * This reduces memory usage and network transfer
 */
export const projections = {
  // Device list view - exclude sensitive data
  deviceList: {
    password: 0,
    enable_password: 0,
    __v: 0
  },
  
  // Device minimal - for dropdowns/selects
  deviceMinimal: {
    _id: 1,
    name: 1,
    type: 1,
    layer: 1,
    ip_address: 1,
    status: 1
  },
  
  // Configuration list - exclude large config text
  configList: {
    generated_config: 0,
    deployment_config: 0,
    deployed_config: 0,
    __v: 0
  },
  
  // Backup list - exclude actual config content
  backupList: {
    running_config: 0,
    startup_config: 0,
    __v: 0
  },
  
  // YANG model list - exclude yang_content
  yangModelList: {
    yang_content: 0,
    __v: 0
  }
};

/**
 * Create aggregation pipeline for counting and data in parallel
 * More efficient than separate count() + find() calls
 * @param {Object} matchStage - MongoDB $match stage
 * @param {Object} options - { skip, limit, sort, project }
 * @returns {Array} - Aggregation pipeline
 */
export function createPaginatedAggregation(matchStage, options = {}) {
  const { skip = 0, limit = 20, sort = { createdAt: -1 }, project, lookup } = options;
  
  const pipeline = [
    { $match: matchStage },
    {
      $facet: {
        // Get total count
        metadata: [{ $count: 'total' }],
        // Get paginated data
        data: [
          { $sort: sort },
          { $skip: skip },
          { $limit: limit },
          ...(lookup ? [lookup] : []),
          ...(project ? [{ $project: project }] : [])
        ]
      }
    },
    {
      $project: {
        total: { $ifNull: [{ $arrayElemAt: ['$metadata.total', 0] }, 0] },
        data: 1
      }
    }
  ];
  
  return pipeline;
}

/**
 * Batch operation helper - processes items in chunks
 * Prevents memory issues with large datasets
 * @param {Array} items - Items to process
 * @param {number} batchSize - Size of each batch
 * @param {Function} processor - Async function to process each batch
 */
export async function processBatch(items, batchSize, processor) {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Check if ObjectId is valid before query
 * Prevents unnecessary database calls with invalid IDs
 * @param {string} id - ID to validate
 * @returns {boolean}
 */
export function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && 
         (String(new mongoose.Types.ObjectId(id)) === id);
}

/**
 * Create lean query - faster as it returns plain objects instead of Mongoose documents
 * @param {Object} model - Mongoose model
 * @param {Object} filter - Query filter
 * @param {Object} projection - Fields to include/exclude
 * @returns {Query} - Lean query
 */
export function leanQuery(model, filter, projection = {}) {
  return model.find(filter, projection).lean();
}

export default {
  getPagination,
  buildSortObject,
  projections,
  createPaginatedAggregation,
  processBatch,
  isValidObjectId,
  leanQuery
};
