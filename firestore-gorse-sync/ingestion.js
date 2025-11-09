/**
 * Content Ingestion Module
 * 
 * Fetches articles, news, and poetry from RSS feeds and public APIs,
 * stores them in Firestore, and syncs to Gorse.
 */

const Parser = require('rss-parser');
const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; FirestoreGorseSync/1.0)',
  },
});

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_ITEMS_PER_SYNC = parseInt(process.env.MAX_ITEMS_PER_SYNC || '500', 10);
const FEED_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// Feed cooldown tracker (in-memory)
const feedLastFetched = new Map();

// RSS Feed sources organized by category
const FEED_SOURCES = {
  'ai-tech': {
    feeds: [
      'https://medium.com/feed/tag/artificial-intelligence',
      'https://towardsdatascience.com/feed',
      'https://feeds.arstechnica.com/arstechnica/index',
    ],
    tags: ['ai', 'technology'],
  },
  'science-health': {
    feeds: [
      'https://www.sciencedaily.com/rss/top/science.xml',
      'https://www.nature.com/feeds/newsroom.xml',
      'https://www.nih.gov/news-events/news-releases/rss.xml',
    ],
    tags: ['science', 'health'],
  },
  'poetry-literature': {
    feeds: [
      'https://www.poetryfoundation.org/rss/poems',
      'https://lithub.com/feed/',
      'https://www.theparisreview.org/blog/feed/',
      'https://www.themarginalian.org/feed/',
    ],
    tags: ['poetry', 'literature'],
  },
  'environment': {
    feeds: [
      'https://earthobservatory.nasa.gov/feeds/rss/eo.rss',
      'https://www.unep.org/rss.xml',
    ],
    tags: ['environment', 'climate'],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a feed is on cooldown
 */
function isFeedOnCooldown(feedUrl) {
  const lastFetch = feedLastFetched.get(feedUrl);
  if (!lastFetch) return false;
  
  const now = Date.now();
  return (now - lastFetch) < FEED_COOLDOWN_MS;
}

/**
 * Mark feed as fetched
 */
function markFeedFetched(feedUrl) {
  feedLastFetched.set(feedUrl, Date.now());
}

/**
 * Generate a document ID from URL or GUID
 */
function generateDocId(url, guid) {
  const source = guid || url;
  // Create a safe document ID from URL/GUID
  return source
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 100);
}

/**
 * Extract plain text from HTML content
 */
function extractPlainText(html) {
  if (!html) return '';
  
  // Simple HTML tag removal
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 500); // Limit to 500 chars
}

/**
 * Parse a single RSS feed
 */
async function parseFeed(feedUrl, tags, db) {
  console.log(`  Fetching feed: ${feedUrl}`);
  
  try {
    const feed = await parser.parseURL(feedUrl);
    const items = [];
    
    for (const item of feed.items) {
      if (!item.link) continue;
      
      const docId = generateDocId(item.link, item.guid);
      const publishedAt = item.isoDate ? new Date(item.isoDate) : new Date();
      
      // Check if already exists
      const docRef = db.collection('content').doc(docId);
      const doc = await docRef.get();
      
      if (doc.exists) {
        continue; // Skip existing items
      }
      
      // Extract content
      const excerpt = item.contentSnippet || item.summary || item.description || '';
      const plainText = extractPlainText(item.content || item['content:encoded'] || excerpt);
      
      const contentData = {
        title: item.title || 'Untitled',
        excerpt: excerpt.substring(0, 300),
        plain_text: plainText,
        tags: tags,
        publishedAt: publishedAt,
        source: feedUrl,
        url: item.link,
        important: false,
        contentType: 'article',
        createdAt: new Date(),
      };
      
      items.push({
        docId,
        data: contentData,
      });
    }
    
    return {
      success: true,
      feedUrl,
      totalItems: feed.items.length,
      newItems: items,
    };
    
  } catch (error) {
    console.error(`  Error parsing feed ${feedUrl}:`, error.message);
    return {
      success: false,
      feedUrl,
      error: error.message,
      newItems: [],
    };
  }
}

/**
 * Sync items to Gorse
 */
async function syncItemsToGorse(items, gorseRequest) {
  if (items.length === 0) return { success: true, synced: 0 };
  
  try {
    const gorseItems = items.map(item => ({
      ItemId: item.docId,
      IsHidden: false,
      Categories: item.data.tags || [],
      Timestamp: item.data.publishedAt.toISOString(),
      Labels: item.data.important ? ['important'] : [],
      Comment: item.data.title || '',
    }));
    
    await gorseRequest('/api/items', 'POST', gorseItems);
    
    return { success: true, synced: gorseItems.length };
  } catch (error) {
    console.error('Error syncing to Gorse:', error.message);
    return { success: false, error: error.message, synced: 0 };
  }
}

// ============================================================================
// MAIN INGESTION FUNCTION
// ============================================================================

