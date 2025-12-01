import express from 'express';
import Joi from 'joi';
import YangModel from '../models/YangModel.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Validation schemas
const yangModelSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  namespace: Joi.string().allow('', null).max(500),
  prefix: Joi.string().allow('', null).max(50),
  version: Joi.string().allow('', null).max(50),
  device_type: Joi.string().valid('nexus', 'ios', 'ios-xe', 'ios-xr', 'all').default('nexus'),
  category: Joi.string().valid('interface', 'routing', 'switching', 'security', 'qos', 'system', 'other').default('other'),
  description: Joi.string().allow('', null).max(1000),
  yang_content: Joi.string().required().min(1),
  xml_templates: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    template: Joi.string().required()
  })).default([]),
  config_paths: Joi.array().items(Joi.object({
    path: Joi.string().required(),
    description: Joi.string().allow('', null),
    data_type: Joi.string().allow('', null),
    required: Joi.boolean()
  })).default([])
}).options({ stripUnknown: true });

// GET /api/yang-models - List all YANG models for current user
router.get('/', async (req, res) => {
  try {
    const { device_type, category, active_only = 'true' } = req.query;
    const userId = req.user.id;
    
    let query = { userId };
    
    if (device_type) {
      query.device_type = { $in: [device_type, 'all'] };
    }
    
    if (category) {
      query.category = category;
    }
    
    if (active_only === 'true') {
      query.is_active = true;
    }
    
    const yangModels = await YangModel.find(query)
      .select('-yang_content') // Don't include full content in list
      .sort({ category: 1, name: 1 });
    
    res.json({
      success: true,
      count: yangModels.length,
      yangModels
    });
  } catch (error) {
    console.error('Error fetching YANG models:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch YANG models',
      error: error.message
    });
  }
});

// GET /api/yang-models/:id - Get single YANG model with full content
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const yangModel = await YangModel.findOne({ _id: req.params.id, userId });
    
    if (!yangModel) {
      return res.status(404).json({
        success: false,
        message: 'YANG model not found'
      });
    }
    
    res.json({
      success: true,
      yangModel
    });
  } catch (error) {
    console.error('Error fetching YANG model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch YANG model',
      error: error.message
    });
  }
});

// POST /api/yang-models - Upload new YANG model
router.post('/', async (req, res) => {
  try {
    console.log('📥 YANG model upload request received');
    console.log('📦 Request body keys:', Object.keys(req.body));
    const userId = req.user.id;
    
    const { error, value } = yangModelSchema.validate(req.body);
    
    if (error) {
      console.error('❌ Validation error:', error.details.map(d => d.message).join(', '));
      return res.status(400).json({
        success: false,
        message: 'Validation error: ' + error.details.map(d => d.message).join(', '),
        details: error.details
      });
    }
    
    // Check if model name already exists for this user
    const existingModel = await YangModel.findOne({ userId, name: value.name });
    if (existingModel) {
      return res.status(409).json({
        success: false,
        message: 'YANG model with this name already exists',
        existing_id: existingModel._id
      });
    }
    
    // Parse YANG content to extract additional info (fill in missing fields)
    const parsedInfo = parseYangContent(value.yang_content);
    
    const yangModel = new YangModel({
      ...value,
      // Only use parsed info if not provided
      namespace: value.namespace || parsedInfo.namespace || '',
      prefix: value.prefix || parsedInfo.prefix || '',
      version: value.version || parsedInfo.version || '1.0.0',
      userId,
      uploaded_by: req.user.name || req.user.email || 'user'
    });
    
    await yangModel.save();
    
    console.log(`✅ YANG model saved: ${yangModel.name} (user: ${userId})`);
    
    res.status(201).json({
      success: true,
      message: 'YANG model uploaded successfully',
      yangModel: {
        ...yangModel.toObject(),
        yang_content: undefined // Don't return full content
      }
    });
  } catch (error) {
    console.error('Error uploading YANG model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload YANG model',
      error: error.message
    });
  }
});

