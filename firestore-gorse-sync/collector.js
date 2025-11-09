/**
 * Large-Scale Content Collection Pipeline
 * 
 * Collects diverse content from 15+ sources including APIs, RSS feeds, and datasets.
 * Normalizes, deduplicates, stores in Firestore, and syncs to Gorse.
 */

const Parser = require('rss-parser');
const fetch = require('node-fetch');
const crypto = require('crypto');
const pLimit = require('p-limit');

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_NEW_ITEMS_PER_RUN = parseInt(process.env.MAX_NEW_ITEMS_PER_RUN || '2000', 10);
const FETCH_CONCURRENCY = parseInt(process.env.FETCH_CONCURRENCY || '5', 10);
const FETCH_TIMEOUT_MS = parseInt(process.env.FETCH_TIMEOUT_MS || '10000', 10);
const NEWSAPI_KEY = process.env.NEWSAPI_KEY || '';
const GUARDIAN_API_KEY = process.env.GUARDIAN_API_KEY || '';

const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; ContentCollector/1.0)',
  },
});

// ============================================================================
// RATE LIMITER
// ============================================================================

class RateLimiter {
  constructor(maxPerSecond = 10) {
    this.maxPerSecond = maxPerSecond;
    this.hostQueues = new Map();
  }
  
  async throttle(host) {
    if (!this.hostQueues.has(host)) {
      this.hostQueues.set(host, []);
    }
    
    const queue = this.hostQueues.get(host);
    const now = Date.now();
    
    // Remove timestamps older than 1 second
    while (queue.length && queue[0] < now - 1000) {
      queue.shift();
    }
    
    // If at limit, wait
    if (queue.length >= this.maxPerSecond) {
      const oldestTimestamp = queue[0];
      const delay = 1000 - (now - oldestTimestamp) + 10; // +10ms buffer
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.throttle(host); // Retry
    }
    
    queue.push(now);
  }
  
  getHost(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }
}

const rateLimiter = new RateLimiter(10);

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate consistent document ID from URL
 */
function generateDocId(url) {
  const normalized = url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(/[^a-z0-9]/g, '_')
    .substring(0, 100);
  
  const hash = crypto
    .createHash('md5')
    .update(normalized)
    .digest('hex')
    .substring(0, 20);
  
  return hash;
}

/**
 * Strip HTML tags and clean text
 */
