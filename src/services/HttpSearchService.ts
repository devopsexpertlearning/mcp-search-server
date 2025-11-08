/**
 * HTTP-based search service using curl
 */

import { spawn } from 'child_process';
import { BaseSearchService } from './BaseSearchService.js';
import { SearchResult, SearchEngine, ExtractedContent, ContentExtractionOptions } from '../types/index.js';
import { DEFAULT_CONFIG } from '../config/constants.js';
import { Validator } from '../utils/validation.js';

export class HttpSearchService extends BaseSearchService {
  protected readonly httpLogger = this.logger.child('Http');

  async search(query: string, engine: SearchEngine, maxResults: number): Promise<SearchResult[]> {
    const validatedQuery = Validator.validateQuery(query);
    const validatedEngine = Validator.validateSearchEngine(engine);
    const validatedMaxResults = Validator.validateMaxResults(maxResults);

    this.httpLogger.debug(`Searching for: "${validatedQuery}" using ${validatedEngine}`);

    try {
      const searchUrl = this.buildSearchUrl(validatedQuery, validatedEngine);
      const html = await this.fetchWithCurl(searchUrl);
      const results = this.parseSearchResults(html, validatedEngine, validatedMaxResults);
      
      this.httpLogger.info(`Found ${results.length} results for query: "${validatedQuery}"`);
      return results;
    } catch (error) {
      this.httpLogger.error(`Search failed for query: "${validatedQuery}"`, error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async extractContent(options: ContentExtractionOptions): Promise<ExtractedContent> {
    const validatedUrl = Validator.validateUrl(options.url);
    
    this.httpLogger.debug(`Extracting content from: ${validatedUrl}`);

    try {
      const html = await this.fetchWithCurl(validatedUrl);
      const content = this.extractContentFromHtml(html, validatedUrl, options);
      
      this.httpLogger.info(`Extracted content from: ${validatedUrl} (${content.content.length} chars)`);
      return content;
    } catch (error) {
      this.httpLogger.error(`Content extraction failed for: ${validatedUrl}`, error);
      throw new Error(`Content extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async fetchWithCurl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const curl = spawn('curl', [
        '-s',
        '-L',
        '--connect-timeout', '10',
        '--max-time', String(DEFAULT_CONFIG.REQUEST_TIMEOUT / 1000),
        '--user-agent', this.userAgent,
        '--header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        '--header', 'Accept-Language: en-US,en;q=0.5',
        '--header', 'Accept-Encoding: gzip, deflate',
        '--header', 'Cache-Control: no-cache',
        '--compressed',
        url
      ]);

      let data = '';
      let errorData = '';

      curl.stdout.on('data', (chunk) => {
        data += chunk;
      });

      curl.stderr.on('data', (chunk) => {
        errorData += chunk;
      });

      curl.on('close', (code) => {
        if (code === 0) {
          this.httpLogger.debug(`Successfully fetched: ${url} (${data.length} bytes)`);
          resolve(data);
        } else {
          const error = `curl failed with code ${code}: ${errorData.trim() || 'Unknown error'}`;
          this.httpLogger.error(`Failed to fetch: ${url} - ${error}`);
          reject(new Error(error));
        }
      });

      curl.on('error', (error) => {
        this.httpLogger.error(`Failed to execute curl for: ${url}`, error);
        reject(new Error(`Failed to execute curl: ${error.message}`));
      });

      // Set timeout
      setTimeout(() => {
        curl.kill();
        reject(new Error('Request timeout'));
      }, DEFAULT_CONFIG.REQUEST_TIMEOUT);
    });
  }
}