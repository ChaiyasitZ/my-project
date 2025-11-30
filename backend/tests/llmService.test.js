/**
 * LLM Service Unit Tests
 * Tests for the OpenRouter LLM Service - focusing on public API
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Import LLMService
const { LLMService } = await import('../services/llmService.js');

describe('LLMService', () => {
  let llmService;

  beforeEach(() => {
    // Reset environment
    process.env.OPENROUTER_API_KEY = 'test-api-key';
    process.env.OPENROUTER_MODEL = 'anthropic/claude-3-haiku';
    
    llmService = new LLMService();
    
    // Clear caches and stats
    llmService.cache.clear();
    llmService.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      totalTokens: 0
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with default configuration', () => {
      expect(llmService.provider).toBe('openrouter');
      expect(llmService.timeout).toBe(120000);
      expect(llmService.cacheTTL).toBe(300000); // 5 minutes
      expect(llmService.maxCacheSize).toBe(100);
    });

    test('should initialize empty cache', () => {
      expect(llmService.cache.size).toBe(0);
    });

    test('should initialize rate limiter', () => {
      expect(llmService.rateLimiter.maxRequests).toBe(30);
      expect(llmService.rateLimiter.windowMs).toBe(60000);
    });

    test('should initialize stats tracking', () => {
      expect(llmService.stats.totalRequests).toBe(0);
      expect(llmService.stats.cacheHits).toBe(0);
      expect(llmService.stats.errors).toBe(0);
    });
  });

  describe('_getCacheKey', () => {
    test('should generate consistent cache keys', () => {
      const key1 = llmService._getCacheKey('test prompt', 'router');
      const key2 = llmService._getCacheKey('test prompt', 'router');
      expect(key1).toBe(key2);
    });

    test('should generate different keys for different prompts', () => {
      const key1 = llmService._getCacheKey('prompt1', 'router');
      const key2 = llmService._getCacheKey('prompt2', 'router');
      expect(key1).not.toBe(key2);
    });

    test('should generate different keys for different device types', () => {
      const key1 = llmService._getCacheKey('test', 'router');
      const key2 = llmService._getCacheKey('test', 'switch');
      expect(key1).not.toBe(key2);
    });
  });

  describe('_setCache', () => {
    test('should store values in cache', () => {
      const key = 'test-key';
      const value = { config: 'test config' };
      
      llmService._setCache(key, value);
      
      expect(llmService.cache.size).toBe(1);
      expect(llmService.cache.has(key)).toBe(true);
    });

    test('should respect maxCacheSize limit', () => {
      // Fill cache beyond limit
      for (let i = 0; i < llmService.maxCacheSize + 10; i++) {
        llmService._setCache(`key-${i}`, { value: i });
      }
      
      expect(llmService.cache.size).toBeLessThanOrEqual(llmService.maxCacheSize);
    });
  });

  describe('clearCache', () => {
    test('should clear all cached values', () => {
      llmService._setCache('key1', 'value1');
      llmService._setCache('key2', 'value2');
      
      expect(llmService.cache.size).toBe(2);
      
      llmService.clearCache();
      
      expect(llmService.cache.size).toBe(0);
    });
  });

  describe('getStats', () => {
    test('should return current statistics', () => {
      llmService.stats.totalRequests = 10;
      llmService.stats.cacheHits = 3;
      llmService.stats.cacheMisses = 7;
      
      const stats = llmService.getStats();
      
      expect(stats.totalRequests).toBe(10);
      expect(stats.cacheHits).toBe(3);
      expect(stats.cacheMisses).toBe(7);
      expect(stats.cacheHitRate).toContain('30');
    });

    test('should handle zero requests gracefully', () => {
      const stats = llmService.getStats();
      
      expect(stats.cacheHitRate).toContain('0');
    });
  });

  describe('_buildSystemMessage', () => {
    test('should include Cisco expert context', () => {
      const message = llmService._buildSystemMessage('configure vlan', 'switch');
      
      expect(message).toContain('Cisco');
    });
  });

  describe('_buildUserMessage', () => {
    test('should include user prompt', () => {
      const message = llmService._buildUserMessage('configure ospf', 'router', {});
      
      expect(message).toContain('ospf');
    });

    test('should include device type context', () => {
      const message = llmService._buildUserMessage('test', 'switch', {});
      
      expect(message.toLowerCase()).toContain('switch');
    });
  });

  describe('_cleanConfiguration', () => {
    test('should remove markdown code blocks', () => {
      const input = '```\ninterface Gi0/0\n```';
      const result = llmService._cleanConfiguration(input);
      
      expect(result).not.toContain('```');
    });

    test('should preserve valid Cisco commands', () => {
      const input = `interface GigabitEthernet0/0
  ip address 192.168.1.1 255.255.255.0
  no shutdown`;
      
      const result = llmService._cleanConfiguration(input);
      
      expect(result).toContain('interface GigabitEthernet0/0');
      expect(result).toContain('ip address');
      expect(result).toContain('no shutdown');
    });
  });

  describe('knowledge base', () => {
    test('should have knowledge base initialized', () => {
      expect(llmService.knowledgeBase).toBeDefined();
    });

    test('should have prompt templates defined', () => {
      expect(llmService.promptTemplates).toBeDefined();
      expect(llmService.promptTemplates.cisco_cli).toBeDefined();
    });
  });
});
