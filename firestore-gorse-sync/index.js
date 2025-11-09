/**
 * Firestore-Gorse Sync Service
 * 
 * Syncs Firestore content, users, and interactions with Gorse recommender system
 * and provides an HTTP API for fetching personalized recommendations.
 */

require('dotenv').config();

const express = require('express');
const fetch = require('node-fetch');
const admin = require('firebase-admin');
const { ingestAllFeeds, testFeed, getContentCount } = require('./ingestion');
const { parseArticle } = require('./article-parser');
const { collectAllContent, testSource } = require('./collector');

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.PORT || 3000;
const GORSE_BASE_URL = process.env.GORSE_BASE_URL || 'http://localhost:8087';
const GORSE_API_KEY = process.env.GORSE_API_KEY || '';
const SYNC_PAGE_SIZE = parseInt(process.env.SYNC_PAGE_SIZE || '500', 10);
const SYNC_INTERVAL_MINUTES = parseInt(process.env.SYNC_INTERVAL_MINUTES || '10', 10);
const AUTO_SYNC_INTERVAL_MINUTES = parseInt(process.env.AUTO_SYNC_INTERVAL_MINUTES || '0', 10);
const AUTO_COLLECT_INTERVAL_MINUTES = parseInt(process.env.AUTO_COLLECT_INTERVAL_MINUTES || '360', 10);
const ENABLE_FIRESTORE_LISTENER = process.env.ENABLE_FIRESTORE_LISTENER === 'true';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MS = 1 * 1000; // 1 second
const INTERACTION_LOOKBACK_DAYS = 90;

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

let db;

function initializeFirebase() {
  if (admin.apps.length === 0) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    
    if (!serviceAccountJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is required');
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  
  db = admin.firestore();
  console.log('✓ Firebase Admin SDK initialized');
}

// ============================================================================
// GORSE API CLIENT
// ============================================================================

async function gorseRequest(endpoint, method = 'GET', body = null) {
  const url = `${GORSE_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (GORSE_API_KEY) {
    headers['X-API-Key'] = GORSE_API_KEY;
  }
  
  const options = {
    method,
    headers,
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gorse API error (${response.status}): ${text}`);
  }
  
  return response.json();
}

async function checkGorseHealth() {
  try {
    // Try to get items - if this works, Gorse is healthy
    await gorseRequest('/api/items?n=1');
    return true;
  } catch (error) {
    console.error('Gorse health check failed:', error.message);
    return false;
  }
}


// ============================================================================
// FIRESTORE → GORSE SYNC FUNCTIONS
// ============================================================================

/**
 * Sync all content items from Firestore to Gorse
 */
