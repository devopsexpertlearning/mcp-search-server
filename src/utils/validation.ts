/**
 * Input validation utilities
 */

import { URL } from 'url';
import { SearchEngine } from '../types/index.js';
import { SEARCH_ENGINES, DEFAULT_CONFIG } from '../config/constants.js';

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class Validator {
  static validateUrl(url: string): string {
    if (!url || typeof url !== 'string') {
      throw new ValidationError('URL is required and must be a string', 'url');
    }

    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new ValidationError('URL must use HTTP or HTTPS protocol', 'url');
      }
      return parsedUrl.toString();
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ValidationError('Invalid URL format', 'url');
    }
  }

  static validateQuery(query: string): string {
    if (!query || typeof query !== 'string') {
      throw new ValidationError('Query is required and must be a string', 'query');
    }

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      throw new ValidationError('Query cannot be empty', 'query');
    }

    if (trimmed.length > 500) {
      throw new ValidationError('Query too long (max 500 characters)', 'query');
    }

    return trimmed;
  }

  static validateSearchEngine(engine: string): SearchEngine {
    if (!engine || typeof engine !== 'string') {
      return SEARCH_ENGINES.DUCKDUCKGO as SearchEngine;
    }

    const normalizedEngine = engine.toLowerCase() as SearchEngine;
    const validEngines = Object.values(SEARCH_ENGINES) as string[];
    
    if (!validEngines.includes(normalizedEngine)) {
      throw new ValidationError(
        `Invalid search engine. Must be one of: ${validEngines.join(', ')}`, 
        'engine'
      );
    }

    return normalizedEngine;
  }

  static validateMaxResults(maxResults: unknown): number {
    if (maxResults === undefined || maxResults === null) {
      return DEFAULT_CONFIG.DEFAULT_MAX_RESULTS;
    }

    const num = Number(maxResults);
    if (!Number.isInteger(num) || num < 1 || num > DEFAULT_CONFIG.MAX_RESULTS) {
      throw new ValidationError(
        `maxResults must be an integer between 1 and ${DEFAULT_CONFIG.MAX_RESULTS}`, 
        'maxResults'
      );
    }

    return num;
  }

  static validateDomain(domain: string): string {
    if (!domain || typeof domain !== 'string') {
      throw new ValidationError('Domain is required and must be a string', 'domain');
    }

    const trimmed = domain.trim().toLowerCase();
    
    // Remove protocol if present
    const withoutProtocol = trimmed.replace(/^https?:\/\//, '');
    
    // Remove path if present
    const domainOnly = withoutProtocol.split('/')[0];
    
    // Basic domain validation
    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
    
    if (!domainRegex.test(domainOnly)) {
      throw new ValidationError('Invalid domain format', 'domain');
    }

    return domainOnly;
  }

  static validateLanguage(language: unknown): string {
    if (!language) return 'en';
    
    if (typeof language !== 'string') {
      throw new ValidationError('Language must be a string', 'language');
    }

    const trimmed = language.trim().toLowerCase();
    
    // Basic language code validation (ISO 639-1)
    const languageRegex = /^[a-z]{2}(-[a-z]{2})?$/;
    
    if (!languageRegex.test(trimmed)) {
      throw new ValidationError('Language must be a valid language code (e.g., "en", "es", "en-US")', 'language');
    }

    return trimmed;
  }

  static validateRegion(region: unknown): string {
    if (!region) return 'us';
    
    if (typeof region !== 'string') {
      throw new ValidationError('Region must be a string', 'region');
    }

    const trimmed = region.trim().toLowerCase();
    
    // Basic region code validation (ISO 3166-1 alpha-2)
    const regionRegex = /^[a-z]{2}$/;
    
    if (!regionRegex.test(trimmed)) {
      throw new ValidationError('Region must be a valid 2-letter country code (e.g., "us", "uk", "de")', 'region');
    }

    return trimmed;
  }

  static validateQueries(queries: unknown): string[] {
    if (!Array.isArray(queries)) {
      throw new ValidationError('Queries must be an array', 'queries');
    }

    if (queries.length === 0) {
      throw new ValidationError('Queries array cannot be empty', 'queries');
    }

    if (queries.length > 10) {
      throw new ValidationError('Too many queries (max 10)', 'queries');
    }

    const validatedQueries: string[] = [];
    
    for (let i = 0; i < queries.length; i++) {
      try {
        const validated = this.validateQuery(queries[i]);
        validatedQueries.push(validated);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new ValidationError(`Query ${i + 1}: ${error.message}`, 'queries');
        }
        throw error;
      }
    }

    return validatedQueries;
  }

  static validateBoolean(value: unknown, defaultValue = false): boolean {
    if (value === undefined || value === null) {
      return defaultValue;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(lower)) return true;
      if (['false', '0', 'no', 'off'].includes(lower)) return false;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    return defaultValue;
  }

  static validateContentType(contentType: unknown): 'article' | 'all' | 'text_only' {
    if (!contentType) return 'article';
    
    if (typeof contentType !== 'string') {
      throw new ValidationError('Content type must be a string', 'contentType');
    }

    const normalized = contentType.toLowerCase();
    const validTypes = ['article', 'all', 'text_only'];
    
    if (!validTypes.includes(normalized)) {
      throw new ValidationError(
        `Invalid content type. Must be one of: ${validTypes.join(', ')}`, 
        'contentType'
      );
    }

    return normalized as 'article' | 'all' | 'text_only';
  }
}