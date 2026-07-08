/**
 * Utilities for reconciling interface names in an LLM-generated configuration
 * against the naming convention actually used on the real device.
 *
 * LLMs frequently hallucinate Linux-style names ("eth0/1") or the wrong
 * vendor prefix (e.g. "GigabitEthernet0/1" on a Nexus that actually uses
 * "Ethernet1/1"). These helpers extract what the config references, compare
 * it against a live interface list pulled from the device, and produce a
 * best-effort suggestion when the two disagree.
 */

// Canonical Cisco interface prefix -> known short-form aliases
const PREFIX_ALIASES = {
  GigabitEthernet: ['gi', 'gig', 'gige', 'ge'],
  FastEthernet: ['fa', 'fastethernet', 'fastEth', 'fe'],
  TenGigabitEthernet: ['te', 'tengig', 'tg', 'tengige', 'tengigabitethernet'],
  TwentyFiveGigE: ['twe', 'twentyfivegige', 'twentyfivegig'],
  FortyGigabitEthernet: ['fo', 'fortygig', 'fortygige'],
  HundredGigE: ['hu', 'hundredgige', 'hundredgig'],
  Ethernet: ['eth', 'e'],
  Serial: ['se', 's'],
  Loopback: ['lo', 'loop'],
  Vlan: ['vl'],
  'Port-channel': ['po', 'portchannel', 'port-channel', 'pc'],
  Tunnel: ['tu', 'tun'],
  Management: ['mgmt', 'ma', 'mgmt0'],
  Null: ['nu']
};

// Flat alias -> canonical lookup, longest alias first so "eth" doesn't get
// shadowed by a shorter accidental prefix match.
const ALIAS_LOOKUP = [];
for (const [canonical, aliases] of Object.entries(PREFIX_ALIASES)) {
  ALIAS_LOOKUP.push({ alias: canonical.toLowerCase(), canonical });
  for (const alias of aliases) {
    ALIAS_LOOKUP.push({ alias: alias.toLowerCase(), canonical });
  }
}
ALIAS_LOOKUP.sort((a, b) => b.alias.length - a.alias.length);

/**
 * Split "GigabitEthernet0/1.100" into { prefix: 'GigabitEthernet', suffix: '0/1.100' }
 */
export function splitInterfaceName(raw) {
  const trimmed = (raw || '').trim();
  const match = /^([A-Za-z-]+)\s*([\d/.:]+.*)$/.exec(trimmed);
  if (!match) return { prefix: trimmed, suffix: '' };
  return { prefix: match[1], suffix: match[2] };
}

/**
 * Normalize an interface name to its canonical long-form prefix + suffix,
 * e.g. "Gi0/1" -> "GigabitEthernet0/1", "eth0/1" -> "Ethernet0/1".
 * Returns null if the prefix isn't a recognized Cisco interface type at all.
 */
export function normalizeInterfaceName(raw) {
  if (!raw) return null;
  const { prefix, suffix } = splitInterfaceName(raw);
  const lowerPrefix = prefix.toLowerCase();
  const found = ALIAS_LOOKUP.find(a => lowerPrefix === a.alias);
  if (!found) return null;
  return `${found.canonical}${suffix}`;
}

/**
 * Extract every "interface X" reference from a CLI configuration.
 */
export function extractInterfaceReferences(configText) {
  if (!configText) return [];
  const names = new Set();
  const regex = /^\s*interface\s+(\S+)/gim;
  let match;
  while ((match = regex.exec(configText)) !== null) {
    names.add(match[1].trim());
  }
  return Array.from(names);
}

/**
 * Parse `show ip interface brief` / `show interface brief` style output into
 * a flat list of raw interface names (first column of each data row).
 */
export function parseInterfaceBriefOutput(rawOutput) {
  if (!rawOutput) return [];
  const lines = rawOutput.split('\n');
  const names = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^interface\b/i.test(trimmed)) continue; // header row
    if (/^-+$/.test(trimmed)) continue;
    const firstToken = trimmed.split(/\s+/)[0];
    // Must look like a real interface name: letters followed by a number
    if (/^[A-Za-z-]+[\d/.:]/.test(firstToken)) {
      names.push(firstToken);
    }
  }
  return names;
}

/**
 * Compare interfaces referenced in a generated config against the real
 * device's live interface list. Returns matched names plus mismatches with
 * a best-effort suggestion when one can be inferred from the numeric suffix
 * (e.g. config says "eth0/1", device has "GigabitEthernet0/1" -> suggest it).
 */
export function compareInterfaces(configInterfaces, liveInterfaceNames) {
  const liveNormalized = (liveInterfaceNames || [])
    .map(name => ({ raw: name, normalized: normalizeInterfaceName(name) || name }))
    .filter(entry => entry.normalized);

  const liveBySuffix = new Map();
  for (const entry of liveNormalized) {
    const { suffix } = splitInterfaceName(entry.normalized);
    if (suffix && !liveBySuffix.has(suffix)) liveBySuffix.set(suffix, entry.raw);
  }

  const matched = [];
  const mismatched = [];

  for (const configName of configInterfaces) {
    const normalized = normalizeInterfaceName(configName);
    const isMatch = !!normalized && liveNormalized.some(
      entry => entry.normalized.toLowerCase() === normalized.toLowerCase()
    );

    if (isMatch) {
      matched.push(configName);
      continue;
    }

    const { suffix } = splitInterfaceName(configName);
    const suggestion = suffix ? liveBySuffix.get(suffix) : null;

    mismatched.push({
      configInterface: configName,
      reason: normalized
        ? 'Not found on this device'
        : `"${configName}" is not a recognized Cisco interface name`,
      suggestion: suggestion || null
    });
  }

  return { matched, mismatched };
}

export default {
  splitInterfaceName,
  normalizeInterfaceName,
  extractInterfaceReferences,
  parseInterfaceBriefOutput,
  compareInterfaces
};
