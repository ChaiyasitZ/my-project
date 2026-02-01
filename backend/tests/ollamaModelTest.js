/**
 * Ollama Model Comparison Test for Network Configuration Generation
 * 
 * Tests 3 models: qwen2.5-coder:7b, codegemma:7b, codellama:7b
 * For use in academic paper and documentation
 * 
 * Run: node backend/tests/ollamaModelTest.js
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const OLLAMA_HOST = 'http://localhost:11434';
const MODELS = ['qwen2.5-coder:7b', 'codegemma:7b', 'codellama:7b'];
const TIMEOUT = 120000; // 2 minutes per request

// Test prompts for network configuration
const TEST_PROMPTS = [
  {
    id: 1,
    name: 'VLAN Configuration (CLI)',
    category: 'VLAN',
    type: 'cli',
    deviceType: 'nexus',
    prompt: 'Generate Cisco NX-OS CLI commands to configure VLAN 100 named "Production" and VLAN 200 named "Development"',
    expectedKeywords: ['vlan', '100', '200', 'name', 'Production', 'Development']
  },
  {
    id: 2,
    name: 'Interface Configuration (CLI)',
    category: 'Interface',
    type: 'cli',
    deviceType: 'nexus',
    prompt: 'Generate Cisco NX-OS CLI commands to configure interface Ethernet1/1 with IP address 192.168.1.1/24 and description "Uplink to Core"',
    expectedKeywords: ['interface', 'Ethernet1/1', 'ip address', '192.168.1.1', 'description']
  },
  {
    id: 3,
    name: 'OSPF Configuration (CLI)',
    category: 'Routing',
    type: 'cli',
    deviceType: 'ios-xe',
    prompt: 'Generate Cisco IOS-XE CLI commands to configure OSPF process 1 with router-id 1.1.1.1 and advertise network 10.0.0.0/24 in area 0',
    expectedKeywords: ['router ospf', 'router-id', 'network', '10.0.0.0', 'area']
  },
  {
    id: 4,
    name: 'BGP Configuration (CLI)',
    category: 'Routing',
    type: 'cli',
    deviceType: 'ios-xe',
    prompt: 'Generate Cisco IOS-XE CLI commands to configure BGP AS 65001 with neighbor 10.0.0.2 in AS 65002',
    expectedKeywords: ['router bgp', '65001', 'neighbor', '10.0.0.2', 'remote-as', '65002']
  },
  {
    id: 5,
    name: 'NETCONF VLAN (NX-OS)',
    category: 'VLAN',
    type: 'netconf',
    deviceType: 'nexus',
    prompt: 'Generate NETCONF XML using Cisco NX-OS YANG model to configure VLAN 100 with name "Production". Use namespace http://cisco.com/ns/yang/cisco-nx-os-device',
    expectedKeywords: ['<config>', '<System>', 'cisco-nx-os-device', '<vlan-id>', '100', 'Production']
  },
  {
    id: 6,
    name: 'NETCONF Interface (IOS-XE)',
    category: 'Interface',
    type: 'netconf',
    deviceType: 'ios-xe',
    prompt: 'Generate NETCONF XML using Cisco IOS-XE YANG model to configure GigabitEthernet1 with IP 192.168.1.1/24. Use namespace http://cisco.com/ns/yang/Cisco-IOS-XE-native',
    expectedKeywords: ['<config>', '<native>', 'Cisco-IOS-XE-native', '<GigabitEthernet>', '<ip>', '<address>']
  },
  {
    id: 7,
    name: 'Access Control List (CLI)',
    category: 'Security',
    type: 'cli',
    deviceType: 'ios-xe',
    prompt: 'Generate Cisco IOS-XE CLI commands to create an extended access-list named "BLOCK_TELNET" that denies TCP traffic to port 23 from any source to any destination',
    expectedKeywords: ['ip access-list', 'extended', 'BLOCK_TELNET', 'deny', 'tcp', '23']
  },
  {
    id: 8,
    name: 'Static Route (CLI)',
    category: 'Routing',
    type: 'cli',
    deviceType: 'nexus',
    prompt: 'Generate Cisco NX-OS CLI commands to configure a static route to network 172.16.0.0/16 via next-hop 10.0.0.1',
    expectedKeywords: ['ip route', '172.16.0.0', '10.0.0.1']
  }
];

// Results storage
const results = {
  testDate: new Date().toISOString(),
  models: {},
  summary: {}
};

/**
 * Make HTTP request to Ollama API
 */
