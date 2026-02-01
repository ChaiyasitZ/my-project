# Ollama Model Comparison Test Results
## Network Configuration Generation for Cisco Devices

**Test Date:** 2026-02-01T18:47:33.779Z
**Total Test Cases:** 8

---

## Executive Summary

This document presents the comparative analysis of three Ollama models for generating network configurations:

1. **qwen2.5-coder:7b** - Alibaba's code-focused LLM
2. **codegemma:7b** - Google's code generation model
3. **codellama:7b** - Meta's code-specialized LLaMA model

---

## Overall Comparison

| Model | Avg Score | Avg Time (s) | Total Tokens | Success Rate | Tokens/Sec |
|-------|-----------|--------------|--------------|--------------|------------|
| qwen2.5-coder:7b | 95.9 | 47.49 | 2243 | 100.0% | 5.9 |
| codegemma:7b | 94.8 | 15.47 | 509 | 100.0% | 4.1 |
| codellama:7b | 94.8 | 39.82 | 2204 | 100.0% | 6.9 |

---

## Performance by Category

| Category | qwen2.5-coder | codegemma | codellama | Winner |
|----------|---------------|-----------|-----------|--------|
| VLAN | 87.5 | 91.5 | 87.5 | **codegemma** |
| Interface | 100.0 | 87.5 | 91.5 | **qwen2.5-coder** |
| Routing | 100.0 | 100.0 | 100.0 | **qwen2.5-coder** |
| Security | 92.0 | 100.0 | 100.0 | **codegemma** |

---

## Performance by Configuration Type

| Type | qwen2.5-coder | codegemma | codellama | Winner |
|------|---------------|-----------|-----------|--------|
| CLI Commands | 98.7 | 100.0 | 100.0 | **codegemma** |
| NETCONF/XML | 87.5 | 79.0 | 79.0 | **qwen2.5-coder** |

---

## Performance by Device Type

| Device | qwen2.5-coder | codegemma | codellama | Winner |
|--------|---------------|-----------|-----------|--------|
| Cisco Nexus (NX-OS) | 93.8 | 95.8 | 93.8 | **codegemma** |
| Cisco IOS-XE | 98.0 | 93.8 | 95.8 | **qwen2.5-coder** |

---

## Test Cases

| # | Test Name | Category | Type | Device |
|---|-----------|----------|------|--------|
| 1 | VLAN Configuration (CLI) | VLAN | CLI | nexus |
| 2 | Interface Configuration (CLI) | Interface | CLI | nexus |
| 3 | OSPF Configuration (CLI) | Routing | CLI | ios-xe |
| 4 | BGP Configuration (CLI) | Routing | CLI | ios-xe |
| 5 | NETCONF VLAN (NX-OS) | VLAN | NETCONF | nexus |
| 6 | NETCONF Interface (IOS-XE) | Interface | NETCONF | ios-xe |
| 7 | Access Control List (CLI) | Security | CLI | ios-xe |
| 8 | Static Route (CLI) | Routing | CLI | nexus |

---

## Detailed Results

### Test 1: VLAN Configuration (CLI)

**Prompt:** Generate Cisco NX-OS CLI commands to configure VLAN 100 named "Production" and VLAN 200 named "Development"

| Model | Score | Time (s) | Keywords | Syntax Valid |
|-------|-------|----------|----------|--------------|
| qwen2.5-coder:7b | 100 | 66.07 | 6/6 | ✓ |
| codegemma:7b | 100 | 27.01 | 6/6 | ✓ |
| codellama:7b | 100 | 42.46 | 6/6 | ✓ |

### Test 2: Interface Configuration (CLI)

**Prompt:** Generate Cisco NX-OS CLI commands to configure interface Ethernet1/1 with IP address 192.168.1.1/24 and description "Uplink to Core"

| Model | Score | Time (s) | Keywords | Syntax Valid |
|-------|-------|----------|----------|--------------|
| qwen2.5-coder:7b | 100 | 39.59 | 5/5 | ✓ |
| codegemma:7b | 100 | 9.39 | 5/5 | ✓ |
| codellama:7b | 100 | 33.82 | 5/5 | ✓ |

### Test 3: OSPF Configuration (CLI)

**Prompt:** Generate Cisco IOS-XE CLI commands to configure OSPF process 1 with router-id 1.1.1.1 and advertise network 10.0.0.0/24 in area 0

