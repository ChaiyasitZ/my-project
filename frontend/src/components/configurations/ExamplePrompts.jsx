/**
 * ExamplePrompts Component
 * Displays example prompts based on configuration mode
 */
import React, { memo, useMemo } from 'react';

/**
 * Example Prompts List
 * @param {Object} props - Component props
 * @param {'cli' | 'netconf'} props.configMode - Current configuration mode
 * @param {Function} props.onSelectPrompt - Handler when prompt is selected
 */
const ExamplePrompts = memo(({ configMode, onSelectPrompt }) => {
  // Memoize example prompts to prevent recreation on every render
  const examplePrompts = useMemo(() => {
    if (configMode === 'netconf') {
      return [
        // NX-OS NETCONF/YANG Examples - Interface Configuration
        "Configure interface Ethernet1/1 with description 'Uplink to Core' and MTU 9216",
        "Set interface Ethernet1/2 as access port on VLAN 100",
        "Configure port-channel 10 with members Ethernet1/3-4 using LACP active mode",
        // VLAN Configuration
        "Create VLAN 100 named PRODUCTION and VLAN 200 named MANAGEMENT",
        "Configure SVI interface Vlan100 with IP 192.168.100.1/24 and description 'Production Gateway'",
        // Routing Configuration  
        "Enable OSPF process 1 with router-id 10.0.0.1 and add interface Ethernet1/1 to area 0.0.0.0",
        "Configure BGP AS 65001 with neighbor 10.0.0.2 remote-as 65002",
        "Add static route to 172.16.0.0/16 via next-hop 10.0.0.254",
        // Advanced Features
        "Configure VXLAN with VNI 10100 mapped to VLAN 100 on NVE1",
        "Enable feature vpc and configure vpc domain 100 with peer-keepalive destination 192.168.1.2",
      ];
    }
    
    return [
      // Router Examples
      "Configure OSPF routing for area 0 on GigabitEthernet0/0",
      "Set up static routes to 10.0.0.0/24 via 192.168.1.1",
      "Configure EIGRP AS 100 on network 192.168.0.0/16",
      // Layer 2 Switch Examples
      "Configure trunk port on interface GigabitEthernet1/0/1 allowing VLANs 10,20,30",
      "Create VLAN 100 named PRODUCTION and VLAN 200 named GUEST",
      "Set up port-security on interface FastEthernet0/1 with maximum 2 MAC addresses",
      // Layer 3 Switch Examples
      "Configure inter-VLAN routing for VLANs 10, 20, 30",
      "Set up SVI for VLAN 10 with IP 192.168.10.1/24",
      "Enable IP routing and configure default gateway 192.168.1.254",
    ];
  }, [configMode]);

  /**
   * Get color classes based on mode
   */
  const colorClass = configMode === 'netconf' 
    ? 'text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30' 
    : 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30';

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Example Prompts:
      </h3>
      <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar pr-2">
        {examplePrompts.map((example, index) => (
          <button
            key={index}
            onClick={() => onSelectPrompt(example)}
            className={`text-left text-xs block w-full px-2 py-1.5 rounded-lg transition-colors ${colorClass}`}
          >
            • {example}
          </button>
        ))}
      </div>
    </div>
  );
});

ExamplePrompts.displayName = 'ExamplePrompts';

export default ExamplePrompts;