function ollamaGenerate(model, prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.3,
        top_p: 0.9,
        num_predict: 1024
      }
    });

    const url = new URL(`${OLLAMA_HOST}/api/generate`);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 11434,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: TIMEOUT
    };

    const startTime = Date.now();
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const endTime = Date.now();
        try {
          const parsed = JSON.parse(body);
          resolve({
            success: true,
            response: parsed.response || '',
            totalDuration: parsed.total_duration ? parsed.total_duration / 1e9 : (endTime - startTime) / 1000,
            evalCount: parsed.eval_count || 0,
            promptEvalCount: parsed.prompt_eval_count || 0,
            responseTime: (endTime - startTime) / 1000
          });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.write(data);
    req.end();
  });
}

/**
 * Evaluate response quality
 */
function evaluateResponse(response, expectedKeywords, type) {
  const evaluation = {
    keywordMatches: 0,
    totalKeywords: expectedKeywords.length,
    matchedKeywords: [],
    missedKeywords: [],
    syntaxValid: false,
    containsCode: false,
    score: 0
  };

  const lowerResponse = response.toLowerCase();

  // Check keyword matches
  for (const keyword of expectedKeywords) {
    if (lowerResponse.includes(keyword.toLowerCase())) {
      evaluation.keywordMatches++;
      evaluation.matchedKeywords.push(keyword);
    } else {
      evaluation.missedKeywords.push(keyword);
    }
  }

  // Check for code blocks or configuration format
  if (type === 'cli') {
    evaluation.containsCode = response.includes('```') || 
                              /^[a-z]+\s+[a-z0-9\/]+/im.test(response) ||
                              response.includes('configure terminal') ||
                              response.includes('interface') ||
                              response.includes('vlan') ||
                              response.includes('router');
    
    // Basic CLI syntax validation
    evaluation.syntaxValid = evaluation.containsCode && 
                             !response.toLowerCase().includes('error') &&
                             !response.toLowerCase().includes('invalid');
  } else if (type === 'netconf') {
    evaluation.containsCode = response.includes('<') && response.includes('>');
    
    // Basic XML validation
    const hasOpenTag = /<[a-zA-Z][^>]*>/g.test(response);
    const hasCloseTag = /<\/[a-zA-Z][^>]*>/g.test(response);
    evaluation.syntaxValid = hasOpenTag && hasCloseTag;
  }

  // Calculate score (0-100)
  const keywordScore = (evaluation.keywordMatches / evaluation.totalKeywords) * 50;
  const syntaxScore = evaluation.syntaxValid ? 30 : 0;
  const codeScore = evaluation.containsCode ? 20 : 0;
  
  evaluation.score = Math.round(keywordScore + syntaxScore + codeScore);

  return evaluation;
}

/**
 * Run test for a single model
 */
