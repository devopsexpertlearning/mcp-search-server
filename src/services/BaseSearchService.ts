/**
 * Base search service with common functionality
 */

import * as cheerio from 'cheerio';
import { SearchResult, SearchEngine, ExtractedContent, ContentExtractionOptions } from '../types/index.js';
import { USER_AGENTS, CONTENT_SELECTORS, DEFAULT_CONFIG } from '../config/constants.js';
import { logger } from '../utils/logger.js';
import { Validator } from '../utils/validation.js';

export abstract class BaseSearchService {
  protected readonly logger = logger.child('SearchService');
  protected readonly userAgent = USER_AGENTS.DEFAULT;

  abstract search(query: string, engine: SearchEngine, maxResults: number): Promise<SearchResult[]>;
  
  /**
   * Extract domain from URL
   */
  protected extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  /**
   * Parse search results from HTML
   */
  protected parseSearchResults(html: string, engine: SearchEngine, maxResults: number): SearchResult[] {
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    try {
      switch (engine) {
        case 'duckduckgo':
          return this.parseDuckDuckGoResults($, maxResults);
        case 'google':
          return this.parseGoogleResults($, maxResults);
        case 'bing':
          return this.parseBingResults($, maxResults);
        case 'searx':
          return this.parseSearxResults($, maxResults);
        case 'startpage':
          return this.parseStartPageResults($, maxResults);
        default:
          this.logger.warn(`Unsupported search engine: ${engine}`);
          return [];
      }
    } catch (error) {
      this.logger.error('Failed to parse search results', error);
      return [];
    }
  }

  private parseDuckDuckGoResults($: cheerio.CheerioAPI, maxResults: number): SearchResult[] {
    const results: SearchResult[] = [];

    $('.result').each((i, element) => {
      if (results.length >= maxResults) return false;
      
      const titleElement = $(element).find('.result__title a').first();
      const snippetElement = $(element).find('.result__snippet').first();

      const title = titleElement.text().trim();
      const url = titleElement.attr('href');
      const snippet = snippetElement.text().trim();

      if (title && url) {
        results.push({
          title,
          url,
          snippet: snippet || '',
          domain: this.extractDomain(url),
        });
      }
    });

    return results;
  }

  private parseGoogleResults($: cheerio.CheerioAPI, maxResults: number): SearchResult[] {
    const results: SearchResult[] = [];

    $('div.g').each((i, element) => {
      if (results.length >= maxResults) return false;
      
      const titleElement = $(element).find('h3').first();
      const linkElement = $(element).find('a[href^="http"]').first();
      const snippetElement = $(element).find('span:contains("...")').first().parent();

      const title = titleElement.text().trim();
      const url = linkElement.attr('href');
      const snippet = snippetElement.text().trim();

      if (title && url) {
        results.push({
          title,
          url,
          snippet: snippet || '',
          domain: this.extractDomain(url),
        });
      }
    });

    return results;
  }

  private parseBingResults($: cheerio.CheerioAPI, maxResults: number): SearchResult[] {
    const results: SearchResult[] = [];

    $('li.b_algo').each((i, element) => {
      if (results.length >= maxResults) return false;
      
      const titleElement = $(element).find('h2 a').first();
      const snippetElement = $(element).find('p, .b_caption p').first();

      const title = titleElement.text().trim();
      const url = titleElement.attr('href');
      const snippet = snippetElement.text().trim();

      if (title && url) {
        results.push({
          title,
          url,
          snippet: snippet || '',
          domain: this.extractDomain(url),
        });
      }
    });

    return results;
  }

  private parseSearxResults($: cheerio.CheerioAPI, maxResults: number): SearchResult[] {
    // Similar implementation for Searx
    return this.parseDuckDuckGoResults($, maxResults); // Fallback
  }

  private parseStartPageResults($: cheerio.CheerioAPI, maxResults: number): SearchResult[] {
    // Similar implementation for StartPage
    return this.parseDuckDuckGoResults($, maxResults); // Fallback
  }

