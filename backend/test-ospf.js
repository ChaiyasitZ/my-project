// Test OSPF template parsing
import { TemplateService } from './services/templateService.js';

const templateService = new TemplateService();

console.log('🔧 Testing OSPF Template System');
console.log('==============================\n');

// Test prompt
const prompt = 'router ospf 1 network 192.168.1.0 0.0.0.255 area 0';
const deviceType = 'router';

console.log(`📝 Input Prompt: "${prompt}"`);
console.log(`🖥️  Device Type: ${deviceType}`);
console.log('─'.repeat(50));

// Parse the prompt
const parseResult = templateService.parsePrompt(prompt, deviceType);

if (parseResult) {
  console.log('✅ Template Match Found!');
  console.log(`   Type: ${parseResult.type}`);
  console.log(`   Category: ${parseResult.category}`);
  console.log(`   Template: ${parseResult.template}`);
  console.log(`   Confidence: ${(parseResult.confidence * 100).toFixed(1)}%`);
  console.log('   Variables Extracted:');
  
  Object.entries(parseResult.variables).forEach(([key, value]) => {
    console.log(`     ${key}: ${value}`);
  });

  // Process variables
  const processedVars = templateService.processVariables(parseResult.variables, deviceType);
  console.log('   Processed Variables:');
  Object.entries(processedVars).forEach(([key, value]) => {
    console.log(`     ${key}: ${value}`);
  });

  // Test template generation (with fallback)
  console.log('\n🔧 Testing Template Generation:');
  templateService.generateFromTemplate(prompt, deviceType).then(result => {
    if (result.success) {
      console.log('✅ Generation Successful!');
      console.log(`   Method: ${result.method || 'template'}`);
      console.log(`   Template Used: ${result.templateUsed}`);
      console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log('\n📋 Generated Configuration:');
      console.log('─'.repeat(50));
      console.log(result.configuration);
      console.log('─'.repeat(50));
    } else {
      console.log('❌ Generation Failed:', result.error);
    }
  }).catch(error => {
    console.log('❌ Generation Error:', error.message);
  });

} else {
  console.log('❌ No template match found');
}

console.log('\n🎯 Expected Behavior:');
console.log('- Should parse OSPF protocol correctly');
console.log('- Should extract process_id: 1');
console.log('- Should extract network: 192.168.1.0');
console.log('- Should extract area: 0');
console.log('- Should generate complete OSPF configuration'); 