async function testModel(model) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing Model: ${model}`);
  console.log(`${'='.repeat(60)}`);

  const modelResults = {
    model: model,
    tests: [],
    avgResponseTime: 0,
    avgScore: 0,
    totalTokens: 0,
    successCount: 0,
    failCount: 0
  };

  let totalTime = 0;
  let totalScore = 0;

  for (const test of TEST_PROMPTS) {
    console.log(`\n  [${test.id}/${TEST_PROMPTS.length}] ${test.name}...`);
    
    try {
      const result = await ollamaGenerate(model, test.prompt);
      const evaluation = evaluateResponse(result.response, test.expectedKeywords, test.type);
      
      const testResult = {
        testId: test.id,
        testName: test.name,
        category: test.category,
        type: test.type,
        deviceType: test.deviceType,
        prompt: test.prompt,
        response: result.response,
        responseTime: result.responseTime,
        totalDuration: result.totalDuration,
        tokensGenerated: result.evalCount,
        evaluation: evaluation,
        success: true
      };

      modelResults.tests.push(testResult);
      modelResults.totalTokens += result.evalCount;
      modelResults.successCount++;
      totalTime += result.responseTime;
      totalScore += evaluation.score;

      console.log(`       ✓ Score: ${evaluation.score}/100 | Time: ${result.responseTime.toFixed(2)}s | Tokens: ${result.evalCount}`);
      console.log(`       Keywords: ${evaluation.keywordMatches}/${evaluation.totalKeywords} | Syntax: ${evaluation.syntaxValid ? '✓' : '✗'}`);
      
    } catch (error) {
      console.log(`       ✗ Error: ${error.message}`);
      modelResults.tests.push({
        testId: test.id,
        testName: test.name,
        category: test.category,
        type: test.type,
        deviceType: test.deviceType,
        prompt: test.prompt,
        error: error.message,
        success: false
      });
      modelResults.failCount++;
    }
  }

  // Calculate averages
  if (modelResults.successCount > 0) {
    modelResults.avgResponseTime = totalTime / modelResults.successCount;
    modelResults.avgScore = totalScore / modelResults.successCount;
  }

  return modelResults;
}

/**
 * Generate comparison report
 */
function generateReport(results) {
  const report = [];
  
  report.push('╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗');
  report.push('║                           OLLAMA MODEL COMPARISON TEST RESULTS - Network Configuration                              ║');
  report.push('╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣');
  report.push(`║  Test Date: ${results.testDate.padEnd(103)}║`);
  report.push(`║  Total Test Cases: ${TEST_PROMPTS.length.toString().padEnd(95)}║`);
  report.push('╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣');
  
  // Summary Table Header
  report.push('║                                              SUMMARY COMPARISON                                                       ║');
  report.push('╠═══════════════════════════╦═════════════════╦═════════════════╦═════════════════╦═════════════════╦═══════════════════╣');
  report.push('║          Model            ║   Avg Score     ║   Avg Time (s)  ║  Total Tokens   ║   Success Rate  ║  Tokens/Second    ║');
  report.push('╠═══════════════════════════╬═════════════════╬═════════════════╬═════════════════╬═════════════════╬═══════════════════╣');
  
  // Sort models by score for ranking
  const sortedModels = Object.values(results.models).sort((a, b) => b.avgScore - a.avgScore);
  
  for (const model of sortedModels) {
    const successRate = ((model.successCount / TEST_PROMPTS.length) * 100).toFixed(1);
    const tokensPerSec = model.avgResponseTime > 0 ? (model.totalTokens / (model.avgResponseTime * model.successCount)).toFixed(1) : '0';
    
    report.push(`║ ${model.model.padEnd(25)} ║ ${model.avgScore.toFixed(1).padStart(15)} ║ ${model.avgResponseTime.toFixed(2).padStart(15)} ║ ${model.totalTokens.toString().padStart(15)} ║ ${(successRate + '%').padStart(15)} ║ ${tokensPerSec.padStart(17)} ║`);
  }
  
  report.push('╠═══════════════════════════╩═════════════════╩═════════════════╩═════════════════╩═════════════════╩═══════════════════╣');
  
  // Detailed scores by category
  report.push('║                                           SCORES BY CATEGORY                                                          ║');
  report.push('╠═══════════════════════════╦═════════════════╦═════════════════╦═════════════════╦═════════════════════════════════════╣');
  report.push('║        Category           ║  qwen2.5-coder  ║    codegemma    ║    codellama    ║              Winner                 ║');
  report.push('╠═══════════════════════════╬═════════════════╬═════════════════╬═════════════════╬═════════════════════════════════════╣');
  
  const categories = ['VLAN', 'Interface', 'Routing', 'Security'];
  
  for (const category of categories) {
    const scores = {};
    for (const [modelName, modelData] of Object.entries(results.models)) {
      const categoryTests = modelData.tests.filter(t => t.category === category && t.success);
      if (categoryTests.length > 0) {
        scores[modelName] = categoryTests.reduce((sum, t) => sum + t.evaluation.score, 0) / categoryTests.length;
      } else {
        scores[modelName] = 0;
      }
    }
    
    const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    const qwenScore = (scores['qwen2.5-coder:7b'] || 0).toFixed(1);
    const gemmaScore = (scores['codegemma:7b'] || 0).toFixed(1);
    const llamaScore = (scores['codellama:7b'] || 0).toFixed(1);
    
    report.push(`║ ${category.padEnd(25)} ║ ${qwenScore.padStart(15)} ║ ${gemmaScore.padStart(15)} ║ ${llamaScore.padStart(15)} ║ ${(winner ? winner[0].split(':')[0] : 'N/A').padStart(35)} ║`);
  }
  
  report.push('╠═══════════════════════════╩═════════════════╩═════════════════╩═════════════════╩═════════════════════════════════════╣');
  
  // Scores by type (CLI vs NETCONF)
  report.push('║                                         SCORES BY CONFIG TYPE                                                         ║');
  report.push('╠═══════════════════════════╦═════════════════╦═════════════════╦═════════════════╦═════════════════════════════════════╣');
  report.push('║        Type               ║  qwen2.5-coder  ║    codegemma    ║    codellama    ║              Winner                 ║');
  report.push('╠═══════════════════════════╬═════════════════╬═════════════════╬═════════════════╬═════════════════════════════════════╣');
  
  const types = ['cli', 'netconf'];
  
  for (const type of types) {
    const scores = {};
    for (const [modelName, modelData] of Object.entries(results.models)) {
      const typeTests = modelData.tests.filter(t => t.type === type && t.success);
      if (typeTests.length > 0) {
        scores[modelName] = typeTests.reduce((sum, t) => sum + t.evaluation.score, 0) / typeTests.length;
      } else {
        scores[modelName] = 0;
      }
    }
    
    const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    const qwenScore = (scores['qwen2.5-coder:7b'] || 0).toFixed(1);
    const gemmaScore = (scores['codegemma:7b'] || 0).toFixed(1);
    const llamaScore = (scores['codellama:7b'] || 0).toFixed(1);
    
    const typeLabel = type === 'cli' ? 'CLI Commands' : 'NETCONF/XML';
    report.push(`║ ${typeLabel.padEnd(25)} ║ ${qwenScore.padStart(15)} ║ ${gemmaScore.padStart(15)} ║ ${llamaScore.padStart(15)} ║ ${(winner ? winner[0].split(':')[0] : 'N/A').padStart(35)} ║`);
  }
  
  report.push('╠═══════════════════════════╩═════════════════╩═════════════════╩═════════════════╩═════════════════════════════════════╣');
  
  // Device type comparison
  report.push('║                                        SCORES BY DEVICE TYPE                                                          ║');
  report.push('╠═══════════════════════════╦═════════════════╦═════════════════╦═════════════════╦═════════════════════════════════════╣');
  report.push('║      Device Type          ║  qwen2.5-coder  ║    codegemma    ║    codellama    ║              Winner                 ║');
  report.push('╠═══════════════════════════╬═════════════════╬═════════════════╬═════════════════╬═════════════════════════════════════╣');
  
  const deviceTypes = ['nexus', 'ios-xe'];
  
  for (const deviceType of deviceTypes) {
    const scores = {};
    for (const [modelName, modelData] of Object.entries(results.models)) {
      const deviceTests = modelData.tests.filter(t => t.deviceType === deviceType && t.success);
      if (deviceTests.length > 0) {
        scores[modelName] = deviceTests.reduce((sum, t) => sum + t.evaluation.score, 0) / deviceTests.length;
      } else {
        scores[modelName] = 0;
      }
    }
    
    const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    const qwenScore = (scores['qwen2.5-coder:7b'] || 0).toFixed(1);
    const gemmaScore = (scores['codegemma:7b'] || 0).toFixed(1);
    const llamaScore = (scores['codellama:7b'] || 0).toFixed(1);
    
    const label = deviceType === 'nexus' ? 'Cisco Nexus (NX-OS)' : 'Cisco IOS-XE';
    report.push(`║ ${label.padEnd(25)} ║ ${qwenScore.padStart(15)} ║ ${gemmaScore.padStart(15)} ║ ${llamaScore.padStart(15)} ║ ${(winner ? winner[0].split(':')[0] : 'N/A').padStart(35)} ║`);
  }
  
  report.push('╚═══════════════════════════╩═════════════════╩═════════════════╩═════════════════╩═════════════════════════════════════╝');
  
  return report.join('\n');
}

/**
 * Generate detailed per-test report
 */
function generateDetailedReport(results) {
  const report = [];
  
  report.push('\n' + '═'.repeat(120));
  report.push('                              DETAILED TEST RESULTS BY MODEL');
  report.push('═'.repeat(120));
  
  for (const [modelName, modelData] of Object.entries(results.models)) {
    report.push(`\n${'─'.repeat(120)}`);
    report.push(`MODEL: ${modelName}`);
    report.push(`${'─'.repeat(120)}`);
    
    for (const test of modelData.tests) {
      report.push(`\n  Test #${test.testId}: ${test.testName}`);
      report.push(`  Category: ${test.category} | Type: ${test.type.toUpperCase()} | Device: ${test.deviceType}`);
      report.push(`  ${'─'.repeat(110)}`);
      
      if (test.success) {
        report.push(`  Score: ${test.evaluation.score}/100 | Response Time: ${test.responseTime.toFixed(2)}s | Tokens: ${test.tokensGenerated}`);
        report.push(`  Keywords Matched: ${test.evaluation.keywordMatches}/${test.evaluation.totalKeywords}`);
        report.push(`  Matched: [${test.evaluation.matchedKeywords.join(', ')}]`);
        report.push(`  Missed: [${test.evaluation.missedKeywords.join(', ')}]`);
        report.push(`  Syntax Valid: ${test.evaluation.syntaxValid ? 'Yes' : 'No'} | Contains Code: ${test.evaluation.containsCode ? 'Yes' : 'No'}`);
        report.push(`  \n  Response Preview (first 500 chars):`);
        report.push(`  ${test.response.substring(0, 500).replace(/\n/g, '\n  ')}...`);
      } else {
        report.push(`  ✗ FAILED: ${test.error}`);
      }
    }
  }
  
  return report.join('\n');
}