async function syncAllItems() {
  console.log('Starting content sync to Gorse...');
  
  let totalSynced = 0;
  let lastDoc = null;
  
  try {
    while (true) {
      let query = db.collection('content')
        .orderBy('publishedAt', 'desc')
        .limit(SYNC_PAGE_SIZE);
      
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        break;
      }
      
      const items = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const publishedAt = data.publishedAt?.toDate() || new Date();
        
        items.push({
          ItemId: doc.id,
          IsHidden: false,
          Categories: data.tags || [],
          Timestamp: publishedAt.toISOString(),
          Labels: data.important ? ['important'] : [],
          Comment: data.title || '',
        });
      });
      
      // Batch insert to Gorse
      if (items.length > 0) {
        await gorseRequest('/api/items', 'POST', items);
        totalSynced += items.length;
        console.log(`  Synced ${totalSynced} items...`);
      }
      
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      
      if (snapshot.size < SYNC_PAGE_SIZE) {
        break;
      }
    }
    
    // Update sync metadata
    await db.collection('sync_meta').doc('items').set({
      lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      totalSynced,
    }, { merge: true });
    
    console.log(`✓ Content sync complete: ${totalSynced} items`);
    return { success: true, totalSynced };
    
  } catch (error) {
    console.error('Error syncing items:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sync all users from Firestore to Gorse
 */
async function syncAllUsers() {
  console.log('Starting users sync to Gorse...');
  
  let totalSynced = 0;
  let lastDoc = null;
  
  try {
    while (true) {
      let query = db.collection('users')
        .limit(SYNC_PAGE_SIZE);
      
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        break;
      }
      
      const users = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        
        users.push({
          UserId: doc.id,
          Labels: data.interests || [],
          Comment: data.displayName || '',
        });
      });
      
      // Batch insert to Gorse
      if (users.length > 0) {
        await gorseRequest('/api/users', 'POST', users);
        totalSynced += users.length;
        console.log(`  Synced ${totalSynced} users...`);
      }
      
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      
      if (snapshot.size < SYNC_PAGE_SIZE) {
        break;
      }
    }
    
    // Update sync metadata
    await db.collection('sync_meta').doc('users').set({
      lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      totalSynced,
    }, { merge: true });
    
    console.log(`✓ Users sync complete: ${totalSynced} users`);
    return { success: true, totalSynced };
    
  } catch (error) {
    console.error('Error syncing users:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sync recent interactions from Firestore to Gorse
 */
async function syncRecentInteractions(daysBack = INTERACTION_LOOKBACK_DAYS) {
  console.log(`Starting interactions sync (last ${daysBack} days)...`);
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  
  let totalSynced = 0;
  let lastDoc = null;
  
  try {
    while (true) {
      let query = db.collection('interactions')
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(cutoffDate))
        .orderBy('timestamp', 'desc')
        .limit(SYNC_PAGE_SIZE);
      
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        break;
      }
      
      const feedback = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate() || new Date();
        
        feedback.push({
          FeedbackType: data.type, // 'view', 'like', 'save', 'dismiss'
          UserId: data.userId,
          ItemId: data.contentId,
          Timestamp: timestamp.toISOString(),
        });
      });
      
      // Batch insert to Gorse
      if (feedback.length > 0) {
        await gorseRequest('/api/feedback', 'POST', feedback);
        totalSynced += feedback.length;
        console.log(`  Synced ${totalSynced} interactions...`);
      }
      
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      
      if (snapshot.size < SYNC_PAGE_SIZE) {
        break;
      }
    }
    
    // Update sync metadata
    await db.collection('sync_meta').doc('interactions').set({
      lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      totalSynced,
    }, { merge: true });
    
    console.log(`✓ Interactions sync complete: ${totalSynced} interactions`);
    return { success: true, totalSynced };
    
  } catch (error) {
    console.error('Error syncing interactions:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Run full sync (items, users, interactions)
 */
async function runFullSync() {
  console.log('=== Starting full sync ===');
  const startTime = Date.now();
  
  const results = {
    items: await syncAllItems(),
    users: await syncAllUsers(),
    interactions: await syncRecentInteractions(),
  };
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`=== Full sync complete in ${duration}s ===`);
  
  return results;
}


// ============================================================================
// RECOMMENDATION ENGINE
// ============================================================================

// In-memory cache
const cache = new Map();

function getCacheKey(uid, count) {
  return `${uid}:${count}`;
}

function getCachedRecommendations(uid, count) {
  const key = getCacheKey(uid, count);
  const cached = cache.get(key);
  
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  
  return cached.data;
}

function setCachedRecommendations(uid, count, data) {
  const key = getCacheKey(uid, count);
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

function invalidateCache(uid) {
  const keysToDelete = [];
  for (const key of cache.keys()) {
    if (key.startsWith(`${uid}:`)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => cache.delete(key));
}

// Rate limiting
const rateLimitMap = new Map();

function checkRateLimit(uid) {
  const now = Date.now();
  const lastCall = rateLimitMap.get(uid);
  
  if (lastCall && now - lastCall < RATE_LIMIT_MS) {
    return false;
  }
  
  rateLimitMap.set(uid, now);
  return true;
}

/**
 * Fallback recommendation logic (when Gorse is unavailable)
 */
async function getFallbackRecommendations(uid, count) {
  console.log(`Using fallback recommendations for user ${uid}`);
  
  // Get user interests
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    return { items: [], source: 'fallback', reason: 'user_not_found' };
  }
  
  const userInterests = userDoc.data().interests || [];
  if (userInterests.length === 0) {
    return { items: [], source: 'fallback', reason: 'no_interests' };
  }
  
  // Get recent content
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 120);
  
  const contentSnapshot = await db.collection('content')
    .where('publishedAt', '>=', admin.firestore.Timestamp.fromDate(cutoffDate))
    .orderBy('publishedAt', 'desc')
    .limit(300)
    .get();
  
  if (contentSnapshot.empty) {
    return { items: [], source: 'fallback', reason: 'no_content' };
  }
  
  // Score each item with aggressive interest matching
  const scoredItems = [];
  contentSnapshot.forEach(doc => {
    const data = doc.data();
    const tags = data.tags || [];
    const publishedAt = data.publishedAt?.toDate() || new Date();
    
    // Aggressive tag matching - heavily weight interest matches
    const tagMatchCount = tags.filter(tag => userInterests.includes(tag)).length;
    const tagMatchScore = tagMatchCount * 10; // 10 points per matching tag
    
    // Partial tag matching - check if any user interest is substring of content tags
    const partialMatches = tags.filter(tag => 
      userInterests.some(interest => 
        tag.toLowerCase().includes(interest.toLowerCase()) || 
        interest.toLowerCase().includes(tag.toLowerCase())
      )
    ).length;
    const partialMatchScore = partialMatches * 5; // 5 points per partial match
    
    // Recency boost - favor recent content
    const daysSince = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24);
    const recencyBoost = Math.max(0, 5 - daysSince / 7); // Up to 5 points for very recent
    
    // Important boost
    const importanceBoost = data.important ? 3 : 0;
    
    // Diversity penalty - slightly reduce score if content type is overrepresented
    const contentTypeBoost = data.contentType === 'article' ? 1 : 0.8;
    
    const score = (tagMatchScore + partialMatchScore + recencyBoost + importanceBoost) * contentTypeBoost;
    
    // Only include items with at least some interest match
    if (tagMatchCount > 0 || partialMatches > 0) {
      scoredItems.push({
        contentId: doc.id,
        score,
        title: data.title,
        excerpt: data.excerpt,
        tags: data.tags,
        publishedAt: publishedAt.toISOString(),
        url: data.url,
      });
    }
  });
  
  // Sort and limit
  scoredItems.sort((a, b) => b.score - a.score);
  const items = scoredItems.slice(0, count);
  
  return { items, source: 'fallback' };
}

