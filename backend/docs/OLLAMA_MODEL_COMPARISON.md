# Ollama Model Comparison Test Results
## Network Configuration Generation for Cisco Devices

**Test Date:** 2026-02-02T12:13:39.246Z
**Test Prompts:** 8
**Test Rounds:** 3
**Total Tests per Model:** 24

---

## Executive Summary

This document presents the comparative analysis of three Ollama models for generating network configurations:

1. **qwen2.5-coder:7b** - Alibaba's code-focused LLM
2. **codegemma:7b** - Google's code generation model
3. **codellama:7b** - Meta's code-specialized LLaMA model

Each model was tested **3 times** to ensure statistical reliability.

---

## Overall Comparison

| Model | Avg Score | Avg Time (s) | Total Tokens | Success Rate | Tokens/Sec |
|-------|-----------|--------------|--------------|--------------|------------|
| qwen2.5-coder:7b | 96.5 | 34.49 | 7815 | 100.0% | 9.4 |
| codegemma:7b | 95.8 | 9.21 | 1475 | 100.0% | 6.7 |
| codellama:7b | 91.6 | 23.73 | 5774 | 100.0% | 10.1 |

---

## Results by Round

| Model | Round 1 | Round 2 | Round 3 | Average | Std Dev |
|-------|---------|---------|---------|---------|---------|
| qwen2.5-coder:7b | 96.9 | 95.9 | 96.9 | **96.5** | 0.47 |
| codegemma:7b | 95.8 | 95.9 | 95.8 | **95.8** | 0.06 |
| codellama:7b | 91.6 | 94.8 | 88.5 | **91.6** | 2.55 |

---

## Performance by Category

| Category | qwen2.5-coder | codegemma | codellama | Winner |
|----------|---------------|-----------|-----------|--------|
| VLAN | 91.5 | 93.0 | 87.5 | **codegemma** |
| Interface | 98.7 | 90.2 | 83.2 | **qwen2.5-coder** |
| Routing | 100.0 | 100.0 | 98.1 | **qwen2.5-coder** |
| Security | 92.0 | 100.0 | 97.3 | **codegemma** |

---

## Performance by Configuration Type

| Type | qwen2.5-coder | codegemma | codellama | Winner |
|------|---------------|-----------|-----------|--------|
| CLI Commands | 98.7 | 100.0 | 98.6 | **codegemma** |
| NETCONF/XML | 90.2 | 83.2 | 70.7 | **qwen2.5-coder** |

---

## Performance by Device Type

| Device | qwen2.5-coder | codegemma | codellama | Winner |
|--------|---------------|-----------|-----------|--------|
| Cisco Nexus (NX-OS) | 95.8 | 96.5 | 92.3 | **codegemma** |
| Cisco IOS-XE | 97.3 | 95.1 | 90.9 | **qwen2.5-coder** |

---

## Resource Usage

### System Information

- **CPU:** AMD Ryzen 7 5800H with Radeon Graphics          (16 cores)
- **RAM:** 31.36 GB total
- **GPU:** NVIDIA GeForce RTX 3050 Laptop GPU

### Average Resource Usage

| Model | CPU Avg (%) | RAM Avg (%) | GPU Avg (%) | GPU Memory (MB) |
|-------|-------------|-------------|-------------|-----------------|
| qwen2.5-coder:7b | 34.5 | 45.6 | 34.4 | 2979 |
| codegemma:7b | 35.8 | 53.6 | 25.3 | 2995 |
| codellama:7b | 36.4 | 46.8 | 33.8 | 2995 |

### Peak Resource Usage

| Model | CPU Max (%) | RAM Max (%) | GPU Max (%) | Peak GPU Memory (MB) | GPU Temp (°C) |
|-------|-------------|-------------|-------------|----------------------|---------------|
| qwen2.5-coder:7b | 35.0 | 48.8 | 97.0 | 3028 | 68 |
| codegemma:7b | 36.0 | 55.9 | 95.0 | 3020 | 65 |
| codellama:7b | 37.0 | 55.0 | 95.0 | 3013 | 66 |

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
| qwen2.5-coder:7b | 100 | 59.45 | 6/6 | ✓ |
| codegemma:7b | 100 | 6.73 | 6/6 | ✓ |
| codellama:7b | 100 | 16.87 | 6/6 | ✓ |

### Test 2: Interface Configuration (CLI)

