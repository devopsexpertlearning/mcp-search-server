/**
 * Browser-based search service using Playwright
 */

import { chromium, Browser, Page } from 'playwright';
import { BaseSearchService } from './BaseSearchService.js';
import { SearchResult, SearchEngine, ExtractedContent, ContentExtractionOptions } from '../types/index.js';
import { DEFAULT_CONFIG } from '../config/constants.js';
import { Validator } from '../utils/validation.js';

export class BrowserSearchService extends BaseSearchService {
  protected readonly browserLogger = this.logger.child('Browser');
  private browser: Browser | null = null;

  async search(query: string, engine: SearchEngine, maxResults: number): Promise<SearchResult[]> {
    const validatedQuery = Validator.validateQuery(query);
    const validatedEngine = Validator.validateSearchEngine(engine);
    const validatedMaxResults = Validator.validateMaxResults(maxResults);

    this.browserLogger.debug(`Browser search for: "${validatedQuery}" using ${validatedEngine}"`);

    const browser = await this.ensureBrowser();
    const page = await browser.newPage();

    try {
      await this.configurePage(page);
      
      const searchUrl = this.buildSearchUrl(validatedQuery, validatedEngine);
      await page.goto(searchUrl, { waitUntil: 'networkidle' });

      // Wait for search results to load
      await page.waitForSelector(this.getResultSelector(validatedEngine), { timeout: 10000 });

      const html = await page.content();
      const results = this.parseSearchResults(html, validatedEngine, validatedMaxResults);

      this.browserLogger.info(`Browser found ${results.length} results for query: "${validatedQuery}"`);
      return results;
    } catch (error) {
      this.browserLogger.error(`Browser search failed for query: "${validatedQuery}"`, error);
      throw new Error(`Browser search failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await page.close().catch(() => {});
    }
  }

  async extractContent(options: ContentExtractionOptions): Promise<ExtractedContent> {
    const validatedUrl = Validator.validateUrl(options.url);
    
    this.browserLogger.debug(`Browser extracting content from: ${validatedUrl}`);

    const browser = await this.ensureBrowser();
    const page = await browser.newPage();

    try {
      await this.configurePage(page);
      await page.goto(validatedUrl, { waitUntil: 'networkidle' });

      const html = await page.content();
      const content = this.extractContentFromHtml(html, validatedUrl, options);
      
      this.browserLogger.info(`Browser extracted content from: ${validatedUrl} (${content.content.length} chars)`);
      return content;
    } catch (error) {
      this.browserLogger.error(`Browser content extraction failed for: ${validatedUrl}`, error);
      throw new Error(`Browser content extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await page.close().catch(() => {});
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      this.browserLogger.debug('Closing browser');
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  private async ensureBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browserLogger.debug('Launching browser');
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
        ]
      });
      this.browserLogger.debug('Browser launched successfully');
    }
    return this.browser;
  }

  private async configurePage(page: Page): Promise<void> {
    // Set realistic headers
    await page.setExtraHTTPHeaders({
      'User-Agent': this.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });

    // Block unnecessary resources for performance
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // Set viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
  }

  private getResultSelector(engine: SearchEngine): string {
    switch (engine) {
      case 'google':
        return 'div.g';
      case 'bing':
        return 'li.b_algo';
      case 'duckduckgo':
        return '.result';
      case 'searx':
        return '.result';
      case 'startpage':
        return '.w-gl__result';
      default:
        return '.result';
    }
  }
}