/**
 * LLM Benchmark Script
 * Tests 3 Ollama models × 3 OS types × 2 config modes (CLI + NETCONF) × 10 rounds
 * Tracks: response time, token usage, CPU/RAM, output quality
 *
 * Usage: node backend/scripts/benchmarkLLM.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// ─── Configuration ───────────────────────────────────────────────
const OLLAMA_URL = 'http://localhost:11434';
const ROUNDS = 10;

const MODELS = [
  'qwen2.5-coder:7b',
  'codellama:7b',
  'codegemma:7b',
];

const DEVICE_TYPES = ['ios', 'ios-xe', 'nexus'];

// ─── Prompts ─────────────────────────────────────────────────────
const CLI_PROMPT = 'Configure OSPF process 1 area 0 on interface GigabitEthernet0/1 with IP 10.0.0.1/30 and set router-id 1.1.1.1';

const NETCONF_PROMPT = 'Configure interface GigabitEthernet0/1 with IP address 10.0.0.1/30 and enable it';

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

OSPF:
<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
  <ospf-items>
    <inst-items>
      <Inst-list>
        <name>1</name>
        <dom-items>
          <Dom-list>
            <name>default</name>
            <rtrId>1.1.1.1</rtrId>
            <area-items>
              <Area-list>
                <id>0.0.0.0</id>
              </Area-list>
            </area-items>
          </Dom-list>
        </dom-items>
      </Inst-list>
    </inst-items>
  </ospf-items>
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

OSPF:
<native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">
  <router>
    <ospf xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-ospf">
      <id>1</id>
      <router-id>1.1.1.1</router-id>
      <network>
        <ip>10.0.0.0</ip>
        <mask>0.0.0.3</mask>
        <area>0</area>
      </network>
    </ospf>
  </router>
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
function scoreCLI(output, deviceType) {
  const checks = [];
  const lower = output.toLowerCase();

  // Basic structure checks
  checks.push({ name: 'has_interface_cmd', pass: /^interface\s/im.test(output) });
  checks.push({ name: 'has_ip_address', pass: /ip\s+address/i.test(output) });
  checks.push({ name: 'has_ospf', pass: /router\s+ospf/i.test(output) });
  checks.push({ name: 'has_network', pass: /network\s/i.test(output) });
  checks.push({ name: 'has_router_id', pass: /router-id/i.test(output) });
  checks.push({ name: 'no_markdown', pass: !output.includes('```') });
  checks.push({ name: 'no_explanation', pass: !/here is|here are|sure|note:/i.test(output) });
  checks.push({ name: 'wildcard_mask', pass: /0\.0\.0\./i.test(output) });
  checks.push({ name: 'no_conf_t', pass: !/configure\s+terminal/i.test(output) });
  checks.push({ name: 'correct_ip', pass: /10\.0\.0\.1/i.test(output) });

  const passed = checks.filter(c => c.pass).length;
  return { score: Math.round((passed / checks.length) * 100), total: checks.length, passed, checks };
}

function scoreNETCONF(output, deviceType) {
  const checks = [];

  checks.push({ name: 'is_xml', pass: /<\w+[\s>]/i.test(output) });
  checks.push({ name: 'has_xmlns', pass: /xmlns=/i.test(output) });
  checks.push({ name: 'well_formed', pass: /<\/\w+>/i.test(output) });
  checks.push({ name: 'no_markdown', pass: !output.includes('```') });
  checks.push({ name: 'no_explanation', pass: !/here is|here are|sure|note:/i.test(output) });
  checks.push({ name: 'correct_ip', pass: /10\.0\.0\.1/.test(output) });

  if (deviceType === 'nexus') {
    checks.push({ name: 'nxos_ns', pass: /cisco-nx-os-device/i.test(output) });
    checks.push({ name: 'nxos_root', pass: /<System/i.test(output) });
    checks.push({ name: 'has_intf_items', pass: /intf-items|phys-items|PhysIf/i.test(output) });
    checks.push({ name: 'has_adminSt', pass: /adminSt/i.test(output) });
  } else if (deviceType === 'ios-xe') {
    checks.push({ name: 'iosxe_ns', pass: /Cisco-IOS-XE-native/i.test(output) });
    checks.push({ name: 'iosxe_root', pass: /<native/i.test(output) });
    checks.push({ name: 'has_interface', pass: /<interface>/i.test(output) || /<GigabitEthernet>/i.test(output) });
    checks.push({ name: 'has_ip_tag', pass: /<ip>/i.test(output) || /<address>/i.test(output) });
  } else {
    // ios → ietf models
    checks.push({ name: 'ietf_ns', pass: /ietf-interfaces|ietf-ip/i.test(output) });
    checks.push({ name: 'has_interface', pass: /<interface>/i.test(output) });
    checks.push({ name: 'has_name', pass: /<name>/i.test(output) });
    checks.push({ name: 'has_enabled', pass: /enabled|ipv4/i.test(output) });
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
  console.log('═══════════════════════════════════════════════════');
  console.log('  LLM Benchmark — 3 models × 3 OS × 2 modes × 10 rounds');
  console.log('═══════════════════════════════════════════════════\n');

  // Verify Ollama is running
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!r.ok) throw new Error('not ok');
    console.log('✅ Ollama is running.\n');
  } catch {
    console.error('❌ Ollama is not running. Start it first with: ollama serve');
    process.exit(1);
  }

  const allResults = [];

  for (const model of MODELS) {
    console.log(`\n====== MODEL: ${model} ======`);

    // Pre-load the model with a dummy request so first real call isn't cold-start
    console.log(`  ⏳ Warming up ${model}...`);
    try {
      await callOllama(model, [{ role: 'user', content: 'hello' }], 0.1);
      console.log(`  ✅ Warm-up done.\n`);
    } catch (e) {
      console.error(`  ❌ Warm-up failed: ${e.message}`);
    }

    for (const deviceType of DEVICE_TYPES) {
      for (const configMode of ['cli', 'netconf']) {
        const label = `${model} | ${deviceType} | ${configMode}`;
        console.log(`\n  ── ${label} (${ROUNDS} rounds) ──`);

        const roundResults = [];

        for (let round = 1; round <= ROUNDS; round++) {
          const resBefore = getSystemResources();

          let messages;
          if (configMode === 'cli') {
            messages = [
              { role: 'system', content: buildCLISystemMessage() },
              { role: 'user', content: buildCLIUserMessage(CLI_PROMPT, deviceType) },
            ];
          } else {
            let sysMsg;
            if (deviceType === 'nexus') sysMsg = buildNxosNetconfSystem();
            else if (deviceType === 'ios-xe') sysMsg = buildIosXeNetconfSystem();
            else sysMsg = buildIosNetconfSystem();
            messages = [
              { role: 'system', content: sysMsg },
              { role: 'user', content: buildNetconfUserMessage(NETCONF_PROMPT, deviceType) },
            ];
          }

          try {
            const { data, elapsed } = await callOllama(model, messages, 0.1);
            const resAfter = getSystemResources();
            const output = data.message?.content?.trim() || '';
            const evalDuration = data.eval_duration ? data.eval_duration / 1e9 : null; // ns → s
            const promptTokens = data.prompt_eval_count || 0;
            const completionTokens = data.eval_count || 0;
            const totalTokens = promptTokens + completionTokens;
            const tokensPerSec = evalDuration && completionTokens ? Math.round(completionTokens / evalDuration * 10) / 10 : null;

            const quality = configMode === 'cli'
              ? scoreCLI(output, deviceType)
              : scoreNETCONF(output, deviceType);

            const result = {
              model,
              deviceType,
              configMode,
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
              cpuBefore: resBefore.cpuUsagePercent,
              cpuAfter: resAfter.cpuUsagePercent,
              ramUsedMB: resAfter.ramUsedMB,
              ramPercent: resAfter.ramUsedPercent,
              outputLength: output.length,
              output,
            };
            roundResults.push(result);

            const icon = quality.score >= 80 ? '✅' : quality.score >= 50 ? '⚠️' : '❌';
            process.stdout.write(`    Round ${String(round).padStart(2)}  ${icon} ${quality.score}%  ${elapsed}ms  ${totalTokens}tok  ${tokensPerSec ?? '-'}tok/s  RAM ${resAfter.ramUsedMB}MB\n`);
          } catch (err) {
            console.error(`    Round ${round}  ❌ ERROR: ${err.message}`);
            roundResults.push({
              model, deviceType, configMode, round,
              error: err.message,
              qualityScore: 0,
              responseTimeMs: 0,
              totalTokens: 0,
            });
          }
        }

        allResults.push(...roundResults);
      }
    }
  }

  // ─── Aggregate & save ──────────────────────────────────────────
  console.log('\n\n═══════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════\n');

  const summary = {};

  for (const r of allResults) {
    const key = `${r.model}|${r.deviceType}|${r.configMode}`;
    if (!summary[key]) {
      summary[key] = {
        model: r.model, deviceType: r.deviceType, configMode: r.configMode,
        times: [], scores: [], tokens: [], tps: [], ram: [], errors: 0, outputs: [],
      };
    }
    if (r.error) { summary[key].errors++; continue; }
    summary[key].times.push(r.responseTimeMs);
    summary[key].scores.push(r.qualityScore);
    summary[key].tokens.push(r.totalTokens);
    if (r.tokensPerSec) summary[key].tps.push(r.tokensPerSec);
    summary[key].ram.push(r.ramUsedMB);
    summary[key].outputs.push(r.output);
  }

  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : 0;
  const min = arr => arr.length ? Math.min(...arr) : 0;
  const max = arr => arr.length ? Math.max(...arr) : 0;
  const std = arr => {
    if (arr.length < 2) return 0;
    const m = avg(arr);
    return Math.round(Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1)) * 10) / 10;
  };

  const summaryRows = [];

  for (const [, s] of Object.entries(summary)) {
    const row = {
      model: s.model,
      deviceType: s.deviceType,
      configMode: s.configMode,
      rounds: s.times.length,
      errors: s.errors,
      avgTimeMs: avg(s.times),
      minTimeMs: min(s.times),
      maxTimeMs: max(s.times),
      stdTimeMs: std(s.times),
      avgScore: avg(s.scores),
      minScore: min(s.scores),
      maxScore: max(s.scores),
      avgTokens: avg(s.tokens),
      avgTokPerSec: avg(s.tps),
      avgRamMB: avg(s.ram),
      bestOutput: s.outputs.length ? s.outputs[s.scores.indexOf(Math.max(...s.scores))] : '',
    };
    summaryRows.push(row);
    console.log(
      `${row.model.padEnd(22)} ${row.deviceType.padEnd(8)} ${row.configMode.padEnd(8)} ` +
      `Score: ${row.avgScore}% (${row.minScore}-${row.maxScore})  ` +
      `Time: ${row.avgTimeMs}ms (±${row.stdTimeMs})  ` +
      `Tokens: ${row.avgTokens}  ` +
      `tok/s: ${row.avgTokPerSec}  ` +
      `RAM: ${row.avgRamMB}MB  ` +
      `Errors: ${row.errors}`
    );
  }

  // Save raw results
  const outDir = path.resolve('backend/scripts');
  const rawPath = path.join(outDir, 'benchmark_results_raw.json');
  const summaryPath = path.join(outDir, 'benchmark_results_summary.json');

  fs.writeFileSync(rawPath, JSON.stringify(allResults, null, 2));
  fs.writeFileSync(summaryPath, JSON.stringify(summaryRows, null, 2));

  console.log(`\n📁 Raw results saved to: ${rawPath}`);
  console.log(`📁 Summary saved to: ${summaryPath}`);
  console.log('\nDone!');
}

runBenchmark().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