/**
 * Main function
 */
async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  OLLAMA MODEL COMPARISON TEST');
  console.log('  Network Configuration Generation');
  console.log('═'.repeat(60));
  console.log(`\nModels to test: ${MODELS.join(', ')}`);
  console.log(`Test cases: ${TEST_PROMPTS.length}`);
  console.log(`Started at: ${new Date().toISOString()}`);
  
  // Test each model
  for (const model of MODELS) {
    try {
      const modelResults = await testModel(model);
      results.models[model] = modelResults;
    } catch (error) {
      console.error(`\nFailed to test model ${model}: ${error.message}`);
      results.models[model] = {
        model: model,
        error: error.message,
        tests: [],
        avgResponseTime: 0,
        avgScore: 0,
        totalTokens: 0,
        successCount: 0,
        failCount: TEST_PROMPTS.length
      };
    }
  }
  
  // Generate reports
  const summaryReport = generateReport(results);
  const detailedReport = generateDetailedReport(results);
  
  console.log('\n\n' + summaryReport);
  console.log(detailedReport);
  
  // Save results to files
  const outputDir = path.join(__dirname, '..', 'docs');
  
  // Ensure docs directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Save JSON results
  const jsonPath = path.join(outputDir, 'ollama-test-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`\n✓ JSON results saved to: ${jsonPath}`);
  
  // Save text report
  const reportPath = path.join(outputDir, 'ollama-test-report.txt');
  fs.writeFileSync(reportPath, summaryReport + '\n' + detailedReport);
  console.log(`✓ Text report saved to: ${reportPath}`);
  
  // Save markdown report for documentation
  const mdReport = generateMarkdownReport(results);
  const mdPath = path.join(outputDir, 'OLLAMA_MODEL_COMPARISON.md');
  fs.writeFileSync(mdPath, mdReport);
  console.log(`✓ Markdown report saved to: ${mdPath}`);
  
  console.log('\n' + '═'.repeat(60));
  console.log('  TEST COMPLETE');
  console.log('═'.repeat(60));
}

