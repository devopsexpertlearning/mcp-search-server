/**
 * Caching service for search results
 */

import { CacheEntry } from '../types/index.js';
import { DEFAULT_CONFIG } from '../config/constants.js';
import { logger } from '../utils/logger.js';

export class CacheService<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly ttl: number;
  private readonly logger = logger.child('Cache');
  private cleanupInterval?: NodeJS.Timeout;

  constructor(ttl: number = DEFAULT_CONFIG.CACHE_TTL) {
    this.ttl = ttl;
    
    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => this.cleanup(), this.ttl);
    
    this.logger.debug(`Cache service initialized with TTL: ${ttl}ms`);
  }

  set(key: string, value: T): void {
    const entry: CacheEntry<T> = {
      results: value,
      timestamp: Date.now(),
    };
    
    this.cache.set(key, entry);
    this.logger.debug(`Cached entry: ${key}`);
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.logger.debug(`Cache miss: ${key}`);
      return null;
    }

    const age = Date.now() - entry.timestamp;
    
    if (age > this.ttl) {
      this.cache.delete(key);
      this.logger.debug(`Cache expired: ${key} (age: ${age}ms)`);
      return null;
    }

    this.logger.debug(`Cache hit: ${key} (age: ${age}ms)`);
    return entry.results;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    const age = Date.now() - entry.timestamp;
    
    if (age > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.logger.debug(`Deleted cache entry: ${key}`);
    }
    return deleted;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.info(`Cleared cache (${size} entries)`);
  }

  size(): number {
    return this.cache.size;
  }

  stats(): { size: number; ttl: number; keys: string[] } {
    return {
      size: this.cache.size,
      ttl: this.ttl,
      keys: Array.from(this.cache.keys()),
    };
  }

  generateKey(prefix: string, ...parts: (string | number | boolean)[]): string {
    const key = [prefix, ...parts.map(p => String(p))].join(':');
    return this.normalizeKey(key);
  }

  private normalizeKey(key: string): string {
    // Remove sensitive data and normalize
    return key
      .toLowerCase()
      .replace(/[^\w\-:.]/g, '_')
      .substring(0, 200); // Limit key length
  }

  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      
      if (age > this.ttl) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.logger.debug(`Cleaned up ${expiredCount} expired cache entries`);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    
    this.clear();
    this.logger.debug('Cache service destroyed');
  }
}