/**
 * Get recommendations for a user (Gorse or fallback)
 */
async function getRecommendationsForUser(uid, count = 20) {
  // Check cache
  const cached = getCachedRecommendations(uid, count);
  if (cached) {
    return { ...cached, cached: true };
  }
  
  try {
    // Try Gorse first with aggressive parameters
    // write-back-type=read: prioritize user's reading history
    // write-back-delay=0: no delay in applying feedback
    const gorseRecommendations = await gorseRequest(
      `/api/recommend/${uid}?n=${count * 2}&write-back-type=read&write-back-delay=0`
    );
    
    // Resolve item IDs to Firestore documents
    const itemIds = gorseRecommendations.map(rec => rec.Id || rec).slice(0, count);
    
    if (itemIds.length === 0) {
      // No recommendations from Gorse, use fallback
      return getFallbackRecommendations(uid, count);
    }
    
    // Get user interests for relevance filtering
    const userDoc = await db.collection('users').doc(uid).get();
    const userInterests = userDoc.exists ? (userDoc.data().interests || []) : [];
    
    // Batch get from Firestore
    const contentRefs = itemIds.map(id => db.collection('content').doc(id));
    const contentDocs = await db.getAll(...contentRefs);
    
    const items = [];
    contentDocs.forEach((doc, idx) => {
      if (doc.exists) {
        const data = doc.data();
        const publishedAt = data.publishedAt?.toDate();
        const tags = data.tags || [];
        
        // Check relevance - must have at least one matching tag or partial match
        const hasExactMatch = tags.some(tag => userInterests.includes(tag.toLowerCase()));
        const hasPartialMatch = tags.some(tag => 
          userInterests.some(interest => 
            tag.toLowerCase().includes(interest.toLowerCase()) || 
            interest.toLowerCase().includes(tag.toLowerCase())
          )
        );
        
        // Only include if relevant to user interests
        if (userInterests.length === 0 || hasExactMatch || hasPartialMatch) {
          items.push({
            contentId: doc.id,
            score: gorseRecommendations[idx].Score || 1.0,
            title: data.title,
            excerpt: data.excerpt,
            tags: data.tags,
            publishedAt: publishedAt?.toISOString(),
            url: data.url,
          });
        }
      }
    });
    
    // If we need more items, get from fallback
    if (items.length < count && userInterests.length > 0) {
      console.log(`📊 Gorse provided ${items.length} items, adding ${count - items.length} more from fallback for variety`);
      const fallbackResult = await getFallbackRecommendations(uid, count - items.length);
      items.push(...fallbackResult.items);
    }
    
    const result = { items: items.slice(0, count), source: 'gorse' };
    
    // Cache the result
    setCachedRecommendations(uid, count, result);
    
    return result;
    
  } catch (error) {
    console.error('Gorse recommendation failed, using fallback:', error.message);
    return getFallbackRecommendations(uid, count);
  }
}