/**
 * Generate Markdown report for documentation
 */
function generateMarkdownReport(results) {
  const md = [];
  
  md.push('# Ollama Model Comparison Test Results');
  md.push('## Network Configuration Generation for Cisco Devices');
  md.push('');
  md.push(`**Test Date:** ${results.testDate}`);
  md.push(`**Total Test Cases:** ${TEST_PROMPTS.length}`);
  md.push('');
  
  md.push('---');
  md.push('');
  md.push('## Executive Summary');
  md.push('');
  md.push('This document presents the comparative analysis of three Ollama models for generating network configurations:');
  md.push('');
  md.push('1. **qwen2.5-coder:7b** - Alibaba\'s code-focused LLM');
  md.push('2. **codegemma:7b** - Google\'s code generation model');
  md.push('3. **codellama:7b** - Meta\'s code-specialized LLaMA model');
  md.push('');
  
  md.push('---');
  md.push('');
  md.push('## Overall Comparison');
  md.push('');
  md.push('| Model | Avg Score | Avg Time (s) | Total Tokens | Success Rate | Tokens/Sec |');
  md.push('|-------|-----------|--------------|--------------|--------------|------------|');
  
  const sortedModels = Object.values(results.models).sort((a, b) => b.avgScore - a.avgScore);
  
  for (const model of sortedModels) {
    const successRate = ((model.successCount / TEST_PROMPTS.length) * 100).toFixed(1);
    const tokensPerSec = model.avgResponseTime > 0 ? 
      (model.totalTokens / (model.avgResponseTime * model.successCount)).toFixed(1) : '0';
    
    md.push(`| ${model.model} | ${model.avgScore.toFixed(1)} | ${model.avgResponseTime.toFixed(2)} | ${model.totalTokens} | ${successRate}% | ${tokensPerSec} |`);
  }
  
  md.push('');
  md.push('---');
  md.push('');
  
  // Category breakdown
  md.push('## Performance by Category');
  md.push('');
  
  const categories = ['VLAN', 'Interface', 'Routing', 'Security'];
  
  md.push('| Category | qwen2.5-coder | codegemma | codellama | Winner |');
  md.push('|----------|---------------|-----------|-----------|--------|');
  
  for (const category of categories) {
    const scores = {};
    for (const [modelName, modelData] of Object.entries(results.models)) {
      const categoryTests = modelData.tests.filter(t => t.category === category && t.success);
      scores[modelName] = categoryTests.length > 0 ?
        (categoryTests.reduce((sum, t) => sum + t.evaluation.score, 0) / categoryTests.length).toFixed(1) : '0.0';
    }
    
    const scoreValues = Object.entries(scores).map(([k, v]) => [k, parseFloat(v)]);
    const winner = scoreValues.sort((a, b) => b[1] - a[1])[0][0].split(':')[0];
    
    md.push(`| ${category} | ${scores['qwen2.5-coder:7b']} | ${scores['codegemma:7b']} | ${scores['codellama:7b']} | **${winner}** |`);
  }
  
  md.push('');
  md.push('---');
  md.push('');
  
  // Type breakdown
  md.push('## Performance by Configuration Type');
  md.push('');
  
  md.push('| Type | qwen2.5-coder | codegemma | codellama | Winner |');
  md.push('|------|---------------|-----------|-----------|--------|');
  
  const types = [['cli', 'CLI Commands'], ['netconf', 'NETCONF/XML']];
  
  for (const [type, label] of types) {
    const scores = {};
    for (const [modelName, modelData] of Object.entries(results.models)) {
      const typeTests = modelData.tests.filter(t => t.type === type && t.success);
      scores[modelName] = typeTests.length > 0 ?
        (typeTests.reduce((sum, t) => sum + t.evaluation.score, 0) / typeTests.length).toFixed(1) : '0.0';
    }
    
    const scoreValues = Object.entries(scores).map(([k, v]) => [k, parseFloat(v)]);
    const winner = scoreValues.sort((a, b) => b[1] - a[1])[0][0].split(':')[0];
    
    md.push(`| ${label} | ${scores['qwen2.5-coder:7b']} | ${scores['codegemma:7b']} | ${scores['codellama:7b']} | **${winner}** |`);
  }
  
  md.push('');
  md.push('---');
  md.push('');
  
  // Device type breakdown
  md.push('## Performance by Device Type');
  md.push('');
  
  md.push('| Device | qwen2.5-coder | codegemma | codellama | Winner |');
  md.push('|--------|---------------|-----------|-----------|--------|');
  
  const deviceTypes = [['nexus', 'Cisco Nexus (NX-OS)'], ['ios-xe', 'Cisco IOS-XE']];
  
  for (const [deviceType, label] of deviceTypes) {
    const scores = {};
    for (const [modelName, modelData] of Object.entries(results.models)) {
      const deviceTests = modelData.tests.filter(t => t.deviceType === deviceType && t.success);
      scores[modelName] = deviceTests.length > 0 ?
        (deviceTests.reduce((sum, t) => sum + t.evaluation.score, 0) / deviceTests.length).toFixed(1) : '0.0';
    }
    
    const scoreValues = Object.entries(scores).map(([k, v]) => [k, parseFloat(v)]);
    const winner = scoreValues.sort((a, b) => b[1] - a[1])[0][0].split(':')[0];
    
    md.push(`| ${label} | ${scores['qwen2.5-coder:7b']} | ${scores['codegemma:7b']} | ${scores['codellama:7b']} | **${winner}** |`);
  }
  
  md.push('');
  md.push('---');
  md.push('');
  
  // Test cases
  md.push('## Test Cases');
  md.push('');
  
  md.push('| # | Test Name | Category | Type | Device |');
  md.push('|---|-----------|----------|------|--------|');
  
  for (const test of TEST_PROMPTS) {
    md.push(`| ${test.id} | ${test.name} | ${test.category} | ${test.type.toUpperCase()} | ${test.deviceType} |`);
  }
  
  md.push('');
  md.push('---');
  md.push('');
  
  // Detailed results per test
  md.push('## Detailed Results');
  md.push('');
  
  for (const test of TEST_PROMPTS) {
    md.push(`### Test ${test.id}: ${test.name}`);
    md.push('');
    md.push(`**Prompt:** ${test.prompt}`);
    md.push('');
    md.push('| Model | Score | Time (s) | Keywords | Syntax Valid |');
    md.push('|-------|-------|----------|----------|--------------|');
    
    for (const model of MODELS) {
      const modelData = results.models[model];
      const testResult = modelData.tests.find(t => t.testId === test.id);
      
      if (testResult && testResult.success) {
        md.push(`| ${model} | ${testResult.evaluation.score} | ${testResult.responseTime.toFixed(2)} | ${testResult.evaluation.keywordMatches}/${testResult.evaluation.totalKeywords} | ${testResult.evaluation.syntaxValid ? '✓' : '✗'} |`);
      } else {
        md.push(`| ${model} | FAILED | - | - | - |`);
      }
    }
    
    md.push('');
  }
  
  md.push('---');
  md.push('');
  md.push('## Methodology');
  md.push('');
  md.push('### Scoring Criteria');
  md.push('');
  md.push('Each response is evaluated on a 100-point scale:');
  md.push('');
  md.push('| Criteria | Weight | Description |');
  md.push('|----------|--------|-------------|');
  md.push('| Keyword Match | 50% | Presence of expected configuration keywords |');
  md.push('| Syntax Validity | 30% | Basic syntax validation for CLI or XML |');
  md.push('| Code Presence | 20% | Contains actual configuration code |');
  md.push('');
  md.push('### Model Parameters');
  md.push('');
  md.push('All models were tested with identical parameters:');
  md.push('');
  md.push('- **Temperature:** 0.3 (low for consistent outputs)');
  md.push('- **Top-p:** 0.9');
  md.push('- **Max Tokens:** 1024');
  md.push('- **Timeout:** 120 seconds');
  md.push('');
  md.push('---');
  md.push('');
  md.push('## Conclusion');
  md.push('');
  
  // Determine overall winner
  if (sortedModels.length > 0) {
    const winner = sortedModels[0];
    md.push(`Based on the comprehensive testing of ${TEST_PROMPTS.length} network configuration prompts across CLI and NETCONF formats for both Cisco Nexus (NX-OS) and IOS-XE devices:`);
    md.push('');
    md.push(`**Overall Winner: ${winner.model}** with an average score of ${winner.avgScore.toFixed(1)}/100`);
    md.push('');
    md.push('### Key Findings');
    md.push('');
    md.push(`1. **Best Overall Performance:** ${sortedModels[0].model}`);
    if (sortedModels[1]) {
      md.push(`2. **Second Place:** ${sortedModels[1].model}`);
    }
    if (sortedModels[2]) {
      md.push(`3. **Third Place:** ${sortedModels[2].model}`);
    }
  }
  
  md.push('');
  md.push('---');
  md.push('');
  md.push('*This report was automatically generated by the Ollama Model Comparison Test Suite*');
  
  return md.join('\n');
}

// Run tests
main().catch(console.error);
