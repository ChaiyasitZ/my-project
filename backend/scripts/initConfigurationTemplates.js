import mongoose from 'mongoose';
import ConfigurationTemplate from '../models/ConfigurationTemplate.js';

// Comprehensive Configuration Templates for Cisco Devices
const templates = [
  // ===== OSPF TEMPLATES =====
  {
    name: 'OSPF Basic Configuration',
    description: 'Basic OSPF routing protocol configuration',
    device_type: 'router',
    category: 'routing_ospf',
    template_config: `configure terminal
!
router ospf {{process_id}}
 router-id {{router_id}}
 network {{network}} {{wildcard}} area {{area}}
 passive-interface default
 no passive-interface {{active_interface}}
 default-information originate
exit
!
interface {{interface_name}}
 ip ospf {{process_id}} area {{area}}
 ip ospf hello-interval 10
 ip ospf dead-interval 40
exit
!
end`,
    variables: {
      process_id: { type: 'number', default: 1, description: 'OSPF Process ID' },
      router_id: { type: 'ip', default: '1.1.1.1', description: 'OSPF Router ID' },
      network: { type: 'ip', default: '192.168.1.0', description: 'Network to advertise' },
      wildcard: { type: 'wildcard', default: '0.0.0.255', description: 'Wildcard mask' },
      area: { type: 'number', default: 0, description: 'OSPF Area' },
      active_interface: { type: 'interface', default: 'GigabitEthernet0/1', description: 'Active interface' },
      interface_name: { type: 'interface', default: 'GigabitEthernet0/1', description: 'Interface name' }
    }
  },
  {
    name: 'OSPF Multi-Area Configuration',
    description: 'OSPF configuration with multiple areas',
    device_type: 'router',
    category: 'routing_ospf',
    template_config: `configure terminal
!
router ospf {{process_id}}
 router-id {{router_id}}
 network {{backbone_network}} {{backbone_wildcard}} area 0
 network {{area1_network}} {{area1_wildcard}} area {{area1}}
 area {{area1}} stub
 area {{area1}} default-cost {{stub_cost}}
 distance ospf {{external_distance}} {{inter_area_distance}} {{intra_area_distance}}
exit
!
end`,
    variables: {
      process_id: { type: 'number', default: 1 },
      router_id: { type: 'ip', default: '1.1.1.1' },
      backbone_network: { type: 'ip', default: '10.0.0.0' },
      backbone_wildcard: { type: 'wildcard', default: '0.0.255.255' },
      area1_network: { type: 'ip', default: '192.168.1.0' },
      area1_wildcard: { type: 'wildcard', default: '0.0.0.255' },
      area1: { type: 'number', default: 1 },
      stub_cost: { type: 'number', default: 10 },
      external_distance: { type: 'number', default: 110 },
      inter_area_distance: { type: 'number', default: 110 },
      intra_area_distance: { type: 'number', default: 110 }
    }
  },

  // ===== EIGRP TEMPLATES =====
  {
    name: 'EIGRP Basic Configuration',
    description: 'Basic EIGRP routing protocol configuration',
    device_type: 'router',
    category: 'routing_eigrp',
    template_config: `configure terminal
!
router eigrp {{as_number}}
 network {{network}} {{wildcard}}
 passive-interface default
 no passive-interface {{active_interface}}
 eigrp router-id {{router_id}}
 metric weights 0 1 0 1 0 0
exit
!
interface {{interface_name}}
 ip bandwidth-percent eigrp {{as_number}} {{bandwidth_percent}}
 ip hello-interval eigrp {{as_number}} {{hello_interval}}
 ip hold-time eigrp {{as_number}} {{hold_time}}
exit
!
end`,
    variables: {
      as_number: { type: 'number', default: 100, description: 'EIGRP AS Number' },
      network: { type: 'ip', default: '192.168.1.0', description: 'Network to advertise' },
      wildcard: { type: 'wildcard', default: '0.0.0.255', description: 'Wildcard mask' },
      active_interface: { type: 'interface', default: 'GigabitEthernet0/1' },
      router_id: { type: 'ip', default: '1.1.1.1', description: 'EIGRP Router ID' },
      interface_name: { type: 'interface', default: 'GigabitEthernet0/1' },
      bandwidth_percent: { type: 'number', default: 50 },
      hello_interval: { type: 'number', default: 5 },
      hold_time: { type: 'number', default: 15 }
    }
  },

  // ===== RIPv2 TEMPLATES =====
  {
    name: 'RIPv2 Basic Configuration',
    description: 'Basic RIPv2 routing protocol configuration',
    device_type: 'router',
    category: 'routing_rip',
    template_config: `configure terminal
!
router rip
 version 2
 network {{network}}
 passive-interface default
 no passive-interface {{active_interface}}
 no auto-summary
 default-information originate
exit
!
interface {{interface_name}}
 ip rip send version 2
 ip rip receive version 2
 ip rip authentication mode md5
 ip rip authentication key-chain {{key_chain}}
exit
!
key chain {{key_chain}}
 key {{key_id}}
  key-string {{key_string}}
  accept-lifetime {{accept_lifetime}}
  send-lifetime {{send_lifetime}}
exit
!
end`,
    variables: {
      network: { type: 'ip', default: '192.168.1.0', description: 'Network to advertise' },
      active_interface: { type: 'interface', default: 'GigabitEthernet0/1' },
      interface_name: { type: 'interface', default: 'GigabitEthernet0/1' },
      key_chain: { type: 'string', default: 'RIP_CHAIN', description: 'Key chain name' },
      key_id: { type: 'number', default: 1, description: 'Key ID' },
      key_string: { type: 'string', default: 'cisco123', description: 'Authentication key' },
      accept_lifetime: { type: 'string', default: 'infinite', description: 'Accept lifetime' },
      send_lifetime: { type: 'string', default: 'infinite', description: 'Send lifetime' }
    }
  },

  // ===== BGP TEMPLATES =====
  {
    name: 'BGP Basic Configuration',
    description: 'Basic BGP routing protocol configuration',
    device_type: 'router',
    category: 'routing_bgp',
    template_config: `configure terminal
!
router bgp {{as_number}}
 bgp router-id {{router_id}}
 bgp log-neighbor-changes
 network {{network}} mask {{subnet_mask}}
 neighbor {{neighbor_ip}} remote-as {{neighbor_as}}
 neighbor {{neighbor_ip}} description {{neighbor_description}}
 neighbor {{neighbor_ip}} update-source {{update_source}}
 neighbor {{neighbor_ip}} next-hop-self
 neighbor {{neighbor_ip}} soft-reconfiguration inbound
exit
!
end`,
    variables: {
      as_number: { type: 'number', default: 65001, description: 'Local AS Number' },
      router_id: { type: 'ip', default: '1.1.1.1', description: 'BGP Router ID' },
      network: { type: 'ip', default: '192.168.1.0', description: 'Network to advertise' },
      subnet_mask: { type: 'ip', default: '255.255.255.0', description: 'Subnet mask' },
      neighbor_ip: { type: 'ip', default: '10.0.0.2', description: 'BGP Neighbor IP' },
      neighbor_as: { type: 'number', default: 65002, description: 'Neighbor AS Number' },
      neighbor_description: { type: 'string', default: 'PEER_ROUTER', description: 'Neighbor description' },
      update_source: { type: 'interface', default: 'Loopback0', description: 'Update source interface' }
    }
  },
  {
    name: 'BGP IBGP Configuration',
    description: 'Internal BGP configuration with route reflector',
    device_type: 'router',
    category: 'routing_bgp',
    template_config: `configure terminal
!
router bgp {{as_number}}
 bgp router-id {{router_id}}
 bgp cluster-id {{cluster_id}}
 neighbor {{ibgp_neighbor}} remote-as {{as_number}}
 neighbor {{ibgp_neighbor}} description {{neighbor_description}}
 neighbor {{ibgp_neighbor}} update-source {{update_source}}
 neighbor {{ibgp_neighbor}} route-reflector-client
 neighbor {{ibgp_neighbor}} next-hop-self
 address-family ipv4
  neighbor {{ibgp_neighbor}} activate
  neighbor {{ibgp_neighbor}} send-community
  no auto-summary
  no synchronization
 exit-address-family
exit
!
end`,
    variables: {
      as_number: { type: 'number', default: 65001 },
      router_id: { type: 'ip', default: '1.1.1.1' },
      cluster_id: { type: 'ip', default: '1.1.1.1' },
      ibgp_neighbor: { type: 'ip', default: '10.0.0.2' },
      neighbor_description: { type: 'string', default: 'IBGP_CLIENT' },
      update_source: { type: 'interface', default: 'Loopback0' }
    }
  },

  // ===== ISIS TEMPLATES =====
  {
    name: 'ISIS Basic Configuration',
    description: 'Basic ISIS routing protocol configuration',
    device_type: 'router',
    category: 'routing_isis',
    template_config: `configure terminal
!
router isis {{tag}}
 net {{net_id}}
 is-type {{is_type}}
 metric-style wide
 passive-interface default
 no passive-interface {{active_interface}}
 area-password {{area_password}}
 domain-password {{domain_password}}
exit
!
interface {{interface_name}}
 ip router isis {{tag}}
 isis circuit-type {{circuit_type}}
 isis metric {{metric}}
 isis hello-interval {{hello_interval}}
 isis hello-multiplier {{hello_multiplier}}
exit
!
interface Loopback0
 ip router isis {{tag}}
 isis circuit-type {{circuit_type}}
exit
!
end`,
    variables: {
      tag: { type: 'string', default: 'CORE', description: 'ISIS Process Tag' },
      net_id: { type: 'string', default: '49.0001.1921.6800.1001.00', description: 'NET ID' },
      is_type: { type: 'string', default: 'level-2-only', description: 'IS Type' },
      active_interface: { type: 'interface', default: 'GigabitEthernet0/1' },
      interface_name: { type: 'interface', default: 'GigabitEthernet0/1' },
      circuit_type: { type: 'string', default: 'level-2-only', description: 'Circuit type' },
      metric: { type: 'number', default: 10, description: 'ISIS metric' },
      hello_interval: { type: 'number', default: 10, description: 'Hello interval' },
      hello_multiplier: { type: 'number', default: 3, description: 'Hello multiplier' },
      area_password: { type: 'string', default: 'area123', description: 'Area password' },
      domain_password: { type: 'string', default: 'domain123', description: 'Domain password' }
    }
  },

  // ===== BASIC ROUTER TEMPLATES =====
  {
    name: 'Basic Router Interface Configuration',
    description: 'Basic router interface setup with IP addressing',
    device_type: 'router',
    category: 'basic_interface',
    template_config: `configure terminal
!
interface {{interface_name}}
 description {{description}}
 ip address {{ip_address}} {{subnet_mask}}
 no shutdown
exit
!
end`,
    variables: {
      interface_name: { type: 'interface', default: 'GigabitEthernet0/1' },
      description: { type: 'string', default: 'LAN_INTERFACE' },
      ip_address: { type: 'ip', default: '192.168.1.1' },
      subnet_mask: { type: 'ip', default: '255.255.255.0' }
    }
  },
  {
    name: 'Static Routing Configuration',
    description: 'Basic static route configuration',
    device_type: 'router',
    category: 'routing_static',
    template_config: `configure terminal
!
ip route {{destination_network}} {{subnet_mask}} {{next_hop}}
ip route {{destination_network}} {{subnet_mask}} {{exit_interface}} {{distance}}
ip route 0.0.0.0 0.0.0.0 {{default_gateway}}
!
end`,
    variables: {
      destination_network: { type: 'ip', default: '10.0.0.0' },
      subnet_mask: { type: 'ip', default: '255.0.0.0' },
      next_hop: { type: 'ip', default: '192.168.1.254' },
      exit_interface: { type: 'interface', default: 'GigabitEthernet0/0' },
      distance: { type: 'number', default: 1 },
      default_gateway: { type: 'ip', default: '192.168.1.254' }
    }
  },
  {
    name: 'ACL Standard Configuration',
    description: 'Standard Access Control List configuration',
    device_type: 'router',
    category: 'security_acl',
    template_config: `configure terminal
!
access-list {{acl_number}} permit {{source_network}} {{wildcard}}
access-list {{acl_number}} deny any
!
interface {{interface_name}}
 ip access-group {{acl_number}} {{direction}}
exit
!
end`,
    variables: {
      acl_number: { type: 'number', default: 10 },
      source_network: { type: 'ip', default: '192.168.1.0' },
      wildcard: { type: 'wildcard', default: '0.0.0.255' },
      interface_name: { type: 'interface', default: 'GigabitEthernet0/1' },
      direction: { type: 'string', default: 'out' }
    }
  },
  {
    name: 'NAT Configuration',
    description: 'Network Address Translation configuration',
    device_type: 'router',
    category: 'nat',
    template_config: `configure terminal
!
access-list {{acl_number}} permit {{internal_network}} {{wildcard}}
!
ip nat pool {{pool_name}} {{pool_start}} {{pool_end}} netmask {{netmask}}
ip nat inside source list {{acl_number}} pool {{pool_name}} overload
!
interface {{inside_interface}}
 ip nat inside
exit
!
interface {{outside_interface}}
 ip nat outside
exit
!
end`,
    variables: {
      acl_number: { type: 'number', default: 1 },
      internal_network: { type: 'ip', default: '192.168.1.0' },
      wildcard: { type: 'wildcard', default: '0.0.0.255' },
      pool_name: { type: 'string', default: 'NAT_POOL' },
      pool_start: { type: 'ip', default: '203.0.113.1' },
      pool_end: { type: 'ip', default: '203.0.113.10' },
      netmask: { type: 'ip', default: '255.255.255.0' },
      inside_interface: { type: 'interface', default: 'GigabitEthernet0/1' },
      outside_interface: { type: 'interface', default: 'GigabitEthernet0/0' }
    }
  },

  // ===== SWITCH L2 TEMPLATES =====
  {
    name: 'Basic VLAN Configuration',
    description: 'Basic VLAN setup for Layer 2 switch',
    device_type: 'switch',
    category: 'switching_vlan',
    template_config: `configure terminal
!
vlan {{vlan_id}}
 name {{vlan_name}}
exit
!
interface {{interface_name}}
 switchport mode access
 switchport access vlan {{vlan_id}}
 spanning-tree portfast
 no shutdown
exit
!
end`,
    variables: {
      vlan_id: { type: 'number', default: 10 },
      vlan_name: { type: 'string', default: 'SALES_VLAN' },
      interface_name: { type: 'interface', default: 'FastEthernet0/1' }
    }
  },
  {
    name: 'Trunk Configuration',
    description: 'Trunk port configuration for VLAN tagging',
    device_type: 'switch',
    category: 'switching_trunk',
    template_config: `configure terminal
!
interface {{interface_name}}
 switchport mode trunk
 switchport trunk encapsulation dot1q
 switchport trunk allowed vlan {{allowed_vlans}}
 switchport trunk native vlan {{native_vlan}}
 no shutdown
exit
!
end`,
    variables: {
      interface_name: { type: 'interface', default: 'GigabitEthernet0/1' },
      allowed_vlans: { type: 'string', default: '10,20,30' },
      native_vlan: { type: 'number', default: 1 }
    }
  },
  {
    name: 'Port Security Configuration',
    description: 'Port security setup for access ports',
    device_type: 'switch',
    category: 'security_port',
    template_config: `configure terminal
!
interface {{interface_name}}
 switchport mode access
 switchport access vlan {{vlan_id}}
 switchport port-security
 switchport port-security maximum {{max_mac}}
 switchport port-security mac-address sticky
 switchport port-security violation {{violation_action}}
 spanning-tree portfast
 no shutdown
exit
!
end`,
    variables: {
      interface_name: { type: 'interface', default: 'FastEthernet0/1' },
      vlan_id: { type: 'number', default: 10 },
      max_mac: { type: 'number', default: 2 },
      violation_action: { type: 'string', default: 'shutdown' }
    }
  },

  // ===== SWITCH L3 TEMPLATES =====
  {
    name: 'L3 Switch Inter-VLAN Routing',
    description: 'Layer 3 switch configuration for inter-VLAN routing',
    device_type: 'switch',
    category: 'switching_l3',
    template_config: `configure terminal
!
ip routing
!
vlan {{vlan_id}}
 name {{vlan_name}}
exit
!
interface vlan{{vlan_id}}
 description {{vlan_description}}
 ip address {{ip_address}} {{subnet_mask}}
 no shutdown
exit
!
interface {{physical_interface}}
 switchport access vlan {{vlan_id}}
 spanning-tree portfast
 no shutdown
exit
!
end`,
    variables: {
      vlan_id: { type: 'number', default: 10 },
      vlan_name: { type: 'string', default: 'SALES_VLAN' },
      vlan_description: { type: 'string', default: 'Sales Department VLAN' },
      ip_address: { type: 'ip', default: '192.168.10.1' },
      subnet_mask: { type: 'ip', default: '255.255.255.0' },
      physical_interface: { type: 'interface', default: 'FastEthernet0/1' }
    }
  },
  {
    name: 'SVI Configuration',
    description: 'Switch Virtual Interface configuration',
    device_type: 'switch',
    category: 'switching_svi',
    template_config: `configure terminal
!
interface vlan{{vlan_id}}
 description {{description}}
 ip address {{ip_address}} {{subnet_mask}}
 ip helper-address {{dhcp_server}}
 standby {{hsrp_group}} ip {{virtual_ip}}
 standby {{hsrp_group}} priority {{priority}}
 standby {{hsrp_group}} preempt
 no shutdown
exit
!
end`,
    variables: {
      vlan_id: { type: 'number', default: 10 },
      description: { type: 'string', default: 'Gateway_for_VLAN_10' },
      ip_address: { type: 'ip', default: '192.168.10.2' },
      subnet_mask: { type: 'ip', default: '255.255.255.0' },
      dhcp_server: { type: 'ip', default: '192.168.10.10' },
      hsrp_group: { type: 'number', default: 10 },
      virtual_ip: { type: 'ip', default: '192.168.10.1' },
      priority: { type: 'number', default: 110 }
    }
  },

  // ===== SPANNING TREE TEMPLATES =====
  {
    name: 'Spanning Tree Configuration',
    description: 'Spanning Tree Protocol configuration',
    device_type: 'switch',
    category: 'spanning_tree',
    template_config: `configure terminal
!
spanning-tree mode {{stp_mode}}
spanning-tree vlan {{vlan_range}} root {{root_type}}
spanning-tree vlan {{vlan_range}} priority {{priority}}
!
interface {{interface_name}}
 spanning-tree port-priority {{port_priority}}
 spanning-tree cost {{cost}}
 spanning-tree portfast
 spanning-tree bpduguard enable
exit
!
end`,
    variables: {
      stp_mode: { type: 'string', default: 'rapid-pvst' },
      vlan_range: { type: 'string', default: '10,20,30' },
      root_type: { type: 'string', default: 'primary' },
      priority: { type: 'number', default: 8192 },
      interface_name: { type: 'interface', default: 'FastEthernet0/1' },
      port_priority: { type: 'number', default: 128 },
      cost: { type: 'number', default: 19 }
    }
  }
];

async function initializeTemplates() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/network_automation');
    console.log('✅ Connected to MongoDB');

    console.log('🔄 Clearing existing templates...');
    await ConfigurationTemplate.deleteMany({});
    console.log('✅ Cleared existing templates');

    console.log('🔄 Inserting configuration templates...');
    for (const template of templates) {
      try {
        const newTemplate = new ConfigurationTemplate(template);
        await newTemplate.save();
        console.log(`✅ Created template: ${template.name}`);
      } catch (error) {
        console.error(`❌ Failed to create template ${template.name}:`, error.message);
      }
    }

    console.log(`🎉 Successfully initialized ${templates.length} configuration templates!`);
    
    // Display summary
    const summary = await ConfigurationTemplate.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    console.log('\n📊 Template Summary:');
    summary.forEach(item => {
      console.log(`  ${item._id}: ${item.count} templates`);
    });

  } catch (error) {
    console.error('❌ Error initializing templates:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run the initialization
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeTemplates();
}

export default initializeTemplates; 