// ============================================================================
// EXPRESS SERVER
// ============================================================================

const app = express();
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  const firestoreHealthy = !!db;
  const gorseHealthy = await checkGorseHealth();
  
  res.json({
    status: firestoreHealthy && gorseHealthy ? 'healthy' : 'degraded',
    firestore: firestoreHealthy ? 'connected' : 'disconnected',
    gorse: gorseHealthy ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Recommendations endpoint
app.get('/recommendations', async (req, res) => {
  try {
    const { uid, count = 20 } = req.query;
    
    if (!uid) {
      return res.status(400).json({ error: 'uid parameter is required' });
    }
    
    // Check rate limit
    if (!checkRateLimit(uid)) {
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: 'Please wait before making another request',
      });
    }
    
    const recommendations = await getRecommendationsForUser(uid, parseInt(count, 10));
    res.json(recommendations);
    
  } catch (error) {
    console.error('Error in /recommendations:', error);
    res.status(500).json({
      error: 'internal_error',
      message: error.message,
    });
  }
});

// Content ingestion and sync endpoint
app.post('/sync', async (req, res) => {
  try {
    const { mode = 'full', debug = false } = req.body;
    
    // Run content ingestion
    const result = await ingestAllFeeds(db, gorseRequest, { mode, debug });
    
    res.json(result);
  } catch (error) {
    console.error('Error in /sync:', error);
    res.status(500).json({
      error: 'sync_failed',
      message: error.message,
    });
  }
});

// Manual Firestore → Gorse sync (legacy endpoint)
app.post('/sync-firestore', async (req, res) => {
  try {
    const { type = 'full' } = req.body;
    
    let result;
    if (type === 'items') {
      result = await syncAllItems();
    } else if (type === 'users') {
      result = await syncAllUsers();
    } else if (type === 'interactions') {
      result = await syncRecentInteractions();
    } else {
      result = await runFullSync();
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error in /sync-firestore:', error);
    res.status(500).json({
      error: 'sync_failed',
      message: error.message,
    });
  }
});

// Test a single feed
app.get('/feeds/test', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'url parameter is required' });
    }
    
    const result = await testFeed(url, db);
    res.json(result);
  } catch (error) {
    console.error('Error in /feeds/test:', error);
    res.status(500).json({
      error: 'test_failed',
      message: error.message,
    });
  }
});