function stripHTML(html) {
  if (!html) return '';
  
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize content item
 */
function normalizeContent(item, source, tags, license, contentType = 'article') {
  const title = stripHTML(item.title || 'Untitled').substring(0, 200);
  const description = stripHTML(item.description || item.contentSnippet || item.summary || '');
  const excerpt = description.substring(0, 200);
  const plainText = license === 'public-domain' ? description : excerpt;
  
  const publishedAt = item.isoDate || item.pubDate || item.published || new Date().toISOString();
  
  return {
    title,
    excerpt,
    plain_text: plainText,
    tags,
    publishedAt: new Date(publishedAt),
    source,
    url: item.link || item.url || '',
    license,
    contentType,
    important: false,
  };
}

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const status = error.status || error.response?.status;
      
      if (status === 429 || (status >= 500 && status < 600)) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        console.log(`  Retrying after ${delay}ms (attempt ${i + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

// ============================================================================
// RSS FETCHERS
// ============================================================================

/**
 * Generic RSS fetcher
 */
async function fetchRSS(url, tags, license = 'rss', contentType = 'article') {
  const host = rateLimiter.getHost(url);
  await rateLimiter.throttle(host);
  
  try {
    const feed = await parser.parseURL(url);
    const items = [];
    
    for (const item of feed.items) {
      if (!item.link) continue;
      
      const normalized = normalizeContent(item, url, tags, license, contentType);
      const docId = generateDocId(item.link);
      
      items.push({
        docId,
        data: normalized,
      });
    }
    
    return {
      success: true,
      source: url,
      items,
    };
  } catch (error) {
    return {
      success: false,
      source: url,
      error: error.message,
      items: [],
    };
  }
}

/**
 * Fetch News content
 */
async function fetchNewsContent() {
  console.log('\n📰 Fetching News content...');
  
  const sources = [
    // Major News Outlets
    { url: 'http://feeds.bbci.co.uk/news/rss.xml', tags: ['news', 'world'] },
    { url: 'https://www.reutersagency.com/feed/?best-topics=world-news', tags: ['news', 'world'] },
    { url: 'http://rss.cnn.com/rss/cnn_topstories.rss', tags: ['news', 'world'] },
    { url: 'https://feeds.npr.org/1001/rss.xml', tags: ['news', 'world'] },
    { url: 'https://www.aljazeera.com/xml/rss/all.xml', tags: ['news', 'world', 'international'] },
    { url: 'https://www.cbsnews.com/latest/rss/main', tags: ['news', 'world'] },
    { url: 'https://abcnews.go.com/abcnews/topstories', tags: ['news', 'world'] },
    { url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', tags: ['news', 'world', 'business'] },
    { url: 'https://www.economist.com/the-world-this-week/rss.xml', tags: ['news', 'world', 'business'] },
    { url: 'https://www.ft.com/?format=rss', tags: ['news', 'business', 'finance'] },
  ];
  
  const results = [];
  for (const { url, tags } of sources) {
    const result = await fetchRSS(url, tags);
    results.push(result);
    console.log(`  ${result.success ? '✓' : '✗'} ${url}: ${result.items.length} items`);
  }
  
  return results;
}

/**
 * Fetch AI & Tech content
 */
async function fetchAITechContent() {
  console.log('\n🤖 Fetching AI & Tech content...');
  
  const sources = [
    // AI & Machine Learning
    { url: 'https://medium.com/feed/tag/artificial-intelligence', tags: ['ai', 'technology'] },
    { url: 'https://towardsdatascience.com/feed', tags: ['ai', 'data-science', 'technology'] },
    { url: 'https://machinelearningmastery.com/feed/', tags: ['ai', 'machine-learning', 'technology'] },
    { url: 'https://www.kdnuggets.com/feed', tags: ['ai', 'data-science', 'machine-learning'] },
    
    // Tech News
    { url: 'https://www.theverge.com/rss/index.xml', tags: ['technology', 'gadgets'] },
    { url: 'https://feeds.arstechnica.com/arstechnica/index', tags: ['technology', 'science'] },
    { url: 'https://techcrunch.com/feed/', tags: ['technology', 'startups', 'business'] },
    { url: 'https://www.wired.com/feed/rss', tags: ['technology', 'science', 'culture'] },
    { url: 'https://www.engadget.com/rss.xml', tags: ['technology', 'gadgets'] },
    { url: 'https://www.cnet.com/rss/news/', tags: ['technology', 'gadgets'] },
    { url: 'https://www.zdnet.com/news/rss.xml', tags: ['technology', 'business'] },
    { url: 'https://www.technologyreview.com/feed/', tags: ['technology', 'science', 'innovation'] },
    { url: 'https://www.theguardian.com/technology/rss', tags: ['technology', 'news'] },
    
    // Developer & Programming
    { url: 'https://dev.to/feed', tags: ['technology', 'programming', 'development'] },
    { url: 'https://news.ycombinator.com/rss', tags: ['technology', 'startups', 'programming'] },
    { url: 'https://www.smashingmagazine.com/feed/', tags: ['technology', 'design', 'development'] },
  ];
  
  const results = [];
  for (const { url, tags } of sources) {
    const result = await fetchRSS(url, tags);
    results.push(result);
    console.log(`  ${result.success ? '✓' : '✗'} ${url}: ${result.items.length} items`);
  }
  
  return results;
}

/**
 * Fetch Science content
 */
async function fetchScienceContent() {
  console.log('\n🔬 Fetching Science content...');
  
  const sources = [
    // Science News
    { url: 'https://www.sciencedaily.com/rss/top/science.xml', tags: ['science', 'research'] },
    { url: 'https://www.nature.com/feeds/newsroom.xml', tags: ['science', 'research', 'academic'] },
    { url: 'https://www.scientificamerican.com/feed/', tags: ['science', 'research'] },
    { url: 'https://www.newscientist.com/feed/home', tags: ['science', 'research', 'technology'] },
    { url: 'https://phys.org/rss-feed/', tags: ['science', 'physics', 'research'] },
    { url: 'https://www.sciencenews.org/feed', tags: ['science', 'research'] },
    { url: 'https://www.space.com/feeds/all', tags: ['science', 'space', 'astronomy'] },
    { url: 'https://www.livescience.com/feeds/all', tags: ['science', 'research'] },
  ];
  
  const results = [];
  for (const { url, tags } of sources) {
    const result = await fetchRSS(url, tags);
    results.push(result);
    console.log(`  ${result.success ? '✓' : '✗'} ${url}: ${result.items.length} items`);
  }
  
  // Add arXiv API
  const arxivResult = await fetchArXiv();
  results.push(arxivResult);
  console.log(`  ${arxivResult.success ? '✓' : '✗'} arXiv API: ${arxivResult.items.length} items`);
  
  return results;
}

/**
 * Fetch Poetry & Literature content
 */
async function fetchPoetryContent() {
  console.log('\n📖 Fetching Poetry & Literature content...');
  
  const sources = [
    { url: 'https://www.poetryfoundation.org/rss/poems', tags: ['poetry', 'literature'], contentType: 'poem' },
    { url: 'https://www.themarginalian.org/feed/', tags: ['literature', 'essays', 'culture'] },
  ];
  
  const results = [];
  for (const { url, tags, contentType } of sources) {
    const result = await fetchRSS(url, tags, 'rss', contentType || 'article');
    results.push(result);
    console.log(`  ${result.success ? '✓' : '✗'} ${url}: ${result.items.length} items`);
  }
  
  return results;
}

/**
 * Fetch Environment content
 */
async function fetchEnvironmentContent() {
  console.log('\n🌍 Fetching Environment content...');
  
  const sources = [
    { url: 'https://earthobservatory.nasa.gov/feeds/rss/eo.rss', tags: ['environment', 'climate', 'nasa'] },
    { url: 'https://www.unep.org/rss.xml', tags: ['environment', 'climate', 'sustainability'] },
  ];
  
  const results = [];
  for (const { url, tags } of sources) {
    const result = await fetchRSS(url, tags);
    results.push(result);
    console.log(`  ${result.success ? '✓' : '✗'} ${url}: ${result.items.length} items`);
  }
  
  return results;
}

/**
 * Fetch Business & Finance content
 */
async function fetchBusinessContent() {
  console.log('\n💼 Fetching Business & Finance content...');
  
  const sources = [
    { url: 'https://feeds.bloomberg.com/markets/news.rss', tags: ['business', 'finance', 'markets'] },
    { url: 'https://www.forbes.com/real-time/feed2/', tags: ['business', 'finance', 'entrepreneurship'] },
    { url: 'https://fortune.com/feed/', tags: ['business', 'finance', 'leadership'] },
    { url: 'https://hbr.org/feed', tags: ['business', 'management', 'leadership'] },
    { url: 'https://www.entrepreneur.com/latest.rss', tags: ['business', 'startups', 'entrepreneurship'] },
    { url: 'https://www.inc.com/rss/', tags: ['business', 'startups', 'growth'] },
    { url: 'https://www.fastcompany.com/latest/rss', tags: ['business', 'innovation', 'technology'] },
  ];
  
  const results = [];
  for (const { url, tags } of sources) {
    const result = await fetchRSS(url, tags);
    results.push(result);
    console.log(`  ${result.success ? '✓' : '✗'} ${url}: ${result.items.length} items`);
  }
  
  return results;
}

/**
 * Fetch Design & Creativity content
 */
async function fetchDesignContent() {
  console.log('\n🎨 Fetching Design & Creativity content...');
  
  const sources = [
    { url: 'https://www.designboom.com/feed/', tags: ['design', 'architecture', 'art'] },
    { url: 'https://www.dezeen.com/feed/', tags: ['design', 'architecture', 'interiors'] },
    { url: 'https://www.creativebloq.com/feed', tags: ['design', 'creativity', 'art'] },
    { url: 'https://www.itsnicethat.com/feed', tags: ['design', 'art', 'creativity'] },
    { url: 'https://www.behance.net/feeds/projects', tags: ['design', 'art', 'creativity'] },
    { url: 'https://dribbble.com/stories.rss', tags: ['design', 'ui', 'ux'] },
    { url: 'https://sidebar.io/feed', tags: ['design', 'ui', 'ux'] },
  ];
  
  const results = [];
  for (const { url, tags } of sources) {
    const result = await fetchRSS(url, tags);
    results.push(result);
    console.log(`  ${result.success ? '✓' : '✗'} ${url}: ${result.items.length} items`);
  }
  
  return results;
}

/**
 * Fetch Health & Wellness content
 */
async function fetchHealthContent() {
  console.log('\n🏥 Fetching Health & Wellness content...');
  
  const sources = [
    { url: 'https://www.health.harvard.edu/blog/feed', tags: ['health', 'wellness', 'medicine'] },
    { url: 'https://www.medicalnewstoday.com/rss/news.xml', tags: ['health', 'medicine', 'research'] },
    { url: 'https://www.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC', tags: ['health', 'wellness'] },
    { url: 'https://www.healthline.com/rss', tags: ['health', 'wellness', 'nutrition'] },
    { url: 'https://www.psychologytoday.com/us/blog/feed', tags: ['psychology', 'mental-health', 'wellness'] },
  ];
  
  const results = [];
  for (const { url, tags } of sources) {
    const result = await fetchRSS(url, tags);
    results.push(result);
    console.log(`  ${result.success ? '✓' : '✗'} ${url}: ${result.items.length} items`);
  }
  
  return results;
}

// ============================================================================
// API FETCHERS
// ============================================================================

/**
 * Fetch from NewsAPI.org
 */
async function fetchNewsAPI() {
  if (!NEWSAPI_KEY) {
    return { success: false, source: 'NewsAPI', error: 'API key not configured', items: [] };
  }
  
  const topics = ['science', 'technology'];
  const allItems = [];
  
  for (const topic of topics) {
    try {
      const url = `https://newsapi.org/v2/everything?q=${topic}&sortBy=publishedAt&pageSize=50&apiKey=${NEWSAPI_KEY}`;
      
      await rateLimiter.throttle('newsapi.org');
      
      const response = await retryWithBackoff(async () => {
        const res = await fetch(url, { timeout: FETCH_TIMEOUT_MS });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });
      
      if (response.articles) {
        for (const article of response.articles) {
          if (!article.url) continue;
          
          const normalized = normalizeContent(
            {
              title: article.title,
              description: article.description,
              link: article.url,
              pubDate: article.publishedAt,
            },
            'NewsAPI',
            ['news', topic],
            'api'
          );
          
          allItems.push({
            docId: generateDocId(article.url),
            data: normalized,
          });
        }
      }
    } catch (error) {
      console.log(`  ✗ NewsAPI (${topic}): ${error.message}`);
    }
  }
  
  return {
    success: allItems.length > 0,
    source: 'NewsAPI',
    items: allItems,
  };
}