  /**
   * Extract content from HTML with intelligent parsing
   */
  protected extractContentFromHtml(
    html: string, 
    url: string, 
    options: ContentExtractionOptions
  ): ExtractedContent {
    const $ = cheerio.load(html);
    const result: ExtractedContent = { url, content: '' };

    try {
      // Extract metadata if requested
      if (options.extractMetadata) {
        result.metadata = {
          title: $('title').text().trim(),
          description: $('meta[name="description"]').attr('content') || '',
          keywords: $('meta[name="keywords"]').attr('content') || '',
          author: $('meta[name="author"]').attr('content') || '',
          canonical: $('link[rel="canonical"]').attr('href') || '',
          language: $('html').attr('lang') || $('meta[http-equiv="content-language"]').attr('content') || '',
          published: $('meta[property="article:published_time"]').attr('content') || 
                    $('meta[name="date"]').attr('content') || '',
        };
      }

      // Extract content based on type
      result.content = this.extractTextContent($, options.contentType || 'article');

      // Extract links if requested
      if (options.extractLinks) {
        result.links = this.extractLinks($, url);
      }

      // Extract images if requested
      if (options.extractImages) {
        result.images = this.extractImages($, url);
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to extract content from HTML', error);
      return { url, content: 'Error extracting content' };
    }
  }

  private extractTextContent($: cheerio.CheerioAPI, contentType: string): string {
    if (contentType === 'article') {
      // Try to find article content using common selectors
      for (const selector of CONTENT_SELECTORS.ARTICLE) {
        const element = $(selector).first();
        if (element.length) {
          // Remove unwanted elements
          element.find(CONTENT_SELECTORS.REMOVE.join(',')).remove();
          const content = element.text().replace(/\s+/g, ' ').trim();
          if (content.length > 100) { // Minimum content length for articles
            return content.substring(0, DEFAULT_CONFIG.MAX_CONTENT_LENGTH);
          }
        }
      }
    }

    // Fallback to body text
    $(CONTENT_SELECTORS.REMOVE.join(',')).remove();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    
    if (contentType === 'text_only') {
      return bodyText;
    }

    return bodyText.substring(0, DEFAULT_CONFIG.MAX_CONTENT_LENGTH);
  }

  private extractLinks($: cheerio.CheerioAPI, baseUrl: string): Array<{ text: string; href: string; domain?: string }> {
    const links: Array<{ text: string; href: string; domain?: string }> = [];

    $('a[href]').each((i, element) => {
      if (links.length >= DEFAULT_CONFIG.MAX_LINKS) return false;

      const href = $(element).attr('href');
      const text = $(element).text().trim();
      
      if (href && text) {
        try {
          const absoluteUrl = new URL(href, baseUrl).toString();
          links.push({
            text,
            href: absoluteUrl,
            domain: this.extractDomain(absoluteUrl),
          });
        } catch {
          // Skip invalid URLs
        }
      }
    });

    return links;
  }

  private extractImages($: cheerio.CheerioAPI, baseUrl: string): Array<{ src: string; alt: string }> {
    const images: Array<{ src: string; alt: string }> = [];

    $('img[src]').each((i, element) => {
      if (images.length >= DEFAULT_CONFIG.MAX_IMAGES) return false;

      const src = $(element).attr('src');
      const alt = $(element).attr('alt') || '';
      
      if (src) {
        try {
          const absoluteUrl = new URL(src, baseUrl).toString();
          images.push({ src: absoluteUrl, alt });
        } catch {
          // Skip invalid URLs
        }
      }
    });

    return images;
  }

  /**
   * Build search URL for different engines
   */
  protected buildSearchUrl(query: string, engine: SearchEngine, options: any = {}): string {
    const encodedQuery = encodeURIComponent(query);
    const { language = 'en', region = 'us', safeSearch = true } = options;

    switch (engine) {
      case 'google':
        let googleUrl = `https://www.google.com/search?q=${encodedQuery}`;
        if (language !== 'en') googleUrl += `&hl=${language}`;
        if (region !== 'us') googleUrl += `&gl=${region}`;
        if (!safeSearch) googleUrl += `&safe=off`;
        return googleUrl;

      case 'bing':
        let bingUrl = `https://www.bing.com/search?q=${encodedQuery}`;
        if (language !== 'en') bingUrl += `&setlang=${language}`;
        return bingUrl;

      case 'duckduckgo':
        let ddgUrl = `https://duckduckgo.com/html/?q=${encodedQuery}`;
        if (region !== 'us') ddgUrl += `&kl=${region}`;
        if (!safeSearch) ddgUrl += `&safe_search=-1`;
        return ddgUrl;

      case 'searx':
        return `https://searx.org/?q=${encodedQuery}&language=${language}`;

      case 'startpage':
        return `https://www.startpage.com/sp/search?query=${encodedQuery}&language=${language}`;

      default:
        return `https://duckduckgo.com/html/?q=${encodedQuery}`;
    }
  }
}