// Get content count
app.get('/content/count', async (req, res) => {
  try {
    const result = await getContentCount(db);
    res.json(result);
  } catch (error) {
    console.error('Error in /content/count:', error);
    res.status(500).json({
      error: 'count_failed',
      message: error.message,
    });
  }
});

// Parse article content
app.get('/article/parse', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'url parameter is required' });
    }
    
    const result = await parseArticle(url);
    res.json(result);
  } catch (error) {
    console.error('Error in /article/parse:', error);
    res.status(500).json({
      error: 'parse_failed',
      message: error.message,
    });
  }
});

// Normalize user interests to lowercase (one-time migration)
app.post('/normalize-interests', async (req, res) => {
  try {
    console.log('Normalizing user interests to lowercase...');
    
    const usersSnapshot = await db.collection('users').get();
    let updated = 0;
    
    const batch = db.batch();
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.interests && Array.isArray(data.interests)) {
        const normalizedInterests = data.interests.map(interest => 
          typeof interest === 'string' ? interest.toLowerCase() : interest
        );
        
        // Only update if there's a difference
        if (JSON.stringify(data.interests) !== JSON.stringify(normalizedInterests)) {
          batch.update(doc.ref, { interests: normalizedInterests });
          updated++;
        }
      }
    });
    
    await batch.commit();
    
    // Also sync to Gorse
    await syncAllUsers();
    
    console.log(`✓ Normalized ${updated} users' interests`);
    res.json({ success: true, usersUpdated: updated });
  } catch (error) {
    console.error('Error normalizing interests:', error);
    res.status(500).json({ error: error.message });
  }
});

// Large-scale content collection endpoint
app.post('/collect', async (req, res) => {
  try {
    const { sources, dry = false } = req.body || {};
    
    const result = await collectAllContent(db, gorseRequest, { sources, dry });
    res.json(result);
  } catch (error) {
    console.error('Error in /collect:', error);
    res.status(500).json({
      error: 'collection_failed',
      message: error.message,
    });
  }
});

// Test single source
app.get('/collect/test', async (req, res) => {
  try {
    const { source } = req.query;
    
    if (!source) {
      return res.status(400).json({ 
        error: 'source parameter is required',
        availableSources: ['bbc', 'reuters', 'medium', 'verge', 'arxiv', 'newsapi', 'guardian']
      });
    }
    
    const result = await testSource(source);
    res.json(result);
  } catch (error) {
    console.error('Error in /collect/test:', error);
    res.status(500).json({
      error: 'test_failed',
      message: error.message,
    });
  }
});

// Cache invalidation
app.post('/invalidate-cache', async (req, res) => {
  const { uid } = req.body;
  
  if (!uid) {
    return res.status(400).json({ error: 'uid is required' });
  }
  
  try {
    invalidateCache(uid);
    // Also clear rate limit to allow immediate refresh
    rateLimitMap.delete(uid);
    
    // Sync user interests to Gorse immediately
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      await gorseRequest('/api/users', 'POST', [{
        UserId: uid,
        Labels: userData.interests || [],
        Comment: userData.displayName || '',
      }]);
      console.log(`✓ Synced interests to Gorse for user ${uid}:`, userData.interests);
    } else {
      console.log(`⚠️  User ${uid} not found in Firestore`);
    }
    
    res.json({ success: true, message: `Cache invalidated and interests synced for user ${uid}` });
  } catch (error) {
    console.error('Error in invalidate-cache:', error);
    // Still return success for cache invalidation even if Gorse sync fails
    res.json({ success: true, message: `Cache invalidated for user ${uid}`, gorseError: error.message });
  }
});

