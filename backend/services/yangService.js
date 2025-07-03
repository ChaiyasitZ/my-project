import YangModel from '../models/YangModel.js';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

export class YangService {
  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: true,
      processEntities: true,
      trimValues: true
    });
    
    this.xmlBuilder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
      indentBy: '  ',
      suppressEmptyNode: true
    });
    
    console.log('🗂️ YANG Service initialized');
  }

  // Parse YANG content to tree structure
  parseYangToTree(yangContent) {
    try {
      const tree = {
        modules: {},
        imports: [],
        includes: [],
        typedefs: {},
        groupings: {},
        containers: {},
        lists: {},
        leaves: {},
        leafLists: {}
      };

      // Basic YANG parsing (simplified for demo)
      const lines = yangContent.split('\n');
      let currentModule = null;
      let currentContainer = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('module ')) {
          currentModule = line.split(' ')[1];
          tree.modules[currentModule] = {
            name: currentModule,
            namespace: '',
            prefix: '',
            containers: {},
            lists: {},
            leaves: {}
          };
        }
        
        if (line.startsWith('namespace ')) {
          const namespace = line.match(/"([^"]+)"/)?.[1];
          if (currentModule && namespace) {
            tree.modules[currentModule].namespace = namespace;
          }
        }
        
        if (line.startsWith('prefix ')) {
          const prefix = line.split(' ')[1].replace(/[";]/g, '');
          if (currentModule && prefix) {
            tree.modules[currentModule].prefix = prefix;
          }
        }
        
        if (line.startsWith('container ')) {
          const containerName = line.split(' ')[1];
          const container = {
            name: containerName,
            description: '',
            leaves: {},
            containers: {},
            lists: {}
          };
          
          if (currentModule) {
            tree.modules[currentModule].containers[containerName] = container;
            tree.containers[containerName] = container;
            currentContainer = containerName;
          }
        }
        
        if (line.startsWith('leaf ')) {
          const leafName = line.split(' ')[1];
          const leaf = {
            name: leafName,
            type: '',
            description: '',
            mandatory: false,
            default: null
          };
          
          // Look ahead for type and other properties
          for (let j = i + 1; j < lines.length && lines[j].includes('}') === false; j++) {
            const nextLine = lines[j].trim();
            if (nextLine.startsWith('type ')) {
              leaf.type = nextLine.split(' ')[1].replace(/[";]/g, '');
            }
            if (nextLine.startsWith('description ')) {
              leaf.description = nextLine.match(/"([^"]+)"/)?.[1] || '';
            }
            if (nextLine.includes('mandatory true')) {
              leaf.mandatory = true;
            }
            if (nextLine.startsWith('default ')) {
              leaf.default = nextLine.split(' ')[1].replace(/[";]/g, '');
            }
          }
          
          if (currentModule) {
            if (currentContainer && tree.containers[currentContainer]) {
              tree.containers[currentContainer].leaves[leafName] = leaf;
            } else {
              tree.modules[currentModule].leaves[leafName] = leaf;
            }
            tree.leaves[leafName] = leaf;
          }
        }
      }

      return tree;
    } catch (error) {
      console.error('❌ Error parsing YANG content:', error);
      throw new Error(`YANG parsing failed: ${error.message}`);
    }
  }

  // Get YANG models by vendor
  async getModelsByVendor(vendor) {
    try {
      return await YangModel.find({ vendor, status: 'active' })
        .select('name namespace prefix revision vendor category description')
        .lean();
    } catch (error) {
      console.error('❌ Error fetching YANG models by vendor:', error);
      throw error;
    }
  }

  // Search YANG models
  async searchModels(query, filters = {}) {
    try {
      const searchCriteria = { status: 'active' };
      
      if (query) {
        searchCriteria.$or = [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { namespace: { $regex: query, $options: 'i' } }
        ];
      }
      
      if (filters.vendor) {
        searchCriteria.vendor = filters.vendor;
      }
      
      if (filters.category) {
        searchCriteria.category = filters.category;
      }

      return await YangModel.find(searchCriteria)
        .select('name namespace prefix revision vendor category description')
        .sort({ name: 1 })
        .lean();
    } catch (error) {
      console.error('❌ Error searching YANG models:', error);
      throw error;
    }
  }

  // Get YANG model details with parsed structure
  async getModelDetails(modelId) {
    try {
      const model = await YangModel.findById(modelId).lean();
      if (!model) {
        throw new Error('YANG model not found');
      }

      // If parsed_structure is empty, parse it now
      if (!model.parsed_structure || Object.keys(model.parsed_structure).length === 0) {
        const tree = this.parseYangToTree(model.yang_content);
        
        // Update the model with parsed structure
        await YangModel.findByIdAndUpdate(modelId, { parsed_structure: tree });
        model.parsed_structure = tree;
      }

      return model;
    } catch (error) {
      console.error('❌ Error getting YANG model details:', error);
      throw error;
    }
  }

  // Validate XML against YANG model
  validateXmlAgainstYang(xmlString, yangModel) {
    try {
      const validation = {
        isValid: true,
        errors: [],
        warnings: []
      };

      // Parse XML
      let xmlData;
      try {
        xmlData = this.xmlParser.parse(xmlString);
      } catch (error) {
        validation.isValid = false;
        validation.errors.push(`XML parsing error: ${error.message}`);
        return validation;
      }

      // Basic validation against YANG structure
      if (yangModel.parsed_structure && yangModel.parsed_structure.containers) {
        this.validateXmlNode(xmlData, yangModel.parsed_structure, validation, '');
      }

      return validation;
    } catch (error) {
      console.error('❌ Error validating XML against YANG:', error);
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: []
      };
    }
  }

  // Recursive XML node validation
  validateXmlNode(xmlNode, yangStructure, validation, path) {
    if (!xmlNode || typeof xmlNode !== 'object') return;

    Object.keys(xmlNode).forEach(key => {
      const currentPath = path ? `${path}.${key}` : key;
      const value = xmlNode[key];

      // Skip XML attributes
      if (key.startsWith('@_')) return;

      // Check if this element exists in YANG structure
      const found = this.findYangElement(key, yangStructure);
      if (!found) {
        validation.warnings.push(`Element '${key}' not found in YANG model at path: ${currentPath}`);
        return;
      }

      // Validate based on YANG type
      if (found.type === 'leaf') {
        this.validateLeafValue(value, found.definition, validation, currentPath);
      } else if (found.type === 'container' && typeof value === 'object') {
        this.validateXmlNode(value, found.definition, validation, currentPath);
      }
    });
  }

  // Find YANG element in structure
  findYangElement(elementName, yangStructure) {
    // Check containers
    if (yangStructure.containers && yangStructure.containers[elementName]) {
      return {
        type: 'container',
        definition: yangStructure.containers[elementName]
      };
    }

    // Check leaves
    if (yangStructure.leaves && yangStructure.leaves[elementName]) {
      return {
        type: 'leaf',
        definition: yangStructure.leaves[elementName]
      };
    }

    // Check in modules
    if (yangStructure.modules) {
      for (const moduleName of Object.keys(yangStructure.modules)) {
        const module = yangStructure.modules[moduleName];
        const found = this.findYangElement(elementName, module);
        if (found) return found;
      }
    }

    return null;
  }

  // Validate leaf value
  validateLeafValue(value, leafDefinition, validation, path) {
    if (leafDefinition.mandatory && (value === null || value === undefined || value === '')) {
      validation.errors.push(`Mandatory leaf '${path}' is missing or empty`);
      validation.isValid = false;
      return;
    }

    // Type validation
    const type = leafDefinition.type;
    if (type && value !== null && value !== undefined) {
      switch (type) {
        case 'string':
          if (typeof value !== 'string') {
            validation.errors.push(`Leaf '${path}' should be string, got ${typeof value}`);
            validation.isValid = false;
          }
          break;
        case 'uint8':
        case 'uint16':
        case 'uint32':
          if (!Number.isInteger(Number(value))) {
            validation.errors.push(`Leaf '${path}' should be integer, got ${value}`);
            validation.isValid = false;
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
            validation.errors.push(`Leaf '${path}' should be boolean, got ${value}`);
            validation.isValid = false;
          }
          break;
      }
    }
  }

  // Generate NETCONF XML template from YANG model
  generateXmlTemplate(yangModel, operation = 'get-config') {
    try {
      if (!yangModel.parsed_structure) {
        throw new Error('YANG model must have parsed structure');
      }

      const template = {
        operation,
        examples: {}
      };

      // Generate examples for each container
      if (yangModel.parsed_structure.containers) {
        Object.keys(yangModel.parsed_structure.containers).forEach(containerName => {
          const container = yangModel.parsed_structure.containers[containerName];
          template.examples[containerName] = this.generateContainerXml(container, yangModel.namespace);
        });
      }

      return template;
    } catch (error) {
      console.error('❌ Error generating XML template:', error);
      throw error;
    }
  }

  // Generate XML for a container
  generateContainerXml(container, namespace) {
    const xml = {
      [`@_xmlns`]: namespace
    };

    // Add leaves
    if (container.leaves) {
      Object.keys(container.leaves).forEach(leafName => {
        const leaf = container.leaves[leafName];
        xml[leafName] = this.getDefaultValueForType(leaf.type, leaf.default);
      });
    }

    return xml;
  }

  // Get default value for YANG type
  getDefaultValueForType(type, defaultValue) {
    if (defaultValue !== null && defaultValue !== undefined) {
      return defaultValue;
    }

    switch (type) {
      case 'string':
        return 'example-string';
      case 'uint8':
      case 'uint16':
      case 'uint32':
      case 'int8':
      case 'int16':
      case 'int32':
        return 0;
      case 'boolean':
        return false;
      case 'ipv4-address':
        return '192.168.1.1';
      default:
        return 'example-value';
    }
  }

  // Get YANG statistics
  async getYangStatistics() {
    try {
      const stats = await YangModel.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            byVendor: {
              $push: {
                vendor: '$vendor',
                category: '$category'
              }
            }
          }
        }
      ]);

      const vendorStats = {};
      const categoryStats = {};

      if (stats[0]?.byVendor) {
        stats[0].byVendor.forEach(item => {
          vendorStats[item.vendor] = (vendorStats[item.vendor] || 0) + 1;
          categoryStats[item.category] = (categoryStats[item.category] || 0) + 1;
        });
      }

      return {
        total: stats[0]?.total || 0,
        byVendor: vendorStats,
        byCategory: categoryStats
      };
    } catch (error) {
      console.error('❌ Error getting YANG statistics:', error);
      throw error;
    }
  }
}

export default new YangService(); 