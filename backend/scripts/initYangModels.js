import mongoose from 'mongoose';
import YangModel from '../models/YangModel.js';
import { config } from '../config/config.js';

// Sample YANG models for Cisco devices
const sampleYangModels = [
  {
    name: 'ietf-interfaces',
    namespace: 'urn:ietf:params:xml:ns:yang:ietf-interfaces',
    prefix: 'if',
    revision: '2018-02-20',
    description: 'This module contains a collection of YANG definitions for managing network interfaces.',
    organization: 'IETF NETMOD (Network Modeling) Working Group',
    contact: 'WG Web:   <https://datatracker.ietf.org/wg/netmod/>',
    yang_content: `module ietf-interfaces {
  yang-version 1.1;
  namespace "urn:ietf:params:xml:ns:yang:ietf-interfaces";
  prefix if;

  import ietf-yang-types {
    prefix yang;
  }

  organization
    "IETF NETMOD (Network Modeling) Working Group";

  contact
    "WG Web:   <https://datatracker.ietf.org/wg/netmod/>
     WG List:  <mailto:netmod@ietf.org>";

  description
    "This module contains a collection of YANG definitions for
     managing network interfaces.";

  revision 2018-02-20 {
    description
      "Updated to support NMDA.";
    reference
      "RFC 8343: A YANG Data Model for Interface Management";
  }

  container interfaces {
    description
      "Interface parameters.";

    list interface {
      key "name";
      description
        "The list of interfaces on the device.";

      leaf name {
        type string;
        description
          "The name of the interface.";
      }

      leaf description {
        type string;
        description
          "A textual description of the interface.";
      }

      leaf type {
        type string;
        mandatory true;
        description
          "The type of the interface.";
      }

      leaf enabled {
        type boolean;
        default "true";
        description
          "This leaf contains the configured, desired state of the
           interface.";
      }

      leaf link-up-down-trap-enable {
        type boolean;
        description
          "Controls whether linkUp/linkDown SNMP notifications
           should be generated for this interface.";
      }
    }
  }
}`,
    parsed_structure: {
      containers: {
        interfaces: {
          description: "Interface parameters.",
          lists: {
            interface: {
              key: "name",
              leaves: [
                { name: "name", type: "string", mandatory: false },
                { name: "description", type: "string", mandatory: false },
                { name: "type", type: "string", mandatory: true },
                { name: "enabled", type: "boolean", default: "true" },
                { name: "link-up-down-trap-enable", type: "boolean", mandatory: false }
              ]
            }
          }
        }
      }
    },
    vendor: 'ietf',
    category: 'interface',
    status: 'active',
    supported_devices: [
      { vendor: 'cisco', model: 'nexus-9000', os_version: 'any' },
      { vendor: 'cisco', model: 'catalyst-9000', os_version: 'any' }
    ]
  },
  {
    name: 'ietf-ip',
    namespace: 'urn:ietf:params:xml:ns:yang:ietf-ip',
    prefix: 'ip',
    revision: '2018-02-22',
    description: 'This module contains a collection of YANG definitions for configuring IP on network interfaces.',
    organization: 'IETF NETMOD (Network Modeling) Working Group',
    contact: 'WG Web:   <https://datatracker.ietf.org/wg/netmod/>',
    yang_content: `module ietf-ip {
  yang-version 1.1;
  namespace "urn:ietf:params:xml:ns:yang:ietf-ip";
  prefix ip;

  import ietf-interfaces {
    prefix if;
  }
  import ietf-inet-types {
    prefix inet;
  }
  import ietf-yang-types {
    prefix yang;
  }

  organization
    "IETF NETMOD (Network Modeling) Working Group";

  contact
    "WG Web:   <https://datatracker.ietf.org/wg/netmod/>
     WG List:  <mailto:netmod@ietf.org>";

  description
    "This module contains a collection of YANG definitions for
     configuring IP on network interfaces.";

  revision 2018-02-22 {
    description
      "Updated to support NMDA.";
    reference
      "RFC 8344: A YANG Data Model for IP Management";
  }

  augment "/if:interfaces/if:interface" {
    description
      "Parameters for configuring IP on interfaces.";

    container ipv4 {
      presence
        "Enables IPv4 unless the 'enabled' leaf
         (which defaults to 'true') is set to 'false'";
      description
        "Parameters for the IPv4 address family.";

      leaf enabled {
        type boolean;
        default true;
        description
          "Controls whether IPv4 is enabled or disabled on this
           interface.";
      }

      list address {
        key "ip";
        description
          "The list of IPv4 addresses on the interface.";

        leaf ip {
          type inet:ipv4-address-no-zone;
          description
            "The IPv4 address on the interface.";
        }

        choice subnet {
          mandatory true;
          description
            "The subnet can be specified as a prefix-length, or,
             if the server supports non-contiguous netmasks, as
             a netmask.";
          case prefix-length {
            leaf prefix-length {
              type uint8 {
                range "0..32";
              }
              description
                "The length of the subnet prefix.";
            }
          }
          case netmask {
            leaf netmask {
              type yang:dotted-quad;
              description
                "The subnet specified as a netmask.";
            }
          }
        }
      }
    }
  }
}`,
    parsed_structure: {
      augments: {
        "/if:interfaces/if:interface": {
          containers: {
            ipv4: {
              presence: true,
              leaves: [
                { name: "enabled", type: "boolean", default: "true" }
              ],
              lists: {
                address: {
                  key: "ip",
                  leaves: [
                    { name: "ip", type: "inet:ipv4-address-no-zone", mandatory: false },
                    { name: "prefix-length", type: "uint8", mandatory: false },
                    { name: "netmask", type: "yang:dotted-quad", mandatory: false }
                  ]
                }
              }
            }
          }
        }
      }
    },
    vendor: 'ietf',
    category: 'interface',
    status: 'active',
    supported_devices: [
      { vendor: 'cisco', model: 'nexus-9000', os_version: 'any' },
      { vendor: 'cisco', model: 'catalyst-9000', os_version: 'any' }
    ]
  },
  {
    name: 'cisco-nx-os-device',
    namespace: 'http://cisco.com/ns/yang/cisco-nx-os-device',
    prefix: 'nxos',
    revision: '2023-05-01',
    description: 'Cisco NX-OS device model.',
    organization: 'Cisco Systems, Inc.',
    contact: 'Cisco Systems, Inc.',
    yang_content: `module cisco-nx-os-device {
  yang-version 1.1;
  namespace "http://cisco.com/ns/yang/cisco-nx-os-device";
  prefix nxos;

  import ietf-inet-types {
    prefix inet;
  }

  organization "Cisco Systems, Inc.";
  contact "Cisco Systems, Inc.";

  description
    "Cisco NX-OS device model.";

  revision 2023-05-01 {
    description "Latest revision";
  }

  container System {
    description "System configuration";
    
    container intf-items {
      description "Interface items";
      
      list phys-items {
        key "id";
        description "Physical interface list";
        
        leaf id {
          type string;
          description "Interface identifier";
        }
        
        leaf adminSt {
          type enumeration {
            enum up;
            enum down;
          }
          default "up";
          description "Administrative state";
        }
        
        leaf descr {
          type string;
          description "Interface description";
        }
        
        container rtvrfMbr-items {
          description "VRF membership";
          
          list tDn-items {
            key "tDn";
            description "Target DN items";
            
            leaf tDn {
              type string;
              description "Target DN";
            }
          }
        }
        
        container rshIfMain-items {
          description "Interface main items";
          
          list addr-items {
            key "addr";
            description "Address items";
            
            leaf addr {
              type inet:ipv4-address;
              description "IPv4 address";
            }
            
            leaf mask {
              type uint8 {
                range "0..32";
              }
              description "Subnet mask length";
            }
          }
        }
      }
    }
    
    container vrf-items {
      description "VRF items";
      
      list name-items {
        key "name";
        description "VRF name items";
        
        leaf name {
          type string;
          description "VRF name";
        }
        
        leaf descr {
          type string;
          description "VRF description";
        }
      }
    }
  }
}`,
    parsed_structure: {
      containers: {
        System: {
          description: "System configuration",
          containers: {
            "intf-items": {
              description: "Interface items",
              lists: {
                "phys-items": {
                  key: "id",
                  leaves: [
                    { name: "id", type: "string", mandatory: false },
                    { name: "adminSt", type: "enumeration", default: "up" },
                    { name: "descr", type: "string", mandatory: false }
                  ]
                }
              }
            },
            "vrf-items": {
              description: "VRF items",
              lists: {
                "name-items": {
                  key: "name",
                  leaves: [
                    { name: "name", type: "string", mandatory: false },
                    { name: "descr", type: "string", mandatory: false }
                  ]
                }
              }
            }
          }
        }
      }
    },
    vendor: 'cisco',
    category: 'system',
    status: 'active',
    supported_devices: [
      { vendor: 'cisco', model: 'nexus-9000', os_version: '9.3' },
      { vendor: 'cisco', model: 'nexus-9000', os_version: '10.1' }
    ]
  }
];

async function initializeYangModels() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(config.database.mongodb_uri);
    console.log('✅ Connected to MongoDB');

    console.log('🗑️  Clearing existing YANG models...');
    await YangModel.deleteMany({});

    console.log('📝 Creating sample YANG models...');
    for (const modelData of sampleYangModels) {
      const model = new YangModel(modelData);
      await model.save();
      console.log(`✅ Created YANG model: ${model.name} (${model.vendor})`);
    }

    console.log(`\n🎉 Successfully initialized ${sampleYangModels.length} YANG models!`);
    console.log('\nAvailable models:');
    const models = await YangModel.find({}).select('name vendor category revision');
    models.forEach(model => {
      console.log(`  - ${model.name} (${model.vendor}/${model.category}) - ${model.revision}`);
    });

  } catch (error) {
    console.error('❌ Error initializing YANG models:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  }
}

// Run initialization if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeYangModels();
}

export default initializeYangModels; 