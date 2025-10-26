import axios from 'axios';

/**
 * OpenRouter LLM Service for Cisco Configuration Generation
 * Uses OpenRouter API for access to multiple AI models
 */
export class LLMService {
  constructor() {
    // Configuration
    this.provider = process.env.LLM_PROVIDER || 'openrouter';
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.model = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';
    this.apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    this.timeout = 120000; // 120 seconds
    
    // HTTP Client for OpenRouter
    this.client = axios.create({
      baseURL: 'https://openrouter.ai/api/v1',
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'http://localhost:3001', // Optional: your app URL
        'X-Title': 'Cisco Network Automation', // Optional: app name
        'Content-Type': 'application/json'
      }
    });
    
    // Optimized parameters for Cisco configuration generation
    this.defaultParams = {
      temperature: 0.1,        // Low for deterministic output
      max_tokens: 1000,        // Enough for complex configs
      top_p: 0.85,             // Balanced probability
      frequency_penalty: 0.3,  // Reduce repetition
      presence_penalty: 0.2,   // Encourage variety
      stop: ['```', 'Here are', 'Here is', 'Sure', 'Note:', '---']
    };
    
    // Knowledge base for enhanced context
    this.knowledgeBase = this._initializeKnowledgeBase();
    
    if (!this.apiKey || this.apiKey === 'your_openrouter_api_key_here') {
      console.warn(`⚠️ OpenRouter API key not configured! Please set OPENROUTER_API_KEY in .env`);
    } else {
      console.log(`🤖 LLM Service initialized - Provider: ${this.provider}, Model: ${this.model}`);
    }
  }

  /**
   * Generate Cisco configuration from text prompt using OpenRouter
   */
  async generateConfiguration(prompt, deviceType, deviceContext = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Generating config for ${deviceType}: "${prompt}"`);

      // Check API key
      if (!this.apiKey || this.apiKey === 'your_openrouter_api_key_here') {
        throw new Error('OpenRouter API key not configured. Please set OPENROUTER_API_KEY in .env file');
      }

      // Build system message with knowledge context
      const systemMessage = this._buildSystemMessage(prompt, deviceType);
      
      // Build user message with the actual request
      const userMessage = this._buildUserMessage(prompt, deviceType, deviceContext);
      
      console.log(`📝 System message length: ${systemMessage.length} characters`);
      console.log(`📝 User message length: ${userMessage.length} characters`);
      console.log(`🎯 Using model: ${this.model}`);
      
      // Call OpenRouter API with retry logic
      let response;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        try {
          response = await this.client.post('/chat/completions', {
            model: this.model,
            messages: [
              {
                role: 'system',
                content: systemMessage
              },
              {
                role: 'user',
                content: userMessage
              }
            ],
            ...this.defaultParams
          });
          break; // Success, exit retry loop
        } catch (apiError) {
          retryCount++;
          if (retryCount > maxRetries) {
            throw apiError;
          }
          console.log(`⚠️ Retry ${retryCount}/${maxRetries} after error: ${apiError.message}`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        }
      }

      // Parse OpenRouter response
      const rawConfig = response.data?.choices?.[0]?.message?.content?.trim();
      
      if (!rawConfig) {
        console.error(`❌ Empty response from OpenRouter`);
        console.error(`❌ Response structure:`, JSON.stringify(response.data, null, 2).substring(0, 500));
        throw new Error(`Empty response from ${this.model} - API may have issues`);
      }
      
      console.log(`📦 Raw response: ${rawConfig.length} chars`);
      console.log(`📄 Raw output preview:\n${rawConfig.substring(0, 200)}...`);
      
      // Clean and validate configuration
      const cleanConfig = this._cleanConfiguration(rawConfig);
      
      if (!cleanConfig || cleanConfig.length < 5) {
        console.error(`❌ Configuration too short after cleaning: ${cleanConfig.length} chars`);
        throw new Error(`Generated configuration is too short or empty`);
      }
      
      const deploymentConfig = this._createDeploymentVersion(cleanConfig);
      const validation = this._validateConfiguration(cleanConfig, deviceType);
      
      const executionTime = Date.now() - startTime;
      const tokensUsed = response.data?.usage?.total_tokens || 0;
      
      console.log(`✅ Generated successfully (${executionTime}ms, ${tokensUsed} tokens)`);
      console.log(`📋 Clean config:\n${cleanConfig.substring(0, 200)}...`);
      console.log(`✅ Validation score: ${validation.score}/100`);
      
      return {
        success: true,
        configuration: deploymentConfig,
        displayConfig: cleanConfig,
        deploymentConfig,
        model: this.model,
        provider: 'openrouter',
        deviceType,
        method: 'openrouter_chat',
        executionTime,
        tokensUsed,
        validation,
        confidenceScore: validation.score,
        recommendations: validation.warnings.length > 0 ? validation.warnings : ['Configuration looks good']
      };
      
    } catch (error) { 
      const executionTime = Date.now() - startTime;
      console.error("❌ Generation failed:", error.message);
      console.error("❌ Full error:", error);
      
      // Provide helpful error messages
      let userMessage = error.message;
      if (error.response?.status === 401) {
        userMessage = 'Invalid OpenRouter API key. Please check your OPENROUTER_API_KEY in .env';
      } else if (error.response?.status === 429) {
        userMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (error.response?.status === 402) {
        userMessage = 'Insufficient credits. Please add credits to your OpenRouter account.';
      } else if (error.code === 'ECONNREFUSED') {
        userMessage = 'Cannot connect to OpenRouter API. Check your internet connection.';
      } else if (error.message.includes('timeout')) {
        userMessage = 'Request timed out. The model may be busy.';
      }
      
      return {
        success: false,
        error: `Generation failed: ${userMessage}`,
        configuration: null,
        executionTime,
        suggestions: [
          'Check if OPENROUTER_API_KEY is set in .env file',
          'Verify your OpenRouter account has credits',
          'Check your internet connection',
          'Try a different model if the current one is unavailable',
          'Simplify your prompt if it\'s too complex'
        ]
      };
    }
  }

  /**
   * Initialize comprehensive Cisco knowledge base
   */
  _initializeKnowledgeBase() {
    return {
      routing: {
        ospf: {
          context: "OSPF (Open Shortest Path First) is a hierarchical link-state routing protocol that uses areas to scale large networks efficiently",
          syntax: [
            "router ospf [process-id]",
            "network [ip-address] [wildcard-mask] area [area-id]",
            "area [area-id] authentication [message-digest]",
            "area [area-id] stub [no-summary]",
            "area [area-id] nssa [default-information-originate]",
            "area [area-id] virtual-link [router-id]",
            "default-information originate [always] [metric [value]]",
            "redistribute [protocol] [metric [value]] [subnets]",
            "passive-interface [interface]",
            "auto-cost reference-bandwidth [value]",
            "router-id [ip-address]",
            "area [area-id] range [ip-address] [mask] [advertise|not-advertise]"
          ],
          examples: [
            "router ospf 1",
            "router-id 1.1.1.1",
            "network 192.168.1.0 0.0.0.255 area 0",
            "network 10.0.0.0 0.255.255.255 area 1",
            "area 1 stub no-summary",
            "area 2 nssa default-information-originate",
            "area 0 authentication message-digest",
            "default-information originate always metric 100",
            "redistribute static subnets",
            "passive-interface loopback0",
            "auto-cost reference-bandwidth 10000"
          ],
          bestPractices: [
            "Always configure router-id manually for stability",
            "Use area 0 as backbone - all areas must connect to area 0",
            "Always use wildcard masks, not subnet masks",
            "Enable authentication (preferably MD5) for security",
            "Use stub areas to reduce LSA flooding",
            "Configure passive-interface on LAN segments",
            "Adjust reference bandwidth for modern interfaces",
            "Use area summarization to reduce routing table size",
            "Place ABRs and ASBRs in area 0 when possible"
          ],
          areaTypes: [
            "Backbone Area (Area 0): Core area, all other areas connect here",
            "Standard Area: Normal OSPF area with all LSA types",
            "Stub Area: Blocks external LSAs (Type 5), reduces memory usage",
            "Totally Stub Area: Blocks external and summary LSAs (Type 3,4,5)",
            "NSSA: Not-So-Stubby Area, allows limited external route injection",
            "Totally NSSA: Combines NSSA with totally stub characteristics"
          ],
          lsaTypes: [
            "Type 1 (Router LSA): Describes router's links within area",
            "Type 2 (Network LSA): Generated by DR for multi-access networks",
            "Type 3 (Summary LSA): Inter-area routes from ABR",
            "Type 4 (ASBR Summary): Location of ASBR in other areas",
            "Type 5 (External LSA): External routes from ASBR",
            "Type 7 (NSSA External): External routes within NSSA area"
          ]
        },
        eigrp: {
          context: "EIGRP (Enhanced Interior Gateway Routing Protocol) is Cisco's advanced distance vector protocol using DUAL algorithm for loop-free topology",
          syntax: [
            "router eigrp [autonomous-system]",
            "network [ip-address] [wildcard-mask]",
            "no auto-summary",
            "eigrp router-id [ip-address]",
            "eigrp stub [connected] [summary] [redistributed] [receive-only]",
            "metric weights [tos] [k1] [k2] [k3] [k4] [k5]",
            "variance [multiplier]",
            "maximum-paths [paths]",
            "redistribute [protocol] [metric [bandwidth] [delay] [reliability] [load] [mtu]]",
            "passive-interface [interface]",
            "bandwidth [kbps]",
            "delay [tens-of-microseconds]",
            "ip hello-interval eigrp [as] [seconds]",
            "ip hold-time eigrp [as] [seconds]",
            "ip summary-address eigrp [as] [network] [mask]"
          ],
          examples: [
            "router eigrp 100",
            "eigrp router-id 2.2.2.2",
            "network 10.0.0.0 0.255.255.255",
            "network 192.168.1.0 0.0.0.255",
            "no auto-summary",
            "eigrp stub connected summary",
            "variance 2",
            "maximum-paths 4",
            "redistribute static metric 1544 2000 255 1 1500",
            "passive-interface gi0/0",
            "ip summary-address eigrp 100 192.168.0.0 255.255.0.0"
          ],
          bestPractices: [
            "Always disable auto-summary for VLSM networks",
            "Use consistent AS numbers across the network",
            "Configure router-id manually for stability",
            "Use EIGRP stub on spoke routers to reduce queries",
            "Implement manual summarization at network boundaries",
            "Tune hello/hold timers for fast convergence",
            "Use variance for unequal-cost load balancing",
            "Configure passive-interface on LAN segments",
            "Use authentication for security in production"
          ],
          metrics: [
            "Bandwidth: Interface bandwidth in Kbps (K1 weight)",
            "Delay: Interface delay in tens of microseconds (K3 weight)",
            "Reliability: Interface reliability 0-255 (K5 weight)",
            "Load: Interface load 0-255 (K4 weight)",
            "MTU: Maximum Transmission Unit (not used in metric by default)"
          ],
          stubTypes: [
            "Connected: Advertise connected routes only",
            "Summary: Advertise summary routes only", 
            "Redistributed: Advertise redistributed routes only",
            "Receive-only: Don't advertise any routes, only receive"
          ]
        },
        bgp: {
          context: "BGP (Border Gateway Protocol) is the path vector exterior gateway protocol for inter-AS routing, using path attributes for policy-based routing decisions",
          syntax: [
            "router bgp [as-number]",
            "bgp router-id [ip-address]",
            "neighbor [ip-address] remote-as [as-number]",
            "neighbor [ip-address] update-source [interface]",
            "neighbor [ip-address] next-hop-self",
            "neighbor [ip-address] route-reflector-client",
            "neighbor [ip-address] send-community [both|extended|standard]",
            "neighbor [ip-address] soft-reconfiguration inbound",
            "neighbor [ip-address] prefix-list [name] [in|out]",
            "neighbor [ip-address] route-map [name] [in|out]",
            "network [network] mask [subnet-mask]",
            "aggregate-address [network] [mask] [summary-only]",
            "redistribute [protocol] [route-map [name]]",
            "bgp log-neighbor-changes",
            "bgp confederation identifier [as-number]",
            "bgp confederation peers [as-number-list]"
          ],
          examples: [
            "router bgp 65001",
            "bgp router-id 3.3.3.3",
            "bgp log-neighbor-changes",
            "neighbor 10.1.1.2 remote-as 65002",
            "neighbor 10.1.1.2 update-source loopback0",
            "neighbor 192.168.1.1 remote-as 65001",
            "neighbor 192.168.1.1 next-hop-self",
            "neighbor 192.168.1.1 route-reflector-client",
            "network 172.16.0.0 mask 255.255.0.0",
            "aggregate-address 10.0.0.0 255.0.0.0 summary-only",
            "redistribute ospf 1 route-map OSPF-TO-BGP"
          ],
          bestPractices: [
            "Always configure router-id manually",
            "Use loopback interfaces for iBGP peering",
            "Configure next-hop-self for iBGP peers",
            "Use route reflectors to reduce iBGP mesh",
            "Implement prefix-lists and route-maps for filtering",
            "Enable soft reconfiguration for policy changes",
            "Use communities for traffic engineering",
            "Configure authentication for security",
            "Monitor BGP table size and memory usage"
          ],
          pathAttributes: [
            "AS_PATH: List of AS numbers the route has traversed",
            "NEXT_HOP: IP address of next hop router",
            "LOCAL_PREF: Local preference for iBGP (higher preferred)",
            "MED: Multi-Exit Discriminator for inbound traffic control",
            "ORIGIN: How route was injected (IGP, EGP, Incomplete)",
            "COMMUNITY: Optional transitive attribute for policy",
            "WEIGHT: Cisco proprietary, highest weight preferred"
          ],
          peerTypes: [
            "eBGP: External BGP between different autonomous systems",
            "iBGP: Internal BGP within same autonomous system",
            "Route Reflector: Reduces iBGP full mesh requirement",
            "Confederation: Divides AS into sub-AS for scalability"
          ]
        },
        rip: {
          context: "RIP (Routing Information Protocol) is a simple distance vector protocol with 15-hop limit, suitable for small networks",
          syntax: [
            "router rip",
            "version 2",
            "network [network-address]",
            "no auto-summary",
            "passive-interface [interface]",
            "redistribute [protocol] [metric [hops]]",
            "default-information originate",
            "maximum-paths [paths]",
            "timers basic [update] [invalid] [holddown] [flush]",
            "distance [distance] [source-network] [wildcard]"
          ],
          examples: [
            "router rip",
            "version 2",
            "network 192.168.1.0",
            "network 10.0.0.0",
            "no auto-summary",
            "passive-interface gi0/0",
            "redistribute static metric 5",
            "default-information originate",
            "timers basic 30 180 180 240"
          ],
          bestPractices: [
            "Always use RIP version 2 for VLSM support",
            "Disable auto-summary for modern networks",
            "Use passive-interface on LAN segments",
            "Limit to small networks (max 15 hops)",
            "Consider OSPF or EIGRP for larger networks",
            "Use authentication where supported"
          ],
          limitations: [
            "Maximum hop count of 15 (16 is unreachable)",
            "Slow convergence compared to modern protocols",
            "No support for VLSM in version 1",
            "Periodic updates every 30 seconds",
            "Count-to-infinity problem"
          ]
        },
        isis: {
          context: "ISIS (Intermediate System to Intermediate System) is a link-state routing protocol similar to OSPF but with different addressing scheme",
          syntax: [
            "router isis [tag]",
            "net [network-entity-title]",
            "is-type [level-1|level-1-2|level-2-only]",
            "area-password [password]",
            "domain-password [password]",
            "redistribute [protocol] [level-1|level-2] [metric [value]]",
            "summary-address [address] [mask] [level-1|level-2]",
            "ip router isis [tag]",
            "isis circuit-type [level-1|level-1-2|level-2-only]",
            "isis metric [metric] [level-1|level-2]",
            "isis hello-interval [seconds] [level-1|level-2]",
            "isis hello-multiplier [multiplier] [level-1|level-2]"
          ],
          examples: [
            "router isis CORE",
            "net 49.0001.1921.6800.1001.00",
            "is-type level-2-only",
            "area-password cisco123",
            "redistribute ospf 1 level-2 metric 20",
            "summary-address 192.168.0.0 255.255.0.0 level-2",
            "interface gi0/1",
            "ip router isis CORE",
            "isis circuit-type level-2-only",
            "isis metric 10"
          ],
          bestPractices: [
            "Use meaningful process tags",
            "Configure NET address carefully (Area.SystemID.SEL)",
            "Use level-2-only for backbone routers",
            "Use level-1 for stub areas",
            "Configure authentication for security",
            "Use summary addresses to reduce LSP flooding",
            "Tune hello intervals for fast convergence"
          ],
          levels: [
            "Level-1: Routing within area (like OSPF intra-area)",
            "Level-2: Routing between areas (like OSPF inter-area)",
            "Level-1-2: Router participates in both levels"
          ],
          addressing: [
            "NET Format: AFI.Area-ID.System-ID.SEL",
            "AFI: Authority and Format Identifier (49 for private)",
            "Area-ID: Variable length area identifier",
            "System-ID: 6-byte unique system identifier",
            "SEL: Selector byte (always 00 for router)"
          ]
        },
        static: {
          context: "Static routing provides manual route configuration with full administrative control",
          syntax: [
            "ip route [destination] [mask] [next-hop|interface] [distance]",
            "ip route [destination] [mask] [interface] [next-hop] [distance]",
            "ip route [destination] [mask] null0 [distance]",
            "ip route 0.0.0.0 0.0.0.0 [next-hop|interface] [distance]",
            "ipv6 route [destination/prefix-length] [next-hop|interface] [distance]",
            "ip route [destination] [mask] [next-hop] track [object-number]"
          ],
          examples: [
            "ip route 192.168.2.0 255.255.255.0 10.1.1.2",
            "ip route 172.16.0.0 255.255.0.0 gi0/1 10.1.1.2",
            "ip route 10.10.10.0 255.255.255.0 null0 200",
            "ip route 0.0.0.0 0.0.0.0 192.168.1.1 1",
            "ip route 203.0.113.0 255.255.255.0 10.1.1.2 track 1",
            "ipv6 route 2001:db8:2::/64 2001:db8:1::2"
          ],
          bestPractices: [
            "Use administrative distance to control route preference",
            "Configure default routes for internet connectivity",
            "Use null routes for blackhole routing",
            "Implement route tracking for redundancy",
            "Document all static routes for maintenance",
            "Use floating static routes as backup"
          ],
          routeTypes: [
            "Standard Static: Basic static route to destination",
            "Default Route: 0.0.0.0/0 for internet access",
            "Host Route: /32 route to specific host",
            "Null Route: Route to null0 for blackholing",
            "Floating Static: High AD backup route",
            "Recursive Route: Next-hop resolved through routing table"
          ]
        }
      },
      switching: {
        vlan: {
          context: "VLANs (Virtual LANs) logically segment broadcast domains within a physical switch infrastructure, providing network isolation and improved security",
          syntax: [
            "vlan [vlan-id]",
            "name [vlan-name]",
            "state [active|suspend]",
            "switchport mode access",
            "switchport access vlan [vlan-id]",
            "switchport mode trunk",
            "switchport trunk allowed vlan [vlan-list]",
            "switchport trunk native vlan [vlan-id]",
            "switchport trunk encapsulation [dot1q|isl]",
            "switchport nonegotiate",
            "vlan database",
            "vtp mode [server|client|transparent|off]",
            "vtp domain [domain-name]",
            "vtp password [password]"
          ],
          examples: [
            "vlan 10",
            "name SALES_DEPT",
            "state active",
            "vlan 20",
            "name ENGINEERING",
            "interface gi0/1",
            "switchport mode access",
            "switchport access vlan 10",
            "interface gi0/24",
            "switchport mode trunk",
            "switchport trunk allowed vlan 10,20,30",
            "switchport trunk native vlan 99",
            "switchport nonegotiate"
          ],
          bestPractices: [
            "Use meaningful VLAN names for easy identification",
            "Change native VLAN from default (VLAN 1) for security",
            "Use VLAN 1 only for management if necessary",
            "Document VLAN assignments and purposes",
            "Use trunk ports only between switches",
            "Prune unused VLANs from trunk links",
            "Use VTP transparent mode or disable VTP",
            "Assign unused ports to unused VLAN",
            "Use consistent VLAN numbering scheme"
          ],
          trunkingProtocols: [
            "802.1Q: Industry standard VLAN tagging protocol",
            "ISL: Cisco proprietary trunking (legacy)",
            "DTP: Dynamic Trunking Protocol for auto-negotiation"
          ],
          vtpModes: [
            "Server: Creates, modifies, deletes VLANs and propagates changes",
            "Client: Receives VLAN information, cannot modify VLANs",
            "Transparent: Forwards VTP advertisements but maintains own database",
            "Off: Disables VTP completely (recommended for modern networks)"
          ],
          securityBestPractices: [
            "Change native VLAN to unused VLAN (not VLAN 1)",
            "Disable unused ports and assign to unused VLAN",
            "Use VLAN ACLs (VACLs) for intra-VLAN filtering",
            "Implement private VLANs for additional isolation",
            "Enable BPDU Guard on access ports",
            "Disable CDP/LLDP on edge ports if not needed"
          ]
        },
        interVlanRouting: {
          context: "Inter-VLAN routing enables communication between different VLANs using Layer 3 routing functionality",
          syntax: [
            "interface vlan [vlan-id]",
            "ip address [ip-address] [subnet-mask]",
            "no shutdown",
            "ip routing",
            "interface [interface].[subinterface]",
            "encapsulation dot1Q [vlan-id] [native]",
            "ip helper-address [ip-address]",
            "standby [group] ip [virtual-ip]",
            "standby [group] priority [priority]",
            "standby [group] preempt"
          ],
          examples: [
            "ip routing",
            "interface vlan 10",
            "ip address 192.168.10.1 255.255.255.0",
            "description SALES_GATEWAY",
            "no shutdown",
            "interface vlan 20", 
            "ip address 192.168.20.1 255.255.255.0",
            "description ENGINEERING_GATEWAY",
            "no shutdown",
            "interface gi0/1.10",
            "encapsulation dot1Q 10",
            "ip address 192.168.10.1 255.255.255.0"
          ],
          methods: [
            "SVI (Switched Virtual Interface): Layer 3 interface on switch",
            "Router-on-a-Stick: External router with subinterfaces",
            "Layer 3 Switch: Dedicated Layer 3 switching hardware",
            "Routed Ports: Physical ports configured as Layer 3"
          ],
          bestPractices: [
            "Use Layer 3 switches for better performance",
            "Configure HSRP/VRRP for gateway redundancy",
            "Implement proper IP addressing scheme",
            "Use DHCP relay agents for centralized DHCP",
            "Apply ACLs between VLANs for security",
            "Monitor inter-VLAN traffic patterns"
          ]
        },
        stp: {
          context: "STP (Spanning Tree Protocol) prevents loops in switched networks",
          syntax: [
            "spanning-tree mode rapid-pvst",
            "spanning-tree vlan [vlan-id] priority [priority]",
            "spanning-tree portfast",
            "spanning-tree bpduguard enable"
          ],
          examples: [
            "spanning-tree mode rapid-pvst",
            "spanning-tree vlan 1 priority 4096",
            "spanning-tree portfast"
          ]
        },
        etherchannel: {
          context: "EtherChannel bundles multiple physical links into one logical link",
          syntax: [
            "channel-group [number] mode active",
            "channel-group [number] mode passive",
            "interface port-channel [number]",
            "switchport mode trunk"
          ],
          examples: [
            "channel-group 1 mode active",
            "interface port-channel 1",
            "switchport mode trunk"
          ]
        }
      },
      interfaces: {
        naming: {
          context: "Cisco interface naming conventions use both full names and standardized short names for efficient configuration",
          shortNames: {
            "Ethernet": ["Eth", "E"],
            "FastEthernet": ["Fa", "FastEth"],
            "GigabitEthernet": ["Gi", "GigE", "Gig"],
            "TenGigabitEthernet": ["Te", "TenGig", "TG"],
            "TwentyFiveGigabitEthernet": ["TF", "TwentyFiveGig"],
            "FortyGigabitEthernet": ["Fo", "FortyGig"],
            "FiftyGigabitEthernet": ["Fi", "FiftyGig"],
            "HundredGigabitEthernet": ["Hu", "HundredGig"],
            "TwoHundredGigabitEthernet": ["TH", "TwoHundredGig"],
            "FourHundredGigabitEthernet": ["F", "FourHundredGig"],
            "Serial": ["Se", "Ser"],
            "Loopback": ["Lo", "Loop"],
            "Null": ["Nu", "Null0"],
            "Management": ["Mg", "Mgmt"],
            "Port-channel": ["Po", "PC"],
            "Bundle-Ether": ["BE"],
            "Bundle-POS": ["BP"],
            "Tunnel": ["Tu", "Tun"],
            "BRI": ["BRI"],
            "Vlan": ["Vl"]
          },
          syntax: [
            "interface [type][slot/port]",
            "interface [type][slot/port/subport]",
            "interface [type][number]",
            "interface [short-name][slot/port]"
          ],
          examples: [
            "interface GigabitEthernet0/1 (same as: interface Gi0/1)",
            "interface FastEthernet0/24 (same as: interface Fa0/24)",
            "interface TenGigabitEthernet1/0/1 (same as: interface Te1/0/1)",
            "interface Serial0/0/0 (same as: interface Se0/0/0)",
            "interface Loopback0 (same as: interface Lo0)",
            "interface Port-channel1 (same as: interface Po1)"
          ],
          bestPractices: [
            "Use short names for faster configuration",
            "Consistent naming across network devices",
            "Use descriptive descriptions for interfaces",
            "Follow slot/port numbering conventions",
            "Use logical interface numbering for virtual interfaces"
          ]
        },
        ethernet: {
          context: "Ethernet interfaces are physical network connections with various speeds and capabilities",
          types: {
            "Ethernet": "10 Mbps legacy Ethernet (rarely used)",
            "FastEthernet": "100 Mbps Ethernet for access ports",
            "GigabitEthernet": "1 Gbps Ethernet, most common interface type",
            "TenGigabitEthernet": "10 Gbps Ethernet for high-speed connections",
            "TwentyFiveGigabitEthernet": "25 Gbps Ethernet for modern data centers",
            "FortyGigabitEthernet": "40 Gbps Ethernet for backbone connections",
            "FiftyGigabitEthernet": "50 Gbps Ethernet for high-density applications",
            "HundredGigabitEthernet": "100 Gbps Ethernet for core networks",
            "TwoHundredGigabitEthernet": "200 Gbps Ethernet for ultra-high-speed",
            "FourHundredGigabitEthernet": "400 Gbps Ethernet for next-gen networks"
          },
          syntax: [
            "interface [ethernet-type][slot/port]",
            "ip address [ip] [mask]",
            "no shutdown",
            "description [text]",
            "duplex [auto|full|half]",
            "speed [auto|10|100|1000|10000]",
            "switchport mode [access|trunk]",
            "switchport access vlan [vlan-id]",
            "channel-group [number] mode [active|passive|on]"
          ],
          examples: [
            "interface Gi0/1",
            "description CONNECTION_TO_SERVER",
            "ip address 192.168.1.1 255.255.255.0",
            "duplex full",
            "speed 1000",
            "no shutdown",
            "interface Fa0/24",
            "switchport mode access",
            "switchport access vlan 10"
          ],
          bestPractices: [
            "Always use 'no shutdown' to enable interfaces",
            "Set meaningful descriptions for all interfaces",
            "Use auto-negotiation when possible",
            "Configure speed/duplex manually only when needed",
            "Use appropriate interface type for bandwidth requirements"
          ]
        },
        virtual: {
          context: "Virtual interfaces provide logical connectivity and special functions",
          types: {
            "Loopback": "Virtual interface that never goes down, used for management",
            "Null": "Bit bucket interface for discarding traffic",
            "Tunnel": "Virtual interface for VPN and overlay networks",
            "Port-channel": "Logical interface for EtherChannel/Link Aggregation",
            "Vlan": "Switched Virtual Interface (SVI) for inter-VLAN routing",
            "Management": "Dedicated out-of-band management interface"
          },
          syntax: [
            "interface loopback [number]",
            "interface null [number]",
            "interface tunnel [number]",
            "interface port-channel [number]",
            "interface vlan [vlan-id]",
            "interface management [slot/port]"
          ],
          examples: [
            "interface Lo0",
            "ip address 1.1.1.1 255.255.255.255",
            "description ROUTER_ID",
            "interface Po1",
            "switchport mode trunk",
            "interface Vlan10",
            "ip address 192.168.10.1 255.255.255.0",
            "interface Tu0",
            "tunnel source gi0/1",
            "tunnel destination 203.0.113.1"
          ],
          bestPractices: [
            "Use loopback0 for router ID and management",
            "Use /32 mask for loopback interfaces",
            "Configure port-channels before adding member interfaces",
            "Use meaningful tunnel interface numbers",
            "Enable SVIs only when needed for routing"
          ]
        },
        serial: {
          context: "Serial interfaces provide WAN connectivity using various encapsulation methods",
          types: {
            "Serial": "Traditional serial WAN interface",
            "BRI": "Basic Rate Interface for ISDN connections",
            "POS": "Packet over SONET/SDH for high-speed WAN"
          },
          syntax: [
            "interface serial [slot/port]",
            "ip address [ip] [mask]",
            "encapsulation [ppp|hdlc|frame-relay]",
            "clock rate [rate]",
            "bandwidth [kbps]",
            "keepalive [seconds]",
            "no shutdown"
          ],
          examples: [
            "interface Se0/0/0",
            "ip address 10.1.1.1 255.255.255.252",
            "encapsulation ppp",
            "clock rate 1544000",
            "bandwidth 1544",
            "no shutdown"
          ],
          bestPractices: [
            "Set clock rate on DCE side of serial connection",
            "Use PPP encapsulation for authentication",
            "Configure bandwidth for routing protocol metrics",
            "Use point-to-point IP addressing (/30 or /31)",
            "Enable keepalives for link monitoring"
          ]
        }
      },
      security: {
        acl: {
          context: "Access Control Lists filter traffic based on various criteria",
          syntax: [
            "access-list [number] permit/deny [protocol] [source] [destination]",
            "ip access-group [acl-name] in/out",
            "ip access-list extended [name]"
          ],
          examples: [
            "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80",
            "ip access-group 100 in"
          ]
        }
      },
      general: {
        basic: {
          context: "Essential device configuration commands for initial setup and basic operation",
          syntax: [
            "hostname [name]",
            "enable secret [password]",
            "enable password [password]",
            "service password-encryption",
            "no ip domain-lookup",
            "ip domain-name [domain]",
            "banner motd # [message] #",
            "banner login # [message] #",
            "clock timezone [zone] [offset]",
            "clock set [time] [date]"
          ],
          examples: [
            "hostname CORE-ROUTER-01",
            "enable secret Cisco123!",
            "service password-encryption",
            "no ip domain-lookup",
            "ip domain-name company.com",
            "banner motd # Authorized Access Only #",
            "clock timezone EST -5"
          ],
          bestPractices: [
            "Use descriptive hostnames with location/function",
            "Use strong enable passwords with encryption",
            "Disable DNS lookup to prevent command delays",
            "Set appropriate time zone and NTP",
            "Use warning banners for security",
            "Enable password encryption service"
          ]
        },
        ipConfiguration: {
          context: "IP address configuration on interfaces for network connectivity",
          syntax: [
            "interface [type][number]",
            "ip address [ip] [mask]",
            "ip address [ip] [mask] secondary",
            "ip address dhcp",
            "no shutdown",
            "description [text]",
            "ip default-gateway [gateway-ip]",
            "ip route [destination] [mask] [next-hop]",
            "ip name-server [dns-server]"
          ],
          examples: [
            "interface gi0/0",
            "ip address 192.168.1.1 255.255.255.0",
            "description LAN_INTERFACE",
            "no shutdown",
            "interface gi0/1",
            "ip address dhcp",
            "no shutdown",
            "ip default-gateway 192.168.1.1",
            "ip route 0.0.0.0 0.0.0.0 192.168.1.1",
            "ip name-server 8.8.8.8"
          ],
          bestPractices: [
            "Always use 'no shutdown' to enable interfaces",
            "Add meaningful descriptions to all interfaces",
            "Use consistent IP addressing schemes",
            "Configure default gateway on switches",
            "Set DNS servers for name resolution",
            "Use secondary addresses when needed"
          ],
          addressingTypes: [
            "Static: Manual IP address assignment",
            "DHCP: Dynamic IP from DHCP server",
            "Secondary: Additional IP on same interface",
            "Unnumbered: Borrow IP from another interface"
          ]
        },
        userManagement: {
          context: "User account management and authentication configuration",
          syntax: [
            "username [name] secret [password]",
            "username [name] privilege [level]",
            "username [name] password [password]",
            "enable secret [password]",
            "enable password [password]",
            "service password-encryption",
            "security passwords min-length [length]",
            "login block-for [seconds] attempts [number] within [seconds]"
          ],
          examples: [
            "username admin secret Admin123!",
            "username admin privilege 15",
            "username operator secret Oper456!",
            "username operator privilege 1",
            "enable secret Enable789!",
            "service password-encryption",
            "security passwords min-length 8",
            "login block-for 300 attempts 3 within 60"
          ],
          bestPractices: [
            "Use strong passwords with mixed characters",
            "Set appropriate privilege levels (1-15)",
            "Enable password encryption service",
            "Implement login attempt limits",
            "Use secret instead of password commands",
            "Regular password rotation policy"
          ],
          privilegeLevels: [
            "Level 0: User EXEC commands (limited)",
            "Level 1: User EXEC mode (default user)",
            "Level 15: Privileged EXEC mode (full access)",
            "Levels 2-14: Custom privilege levels"
          ]
        },
        lineConfiguration: {
          context: "Console and VTY line configuration for device access",
          syntax: [
            "line console 0",
            "line vty 0 4",
            "line vty 0 15",
            "password [password]",
            "login",
            "login local",
            "transport input [protocol]",
            "transport output [protocol]",
            "exec-timeout [minutes] [seconds]",
            "logging synchronous",
            "history size [number]"
          ],
          examples: [
            "line console 0",
            "password Console123!",
            "login",
            "logging synchronous",
            "exec-timeout 5 0",
            "line vty 0 15",
            "login local",
            "transport input ssh",
            "exec-timeout 10 0",
            "history size 50"
          ],
          bestPractices: [
            "Secure console access with passwords",
            "Use 'login local' for username authentication",
            "Restrict VTY to SSH only for security",
            "Set reasonable exec timeouts",
            "Enable logging synchronous on console",
            "Configure sufficient VTY lines (0-15)"
          ],
          lineTypes: [
            "Console: Physical console port access",
            "VTY: Virtual terminal (Telnet/SSH) access",
            "AUX: Auxiliary port (modem) access",
            "TTY: Asynchronous terminal lines"
          ]
        },
        sshConfiguration: {
          context: "SSH configuration for secure remote access",
          syntax: [
            "ip domain-name [domain]",
            "crypto key generate rsa [modulus [size]]",
            "ip ssh version 2",
            "ip ssh time-out [seconds]",
            "ip ssh authentication-retries [number]",
            "ip ssh source-interface [interface]",
            "ip ssh logging events",
            "line vty 0 15",
            "transport input ssh",
            "login local"
          ],
          examples: [
            "ip domain-name company.com",
            "crypto key generate rsa modulus 2048",
            "ip ssh version 2",
            "ip ssh time-out 60",
            "ip ssh authentication-retries 3",
            "ip ssh logging events",
            "line vty 0 15",
            "login local",
            "transport input ssh"
          ],
          bestPractices: [
            "Use RSA keys 2048 bits or larger",
            "Configure domain name before generating keys",
            "Use SSH version 2 only",
            "Set reasonable timeout values",
            "Limit authentication retries",
            "Enable SSH event logging",
            "Disable Telnet access"
          ],
          requirements: [
            "Domain name must be configured",
            "RSA keys must be generated",
            "Username database required",
            "VTY lines configured for SSH"
          ]
        },
        configurationManagement: {
          context: "Configuration saving, backup, and management commands",
          syntax: [
            "copy running-config startup-config",
            "write memory",
            "write",
            "copy startup-config running-config",
            "copy running-config tftp:",
            "copy tftp: startup-config",
            "erase startup-config",
            "reload",
            "show running-config",
            "show startup-config",
            "configure terminal",
            "end",
            "exit"
          ],
          examples: [
            "copy running-config startup-config",
            "write memory",
            "copy running-config tftp://192.168.1.100/router-config.txt",
            "copy tftp://192.168.1.100/backup-config.txt startup-config",
            "show running-config | include hostname",
            "configure terminal",
            "end"
          ],
          bestPractices: [
            "Always save configuration after changes",
            "Regular backups to TFTP/FTP servers",
            "Document configuration changes",
            "Test configurations before saving",
            "Keep multiple backup versions",
            "Use configuration archiving"
          ],
          configTypes: [
            "Running-config: Active configuration in RAM",
            "Startup-config: Boot configuration in NVRAM", 
            "TFTP backup: External server backup",
            "Archive: Automated configuration history"
          ]
        }
      }
    };
  }

  /**
   * Build system message with role definition and rules
   */
  _buildSystemMessage(prompt, deviceType) {
    const relevantKnowledge = this._getRelevantKnowledge(prompt);
    
    return `You are a Cisco IOS command generator expert. Your job is to generate ONLY raw Cisco IOS configuration commands.

RELEVANT KNOWLEDGE:
${relevantKnowledge}

STRICT OUTPUT RULES:
1. Generate ONLY configuration commands (no "configure terminal", no "end", no "exit")
2. Use proper indentation (single space before sub-commands)
3. Use wildcard masks for OSPF network commands, NOT subnet masks
4. Accept both full and short interface names (Gi, Fa, Te, etc.)
5. Follow Cisco best practices
6. NO explanations, NO comments, NO markdown, NO code blocks
7. Start directly with the first command

EXAMPLE OUTPUT FORMAT:
interface GigabitEthernet0/1
 ip address 192.168.1.1 255.255.255.0
 description Connection to Core Switch
 no shutdown

Remember: Output ONLY the commands, nothing else.`;
  }

  /**
   * Build user message with specific request
   */
  _buildUserMessage(prompt, deviceType, deviceContext) {
    const deviceName = deviceContext.name || 'Device';
    const deviceModel = deviceContext.model || 'Generic Cisco';
    
    // Pre-process the prompt
    let processedPrompt = this._preprocessCIDR(prompt);
    processedPrompt = this._standardizeInterfaceNames(processedPrompt);
    
    return `Device: ${deviceName} (${deviceType} - ${deviceModel})

Configuration Request: ${processedPrompt}

Generate the Cisco IOS commands now:`;
  }

  /**
   * Build knowledge-enhanced prompt (legacy method for compatibility)
   */
  _buildPromptWithKnowledge(prompt, deviceType, deviceContext) {
    const systemMsg = this._buildSystemMessage(prompt, deviceType);
    const userMsg = this._buildUserMessage(prompt, deviceType, deviceContext);
    return `${systemMsg}\n\n${userMsg}`;
  }

  /**
   * Get relevant knowledge based on prompt content
   */
  _getRelevantKnowledge(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    let knowledge = [];
    
    // Check for routing protocols
    if (lowerPrompt.includes('ospf') || lowerPrompt.includes('area')) {
      const ospf = this.knowledgeBase.routing.ospf;
      knowledge.push(`OSPF: ${ospf.context}`);
      knowledge.push(`Syntax: ${ospf.syntax.slice(0, 6).join(', ')}`);
      knowledge.push(`Best Practices: ${ospf.bestPractices.slice(0, 4).join(', ')}`);
      if (lowerPrompt.includes('area') || lowerPrompt.includes('stub') || lowerPrompt.includes('nssa')) {
        knowledge.push(`Area Types: ${ospf.areaTypes.slice(0, 3).join(', ')}`);
      }
    }
    
    if (lowerPrompt.includes('eigrp')) {
      const eigrp = this.knowledgeBase.routing.eigrp;
      knowledge.push(`EIGRP: ${eigrp.context}`);
      knowledge.push(`Syntax: ${eigrp.syntax.slice(0, 6).join(', ')}`);
      knowledge.push(`Best Practices: ${eigrp.bestPractices.slice(0, 4).join(', ')}`);
      if (lowerPrompt.includes('stub') || lowerPrompt.includes('metric') || lowerPrompt.includes('variance')) {
        knowledge.push(`Metrics: ${eigrp.metrics.slice(0, 3).join(', ')}`);
      }
    }
    
    if (lowerPrompt.includes('bgp')) {
      const bgp = this.knowledgeBase.routing.bgp;
      knowledge.push(`BGP: ${bgp.context}`);
      knowledge.push(`Syntax: ${bgp.syntax.slice(0, 6).join(', ')}`);
      knowledge.push(`Best Practices: ${bgp.bestPractices.slice(0, 4).join(', ')}`);
      if (lowerPrompt.includes('neighbor') || lowerPrompt.includes('peer')) {
        knowledge.push(`Peer Types: ${bgp.peerTypes.join(', ')}`);
      }
    }
    
    if (lowerPrompt.includes('rip')) {
      const rip = this.knowledgeBase.routing.rip;
      knowledge.push(`RIP: ${rip.context}`);
      knowledge.push(`Syntax: ${rip.syntax.slice(0, 5).join(', ')}`);
      knowledge.push(`Best Practices: ${rip.bestPractices.slice(0, 3).join(', ')}`);
    }
    
    if (lowerPrompt.includes('isis')) {
      const isis = this.knowledgeBase.routing.isis;
      knowledge.push(`ISIS: ${isis.context}`);
      knowledge.push(`Syntax: ${isis.syntax.slice(0, 5).join(', ')}`);
      knowledge.push(`Best Practices: ${isis.bestPractices.slice(0, 4).join(', ')}`);
    }
    
    if (lowerPrompt.includes('static') || lowerPrompt.includes('ip route')) {
      const staticRouting = this.knowledgeBase.routing.static;
      knowledge.push(`Static Routing: ${staticRouting.context}`);
      knowledge.push(`Syntax: ${staticRouting.syntax.slice(0, 4).join(', ')}`);
      knowledge.push(`Best Practices: ${staticRouting.bestPractices.slice(0, 3).join(', ')}`);
    }
    
    // Check for switching
    if (lowerPrompt.includes('vlan') || lowerPrompt.includes('switchport')) {
      const vlan = this.knowledgeBase.switching.vlan;
      knowledge.push(`VLAN: ${vlan.context}`);
      knowledge.push(`Syntax: ${vlan.syntax.slice(0, 6).join(', ')}`);
      knowledge.push(`Best Practices: ${vlan.bestPractices.slice(0, 4).join(', ')}`);
      if (lowerPrompt.includes('trunk') || lowerPrompt.includes('native')) {
        knowledge.push(`Trunking: ${vlan.trunkingProtocols.join(', ')}`);
      }
      if (lowerPrompt.includes('vtp')) {
        knowledge.push(`VTP Modes: ${vlan.vtpModes.join(', ')}`);
      }
    }
    
    if (lowerPrompt.includes('inter-vlan') || lowerPrompt.includes('svi') || lowerPrompt.includes('router-on-stick')) {
      const interVlan = this.knowledgeBase.switching.interVlanRouting;
      knowledge.push(`Inter-VLAN Routing: ${interVlan.context}`);
      knowledge.push(`Syntax: ${interVlan.syntax.slice(0, 5).join(', ')}`);
      knowledge.push(`Methods: ${interVlan.methods.join(', ')}`);
      knowledge.push(`Best Practices: ${interVlan.bestPractices.slice(0, 3).join(', ')}`);
    }
    
    if (lowerPrompt.includes('spanning-tree') || lowerPrompt.includes('stp')) {
      const stp = this.knowledgeBase.switching.stp;
      knowledge.push(`STP: ${stp.context}`);
      knowledge.push(`Syntax: ${stp.syntax.join(', ')}`);
    }
    
    if (lowerPrompt.includes('etherchannel') || lowerPrompt.includes('port-channel')) {
      const etherchannel = this.knowledgeBase.switching.etherchannel;
      knowledge.push(`EtherChannel: ${etherchannel.context}`);
      knowledge.push(`Syntax: ${etherchannel.syntax.join(', ')}`);
    }
    
    // Check for interface naming
    if (lowerPrompt.includes('interface') || this._containsInterfaceShortName(lowerPrompt)) {
      const naming = this.knowledgeBase.interfaces.naming;
      knowledge.push(`Interface Naming: ${naming.context}`);
      knowledge.push(`Short Names: Gi (GigabitEthernet), Fa (FastEthernet), Te (TenGigabitEthernet), Se (Serial), Lo (Loopback), Po (Port-channel)`);
      knowledge.push(`Best Practices: ${naming.bestPractices.slice(0, 3).join(', ')}`);
    }
    
    // Check for Ethernet interfaces
    if (lowerPrompt.includes('ethernet') || lowerPrompt.includes('gi') || lowerPrompt.includes('fa') || lowerPrompt.includes('te')) {
      const ethernet = this.knowledgeBase.interfaces.ethernet;
      knowledge.push(`Ethernet Interfaces: ${ethernet.context}`);
      knowledge.push(`Syntax: ${ethernet.syntax.slice(0, 5).join(', ')}`);
      knowledge.push(`Best Practices: ${ethernet.bestPractices.slice(0, 3).join(', ')}`);
    }
    
    // Check for virtual interfaces
    if (lowerPrompt.includes('loopback') || lowerPrompt.includes('lo') || lowerPrompt.includes('port-channel') || lowerPrompt.includes('po') || lowerPrompt.includes('tunnel')) {
      const virtual = this.knowledgeBase.interfaces.virtual;
      knowledge.push(`Virtual Interfaces: ${virtual.context}`);
      knowledge.push(`Types: ${Object.keys(virtual.types).slice(0, 4).join(', ')}`);
      knowledge.push(`Best Practices: ${virtual.bestPractices.slice(0, 3).join(', ')}`);
    }
    
    // Check for serial interfaces
    if (lowerPrompt.includes('serial') || lowerPrompt.includes('se') || lowerPrompt.includes('wan')) {
      const serial = this.knowledgeBase.interfaces.serial;
      knowledge.push(`Serial Interfaces: ${serial.context}`);
      knowledge.push(`Syntax: ${serial.syntax.slice(0, 4).join(', ')}`);
      knowledge.push(`Best Practices: ${serial.bestPractices.slice(0, 3).join(', ')}`);
    }
    
    // Check for security
    if (lowerPrompt.includes('access-list') || lowerPrompt.includes('acl')) {
      const acl = this.knowledgeBase.security.acl;
      knowledge.push(`ACL: ${acl.context}`);
      knowledge.push(`Syntax: ${acl.syntax.join(', ')}`);
    }
    
    // Check for basic configuration
    if (lowerPrompt.includes('hostname') || lowerPrompt.includes('enable secret') || lowerPrompt.includes('banner')) {
      const basic = this.knowledgeBase.general.basic;
      knowledge.push(`Basic Configuration: ${basic.context}`);
      knowledge.push(`Syntax: ${basic.syntax.slice(0, 5).join(', ')}`);
      knowledge.push(`Best Practices: ${basic.bestPractices.slice(0, 3).join(', ')}`);
    }
    
    // Check for IP configuration
    if (lowerPrompt.includes('ip address') || lowerPrompt.includes('ip route') || lowerPrompt.includes('default-gateway')) {
      const ipConfig = this.knowledgeBase.general.ipConfiguration;
      knowledge.push(`IP Configuration: ${ipConfig.context}`);
      knowledge.push(`Syntax: ${ipConfig.syntax.slice(0, 5).join(', ')}`);
      knowledge.push(`Best Practices: ${ipConfig.bestPractices.slice(0, 3).join(', ')}`);
      knowledge.push(`Types: ${ipConfig.addressingTypes.slice(0, 3).join(', ')}`);
    }
    
    // Check for user management
    if (lowerPrompt.includes('username') || lowerPrompt.includes('privilege') || lowerPrompt.includes('enable secret')) {
      const userMgmt = this.knowledgeBase.general.userManagement;
      knowledge.push(`User Management: ${userMgmt.context}`);
      knowledge.push(`Syntax: ${userMgmt.syntax.slice(0, 4).join(', ')}`);
      knowledge.push(`Best Practices: ${userMgmt.bestPractices.slice(0, 3).join(', ')}`);
      knowledge.push(`Privilege Levels: ${userMgmt.privilegeLevels.slice(0, 3).join(', ')}`);
    }
    
    // Check for line configuration
    if (lowerPrompt.includes('line console') || lowerPrompt.includes('line vty') || lowerPrompt.includes('transport input')) {
      const lineConfig = this.knowledgeBase.general.lineConfiguration;
      knowledge.push(`Line Configuration: ${lineConfig.context}`);
      knowledge.push(`Syntax: ${lineConfig.syntax.slice(0, 5).join(', ')}`);
      knowledge.push(`Best Practices: ${lineConfig.bestPractices.slice(0, 3).join(', ')}`);
      knowledge.push(`Line Types: ${lineConfig.lineTypes.slice(0, 3).join(', ')}`);
    }
    
    // Check for SSH configuration
    if (lowerPrompt.includes('ssh') || lowerPrompt.includes('crypto key') || lowerPrompt.includes('domain-name')) {
      const sshConfig = this.knowledgeBase.general.sshConfiguration;
      knowledge.push(`SSH Configuration: ${sshConfig.context}`);
      knowledge.push(`Syntax: ${sshConfig.syntax.slice(0, 5).join(', ')}`);
      knowledge.push(`Best Practices: ${sshConfig.bestPractices.slice(0, 3).join(', ')}`);
      knowledge.push(`Requirements: ${sshConfig.requirements.join(', ')}`);
    }
    
    // Check for configuration management
    if (lowerPrompt.includes('copy') || lowerPrompt.includes('write') || lowerPrompt.includes('save') || lowerPrompt.includes('backup')) {
      const configMgmt = this.knowledgeBase.general.configurationManagement;
      knowledge.push(`Configuration Management: ${configMgmt.context}`);
      knowledge.push(`Syntax: ${configMgmt.syntax.slice(0, 4).join(', ')}`);
      knowledge.push(`Best Practices: ${configMgmt.bestPractices.slice(0, 3).join(', ')}`);
      knowledge.push(`Config Types: ${configMgmt.configTypes.slice(0, 3).join(', ')}`);
    }
    
    // If no specific knowledge found, add general context
    if (knowledge.length === 0) {
      const basic = this.knowledgeBase.general.basic;
      knowledge.push(`Basic Config: ${basic.context}`);
      knowledge.push(`Common Commands: ${basic.syntax.slice(0, 3).join(', ')}`);
    }
    
    return knowledge.join('\n');
  }

  /**
   * Check if prompt contains interface short names
   */
  _containsInterfaceShortName(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    const shortNames = ['gi', 'fa', 'te', 'se', 'lo', 'po', 'tu', 'hu', 'fo', 'fi', 'tf', 'th', 'f', 'mg', 'vl'];
    
    // Check for short names followed by numbers/slots
    return shortNames.some(shortName => {
      const pattern = new RegExp(`\\b${shortName}\\d+(?:\\/\\d+(?:\\/\\d+)?)?\\b`, 'i');
      return pattern.test(lowerPrompt);
    });
  }

  /**
   * Build prompt for raw device commands (legacy method)
   */
  _buildPrompt(prompt, deviceType, deviceContext) {
    const deviceName = deviceContext.name || 'Device';
    
    // Pre-process CIDR notation in the prompt
    const processedPrompt = this._preprocessCIDR(prompt);
    
    return `Generate only the raw Cisco IOS commands to send to the device. No configure terminal, no end, just the commands.

Device: ${deviceName} (${deviceType})
Request: ${processedPrompt}

IMPORTANT: Use wildcard masks for OSPF network commands, not subnet masks.

Commands:`;
  }

  /**
   * Pre-process CIDR notation to include wildcard mask hints
   */
  _preprocessCIDR(prompt) {
    // CIDR to wildcard mask conversion
    const cidrToWildcard = {
      '/8': '0.255.255.255',
      '/9': '0.127.255.255',
      '/10': '0.63.255.255',
      '/11': '0.31.255.255',
      '/12': '0.15.255.255',
      '/13': '0.7.255.255',
      '/14': '0.3.255.255',
      '/15': '0.1.255.255',
      '/16': '0.0.255.255', 
      '/17': '0.0.127.255',
      '/18': '0.0.63.255',
      '/19': '0.0.31.255',
      '/20': '0.0.15.255',
      '/21': '0.0.7.255',
      '/22': '0.0.3.255',
      '/23': '0.0.1.255',
      '/24': '0.0.0.255',
      '/25': '0.0.0.127',
      '/26': '0.0.0.63',
      '/27': '0.0.0.31',
      '/28': '0.0.0.15',
      '/29': '0.0.0.7',
      '/30': '0.0.0.3',
      '/31': '0.0.0.1',
      '/32': '0.0.0.0',
    };
    
    let processed = prompt;
    
    // Replace CIDR notation with network and wildcard mask
    for (const [cidr, wildcard] of Object.entries(cidrToWildcard)) {
      const cidrPattern = new RegExp(`(\\d+\\.\\d+\\.\\d+\\.\\d+)${cidr.replace('/', '\\/')}`, 'g');
      processed = processed.replace(cidrPattern, `$1 wildcard ${wildcard}`);
    }
    
    return processed;
  }

  /**
   * Standardize interface names to proper Cisco format
   */
  _standardizeInterfaceNames(prompt) {
    if (!prompt) return prompt;
    
    let standardized = prompt;
    const interfaceMap = this.knowledgeBase.interfaces.naming.shortNames;
    
    // Create reverse mapping for short names to full names
    const shortToFull = {};
    for (const [fullName, shortNames] of Object.entries(interfaceMap)) {
      shortNames.forEach(shortName => {
        shortToFull[shortName.toLowerCase()] = fullName;
      });
    }
    
    // Replace short names with full names in the prompt
    for (const [shortName, fullName] of Object.entries(shortToFull)) {
      // Match interface short names followed by numbers/slots
      const pattern = new RegExp(`\\b${shortName}(\\d+(?:\\/\\d+(?:\\/\\d+)?)?)\\b`, 'gi');
      standardized = standardized.replace(pattern, `${fullName}$1`);
    }
    
    return standardized;
  }

  /**
   * Clean configuration output for raw device commands
   */
  _cleanConfiguration(rawConfig) {
    if (!rawConfig) return '';
    
    let cleaned = rawConfig;
    
    // Remove code blocks and markdown
    cleaned = cleaned
      .replace(/```cisco/gi, '')
      .replace(/```ios/gi, '')
      .replace(/```/g, '')
      .trim();
    
    // Remove explanatory text
    const unwantedPhrases = [
      /^Here's.*$/gmi,
      /^Here are.*$/gmi,
      /^This.*$/gmi,
      /^Sure.*$/gmi,
      /^Commands:.*$/gmi,
      /^Note:.*$/gmi,
      /^The following.*$/gmi,
      /^These commands.*$/gmi,
      /^Configuration:.*$/gmi,
      /^Output:.*$/gmi,
      /^---+$/gm,
      /^===+$/gm,
      /^#{1,6}\s.*$/gm, // Remove markdown headers
    ];
    
    unwantedPhrases.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    // Split into lines and filter
    const lines = cleaned.split('\n')
      .map(line => line.trimEnd()) // Keep leading spaces for indentation
      .filter(line => {
        const trimmed = line.trim();
        // Filter out unwanted lines
        return trimmed && 
               trimmed !== 'configure terminal' && 
               trimmed !== 'end' && 
               trimmed !== 'exit' &&
               trimmed !== 'write memory' &&
               trimmed !== 'copy running-config startup-config' &&
               !trimmed.match(/^(Here|This|Sure|Commands?:|Note:|Output:)/i);
      });
    
    // Format with proper indentation for device commands
    const formattedLines = [];
    let inConfigMode = false;
    let currentIndentLevel = 0;
    
    for (let line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines
      if (!trimmed) continue;
      
      // Check if entering a config mode (main command)
      if (trimmed.startsWith('router ') || 
          trimmed.startsWith('interface ') || 
          trimmed.startsWith('vlan ') || 
          trimmed.startsWith('line ') ||
          trimmed.startsWith('ip access-list ') ||
          trimmed.startsWith('access-list ')) {
        formattedLines.push(trimmed);
        inConfigMode = true;
        currentIndentLevel = 0;
      } 
      // Check for exit/end commands within config mode
      else if (trimmed === '!' || trimmed.startsWith('exit') || trimmed.startsWith('end')) {
        inConfigMode = false;
        currentIndentLevel = 0;
        // Add blank line for readability between sections
        if (formattedLines.length > 0) {
          formattedLines.push('');
        }
      }
      // Sub-commands get indented with single space
      else if (inConfigMode) {
        // If line already has indentation, preserve it; otherwise add one space
        if (line.startsWith(' ')) {
          formattedLines.push(line);
        } else {
          formattedLines.push(' ' + trimmed);
        }
      }
      // Global commands (no indentation needed)
      else {
        formattedLines.push(trimmed);
        inConfigMode = false;
        currentIndentLevel = 0;
      }
    }
    
    // Remove consecutive blank lines
    const result = formattedLines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    return result;
  }

  /**
   * Create deployment version (no comments)
   */
  _createDeploymentVersion(configuration) {
    if (!configuration) return '';
    
    const deploymentLines = configuration
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('!');
      });
    
    return deploymentLines.join('\n');
  }

  /**
   * Basic validation for raw device commands
   */
  _validateConfiguration(configuration, deviceType) {
    const validation = {
      isValid: true,
      score: 100,
      errors: [],
      warnings: [],
      explanation: []
    };

    if (!configuration || configuration.length < 5) {
      validation.isValid = false;
      validation.score = 0;
      validation.errors.push('Configuration too short');
      return validation;
    }

    // Check for valid Cisco commands
    const lines = configuration.split('\n');
    let hasValidCommands = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('router ') || trimmed.startsWith('interface ') ||
          trimmed.startsWith('vlan ') || trimmed.startsWith('ip ') ||
          trimmed.startsWith('network ') || trimmed.startsWith('switchport ')) {
        hasValidCommands = true;
        break;
      }
    }
    
    if (!hasValidCommands) {
      validation.warnings.push('No recognizable Cisco commands found');
      validation.score -= 20;
    }

    validation.explanation.push('✓ Raw device commands generated');
    return validation;
  }

  /**
   * Get service status
   */
  async getServiceStatus() {
    try {
      // Check if API key is configured
      if (!this.apiKey || this.apiKey === 'your_openrouter_api_key_here') {
        return {
          status: "not_configured",
          service: "OpenRouter API",
          provider: this.provider,
          model: this.model,
          error: "API key not configured",
          setup: [
            "1. Sign up at https://openrouter.ai",
            "2. Get your API key from the dashboard",
            "3. Add OPENROUTER_API_KEY to your .env file",
            "4. Restart the backend server"
          ]
        };
      }

      // Test API connection with a simple request
      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages: [
          { role: 'user', content: 'Say OK' }
        ],
        max_tokens: 5
      });

      const isWorking = response.data?.choices?.[0]?.message?.content;

      return {
        status: isWorking ? "connected" : "error",
        service: "OpenRouter API - Knowledge-Enhanced Generation",
        provider: this.provider,
        apiUrl: 'https://openrouter.ai/api/v1',
        model: this.model,
        modelAvailable: !!isWorking,
        knowledgeBase: {
          categories: Object.keys(this.knowledgeBase),
          totalProtocols: Object.keys(this.knowledgeBase.routing).length,
          totalFeatures: Object.keys(this.knowledgeBase.switching).length + 
                        Object.keys(this.knowledgeBase.interfaces).length + 
                        Object.keys(this.knowledgeBase.security).length
        },
        features: [
          "🌐 OpenRouter API with multiple model support",
          "🧠 Comprehensive Cisco knowledge base",
          "🎯 Context-aware configuration generation",
          "📚 Protocol-specific best practices",
          "🔧 Syntax validation and examples",
          "🧹 Clean output formatting",
          "✅ CIDR to wildcard conversion"
        ],
        availableModels: [
          "qwen/qwen-2.5-coder-32b-instruct (Recommended)",
          "anthropic/claude-3.5-sonnet",
          "openai/gpt-4-turbo",
          "google/gemini-pro-1.5",
          "meta-llama/llama-3.1-70b-instruct"
        ]
      };
    } catch (error) {
      let errorMessage = error.message;
      let status = "error";
      
      if (error.response?.status === 401) {
        errorMessage = "Invalid API key";
        status = "unauthorized";
      } else if (error.response?.status === 402) {
        errorMessage = "Insufficient credits";
        status = "no_credits";
      } else if (error.response?.status === 429) {
        errorMessage = "Rate limit exceeded";
        status = "rate_limited";
      }
      
      return {
        status,
        service: "OpenRouter API",
        provider: this.provider,
        model: this.model,
        modelAvailable: false,
        error: errorMessage,
        troubleshooting: [
          "Check your OPENROUTER_API_KEY in .env",
          "Verify your OpenRouter account has credits",
          "Check https://openrouter.ai/docs for status",
          "Try a different model if current one is unavailable"
        ]
      };
    }
  }

  /**
   * Add custom knowledge to the knowledge base
   */
  addKnowledge(category, subcategory, knowledgeData) {
    try {
      if (!this.knowledgeBase[category]) {
        this.knowledgeBase[category] = {};
      }
      
      this.knowledgeBase[category][subcategory] = {
        context: knowledgeData.context || '',
        syntax: knowledgeData.syntax || [],
        examples: knowledgeData.examples || [],
        bestPractices: knowledgeData.bestPractices || []
      };
      
      console.log(`📚 Knowledge added: ${category}.${subcategory}`);
      
      return {
        success: true,
        message: `Knowledge added to ${category}.${subcategory}`,
        knowledgeBase: this.getKnowledgeBaseSummary()
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add knowledge: ${error.message}`
      };
    }
  }

  /**
   * Get knowledge base summary
   */
  getKnowledgeBaseSummary() {
    const summary = {};
    
    for (const [category, subcategories] of Object.entries(this.knowledgeBase)) {
      summary[category] = {
        subcategories: Object.keys(subcategories),
        count: Object.keys(subcategories).length
      };
    }
    
    return summary;
  }

  /**
   * Get specific knowledge entry
   */
  getKnowledge(category, subcategory) {
    try {
      if (this.knowledgeBase[category] && this.knowledgeBase[category][subcategory]) {
        return {
          success: true,
          knowledge: this.knowledgeBase[category][subcategory]
        };
      } else {
        return {
          success: false,
          error: `Knowledge not found: ${category}.${subcategory}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to retrieve knowledge: ${error.message}`
      };
    }
  }

  /**
   * Explain configuration
   */
  async explainConfiguration(configuration) {
    try {
      const prompt = `Explain this Cisco configuration:

${configuration.substring(0, 400)}

Brief explanation:`;

      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: 150 }
      });

      return {
        success: true,
        explanation: response.data.response?.trim() || "No explanation generated",
        model: this.model,
        method: 'clean_explain'
      };
    } catch (error) {
      return {
        success: false,
        explanation: "Configuration explanation failed",
        error: error.message
      };
    }
  }

  /**
   * Multi-device configuration generation
   */
  async generateMultiDeviceConfiguration(devices, prompt, topologyHints = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Multi-device generation for ${devices.length} devices`);
      
      const promises = devices.map(async (device, index) => {
        console.log(`🔄 Generating ${index + 1}/${devices.length}: ${device.name}`);
        
        const devicePrompt = `${prompt} for device ${device.name}`;
        const result = await this.generateConfiguration(devicePrompt, device.type, {
          name: device.name,
          model: device.model,
          location: device.location
        });

        return {
          device_id: device.id,
          device_name: device.name,
          success: result.success,
          configuration: result.configuration || null,
          displayConfig: result.displayConfig || null,
          deploymentConfig: result.deploymentConfig || null,
          error: result.error || null,
          validation: result.validation || null
        };
      });

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;
      const executionTime = Date.now() - startTime;

      console.log(`✅ Multi-device: ${successCount}/${devices.length} successful (${executionTime}ms)`);

      return {
        success: successCount > 0,
        results,
        executionTime,
        method: 'clean_multi',
        model: this.model,
        summary: {
          successfulDevices: successCount,
          totalDevices: devices.length,
          description: `${successCount}/${devices.length} devices configured`
        }
      };

    } catch (error) {
      console.error("❌ Multi-device error:", error.message);
      
      return {
        success: false,
        error: `Multi-device generation failed: ${error.message}`,
        results: [],
        executionTime: Date.now() - startTime,
        method: 'clean_multi',
        model: this.model,
        summary: {
          successfulDevices: 0,
          totalDevices: devices.length,
          description: 'Generation failed'
        }
      };
    }
  }

  /**
   * NETCONF XML generation
   */
  async generateNetconfXml(prompt, deviceType, deviceContext = {}, yangModel = null) {
    const startTime = Date.now();
    
    try {
      console.log(`🔗 NETCONF XML generation: "${prompt}"`);

      const xmlPrompt = `Generate NETCONF XML configuration for Cisco device:

Request: ${prompt}
Device: ${deviceContext.name || 'Device'} (${deviceType})
YANG Model: ${yangModel?.name || 'Cisco-IOS-XE-native'}

Generate valid NETCONF XML:

<?xml version="1.0" encoding="UTF-8"?>`;

      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: xmlPrompt,
        stream: false,
        options: { temperature: 0.2, num_predict: 400 }
      });

      const xmlConfiguration = response.data.response?.trim();
      
      if (!xmlConfiguration || !xmlConfiguration.includes('<')) {
        throw new Error('Invalid XML response');
      }
      
      const executionTime = Date.now() - startTime;
      console.log(`✅ NETCONF XML generated (${executionTime}ms)`);
      
      return {
        success: true,
        configuration: xmlConfiguration,
        model: this.model,
        deviceType,
        method: 'clean_netconf',
        executionTime,
        validation: { isValid: true, errors: [], warnings: [] },
        confidenceScore: 85,
        yangModel: yangModel?.name || 'Cisco-IOS-XE-native',
        outputFormat: 'netconf_xml'
      };
      
    } catch (error) {
      console.error("❌ NETCONF XML error:", error.message);
      
      return {
        success: false,
        error: `NETCONF XML generation failed: ${error.message}`,
        configuration: null,
        executionTime: Date.now() - startTime
      };
    }
  }
}

export default new LLMService();