// PUT /api/yang-models/:id - Update YANG model
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const yangModel = await YangModel.findOne({ _id: req.params.id, userId });
    
    if (!yangModel) {
      return res.status(404).json({
        success: false,
        message: 'YANG model not found'
      });
    }
    
    const { error, value } = yangModelSchema.validate(req.body, { stripUnknown: true });
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }
    
    // Update fields
    Object.assign(yangModel, value);
    await yangModel.save();
    
    res.json({
      success: true,
      message: 'YANG model updated successfully',
      yangModel: {
        ...yangModel.toObject(),
        yang_content: undefined
      }
    });
  } catch (error) {
    console.error('Error updating YANG model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update YANG model',
      error: error.message
    });
  }
});

// DELETE /api/yang-models/:id - Delete YANG model
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const yangModel = await YangModel.findOneAndDelete({ _id: req.params.id, userId });
    
    if (!yangModel) {
      return res.status(404).json({
        success: false,
        message: 'YANG model not found'
      });
    }
    
    res.json({
      success: true,
      message: 'YANG model deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting YANG model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete YANG model',
      error: error.message
    });
  }
});

// POST /api/yang-models/:id/templates - Add XML template to YANG model
router.post('/:id/templates', async (req, res) => {
  try {
    const { name, description, template } = req.body;
    const userId = req.user.id;
    
    if (!name || !template) {
      return res.status(400).json({
        success: false,
        message: 'Template name and template content are required'
      });
    }
    
    const yangModel = await YangModel.findOne({ _id: req.params.id, userId });
    
    if (!yangModel) {
      return res.status(404).json({
        success: false,
        message: 'YANG model not found'
      });
    }
    
    yangModel.xml_templates.push({ name, description, template });
    await yangModel.save();
    
    res.json({
      success: true,
      message: 'XML template added successfully',
      templates: yangModel.xml_templates
    });
  } catch (error) {
    console.error('Error adding template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add template',
      error: error.message
    });
  }
});

// GET /api/yang-models/for-generation/:deviceType - Get YANG models for config generation
router.get('/for-generation/:deviceType', async (req, res) => {
  try {
    const { deviceType } = req.params;
    const { category } = req.query;
    const userId = req.user.id;
    
    let query = {
      userId,
      is_active: true,
      device_type: { $in: [deviceType, 'all'] }
    };
    
    if (category) {
      query.category = category;
    }
    
    const yangModels = await YangModel.find(query)
      .select('name namespace prefix category xml_templates config_paths description')
      .sort({ category: 1, name: 1 });
    
    // Format for LLM consumption
    const formattedModels = yangModels.map(model => ({
      name: model.name,
      namespace: model.namespace,
      prefix: model.prefix,
      category: model.category,
      description: model.description,
      templates: model.xml_templates,
      paths: model.config_paths
    }));
    
    res.json({
      success: true,
      count: formattedModels.length,
      models: formattedModels
    });
  } catch (error) {
    console.error('Error fetching YANG models for generation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch YANG models',
      error: error.message
    });
  }
});

// POST /api/yang-models/toggle/:id - Toggle active status
router.post('/toggle/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const yangModel = await YangModel.findOne({ _id: req.params.id, userId });
    
    if (!yangModel) {
      return res.status(404).json({
        success: false,
        message: 'YANG model not found'
      });
    }
    
    yangModel.is_active = !yangModel.is_active;
    await yangModel.save();
    
    res.json({
      success: true,
      message: `YANG model ${yangModel.is_active ? 'activated' : 'deactivated'}`,
      is_active: yangModel.is_active
    });
  } catch (error) {
    console.error('Error toggling YANG model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle YANG model',
      error: error.message
    });
  }
});

// Helper function to parse YANG content
function parseYangContent(content) {
  const parsed = {};
  
  // Try to extract module name
  const moduleMatch = content.match(/module\s+([^\s{]+)/);
  if (moduleMatch) {
    parsed.name = parsed.name || moduleMatch[1];
  }
  
  // Try to extract namespace
  const nsMatch = content.match(/namespace\s+"([^"]+)"/);
  if (nsMatch) {
    parsed.namespace = parsed.namespace || nsMatch[1];
  }
  
  // Try to extract prefix
  const prefixMatch = content.match(/prefix\s+([^\s;]+)/);
  if (prefixMatch) {
    parsed.prefix = parsed.prefix || prefixMatch[1].replace(/[";]/g, '');
  }
  
  // Try to extract revision/version
  const revisionMatch = content.match(/revision\s+([^\s{]+)/);
  if (revisionMatch) {
    parsed.version = revisionMatch[1].replace(/[";]/g, '');
  }
  
  return parsed;
}

export default router;