/**
 * Fetch from Guardian API
 */
async function fetchGuardianAPI() {
  if (!GUARDIAN_API_KEY) {
    return { success: false, source: 'Guardian', error: 'API key not configured', items: [] };
  }
  
  try {
    const url = `https://content.guardianapis.com/search?section=science|technology&page-size=50&api-key=${GUARDIAN_API_KEY}`;
    
    await rateLimiter.throttle('content.guardianapis.com');
    
    const response = await retryWithBackoff(async () => {
      const res = await fetch(url, { timeout: FETCH_TIMEOUT_MS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
    
    const items = [];
    
    if (response.response?.results) {
      for (const article of response.response.results) {
        if (!article.webUrl) continue;
        
        const normalized = normalizeContent(
          {
            title: article.webTitle,
            description: article.fields?.trailText || '',
            link: article.webUrl,
            pubDate: article.webPublicationDate,
          },
          'Guardian',
          ['news', article.sectionName?.toLowerCase() || 'general'],
          'api'
        );
        
        items.push({
          docId: generateDocId(article.webUrl),
          data: normalized,
        });
      }
    }
    
    return {
      success: true,
      source: 'Guardian',
      items,
    };
  } catch (error) {
    return {
      success: false,
      source: 'Guardian',
      error: error.message,
      items: [],
    };
  }
}

/**
 * Fetch from arXiv API
 */
async function fetchArXiv() {
  try {
    const url = 'https://export.arxiv.org/api/query?search_query=all:AI&max_results=50&sortBy=submittedDate&sortOrder=descending';
    
    await rateLimiter.throttle('export.arxiv.org');
    
    const response = await retryWithBackoff(async () => {
      const res = await fetch(url, { timeout: FETCH_TIMEOUT_MS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    });
    
    // Simple XML parsing for arXiv
    const entries = response.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    const items = [];
    
    for (const entry of entries) {
      const titleMatch = entry.match(/<title>(.*?)<\/title>/);
      const summaryMatch = entry.match(/<summary>(.*?)<\/summary>/);
      const linkMatch = entry.match(/<id>(.*?)<\/id>/);
      const publishedMatch = entry.match(/<published>(.*?)<\/published>/);
      
      if (titleMatch && linkMatch) {
        const normalized = normalizeContent(
          {
            title: stripHTML(titleMatch[1]),
            description: summaryMatch ? stripHTML(summaryMatch[1]) : '',
            link: linkMatch[1],
            pubDate: publishedMatch ? publishedMatch[1] : new Date().toISOString(),
          },
          'arXiv',
          ['science', 'research', 'academic', 'ai'],
          'restricted'
        );
        
        items.push({
          docId: generateDocId(linkMatch[1]),
          data: normalized,
        });
      }
    }
    
    return {
      success: true,
      source: 'arXiv',
      items,
    };
  } catch (error) {
    return {
      success: false,
      source: 'arXiv',
      error: error.message,
      items: [],
    };
  }
}

// ============================================================================
// MAIN COLLECTION ORCHESTRATOR
// ============================================================================

/**
 * Collect all content from all sources
 */
async function collectAllContent(db, gorseRequest, options = {}) {
  const { dry = false, sources = null } = options;
  
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Starting Large-Scale Content Collection');
  console.log('='.repeat(60));
  console.log(`Mode: ${dry ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Max items per run: ${MAX_NEW_ITEMS_PER_RUN}`);
  console.log(`Concurrency: ${FETCH_CONCURRENCY}`);
  
  const startTime = Date.now();
  const limit = pLimit(FETCH_CONCURRENCY);
  
  // Define all fetcher functions
  const fetchers = [
    { name: 'news', fn: fetchNewsContent },
    { name: 'ai-tech', fn: fetchAITechContent },
    { name: 'science', fn: fetchScienceContent },
    { name: 'poetry', fn: fetchPoetryContent },
    { name: 'environment', fn: fetchEnvironmentContent },
    { name: 'business', fn: fetchBusinessContent },
    { name: 'design', fn: fetchDesignContent },
    { name: 'health', fn: fetchHealthContent },
    { name: 'newsapi', fn: fetchNewsAPI },
    { name: 'guardian', fn: fetchGuardianAPI },
  ];
  
  // Filter by sources if specified
  const activeFetchers = sources 
    ? fetchers.filter(f => sources.includes(f.name))
    : fetchers;
  
  // Run all fetchers with concurrency limit
  const fetchPromises = activeFetchers.map(({ fn }) => 
    limit(() => fn().catch(err => {
      console.error(`Fetcher error: ${err.message}`);
      return [];
    }))
  );
  
  const allResults = await Promise.all(fetchPromises);
  
  // Flatten results
  const flatResults = allResults.flat();
  
  // Aggregate all items
  const allItems = [];
  const errors = [];
  let feedsAttempted = 0;
  let feedsSucceeded = 0;
  
  for (const result of flatResults) {
    feedsAttempted++;
    
    if (result.success) {
      feedsSucceeded++;
      allItems.push(...result.items);
    } else {
      errors.push({
        source: result.source,
        error: result.error || 'Unknown error',
      });
    }
  }
  
  console.log(`\n📊 Collection Summary:`);
  console.log(`  Feeds attempted: ${feedsAttempted}`);
  console.log(`  Feeds succeeded: ${feedsSucceeded}`);
  console.log(`  Total items found: ${allItems.length}`);
  
  if (dry) {
    console.log('\n✓ Dry run complete - no data written');
    return {
      status: 'dry-run',
      feedsAttempted,
      feedsSucceeded,
      itemsFound: allItems.length,
      duration: Date.now() - startTime,
      errors,
    };
  }
  
  // Deduplicate and write to Firestore
  console.log(`\n💾 Writing to Firestore...`);
  
  let newItemsAdded = 0;
  let existingItems = 0;
  const itemsToSync = [];
  
  for (const item of allItems) {
    if (newItemsAdded >= MAX_NEW_ITEMS_PER_RUN) {
      console.log(`  ⚠️  Reached max items limit (${MAX_NEW_ITEMS_PER_RUN})`);
      break;
    }
    
    try {
      const docRef = db.collection('content').doc(item.docId);
      const doc = await docRef.get();
      
      if (doc.exists) {
        existingItems++;
        continue;
      }
      
      await docRef.set({
        ...item.data,
        createdAt: new Date(),
      });
      
      newItemsAdded++;
      itemsToSync.push(item);
      
      if (newItemsAdded % 100 === 0) {
        console.log(`  Added ${newItemsAdded} items...`);
      }
    } catch (error) {
      console.error(`  Error writing ${item.docId}: ${error.message}`);
    }
  }
  
  console.log(`  ✓ Added ${newItemsAdded} new items`);
  console.log(`  ⊘ Skipped ${existingItems} existing items`);
  
  // Sync to Gorse
  let syncedToGorse = 0;
  
  if (itemsToSync.length > 0) {
    console.log(`\n🔄 Syncing to Gorse...`);
    
    try {
      const gorseItems = itemsToSync.map(item => ({
        ItemId: item.docId,
        IsHidden: false,
        Categories: item.data.tags || [],
        Timestamp: item.data.publishedAt.toISOString(),
        Labels: item.data.important ? ['important'] : [],
        Comment: item.data.title || '',
      }));
      
      await gorseRequest('/api/items', 'POST', gorseItems);
      syncedToGorse = gorseItems.length;
      console.log(`  ✓ Synced ${syncedToGorse} items to Gorse`);
    } catch (error) {
      console.error(`  ✗ Gorse sync failed: ${error.message}`);
    }
  }
  
  // Get total count
  const countSnapshot = await db.collection('content').count().get();
  const totalItemsInFirestore = countSnapshot.data().count;
  
  // Store metrics
  const metrics = {
    timestamp: new Date(),
    feedsAttempted,
    feedsSucceeded,
    newItemsAdded,
    totalItemsInFirestore,
    syncedToGorse,
    duration: Date.now() - startTime,
    errors,
  };
  
  await db.collection('collection_metrics').doc('latest').set(metrics);
  await db.collection('last_collection_run').doc('state').set(metrics);
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Collection complete in ${duration}s`);
  console.log(`   New items: ${newItemsAdded}`);
  console.log(`   Total in Firestore: ${totalItemsInFirestore}`);
  console.log(`   Synced to Gorse: ${syncedToGorse}`);
  console.log(`${'='.repeat(60)}\n`);
  
  return {
    status: 'complete',
    feedsAttempted,
    feedsSucceeded,
    newItemsAdded,
    totalItemsInFirestore,
    syncedToGorse,
    duration: parseFloat(duration),
    errors,
  };
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

/**
 * Test a single source
 */
async function testSource(sourceName) {
  const sourceMap = {
    'bbc': () => fetchRSS('http://feeds.bbci.co.uk/news/rss.xml', ['news'], 'rss'),
    'reuters': () => fetchRSS('https://www.reutersagency.com/feed/?best-topics=world-news', ['news'], 'rss'),
    'medium': () => fetchRSS('https://medium.com/feed/tag/artificial-intelligence', ['ai'], 'rss'),
    'verge': () => fetchRSS('https://www.theverge.com/rss/index.xml', ['technology'], 'rss'),
    'arxiv': fetchArXiv,
    'newsapi': fetchNewsAPI,
    'guardian': fetchGuardianAPI,
  };
  
  const fetcher = sourceMap[sourceName];
  
  if (!fetcher) {
    return {
      success: false,
      error: `Unknown source: ${sourceName}. Available: ${Object.keys(sourceMap).join(', ')}`,
    };
  }
  
  const result = await fetcher();
  
  return {
    success: result.success,
    source: result.source,
    itemCount: result.items.length,
    titles: result.items.slice(0, 10).map(item => item.data.title),
    error: result.error,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  collectAllContent,
  testSource,
  fetchNewsContent,
  fetchAITechContent,
  fetchScienceContent,
  fetchPoetryContent,
  fetchEnvironmentContent,
  fetchBusinessContent,
  fetchDesignContent,
  fetchHealthContent,
  fetchNewsAPI,
  fetchGuardianAPI,
  fetchArXiv,
};