/**
 * Ingest all feeds and sync to Firestore and Gorse
 */
async function ingestAllFeeds(db, gorseRequest, options = {}) {
  const { mode = 'full', debug = false } = options;
  
  console.log(`\n=== Starting content ingestion (${mode} mode) ===`);
  const startTime = Date.now();
  
  const stats = {
    totalFeeds: 0,
    successfulFeeds: 0,
    failedFeeds: 0,
    totalNewItems: 0,
    totalExistingItems: 0,
    syncedToGorse: 0,
    errors: [],
    feedDetails: [],
  };
  
  const allNewItems = [];
  
  // Process each category
  for (const [category, config] of Object.entries(FEED_SOURCES)) {
    console.log(`\nProcessing category: ${category}`);
    
    for (const feedUrl of config.feeds) {
      stats.totalFeeds++;
      
      // Check cooldown
      if (mode === 'incremental' && isFeedOnCooldown(feedUrl)) {
        console.log(`  Skipping ${feedUrl} (on cooldown)`);
        continue;
      }
      
      // Parse feed
      const result = await parseFeed(feedUrl, config.tags, db);
      
      if (result.success) {
        stats.successfulFeeds++;
        stats.totalNewItems += result.newItems.length;
        allNewItems.push(...result.newItems);
        
        if (debug) {
          stats.feedDetails.push({
            feedUrl,
            category,
            totalItems: result.totalItems,
            newItems: result.newItems.length,
          });
        }
        
        markFeedFetched(feedUrl);
        console.log(`  ✓ Found ${result.newItems.length} new items`);
      } else {
        stats.failedFeeds++;
        stats.errors.push({
          feedUrl,
          error: result.error,
        });
        console.log(`  ✗ Failed: ${result.error}`);
      }
      
      // Check if we've hit the limit
      if (allNewItems.length >= MAX_ITEMS_PER_SYNC) {
        console.log(`\n⚠️  Reached max items limit (${MAX_ITEMS_PER_SYNC}), stopping ingestion`);
        break;
      }
    }
    
    if (allNewItems.length >= MAX_ITEMS_PER_SYNC) {
      break;
    }
  }
  
  // Insert new items into Firestore
  console.log(`\n📝 Inserting ${allNewItems.length} new items into Firestore...`);
  
  if (allNewItems.length > 0) {
    const batch = db.batch();
    let batchCount = 0;
    
    for (const item of allNewItems) {
      const docRef = db.collection('content').doc(item.docId);
      batch.set(docRef, {
        ...item.data,
        publishedAt: item.data.publishedAt, // Keep as Date for Firestore
      });
      
      batchCount++;
      
      // Firestore batch limit is 500
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`  Committed batch of ${batchCount} items`);
        batchCount = 0;
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
      console.log(`  Committed final batch of ${batchCount} items`);
    }
    
    // Sync to Gorse
    console.log(`\n🔄 Syncing ${allNewItems.length} items to Gorse...`);
    const gorseResult = await syncItemsToGorse(allNewItems, gorseRequest);
    
    if (gorseResult.success) {
      stats.syncedToGorse = gorseResult.synced;
      console.log(`  ✓ Synced ${gorseResult.synced} items to Gorse`);
    } else {
      stats.errors.push({
        stage: 'gorse_sync',
        error: gorseResult.error,
      });
      console.log(`  ✗ Gorse sync failed: ${gorseResult.error}`);
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n=== Ingestion complete in ${duration}s ===`);
  console.log(`  Total feeds: ${stats.totalFeeds}`);
  console.log(`  Successful: ${stats.successfulFeeds}`);
  console.log(`  Failed: ${stats.failedFeeds}`);
  console.log(`  New items: ${stats.totalNewItems}`);
  console.log(`  Synced to Gorse: ${stats.syncedToGorse}`);
  
  return {
    status: 'complete',
    newItems: stats.totalNewItems,
    syncedToGorse: stats.syncedToGorse,
    duration: parseFloat(duration),
    ...(debug && { details: stats }),
    ...(stats.errors.length > 0 && { errors: stats.errors }),
  };
}

/**
 * Test a single feed
 */
async function testFeed(feedUrl, db) {
  console.log(`Testing feed: ${feedUrl}`);
  
  try {
    const feed = await parser.parseURL(feedUrl);
    
    return {
      success: true,
      feedUrl,
      title: feed.title,
      itemCount: feed.items.length,
      items: feed.items.slice(0, 5).map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.isoDate || item.pubDate,
      })),
    };
  } catch (error) {
    return {
      success: false,
      feedUrl,
      error: error.message,
    };
  }
}

/**
 * Get content count from Firestore
 */
async function getContentCount(db) {
  try {
    const snapshot = await db.collection('content').count().get();
    return {
      success: true,
      count: snapshot.data().count,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  ingestAllFeeds,
  testFeed,
  getContentCount,
  FEED_SOURCES,
};
