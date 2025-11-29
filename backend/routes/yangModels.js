import express from 'express';
import Joi from 'joi';
import YangModel from '../models/YangModel.js';

const router = express.Router();

// Validation schemas
const yangModelSchema = Joi.object({
  name: Joi.string().required().min(3).max(100),
  namespace: Joi.string().required().uri(),
  prefix: Joi.string().max(50),
  version: Joi.string().max(20),
  device_type: Joi.string().valid('nexus', 'ios', 'ios-xe', 'ios-xr', 'all'),
  category: Joi.string().valid('interface', 'routing', 'switching', 'security', 'qos', 'system', 'other'),
  description: Joi.string().max(500),
  yang_content: Joi.string().required().min(50),
  xml_templates: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    description: Joi.string(),
    template: Joi.string().required()
  })),
  config_paths: Joi.array().items(Joi.object({
    path: Joi.string().required(),
    description: Joi.string(),
    data_type: Joi.string(),
    required: Joi.boolean()
  }))
});

// GET /api/yang-models - List all YANG models
router.get('/', async (req, res) => {
  try {
    const { device_type, category, active_only = 'true' } = req.query;
    
    let query = {};
    
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
    const yangModel = await YangModel.findById(req.params.id);
    
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
    
    const { error, value } = yangModelSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }
    
    // Check if namespace already exists
    const existingModel = await YangModel.findOne({ namespace: value.namespace });
    if (existingModel) {
      return res.status(409).json({
        success: false,
        message: 'YANG model with this namespace already exists',
        existing_id: existingModel._id
      });
    }
    
    // Parse YANG content to extract additional info
    const parsedInfo = parseYangContent(value.yang_content);
    
    const yangModel = new YangModel({
      ...value,
      ...parsedInfo
    });
    
    await yangModel.save();
    
    console.log(`✅ YANG model saved: ${yangModel.name} (${yangModel.namespace})`);
    
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
    const yangModel = await YangModel.findById(req.params.id);
    
    if (!yangModel) {
      return res.status(404).json({
        success: false,
        message: 'YANG model not found'
      });
    }
    
    const { error, value } = yangModelSchema.validate(req.body);
    
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
    const yangModel = await YangModel.findByIdAndDelete(req.params.id);
    
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
    
    if (!name || !template) {
      return res.status(400).json({
        success: false,
        message: 'Template name and template content are required'
      });
    }
    
    const yangModel = await YangModel.findById(req.params.id);
    
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
    
    let query = {
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
    const yangModel = await YangModel.findById(req.params.id);
    
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