| Model | Score | Time (s) | Keywords | Syntax Valid |
|-------|-------|----------|----------|--------------|
| qwen2.5-coder:7b | 100 | 46.56 | 5/5 | ✓ |
| codegemma:7b | 100 | 9.41 | 5/5 | ✓ |
| codellama:7b | 100 | 20.54 | 5/5 | ✓ |

### Test 4: BGP Configuration (CLI)

**Prompt:** Generate Cisco IOS-XE CLI commands to configure BGP AS 65001 with neighbor 10.0.0.2 in AS 65002

| Model | Score | Time (s) | Keywords | Syntax Valid |
|-------|-------|----------|----------|--------------|
| qwen2.5-coder:7b | 100 | 94.46 | 6/6 | ✓ |
| codegemma:7b | 100 | 17.62 | 6/6 | ✓ |
| codellama:7b | 100 | 23.49 | 6/6 | ✓ |

### Test 5: NETCONF VLAN (NX-OS)

**Prompt:** Generate NETCONF XML using Cisco NX-OS YANG model to configure VLAN 100 with name "Production". Use namespace http://cisco.com/ns/yang/cisco-nx-os-device

| Model | Score | Time (s) | Keywords | Syntax Valid |
|-------|-------|----------|----------|--------------|
| qwen2.5-coder:7b | 75 | 26.01 | 3/6 | ✓ |
| codegemma:7b | 83 | 14.69 | 4/6 | ✓ |
| codellama:7b | 75 | 35.48 | 3/6 | ✓ |

### Test 6: NETCONF Interface (IOS-XE)

**Prompt:** Generate NETCONF XML using Cisco IOS-XE YANG model to configure GigabitEthernet1 with IP 192.168.1.1/24. Use namespace http://cisco.com/ns/yang/Cisco-IOS-XE-native

| Model | Score | Time (s) | Keywords | Syntax Valid |
|-------|-------|----------|----------|--------------|
| qwen2.5-coder:7b | 100 | 60.97 | 6/6 | ✓ |
| codegemma:7b | 75 | 29.19 | 3/6 | ✓ |
| codellama:7b | 83 | 52.28 | 4/6 | ✓ |

### Test 7: Access Control List (CLI)

**Prompt:** Generate Cisco IOS-XE CLI commands to create an extended access-list named "BLOCK_TELNET" that denies TCP traffic to port 23 from any source to any destination

| Model | Score | Time (s) | Keywords | Syntax Valid |
|-------|-------|----------|----------|--------------|
| qwen2.5-coder:7b | 92 | 8.85 | 5/6 | ✓ |
| codegemma:7b | 100 | 6.71 | 6/6 | ✓ |
| codellama:7b | 100 | 15.53 | 6/6 | ✓ |

### Test 8: Static Route (CLI)

**Prompt:** Generate Cisco NX-OS CLI commands to configure a static route to network 172.16.0.0/16 via next-hop 10.0.0.1

| Model | Score | Time (s) | Keywords | Syntax Valid |
|-------|-------|----------|----------|--------------|
| qwen2.5-coder:7b | 100 | 37.40 | 3/3 | ✓ |
| codegemma:7b | 100 | 9.72 | 3/3 | ✓ |
| codellama:7b | 100 | 94.98 | 3/3 | ✓ |

---

## Methodology

### Scoring Criteria

Each response is evaluated on a 100-point scale:

| Criteria | Weight | Description |
|----------|--------|-------------|
| Keyword Match | 50% | Presence of expected configuration keywords |
| Syntax Validity | 30% | Basic syntax validation for CLI or XML |
| Code Presence | 20% | Contains actual configuration code |

### Model Parameters

All models were tested with identical parameters:

- **Temperature:** 0.3 (low for consistent outputs)
- **Top-p:** 0.9
- **Max Tokens:** 1024
- **Timeout:** 120 seconds

---

## Conclusion

Based on the comprehensive testing of 8 network configuration prompts across CLI and NETCONF formats for both Cisco Nexus (NX-OS) and IOS-XE devices:

**Overall Winner: qwen2.5-coder:7b** with an average score of 95.9/100

### Key Findings

1. **Best Overall Performance:** qwen2.5-coder:7b
2. **Second Place:** codegemma:7b
3. **Third Place:** codellama:7b

---

*This report was automatically generated by the Ollama Model Comparison Test Suite*