/**
 * Article Parser Module
 * 
 * Extracts clean article content from URLs using Mozilla Readability
 */

const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const fetch = require('node-fetch');

/**
 * Parse article from URL and extract clean content
 */
async function parseArticle(url) {
  try {
    console.log(`Parsing article: ${url}`);
    
    // Fetch the HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Parse with JSDOM
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;
    
    // Use Readability to extract article content
    const reader = new Readability(document, {
      charThreshold: 100,
      keepClasses: false,
    });
    
    const article = reader.parse();
    
    if (!article) {
      throw new Error('Failed to parse article content');
    }
    
    // Clean up the HTML content
    const cleanContent = cleanHTML(article.content);
    
    return {
      success: true,
      title: article.title || 'Untitled',
      byline: article.byline || null,
      content: cleanContent,
      textContent: article.textContent || '',
      length: article.length || 0,
      excerpt: article.excerpt || '',
      siteName: article.siteName || null,
      publishedTime: article.publishedTime || null,
    };
    
  } catch (error) {
    console.error(`Error parsing article ${url}:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Clean HTML content - remove scripts, styles, ads, etc.
 */
function cleanHTML(html) {
  if (!html) return '';
  
  // Remove script and style tags
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove common ad-related elements
  const adPatterns = [
    /<div[^>]*class="[^"]*ad[^"]*"[^>]*>.*?<\/div>/gi,
    /<div[^>]*id="[^"]*ad[^"]*"[^>]*>.*?<\/div>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<ins[^>]*>.*?<\/ins>/gi,
  ];
  
  adPatterns.forEach(pattern => {
    html = html.replace(pattern, '');
  });
  
  // Remove inline styles
  html = html.replace(/\s*style="[^"]*"/gi, '');
  
  // Remove data attributes
  html = html.replace(/\s*data-[a-z-]+="[^"]*"/gi, '');
  
  // Clean up whitespace
  html = html.replace(/\s+/g, ' ');
  html = html.replace(/>\s+</g, '><');
  
  return html.trim();
}

/**
 * Convert HTML to plain text
 */
function htmlToPlainText(html) {
  if (!html) return '';
  
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, ' ');
  
  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

module.exports = {
  parseArticle,
  cleanHTML,
  htmlToPlainText,
};
