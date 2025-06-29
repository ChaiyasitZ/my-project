import express from 'express';
import Joi from 'joi';
import ConfigurationTemplate from '../models/ConfigurationTemplate.js';
import aiService from '../services/aiService.js';
import templateService from '../services/templateService.js';

const router = express.Router();

// Validation schemas
const templateCreateSchema = Joi.object({
  name: Joi.string().required().min(3).max(255),
  description: Joi.string().optional(),
  device_type: Joi.string().valid('router', 'switch', 'firewall', 'general').required(),
  category: Joi.string().required().max(100),
  template_config: Joi.string().required(),
  variables: Joi.object().optional()
});

const templateUpdateSchema = Joi.object({
  name: Joi.string().optional().min(3).max(255),
  description: Joi.string().optional(),
  device_type: Joi.string().valid('router', 'switch', 'firewall', 'general').optional(),
  category: Joi.string().optional().max(100),
  template_config: Joi.string().optional(),
  variables: Joi.object().optional()
});

// GET /api/templates - List all templates with filtering
router.get('/', async (req, res) => {
  try {
    const { device_type, category, search, limit = 50, offset = 0 } = req.query;
    
    // Build filter
    const filter = {};
    if (device_type) filter.device_type = device_type;
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get templates with pagination
    const [templates, total] = await Promise.all([
      ConfigurationTemplate.find(filter)
        .sort({ category: 1, name: 1 })
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .lean(),
      ConfigurationTemplate.countDocuments(filter)
    ]);
    
    res.json({
      success: true,
      templates: templates,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates',
      error: error.message
    });
  }
});

// GET /api/templates/categories - Get all template categories
router.get('/categories', async (req, res) => {
  try {
    const result = await aiService.getTemplateCategories();
    res.json(result);
  } catch (error) {
    console.error('Error fetching template categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template categories',
      error: error.message
    });
  }
});

// GET /api/templates/by-device/:device_type - Get templates by device type
router.get('/by-device/:device_type', async (req, res) => {
  try {
    const { device_type } = req.params;
    const { category } = req.query;
    
    const result = await aiService.getAvailableTemplates(device_type, category);
    res.json(result);
    
  } catch (error) {
    console.error('Error fetching templates by device type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates',
      error: error.message
    });
  }
});

// GET /api/templates/:id - Get specific template
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const template = await ConfigurationTemplate.findById(id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    res.json({
      success: true,
      template: template
    });
    
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template',
      error: error.message
    });
  }
});

// POST /api/templates/preview - Preview template with variables
router.post('/preview', async (req, res) => {
  try {
    const { template_id, variables } = req.body;
    
    if (!template_id) {
      return res.status(400).json({
        success: false,
        message: 'Template ID is required'
      });
    }
    
    const template = await ConfigurationTemplate.findById(template_id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    // Substitute variables
    const configuration = templateService.substituteVariables(
      template.template_config,
      variables || {},
      template.variables
    );
    
    res.json({
      success: true,
      configuration: configuration,
      template: {
        name: template.name,
        description: template.description,
        category: template.category,
        device_type: template.device_type
      }
    });
    
  } catch (error) {
    console.error('Error previewing template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to preview template',
      error: error.message
    });
  }
});

// POST /api/templates/parse-prompt - Parse a prompt to identify templates
router.post('/parse-prompt', async (req, res) => {
  try {
    const { prompt, device_type } = req.body;
    
    if (!prompt || !device_type) {
      return res.status(400).json({
        success: false,
        message: 'Prompt and device_type are required'
      });
    }
    
    const parseResult = templateService.parsePrompt(prompt, device_type);
    const recommendation = await aiService.getGenerationMethod(prompt, device_type);
    
    res.json({
      success: true,
      parse_result: parseResult,
      recommendation: recommendation
    });
    
  } catch (error) {
    console.error('Error parsing prompt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to parse prompt',
      error: error.message
    });
  }
});

// POST /api/templates - Create new template
router.post('/', async (req, res) => {
  try {
    const { error, value } = templateCreateSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }
    
    // Check if template name already exists
    const existingTemplate = await ConfigurationTemplate.findOne({ name: value.name });
    
    if (existingTemplate) {
      return res.status(409).json({
        success: false,
        message: 'Template with this name already exists'
      });
    }
    
    const template = new ConfigurationTemplate(value);
    await template.save();
    
    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      template: template
    });
    
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create template',
      error: error.message
    });
  }
});

// PUT /api/templates/:id - Update template
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = templateUpdateSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }
    
    const template = await ConfigurationTemplate.findByIdAndUpdate(
      id,
      value,
      { new: true, runValidators: true }
    );
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Template updated successfully',
      template: template
    });
    
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update template',
      error: error.message
    });
  }
});

// DELETE /api/templates/:id - Delete template
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const template = await ConfigurationTemplate.findByIdAndDelete(id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete template',
      error: error.message
    });
  }
});

// GET /api/templates/stats/summary - Get template statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await ConfigurationTemplate.aggregate([
      {
        $group: {
          _id: null,
          total_templates: { $sum: 1 },
          categories: { $addToSet: '$category' },
          device_types: { $addToSet: '$device_type' }
        }
      },
      {
        $project: {
          _id: 0,
          total_templates: 1,
          total_categories: { $size: '$categories' },
          total_device_types: { $size: '$device_types' },
          categories: 1,
          device_types: 1
        }
      }
    ]);
    
    const categoryStats = await ConfigurationTemplate.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          device_types: { $addToSet: '$device_type' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    const deviceTypeStats = await ConfigurationTemplate.aggregate([
      {
        $group: {
          _id: '$device_type',
          count: { $sum: 1 },
          categories: { $addToSet: '$category' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    res.json({
      success: true,
      summary: stats[0] || {
        total_templates: 0,
        total_categories: 0,
        total_device_types: 0,
        categories: [],
        device_types: []
      },
      category_breakdown: categoryStats,
      device_type_breakdown: deviceTypeStats
    });
    
  } catch (error) {
    console.error('Error fetching template stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template statistics',
      error: error.message
    });
  }
});

export default router; 