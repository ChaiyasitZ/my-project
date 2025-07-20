export class AIContext {
  constructor() {
    console.log('🧠 AI Context service initialized');
  }

  // Helper function to convert CIDR to wildcard mask
  cidrToWildcardMask(cidr) {
    const prefixLength = parseInt(cidr.replace('/', ''));
    if (isNaN(prefixLength) || prefixLength < 0 || prefixLength > 32) {
      return null;
    }
    
    // Calculate wildcard mask (inverse of subnet mask)
    const wildcardMask = (0xFFFFFFFF >>> prefixLength) >>> 0;
    return [
      (wildcardMask >>> 24) & 0xFF,
      (wildcardMask >>> 16) & 0xFF,
      (wildcardMask >>> 8) & 0xFF,
      wildcardMask & 0xFF
    ].join('.');
  }

  // Helper function to extract and convert CIDR in prompt
  preprocessPrompt(prompt) {
    // Convert CIDR notation to include wildcard mask examples
    const cidrRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})/g;
    let processedPrompt = prompt;
    
    const matches = [...prompt.matchAll(cidrRegex)];
    for (const match of matches) {
      const [fullMatch, network, prefix] = match;
      const wildcardMask = this.cidrToWildcardMask(`/${prefix}`);
      
      if (wildcardMask) {
        // Add specific wildcard mask information for this exact network
        processedPrompt += `\n\nIMPORTANT: ${network}/${prefix} MUST use wildcard mask ${wildcardMask}`;
        processedPrompt += `\nCORRECT COMMAND: network ${network} ${wildcardMask} area X`;
      }
    }
    
    return processedPrompt;
  }

  // Build configuration prompt for single device
  buildConfigurationPrompt(prompt, deviceType, deviceContext = {}) {
    const deviceInfo = [
      deviceContext.model && `Model: ${deviceContext.model}`,
      deviceContext.name && `Name: ${deviceContext.name}`,
      deviceContext.ios_version && `IOS: ${deviceContext.ios_version}`
    ].filter(Boolean).join(', ');

    // Preprocess prompt to handle CIDR notation
    const processedPrompt = this.preprocessPrompt(prompt);

    return `Generate ONLY Cisco IOS configuration commands for ${deviceType}.

${deviceInfo ? `Device: ${deviceInfo}` : ''}

Task: ${processedPrompt}

CRITICAL REQUIREMENTS:
- Generate ONLY configuration commands
- NO explanations, descriptions, comments, or text
- NO "Here's the configuration:" or similar phrases
- NO markdown formatting
- NO line numbers or explanatory text
- Start directly with configuration commands
- Use proper Cisco IOS syntax only

⚠️ CIDR TO WILDCARD MASK CONVERSION - USE EXACT VALUES:
/8 = 0.255.255.255
/16 = 0.0.255.255
/24 = 0.0.0.255
/25 = 0.0.0.127
/26 = 0.0.0.63
/27 = 0.0.0.31
/28 = 0.0.0.15
/29 = 0.0.0.7
/30 = 0.0.0.3

EXAMPLE FORMATS:
- For /24: network 192.168.1.0 0.0.0.255 area 0
- For /25: network 192.168.1.0 0.0.0.127 area 0
- For /30: network 192.168.1.0 0.0.0.3 area 0

⚠️ ROUTING PROTOCOL EXAMPLES WITH CIDR CONVERSION:

🔸 OSPF EXAMPLES:
configure terminal
router ospf 1
network 192.168.1.0 0.0.0.255 area 0
network 10.0.0.0 0.255.255.255 area 0
router-id 1.1.1.1
end

configure terminal
router ospf 100
network 172.16.0.0 0.0.255.255 area 1
network 192.168.10.0 0.0.0.127 area 0
end

🔸 EIGRP EXAMPLES:
configure terminal
router eigrp 100
network 192.168.1.0 0.0.0.255
network 10.0.0.0 0.255.255.255
no auto-summary
end

configure terminal
router eigrp 200
network 172.16.0.0 0.0.255.255
network 192.168.0.0 0.0.255.255
end

🔸 RIPv2 EXAMPLES:
configure terminal
router rip
version 2
network 192.168.1.0
network 10.0.0.0
no auto-summary
end

configure terminal
router rip
version 2
network 172.16.0.0
network 192.168.0.0
end

🔸 BGP EXAMPLES:
configure terminal
router bgp 65001
network 192.168.1.0 mask 255.255.255.0
network 10.0.0.0 mask 255.0.0.0
neighbor 10.0.0.2 remote-as 65002
end

configure terminal
router bgp 65100
network 172.16.0.0 mask 255.255.0.0
neighbor 192.168.1.2 remote-as 65200
neighbor 192.168.1.2 update-source loopback0
end

🔸 ISIS EXAMPLES:
configure terminal
router isis AREA1
net 49.0001.1921.6800.1001.00
is-type level-2-only
end
interface gigabitethernet0/1
ip router isis AREA1
end

configure terminal
router isis CORE
net 49.0002.1720.1600.1001.00
is-type level-1-2
end
interface gigabitethernet0/0
ip router isis CORE
isis metric 10
end

GENERATE CONFIGURATION NOW:`;
  }

  // Build multi-device prompt
  buildMultiDevicePrompt(prompt, device, deviceIndex, totalDevices) {
    return `Generate ONLY Cisco IOS configuration commands for ${device.type} "${device.name}".

Task: ${prompt}

Device ${deviceIndex + 1} of ${totalDevices}

CRITICAL REQUIREMENTS:
- Generate ONLY configuration commands
- NO explanations, descriptions, comments, or text
- NO "Here's the configuration:" or similar phrases
- NO markdown formatting
- NO line numbers or explanatory text
- Start directly with configuration commands
- Use proper Cisco IOS syntax only
- Consider this is device ${deviceIndex + 1} in a ${totalDevices}-device network

CIDR TO WILDCARD MASK CONVERSION:
/8 = 0.255.255.255, /16 = 0.0.255.255, /24 = 0.0.0.255, /25 = 0.0.0.127, /26 = 0.0.0.63, /27 = 0.0.0.31, /28 = 0.0.0.15, /29 = 0.0.0.7, /30 = 0.0.0.3

ROUTING PROTOCOL EXAMPLES:
🔸 OSPF: router ospf 1 → network 192.168.1.0 0.0.0.255 area 0
🔸 EIGRP: router eigrp 100 → network 192.168.1.0 0.0.0.255 → no auto-summary
🔸 RIPv2: router rip → version 2 → network 192.168.1.0 → no auto-summary
🔸 BGP: router bgp 65001 → network 192.168.1.0 mask 255.255.255.0 → neighbor X.X.X.X remote-as XXXX
🔸 ISIS: router isis AREA1 → net 49.0001.xxxx.xxxx.xxxx.00 → interface config

GENERATE CONFIGURATION NOW:`;
  }

  // Build NETCONF XML prompt
  buildNetconfXmlPrompt(prompt, deviceType, yangModel = null) {
    return `Generate ONLY NETCONF XML configuration for Cisco ${deviceType}.

Task: ${prompt}

${yangModel ? `YANG Model: ${yangModel.name}` : ''}

CRITICAL REQUIREMENTS:
- Generate ONLY XML configuration commands
- NO explanations, descriptions, comments, or text
- NO "Here's the XML:" or similar phrases
- NO markdown formatting
- NO line numbers or explanatory text
- Start directly with XML tags
- Use proper NETCONF XML format only

CIDR TO WILDCARD MASK CONVERSION:
/8 = 0.255.255.255, /16 = 0.0.255.255, /24 = 0.0.0.255, /25 = 0.0.0.127, /26 = 0.0.0.63, /27 = 0.0.0.31, /28 = 0.0.0.15, /29 = 0.0.0.7, /30 = 0.0.0.3

ROUTING PROTOCOLS FOR XML:
🔸 OSPF: Use routing-process with process-id and area configurations
🔸 EIGRP: Use routing-process with autonomous-system and network statements
🔸 RIPv2: Use rip with version 2 and network configurations
🔸 BGP: Use bgp with as-number, network, and neighbor configurations
🔸 ISIS: Use isis with area-tag and interface configurations

GENERATE XML NOW:`;
  }

  // Helper function to clean AI response - remove explanations and comments
  cleanConfigurationResponse(response) {
    if (!response) return '';
    
    let cleaned = response.trim();
    
    // Remove common unwanted phrases at the beginning
    const unwantedPrefixes = [
      'Here\'s the configuration:',
      'Here is the configuration:',
      'Configuration:',
      'The configuration is:',
      'Below is the configuration:',
      'Here\'s what you need:',
      'Here is what you need:',
      'Solution:',
      'Answer:',
      'Output:',
      'Result:'
    ];
    
    for (const prefix of unwantedPrefixes) {
      if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
        cleaned = cleaned.substring(prefix.length).trim();
      }
    }
    
    // Remove markdown code blocks
    cleaned = cleaned.replace(/```[\s\S]*?\n/g, '');
    cleaned = cleaned.replace(/```[\s\S]*?$/g, '');
    cleaned = cleaned.replace(/```/g, '');
    
    // Remove explanatory lines (lines that don't start with valid Cisco commands)
    const lines = cleaned.split('\n');
    const validConfigLines = [];
    
    const validCommandStarts = [
      'configure terminal',
      'conf t',
      'router ',
      'interface ',
      'ip ',
      'network ',
      'neighbor ',
      'redistribute ',
      'access-list ',
      'vlan ',
      'switchport ',
      'spanning-tree ',
      'hostname ',
      'enable ',
      'line ',
      'username ',
      'crypto ',
      'service ',
      'no ',
      'exit',
      'end',
      '!',
      ' ' // for indented commands
    ];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
        continue;
      }
      
      // Check if line starts with valid Cisco command
      const isValidCommand = validCommandStarts.some(cmd => 
        trimmedLine.toLowerCase().startsWith(cmd.toLowerCase()) || 
        trimmedLine.startsWith(' ') // indented commands
      );
      
      if (isValidCommand) {
        validConfigLines.push(line);
      }
    }
    
    return validConfigLines.join('\n').trim();
  }

  // Clean XML response
  cleanXmlResponse(response) {
    if (!response) return '';
    
    let cleaned = response.trim();
    
    // Remove unwanted prefixes for XML
    const xmlUnwantedPrefixes = [
      'Here\'s the XML:',
      'Here is the XML:',
      'XML:',
      'The XML is:',
      'Below is the XML:',
      'NETCONF XML:',
      'Configuration XML:'
    ];
    
    for (const prefix of xmlUnwantedPrefixes) {
      if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
        cleaned = cleaned.substring(prefix.length).trim();
      }
    }
    
    // Remove markdown code blocks
    cleaned = cleaned.replace(/```[\s\S]*?\n/g, '');
    cleaned = cleaned.replace(/```[\s\S]*?$/g, '');
    cleaned = cleaned.replace(/```/g, '');
    
    return cleaned;
  }

  // Get routing protocol templates
  getRoutingProtocolExamples() {
    return {
      ospf: {
        name: 'OSPF',
        description: 'Open Shortest Path First - Link State Routing Protocol',
        examples: [
          'router ospf 1 network 192.168.1.0/24 area 0',
          'router ospf 100 network 10.0.0.0/8 area 0',
          'router ospf 1 network 172.16.0.0/16 area 1',
          'router ospf 50 network 192.168.10.0/25 area 0'
        ],
        config_template: `configure terminal
router ospf {process_id}
network {network} {wildcard_mask} area {area}
router-id {router_id}
end`
      },
      eigrp: {
        name: 'EIGRP',
        description: 'Enhanced Interior Gateway Routing Protocol - Advanced Distance Vector',
        examples: [
          'eigrp 100 network 192.168.0.0/16',
          'eigrp 200 network 10.0.0.0/8',
          'eigrp 300 network 172.16.0.0/12',
          'eigrp 150 network 192.168.1.0/24'
        ],
        config_template: `configure terminal
router eigrp {as_number}
network {network} {wildcard_mask}
no auto-summary
end`
      },
      bgp: {
        name: 'BGP',
        description: 'Border Gateway Protocol - Path Vector Routing Protocol',
        examples: [
          'bgp 65001 neighbor 10.0.0.2 remote-as 65002',
          'bgp 65100 network 192.168.1.0/24',
          'bgp 65200 neighbor 172.16.1.1 remote-as 65300',
          'bgp 65001 network 10.0.0.0/8'
        ],
        config_template: `configure terminal
router bgp {as_number}
network {network} mask {subnet_mask}
neighbor {neighbor_ip} remote-as {remote_as}
end`
      },
      rip: {
        name: 'RIPv2',
        description: 'Routing Information Protocol version 2 - Distance Vector',
        examples: [
          'rip version 2 network 192.168.1.0',
          'rip network 10.0.0.0',
          'rip version 2 network 172.16.0.0',
          'rip network 192.168.0.0'
        ],
        config_template: `configure terminal
router rip
version 2
network {classful_network}
no auto-summary
end`
      },
      isis: {
        name: 'ISIS',
        description: 'Intermediate System to Intermediate System - Link State',
        examples: [
          'isis CORE network 172.16.0.0/16',
          'isis area 49.0001 interface gi0/1',
          'isis BACKBONE network 10.0.0.0/8',
          'isis AREA1 interface loopback0'
        ],
        config_template: `configure terminal
router isis {area_tag}
net {net_address}
is-type level-1-2
end
interface {interface}
ip router isis {area_tag}
end`
      }
    };
  }
}

export default new AIContext(); 