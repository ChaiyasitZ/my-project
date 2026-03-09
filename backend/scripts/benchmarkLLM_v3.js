/**
 * LLM Benchmark Script v3
 * Tests 3 Ollama models × 3 OS types × 2 config modes × 5 prompts × 5 rounds
 * Tracks: response time, token usage, CPU%, RAM, GPU%, VRAM
 *
 * Usage: node backend/scripts/benchmarkLLM_v3.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// ─── Configuration ───────────────────────────────────────────────
const OLLAMA_URL = 'http://localhost:11434';
const ROUNDS = 5;

const MODELS = [
  'qwen2.5-coder:7b',
  'codellama:7b',
  'codegemma:7b',
];

const DEVICE_TYPES = ['ios', 'ios-xe', 'nexus'];

// ─── 5 CLI Prompts ───────────────────────────────────────────────
const CLI_PROMPTS = [
  {
    id: 'C1',
    name: 'OSPF Basic',
    prompt: 'Configure OSPF process 1 area 0 on interface GigabitEthernet0/1 with IP 10.0.0.1/30 and set router-id 1.1.1.1',
    checks: (output) => [
      { name: 'has_interface_cmd', pass: /^interface\s/im.test(output) },
      { name: 'has_ip_address', pass: /ip\s+address/i.test(output) },
      { name: 'has_ospf', pass: /router\s+ospf/i.test(output) },
      { name: 'has_network', pass: /network\s/i.test(output) },
      { name: 'has_router_id', pass: /router-id/i.test(output) },
      { name: 'no_markdown', pass: !output.includes('```') },
      { name: 'no_explanation', pass: !/here is|here are|sure|note:/i.test(output) },
      { name: 'wildcard_mask', pass: /0\.0\.0\./i.test(output) },
      { name: 'no_conf_t', pass: !/configure\s+terminal/i.test(output) },
      { name: 'correct_ip', pass: /10\.0\.0\.1/i.test(output) },
    ],
  },
  {
    id: 'C2',
    name: 'VLAN + SVI',
    prompt: 'Create VLAN 100 named "Engineering" and configure SVI interface Vlan100 with IP address 192.168.100.1/24 and enable it',
    checks: (output) => [
      { name: 'has_vlan', pass: /vlan\s+100/i.test(output) },
      { name: 'has_vlan_name', pass: /name\s+Engineering/i.test(output) },
      { name: 'has_svi', pass: /interface\s+Vlan\s*100/i.test(output) },
      { name: 'has_ip', pass: /ip\s+address\s+192\.168\.100\.1/i.test(output) },
      { name: 'has_subnet', pass: /255\.255\.255\.0/i.test(output) },
      { name: 'has_no_shut', pass: /no\s+shut/i.test(output) },
      { name: 'no_markdown', pass: !output.includes('```') },
      { name: 'no_explanation', pass: !/here is|here are|sure|note:/i.test(output) },
      { name: 'no_conf_t', pass: !/configure\s+terminal/i.test(output) },
      { name: 'correct_order', pass: /vlan\s+100[\s\S]*interface\s+Vlan/im.test(output) },
    ],
  },
  {
    id: 'C3',
    name: 'ACL Standard',
    prompt: 'Create a standard access-list 10 to permit network 172.16.0.0/16 and deny all other traffic, then apply it inbound on interface GigabitEthernet0/0',
    checks: (output) => [
      { name: 'has_acl', pass: /access-list\s+10/i.test(output) },
      { name: 'has_permit', pass: /permit/i.test(output) },
      { name: 'has_network', pass: /172\.16\.0\.0/i.test(output) },
      { name: 'has_wildcard', pass: /0\.0\.255\.255/i.test(output) },
      { name: 'has_deny', pass: /deny\s+any/i.test(output) },
      { name: 'has_interface', pass: /interface\s+Gig/i.test(output) },
      { name: 'has_ip_access_group', pass: /ip\s+access-group\s+10\s+in/i.test(output) },
      { name: 'no_markdown', pass: !output.includes('```') },
      { name: 'no_explanation', pass: !/here is|here are|sure|note:/i.test(output) },
      { name: 'no_conf_t', pass: !/configure\s+terminal/i.test(output) },
    ],
  },
  {
    id: 'C4',
    name: 'Static Route + Default',
    prompt: 'Configure a static route for network 10.10.0.0/16 via next-hop 192.168.1.1 and a default route via 192.168.1.254',
    checks: (output) => [
      { name: 'has_ip_route', pass: /ip\s+route/i.test(output) },
      { name: 'has_dest_network', pass: /10\.10\.0\.0/i.test(output) },
      { name: 'has_mask', pass: /255\.255\.0\.0/i.test(output) },
      { name: 'has_nexthop1', pass: /192\.168\.1\.1/i.test(output) },
      { name: 'has_default_route', pass: /0\.0\.0\.0\s+0\.0\.0\.0/i.test(output) },
      { name: 'has_nexthop2', pass: /192\.168\.1\.254/i.test(output) },
      { name: 'no_markdown', pass: !output.includes('```') },
      { name: 'no_explanation', pass: !/here is|here are|sure|note:/i.test(output) },
      { name: 'no_conf_t', pass: !/configure\s+terminal/i.test(output) },
      { name: 'two_routes', pass: (output.match(/ip\s+route/gi) || []).length >= 2 },
    ],
  },
  {
    id: 'C5',
    name: 'EIGRP Config',
    prompt: 'Configure EIGRP autonomous system 100 with router-id 2.2.2.2, advertise networks 10.1.0.0/16 and 10.2.0.0/16, and disable auto-summary',
    checks: (output) => [
      { name: 'has_eigrp', pass: /router\s+eigrp\s+100/i.test(output) },
      { name: 'has_router_id', pass: /router-id|eigrp\s+router-id/i.test(output) },
      { name: 'has_rid_value', pass: /2\.2\.2\.2/i.test(output) },
      { name: 'has_network1', pass: /10\.1\.0\.0/i.test(output) },
      { name: 'has_network2', pass: /10\.2\.0\.0/i.test(output) },
      { name: 'has_no_auto', pass: /no\s+auto-summary/i.test(output) },
      { name: 'no_markdown', pass: !output.includes('```') },
      { name: 'no_explanation', pass: !/here is|here are|sure|note:/i.test(output) },
      { name: 'no_conf_t', pass: !/configure\s+terminal/i.test(output) },
      { name: 'has_wildcard', pass: /0\.0\.255\.255/i.test(output) },
    ],
  },
];

// ─── 5 NETCONF Prompts ──────────────────────────────────────────
const NETCONF_PROMPTS = [
  {
    id: 'N1',
    name: 'Interface IP',
    prompt: 'Configure interface GigabitEthernet0/1 with IP address 10.0.0.1/30 and enable it',
  },
  {
    id: 'N2',
    name: 'Loopback Interface',
    prompt: 'Create Loopback0 interface with IP address 1.1.1.1/32 and description "Router-ID Loopback"',
  },
  {
    id: 'N3',
    name: 'Interface + Description',
    prompt: 'Configure interface GigabitEthernet0/2 with IP 192.168.1.1/24, description "Uplink to Core" and enable it',
  },
  {
    id: 'N4',
    name: 'Ethernet Admin Up',
    prompt: 'Configure interface Ethernet1/1 with IP 10.10.10.1/30 and set admin status to up',
  },
  {
    id: 'N5',
    name: 'Interface Shutdown',
    prompt: 'Configure interface GigabitEthernet0/3 with IP address 172.16.0.1/24 and disable it (shutdown)',
  },
];

// ─── System Messages (same as llmService.js) ─────────────────────
function buildCLISystemMessage() {
  return `You are a Cisco IOS command generator expert. Your job is to generate ONLY raw Cisco IOS configuration commands.

CRITICAL PROTOCOL-SPECIFIC RULES:
1. OSPF: Does NOT support "no auto-summary" command (OSPF is classless by default)
2. EIGRP: MUST include "no auto-summary" for modern VLSM networks
3. RIP: Use "version 2" with "no auto-summary" for classless operation
4. BGP: Does not use auto-summary command

STRICT OUTPUT RULES:
1. Generate ONLY configuration commands (no "configure terminal", no "end", no "exit")
2. Use proper indentation (single space before sub-commands)
3. Use wildcard masks for OSPF network commands, NOT subnet masks
4. Accept both full and short interface names (Gi, Fa, Te, etc.)
5. Follow Cisco best practices
6. NO explanations, NO comments, NO markdown, NO code blocks
7. Start directly with the first command
8. DO NOT include commands that are invalid for the protocol being configured

EXAMPLE OUTPUT FORMAT:
interface GigabitEthernet0/1
 ip address 192.168.1.1 255.255.255.0
 description Connection to Core Switch
 no shutdown

Remember: Output ONLY the commands, nothing else.`;
}

function buildCLIUserMessage(prompt, deviceType) {
  return `Device: Router (${deviceType} - Generic Cisco)

Configuration Request: ${prompt}

Generate the Cisco IOS commands now:`;
}

function buildNxosNetconfSystem() {
  return `You are a Cisco NX-OS NETCONF expert. Generate VALID YANG-compliant XML for NETCONF edit-config operations.

NAMESPACE: http://cisco.com/ns/yang/cisco-nx-os-device
ROOT ELEMENT: <System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">

OUTPUT RULES:
1. Output ONLY the XML content (no explanations, no markdown)
2. Start with <System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
3. End with </System>
4. Use proper 2-space indentation
5. All tags must be properly closed

NX-OS YANG STRUCTURE REFERENCE:

INTERFACE (Physical):
<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
  <intf-items>
    <phys-items>
      <PhysIf-list>
        <id>Ethernet1/1</id>
        <adminSt>up</adminSt>
        <descr>Description</descr>
      </PhysIf-list>
    </phys-items>
  </intf-items>
</System>

IP ADDRESS ON INTERFACE:
<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
  <ipv4-items>
    <inst-items>
      <Inst-list>
        <name>default</name>
        <dom-items>
          <Dom-list>
            <name>default</name>
            <if-items>
              <If-list>
                <id>eth1/1</id>
                <addr-items>
                  <Addr-list>
                    <addr>10.0.0.1/30</addr>
                  </Addr-list>
                </addr-items>
              </If-list>
            </if-items>
          </Dom-list>
        </dom-items>
      </Inst-list>
    </inst-items>
  </ipv4-items>
</System>

Generate ONLY the XML. No explanations.`;
}

function buildIosXeNetconfSystem() {
  return `You are a Cisco IOS-XE NETCONF expert. Generate VALID YANG-compliant XML for NETCONF edit-config operations.

NAMESPACE: http://cisco.com/ns/yang/Cisco-IOS-XE-native
ROOT ELEMENT: <native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">

OUTPUT RULES:
1. Output ONLY the XML content (no explanations, no markdown)
2. Start with <native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">
3. End with </native>
4. Use proper 2-space indentation
5. All tags must be properly closed

IOS-XE YANG STRUCTURE REFERENCE:

INTERFACE:
<native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">
  <interface>
    <GigabitEthernet>
      <name>0/1</name>
      <ip>
        <address>
          <primary>
            <address>10.0.0.1</address>
            <mask>255.255.255.252</mask>
          </primary>
        </address>
      </ip>
      <shutdown xmlns:nc="urn:ietf:params:xml:ns:netconf:base:1.0" nc:operation="remove"/>
    </GigabitEthernet>
  </interface>
</native>

Generate ONLY the XML. No explanations.`;
}

function buildIosNetconfSystem() {
  return `You are a Cisco IOS NETCONF expert. Generate VALID YANG-compliant XML for NETCONF edit-config operations.
Note: Classic Cisco IOS uses IETF models. Use ietf-interfaces and ietf-routing where applicable.

PRIMARY NAMESPACE: urn:ietf:params:xml:ns:yang:ietf-interfaces

OUTPUT RULES:
1. Output ONLY the XML content (no explanations, no markdown)
2. Use proper 2-space indentation
3. All tags must be properly closed

INTERFACE EXAMPLE:
<interfaces xmlns="urn:ietf:params:xml:ns:yang:ietf-interfaces">
  <interface>
    <name>GigabitEthernet0/1</name>
    <type xmlns:ianaift="urn:ietf:params:xml:ns:yang:iana-if-type">ianaift:ethernetCsmacd</type>
    <enabled>true</enabled>
    <ipv4 xmlns="urn:ietf:params:xml:ns:yang:ietf-ip">
      <address>
        <ip>10.0.0.1</ip>
        <netmask>255.255.255.252</netmask>
      </address>
    </ipv4>
  </interface>
</interfaces>

Generate ONLY the XML. No explanations.`;
}

function buildNetconfUserMessage(prompt, deviceType) {
  return `Device: Switch (${deviceType})

Configuration Request: ${prompt}

Generate the NETCONF/YANG XML now:`;
}

// ─── Scoring helpers ─────────────────────────────────────────────
function scoreCLI(output, deviceType, promptObj) {
  const checks = promptObj.checks(output);
  const passed = checks.filter(c => c.pass).length;
  return { score: Math.round((passed / checks.length) * 100), total: checks.length, passed, checks };
}

function scoreNETCONF(output, deviceType, promptObj) {
  const checks = [];
  const ipMatch = promptObj.prompt.match(/(\d+\.\d+\.\d+\.\d+)/);
  const expectedIp = ipMatch ? ipMatch[1] : '10.0.0.1';

  checks.push({ name: 'is_xml', pass: /<\w+[\s>]/i.test(output) });
  checks.push({ name: 'has_xmlns', pass: /xmlns=/i.test(output) });
  checks.push({ name: 'well_formed', pass: /<\/\w+>/i.test(output) });
  checks.push({ name: 'no_markdown', pass: !output.includes('```') });
  checks.push({ name: 'no_explanation', pass: !/here is|here are|sure|note:/i.test(output) });
  checks.push({ name: 'correct_ip', pass: output.includes(expectedIp) });

  if (deviceType === 'nexus') {
    checks.push({ name: 'nxos_ns', pass: /cisco-nx-os-device/i.test(output) });
    checks.push({ name: 'nxos_root', pass: /<System/i.test(output) });
    checks.push({ name: 'has_intf_items', pass: /intf-items|phys-items|PhysIf/i.test(output) });
    checks.push({ name: 'has_adminSt', pass: /adminSt/i.test(output) });
  } else if (deviceType === 'ios-xe') {
    checks.push({ name: 'iosxe_ns', pass: /Cisco-IOS-XE-native/i.test(output) });
    checks.push({ name: 'iosxe_root', pass: /<native/i.test(output) });
    checks.push({ name: 'has_interface', pass: /<interface>/i.test(output) || /<GigabitEthernet>/i.test(output) || /<Loopback>/i.test(output) });
    checks.push({ name: 'has_ip_tag', pass: /<ip>/i.test(output) || /<address>/i.test(output) });
  } else {
    checks.push({ name: 'ietf_ns', pass: /ietf-interfaces|ietf-ip/i.test(output) });
    checks.push({ name: 'has_interface', pass: /<interface>/i.test(output) });
    checks.push({ name: 'has_name', pass: /<name>/i.test(output) });
    checks.push({ name: 'has_enabled', pass: /enabled|ipv4|shutdown|disable/i.test(output) });
  }

  const passed = checks.filter(c => c.pass).length;
  return { score: Math.round((passed / checks.length) * 100), total: checks.length, passed, checks };
}

// ─── Resource tracking ──────────────────────────────────────────
function getSystemResources() {
  const totMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totMem - freeMem;
  const cpus = os.cpus();
  const avgIdle = cpus.reduce((a, c) => {
    const total = Object.values(c.times).reduce((s, v) => s + v, 0);
    return a + (c.times.idle / total);
  }, 0) / cpus.length;
  return {
    cpuUsagePercent: Math.round((1 - avgIdle) * 100 * 10) / 10,
    ramUsedMB: Math.round(usedMem / 1024 / 1024),
    ramTotalMB: Math.round(totMem / 1024 / 1024),
    ramUsedPercent: Math.round((usedMem / totMem) * 100 * 10) / 10,
  };
}

function getGpuInfo() {
  try {
    const raw = execSync(
      'nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu,temperature.gpu,power.draw --format=csv,noheader,nounits',
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();
    if (!raw) return null;
    const parts = raw.split(',').map(s => s.trim());
    return {
      gpuName: parts[0] || 'Unknown',
      gpuVramUsedMB: parseInt(parts[1]) || 0,
      gpuVramTotalMB: parseInt(parts[2]) || 0,
      gpuUtilPercent: parseInt(parts[3]) || 0,
      gpuTempC: parseInt(parts[4]) || 0,
      gpuPowerW: parseFloat(parts[5]) || 0,
    };
  } catch {
    return null;
  }
}

// ─── Ollama API call ─────────────────────────────────────────────
async function callOllama(model, messages, temperature = 0.1) {
  const body = {
    model,
    messages,
    stream: false,
    options: {
      temperature,
      num_predict: 1500,
      top_p: 0.85,
    },
  };
  const start = Date.now();
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama ${res.status}: ${text}`);
  }
  const data = await res.json();
  const elapsed = Date.now() - start;
  return { data, elapsed };
}

// ─── Main benchmark ─────────────────────────────────────────────
async function runBenchmark() {
  const totalCombos = MODELS.length * DEVICE_TYPES.length * 2 * CLI_PROMPTS.length;
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  LLM Benchmark v3 — 3 models × 3 OS × 2 modes × 5 prompts × ${ROUNDS} rounds`);
  console.log(`  Total API calls: ${totalCombos * ROUNDS}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Verify Ollama
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!r.ok) throw new Error('not ok');
    const tags = await r.json();
    const available = tags.models?.map(m => m.name) || [];
    console.log('✅ Ollama is running.');
    console.log(`   Available models: ${available.join(', ')}`);
    for (const m of MODELS) {
      if (!available.some(a => a.startsWith(m.split(':')[0]))) {
        console.log(`   ⚠️  Model ${m} may not be available. Pull it with: ollama pull ${m}`);
      }
    }
  } catch {
    console.error('❌ Ollama is not running. Start it first with: ollama serve');
    process.exit(1);
  }

  // Check GPU
  const gpuBaseline = getGpuInfo();
  if (gpuBaseline) {
    console.log(`✅ GPU detected: ${gpuBaseline.gpuName}`);
    console.log(`   VRAM: ${gpuBaseline.gpuVramUsedMB} / ${gpuBaseline.gpuVramTotalMB} MB`);
    console.log(`   Temp: ${gpuBaseline.gpuTempC}°C  Power: ${gpuBaseline.gpuPowerW}W`);
  } else {
    console.log('⚠️  No NVIDIA GPU detected — GPU/VRAM tracking disabled.');
  }

  // System info
  const sysRes = getSystemResources();
  console.log(`\n📊 System: RAM ${sysRes.ramTotalMB} MB total, CPU cores: ${os.cpus().length}`);
  console.log('');

  const allResults = [];

  for (const model of MODELS) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  MODEL: ${model}`);
    console.log(`${'═'.repeat(60)}`);

    // Warm up
    console.log(`  ⏳ Warming up ${model}...`);
    try {
      await callOllama(model, [{ role: 'user', content: 'hello' }], 0.1);
      // Capture VRAM after model load
      const gpuAfterLoad = getGpuInfo();
      if (gpuAfterLoad) {
        console.log(`  ✅ Model loaded. VRAM: ${gpuAfterLoad.gpuVramUsedMB} / ${gpuAfterLoad.gpuVramTotalMB} MB`);
      } else {
        console.log(`  ✅ Model loaded.`);
      }
    } catch (e) {
      console.error(`  ❌ Warm-up failed: ${e.message}`);
      continue;
    }

    for (const deviceType of DEVICE_TYPES) {
      for (const configMode of ['cli', 'netconf']) {
        const prompts = configMode === 'cli' ? CLI_PROMPTS : NETCONF_PROMPTS;

        for (const promptObj of prompts) {
          const label = `${model} | ${deviceType} | ${configMode} | ${promptObj.id}: ${promptObj.name}`;
          console.log(`\n  ── ${label} (${ROUNDS} rounds) ──`);

          for (let round = 1; round <= ROUNDS; round++) {
            // Snapshot resources before
            const resBefore = getSystemResources();
            const gpuBefore = getGpuInfo();

            let messages;
            if (configMode === 'cli') {
              messages = [
                { role: 'system', content: buildCLISystemMessage() },
                { role: 'user', content: buildCLIUserMessage(promptObj.prompt, deviceType) },
              ];
            } else {
              let sysMsg;
              if (deviceType === 'nexus') sysMsg = buildNxosNetconfSystem();
              else if (deviceType === 'ios-xe') sysMsg = buildIosXeNetconfSystem();
              else sysMsg = buildIosNetconfSystem();
              messages = [
                { role: 'system', content: sysMsg },
                { role: 'user', content: buildNetconfUserMessage(promptObj.prompt, deviceType) },
              ];
            }

            try {
              const { data, elapsed } = await callOllama(model, messages, 0.1);

              // Snapshot resources after
              const resAfter = getSystemResources();
              const gpuAfter = getGpuInfo();

              const output = data.message?.content?.trim() || '';
              const evalDuration = data.eval_duration ? data.eval_duration / 1e9 : null;
              const promptTokens = data.prompt_eval_count || 0;
              const completionTokens = data.eval_count || 0;
              const totalTokens = promptTokens + completionTokens;
              const tokensPerSec = evalDuration && completionTokens
                ? Math.round(completionTokens / evalDuration * 10) / 10
                : null;

              const quality = configMode === 'cli'
                ? scoreCLI(output, deviceType, promptObj)
                : scoreNETCONF(output, deviceType, promptObj);

              const result = {
                model,
                deviceType,
                configMode,
                promptId: promptObj.id,
                promptName: promptObj.name,
                prompt: promptObj.prompt,
                round,
                responseTimeMs: elapsed,
                promptTokens,
                completionTokens,
                totalTokens,
                tokensPerSec,
                qualityScore: quality.score,
                qualityPassed: quality.passed,
                qualityTotal: quality.total,
                qualityChecks: quality.checks,
                // CPU
                cpuBefore: resBefore.cpuUsagePercent,
                cpuAfter: resAfter.cpuUsagePercent,
                // RAM
                ramUsedMB: resAfter.ramUsedMB,
                ramTotalMB: resAfter.ramTotalMB,
                ramPercent: resAfter.ramUsedPercent,
                // GPU
                gpuName: gpuAfter?.gpuName ?? null,
                gpuUtilBefore: gpuBefore?.gpuUtilPercent ?? null,
                gpuUtilAfter: gpuAfter?.gpuUtilPercent ?? null,
                gpuVramUsedMB: gpuAfter?.gpuVramUsedMB ?? null,
                gpuVramTotalMB: gpuAfter?.gpuVramTotalMB ?? null,
                gpuTempC: gpuAfter?.gpuTempC ?? null,
                gpuPowerW: gpuAfter?.gpuPowerW ?? null,
                // Output
                outputLength: output.length,
                output,
              };
              allResults.push(result);

              const icon = quality.score >= 80 ? '✅' : quality.score >= 50 ? '⚠️' : '❌';
              const gpuStr = gpuAfter
                ? `GPU ${gpuAfter.gpuUtilPercent}% VRAM ${gpuAfter.gpuVramUsedMB}MB ${gpuAfter.gpuTempC}°C`
                : '';
              process.stdout.write(
                `    R${String(round).padStart(2)} ${icon} ${String(quality.score).padStart(3)}%  ` +
                `${String(elapsed).padStart(6)}ms  ${String(totalTokens).padStart(4)}tok  ` +
                `${String(tokensPerSec ?? '-').padStart(5)}tok/s  ` +
                `CPU ${resAfter.cpuUsagePercent}%  RAM ${resAfter.ramUsedMB}MB  ${gpuStr}\n`
              );
            } catch (err) {
              console.error(`    R${round}  ❌ ERROR: ${err.message}`);
              allResults.push({
                model, deviceType, configMode,
                promptId: promptObj.id, promptName: promptObj.name, round,
                error: err.message,
                qualityScore: 0, responseTimeMs: 0, totalTokens: 0,
              });
            }
          }
        }
      }
    }
  }

  // ─── Aggregate ─────────────────────────────────────────────────
  console.log('\n\n' + '═'.repeat(60));
  console.log('  AGGREGATED RESULTS');
  console.log('═'.repeat(60) + '\n');

  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : 0;
  const min = arr => arr.length ? Math.min(...arr) : 0;
  const max = arr => arr.length ? Math.max(...arr) : 0;
  const std = arr => {
    if (arr.length < 2) return 0;
    const m = avg(arr);
    return Math.round(Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1)) * 10) / 10;
  };

  // ─── Per-prompt detail ─────────────────────────────────────────
  const detailSummary = {};
  for (const r of allResults) {
    const key = `${r.model}|${r.deviceType}|${r.configMode}|${r.promptId}`;
    if (!detailSummary[key]) {
      detailSummary[key] = {
        model: r.model, deviceType: r.deviceType, configMode: r.configMode,
        promptId: r.promptId, promptName: r.promptName,
        times: [], scores: [], tokens: [], tps: [], ram: [],
        cpu: [], gpuUtil: [], vram: [], gpuTemp: [], gpuPower: [],
        errors: 0, outputs: [],
      };
    }
    if (r.error) { detailSummary[key].errors++; continue; }
    detailSummary[key].times.push(r.responseTimeMs);
    detailSummary[key].scores.push(r.qualityScore);
    detailSummary[key].tokens.push(r.totalTokens);
    if (r.tokensPerSec) detailSummary[key].tps.push(r.tokensPerSec);
    detailSummary[key].ram.push(r.ramUsedMB);
    detailSummary[key].cpu.push(r.cpuAfter ?? 0);
    if (r.gpuUtilAfter != null) detailSummary[key].gpuUtil.push(r.gpuUtilAfter);
    if (r.gpuVramUsedMB != null) detailSummary[key].vram.push(r.gpuVramUsedMB);
    if (r.gpuTempC != null) detailSummary[key].gpuTemp.push(r.gpuTempC);
    if (r.gpuPowerW != null) detailSummary[key].gpuPower.push(r.gpuPowerW);
    detailSummary[key].outputs.push(r.output);
  }

  const detailRows = [];
  for (const [, s] of Object.entries(detailSummary)) {
    detailRows.push({
      model: s.model, deviceType: s.deviceType, configMode: s.configMode,
      promptId: s.promptId, promptName: s.promptName,
      rounds: s.times.length, errors: s.errors,
      avgTimeMs: avg(s.times), stdTimeMs: std(s.times),
      avgScore: avg(s.scores), minScore: min(s.scores), maxScore: max(s.scores),
      avgTokens: avg(s.tokens), avgTokPerSec: avg(s.tps),
      avgCpuPercent: avg(s.cpu),
      avgRamMB: avg(s.ram),
      avgGpuUtil: avg(s.gpuUtil), avgVramMB: avg(s.vram),
      avgGpuTempC: avg(s.gpuTemp), avgGpuPowerW: avg(s.gpuPower),
    });
  }

  // ─── Mode-level summary (model × device × mode) ───────────────
  const modeSummary = {};
  for (const r of allResults) {
    const key = `${r.model}|${r.deviceType}|${r.configMode}`;
    if (!modeSummary[key]) {
      modeSummary[key] = {
        model: r.model, deviceType: r.deviceType, configMode: r.configMode,
        times: [], scores: [], tokens: [], tps: [], ram: [],
        cpu: [], gpuUtil: [], vram: [], errors: 0,
      };
    }
    if (r.error) { modeSummary[key].errors++; continue; }
    modeSummary[key].times.push(r.responseTimeMs);
    modeSummary[key].scores.push(r.qualityScore);
    modeSummary[key].tokens.push(r.totalTokens);
    if (r.tokensPerSec) modeSummary[key].tps.push(r.tokensPerSec);
    modeSummary[key].ram.push(r.ramUsedMB);
    modeSummary[key].cpu.push(r.cpuAfter ?? 0);
    if (r.gpuUtilAfter != null) modeSummary[key].gpuUtil.push(r.gpuUtilAfter);
    if (r.gpuVramUsedMB != null) modeSummary[key].vram.push(r.gpuVramUsedMB);
  }

  const summaryRows = [];
  for (const [, s] of Object.entries(modeSummary)) {
    const row = {
      model: s.model, deviceType: s.deviceType, configMode: s.configMode,
      rounds: s.times.length, errors: s.errors,
      avgTimeMs: avg(s.times), minTimeMs: min(s.times), maxTimeMs: max(s.times), stdTimeMs: std(s.times),
      avgScore: avg(s.scores), minScore: min(s.scores), maxScore: max(s.scores),
      avgTokens: avg(s.tokens), avgTokPerSec: avg(s.tps),
      avgCpuPercent: avg(s.cpu),
      avgRamMB: avg(s.ram),
      avgGpuUtil: avg(s.gpuUtil), avgVramMB: avg(s.vram),
    };
    summaryRows.push(row);

    const gpu = row.avgVramMB ? `GPU ${row.avgGpuUtil}%  VRAM ${row.avgVramMB}MB` : '';
    console.log(
      `${row.model.padEnd(22)} ${row.deviceType.padEnd(8)} ${row.configMode.padEnd(8)} ` +
      `Score: ${String(row.avgScore).padStart(5)}% (${row.minScore}-${row.maxScore})  ` +
      `Time: ${String(row.avgTimeMs).padStart(7)}ms  ` +
      `tok/s: ${String(row.avgTokPerSec).padStart(5)}  ` +
      `CPU: ${String(row.avgCpuPercent).padStart(5)}%  ` +
      `RAM: ${String(row.avgRamMB).padStart(6)}MB  ` +
      `${gpu}`
    );
  }

  // ─── Model-level summary ───────────────────────────────────────
  console.log('\n── Model-Level Summary ──\n');
  const modelSummary = {};
  for (const r of allResults) {
    if (r.error) continue;
    if (!modelSummary[r.model]) {
      modelSummary[r.model] = {
        cliScores: [], netconfScores: [], allScores: [],
        times: [], tps: [], ram: [], cpu: [],
        gpuUtil: [], vram: [],
      };
    }
    const ms = modelSummary[r.model];
    ms.allScores.push(r.qualityScore);
    if (r.configMode === 'cli') ms.cliScores.push(r.qualityScore);
    else ms.netconfScores.push(r.qualityScore);
    ms.times.push(r.responseTimeMs);
    if (r.tokensPerSec) ms.tps.push(r.tokensPerSec);
    ms.ram.push(r.ramUsedMB);
    ms.cpu.push(r.cpuAfter ?? 0);
    if (r.gpuUtilAfter != null) ms.gpuUtil.push(r.gpuUtilAfter);
    if (r.gpuVramUsedMB != null) ms.vram.push(r.gpuVramUsedMB);
  }

  const modelRows = [];
  for (const [model, ms] of Object.entries(modelSummary)) {
    const row = {
      model,
      cliAvg: avg(ms.cliScores),
      netconfAvg: avg(ms.netconfScores),
      totalAvg: avg(ms.allScores),
      avgTokPerSec: avg(ms.tps),
      avgTimeMs: avg(ms.times),
      avgCpuPercent: avg(ms.cpu),
      avgRamMB: avg(ms.ram),
      avgGpuUtil: avg(ms.gpuUtil),
      avgVramMB: avg(ms.vram),
    };
    modelRows.push(row);
    const gpu = row.avgVramMB ? `GPU ${row.avgGpuUtil}%  VRAM ${row.avgVramMB}MB` : '';
    console.log(
      `${model.padEnd(22)} CLI: ${String(row.cliAvg).padStart(5)}%  NETCONF: ${String(row.netconfAvg).padStart(5)}%  ` +
      `Total: ${String(row.totalAvg).padStart(5)}%  tok/s: ${String(row.avgTokPerSec).padStart(5)}  ` +
      `CPU: ${String(row.avgCpuPercent).padStart(5)}%  RAM: ${String(row.avgRamMB).padStart(6)}MB  ${gpu}`
    );
  }

  // ─── Save results ─────────────────────────────────────────────
  const outDir = path.resolve('backend/scripts');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const rawPath = path.join(outDir, `benchmark_v3_raw_${timestamp}.json`);
  const summaryPath = path.join(outDir, `benchmark_v3_summary_${timestamp}.json`);
  const detailPath = path.join(outDir, `benchmark_v3_detail_${timestamp}.json`);

  fs.writeFileSync(rawPath, JSON.stringify(allResults, null, 2));
  fs.writeFileSync(summaryPath, JSON.stringify({ summaryRows, modelRows }, null, 2));
  fs.writeFileSync(detailPath, JSON.stringify(detailRows, null, 2));

  // Also save as latest (overwrite)
  fs.writeFileSync(path.join(outDir, 'benchmark_v3_raw.json'), JSON.stringify(allResults, null, 2));
  fs.writeFileSync(path.join(outDir, 'benchmark_v3_summary.json'), JSON.stringify({ summaryRows, modelRows }, null, 2));
  fs.writeFileSync(path.join(outDir, 'benchmark_v3_detail.json'), JSON.stringify(detailRows, null, 2));

  console.log(`\n📁 Raw results: ${rawPath}`);
  console.log(`📁 Summary: ${summaryPath}`);
  console.log(`📁 Detail: ${detailPath}`);
  console.log('\n✅ Benchmark complete!');
}

runBenchmark().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