// Sync single interaction to Gorse immediately
app.post('/interaction/sync', async (req, res) => {
  try {
    const { userId, contentId, type } = req.body;
    
    if (!userId || !contentId || !type) {
      return res.status(400).json({ 
        error: 'userId, contentId, and type are required' 
      });
    }
    
    // Send to Gorse immediately
    await gorseRequest('/api/feedback', 'POST', [{
      FeedbackType: type,
      UserId: userId,
      ItemId: contentId,
      Timestamp: new Date().toISOString(),
    }]);
    
    // Invalidate user's recommendation cache
    invalidateCache(userId);
    
    res.json({ 
      success: true, 
      message: 'Interaction synced to Gorse' 
    });
  } catch (error) {
    console.error('Error syncing interaction:', error);
    res.status(500).json({
      error: 'sync_failed',
      message: error.message,
    });
  }
});

// ============================================================================
// STARTUP
// ============================================================================

async function startServer() {
  try {
    // Initialize Firebase
    initializeFirebase();
    
    // Check Gorse connection
    const gorseHealthy = await checkGorseHealth();
    if (!gorseHealthy) {
      console.warn('⚠️  Gorse is not reachable. Recommendations will use fallback mode.');
    } else {
      console.log('✓ Gorse connection verified');
      
      // Verify Firestore and Gorse are in sync
      console.log('🔍 Checking Firestore-Gorse sync status...');
      try {
        const firestoreCount = await db.collection('content').count().get();
        const firestoreTotal = firestoreCount.data().count;
        
        // Get Gorse item count (approximate)
        const gorseItems = await gorseRequest('/api/items?n=1');
        
        // If there's a significant difference, auto-sync
        if (firestoreTotal > 100) { // Only check if we have substantial content
          console.log(`  Firestore: ${firestoreTotal} items`);
          console.log(`  Syncing all items to Gorse to ensure consistency...`);
          
          // Run background sync without blocking startup
          syncAllItems().then(() => {
            console.log('✓ Background sync to Gorse completed');
          }).catch(err => {
            console.error('Background sync failed:', err.message);
          });
        }
      } catch (error) {
        console.log('  Could not verify sync status:', error.message);
      }
    }
    
    // Schedule automatic content ingestion (legacy)
    if (AUTO_SYNC_INTERVAL_MINUTES > 0) {
      setInterval(() => {
        console.log('Running scheduled content ingestion...');
        ingestAllFeeds(db, gorseRequest, { mode: 'incremental' }).catch(err => {
          console.error('Scheduled ingestion failed:', err);
        });
      }, AUTO_SYNC_INTERVAL_MINUTES * 60 * 1000);
      
      console.log(`✓ Scheduled auto-ingestion every ${AUTO_SYNC_INTERVAL_MINUTES} minutes`);
    }
    
    // Schedule automatic large-scale collection
    if (AUTO_COLLECT_INTERVAL_MINUTES > 0) {
      setInterval(() => {
        console.log('Running scheduled large-scale collection...');
        collectAllContent(db, gorseRequest, { dry: false }).catch(err => {
          console.error('Scheduled collection failed:', err);
        });
      }, AUTO_COLLECT_INTERVAL_MINUTES * 60 * 1000);
      
      console.log(`✓ Scheduled auto-collection every ${AUTO_COLLECT_INTERVAL_MINUTES} minutes`);
    }
    
    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`✓ Firestore-Gorse sync service listening on port ${PORT}`);
      console.log(`  Health: http://localhost:${PORT}/health`);
      console.log(`  Recommendations: http://localhost:${PORT}/recommendations?uid=USER_ID&count=20`);
      console.log(`  Manual sync: POST http://localhost:${PORT}/sync`);
      console.log(`  Gorse Dashboard: http://localhost:8088`);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start if run directly
if (require.main === module) {
  startServer();
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  syncAllItems,
  syncAllUsers,
  syncRecentInteractions,
  runFullSync,
  getRecommendationsForUser,
  invalidateCache,
};