**Prompt:** Generate Cisco NX-OS CLI commands to configure interface Ethernet1/1 with IP address 192.168.1.1/24 and description "Uplink to Core"

| Model | Score | Time (s) | Keywords | Syntax Valid |
|-------|-------|----------|----------|--------------|
| qwen2.5-coder:7b | 100 | 30.33 | 5/5 | ✓ |
| codegemma:7b | 100 | 6.63 | 5/5 | ✓ |
| codellama:7b | 100 | 11.26 | 5/5 | ✓ |

### Test 3: OSPF Configuration (CLI)

**Prompt:** Generate Cisco IOS-XE CLI commands to configure OSPF process 1 with router-id 1.1.1.1 and advertise network 10.0.0.0/24 in area 0

| Model | Score | Time (s) | Keywords | Syntax Valid |
|-------|-------|----------|----------|--------------|
| qwen2.5-coder:7b | 100 | 20.28 | 5/5 | ✓ |
| codegemma:7b | 100 | 6.67 | 5/5 | ✓ |
| codellama:7b | 100 | 14.68 | 5/5 | ✓ |

### Test 4: BGP Configuration (CLI)

**Prompt:** Generate Cisco IOS-XE CLI commands to configure BGP AS 65001 with neighbor 10.0.0.2 in AS 65002

| Model | Score | Time (s) | Keywords | Syntax Valid |
|-------|-------|----------|----------|--------------|
| qwen2.5-coder:7b | 100 | 51.45 | 6/6 | ✓ |
| codegemma:7b | 100 | 9.24 | 6/6 | ✓ |
| codellama:7b | 100 | 49.94 | 6/6 | ✓ |

### Test 5: NETCONF VLAN (NX-OS)

**Prompt:** Generate NETCONF XML using Cisco NX-OS YANG model to configure VLAN 100 with name "Production". Use namespace http://cisco.com/ns/yang/cisco-nx-os-device

| Model | Score | Time (s) | Keywords | Syntax Valid |
|-------|-------|----------|----------|--------------|
| qwen2.5-coder:7b | 83 | 24.01 | 4/6 | ✓ |
| codegemma:7b | 83 | 10.36 | 4/6 | ✓ |
| codellama:7b | 75 | 26.85 | 3/6 | ✓ |

### Test 6: NETCONF Interface (IOS-XE)

**Prompt:** Generate NETCONF XML using Cisco IOS-XE YANG model to configure GigabitEthernet1 with IP 192.168.1.1/24. Use namespace http://cisco.com/ns/yang/Cisco-IOS-XE-native

| Model | Score | Time (s) | Keywords | Syntax Valid |
|-------|-------|----------|----------|--------------|
| qwen2.5-coder:7b | 100 | 44.34 | 6/6 | ✓ |
| codegemma:7b | 83 | 20.31 | 4/6 | ✓ |
| codellama:7b | 58 | 15.67 | 1/6 | ✓ |

### Test 7: Access Control List (CLI)

**Prompt:** Generate Cisco IOS-XE CLI commands to create an extended access-list named "BLOCK_TELNET" that denies TCP traffic to port 23 from any source to any destination

| Model | Score | Time (s) | Keywords | Syntax Valid |
|-------|-------|----------|----------|--------------|
| qwen2.5-coder:7b | 92 | 21.52 | 5/6 | ✓ |
| codegemma:7b | 100 | 4.44 | 6/6 | ✓ |
| codellama:7b | 100 | 6.85 | 6/6 | ✓ |

### Test 8: Static Route (CLI)

**Prompt:** Generate Cisco NX-OS CLI commands to configure a static route to network 172.16.0.0/16 via next-hop 10.0.0.1

| Model | Score | Time (s) | Keywords | Syntax Valid |
|-------|-------|----------|----------|--------------|
| qwen2.5-coder:7b | 100 | 25.89 | 3/3 | ✓ |
| codegemma:7b | 100 | 6.57 | 3/3 | ✓ |
| codellama:7b | 100 | 42.91 | 3/3 | ✓ |

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

**Overall Winner: qwen2.5-coder:7b** with an average score of 96.5/100

### Key Findings

1. **Best Overall Performance:** qwen2.5-coder:7b
2. **Second Place:** codegemma:7b
3. **Third Place:** codellama:7b

---

*This report was automatically generated by the Ollama Model Comparison Test Suite*