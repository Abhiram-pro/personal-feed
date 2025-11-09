# Design Document: Large-Scale Content Collection Pipeline

## Overview

The content collection pipeline is a modular, scalable system that fetches content from 15+ sources, normalizes data, deduplicates, stores in Firestore, and syncs to Gorse for ML recommendations.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Express HTTP Server                       │
│  POST /collect  │  GET /collect/test  │  GET /health        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Content Collection Orchestrator                 │
│                  (collectAllContent)                         │
│  - Concurrency pool (5 max)                                 │
│  - Metrics tracking                                          │
│  - Error aggregation                                         │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    ┌────────┐     ┌────────┐     ┌────────┐
    │ News   │     │ AI/Tech│     │Science │
    │Fetchers│     │Fetchers│     │Fetchers│
    └────┬───┘     └────┬───┘     └────┬───┘
         │              │              │
         ▼               ▼               ▼
    ┌────────┐     ┌────────┐     ┌────────┐
    │ Poetry │     │  Env   │     │ Rate   │
    │Fetchers│     │Fetchers│     │Limiter │
    └────┬───┘     └────┬───┘     └────┬───┘
         │              │              │
         └──────────────┼──────────────┘
                        ▼
              ┌──────────────────┐
              │   Normalizer     │
              │  - Clean HTML    │
              │  - Extract text  │
              │  - Generate ID   │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │  Deduplicator    │
              │  - URL hash      │
              │  - Check exists  │
              └────────┬─────────┘
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
    ┌─────────────┐         ┌──────────┐
    │  Firestore  │         │  Gorse   │
    │   content   │────────▶│  /items  │
    └─────────────┘         └──────────┘
```

## Components

### 1. Collector Module (`collector.js`)

**Responsibilities:**
- Orchestrate content collection from all sources
- Manage concurrency and rate limiting
- Normalize and deduplicate content
- Write to Firestore and sync to Gorse

**Key Functions:**
- `collectAllContent()` - Main orchestrator
- `fetchNewsContent()` - News sources
- `fetchAITechContent()` - AI/Tech sources
- `fetchScienceContent()` - Science sources
- `fetchPoetryContent()` - Poetry sources
- `fetchEnvironmentContent()` - Environment sources
- `normalizeContent()` - Data normalization
- `generateDocId()` - Deduplication ID
- `syncToGorse()` - Gorse synchronization

### 2. Rate Limiter

**Implementation:**
- Per-host request tracking
- Token bucket algorithm
- Max 10 requests/second per host
- Exponential backoff on 429/5xx

### 3. Fetcher Types

**RSS Fetchers:**
- Use `rss-parser` library
- Parse feed items
- Extract title, description, link, pubDate
- Handle malformed feeds gracefully

**API Fetchers:**
- NewsAPI.org - REST API with API key
- Guardian API - REST API with API key
- arXiv API - XML API with query parameters

**Dataset Fetchers:**
- Project Gutenberg - RDF catalog parsing
- GDELT - CSV/API (placeholder)

## Data Models

### Content Document (Firestore)

```javascript
{
  // Document ID: hash of normalized URL
  title: string,              // Article/poem title
  excerpt: string,            // Max 200 chars
  plain_text: string,         // Full text if allowed
  tags: string[],             // ['ai', 'technology']
  publishedAt: Timestamp,     // Firestore Timestamp
  source: string,             // Source URL/name
  url: string,                // Original URL
  license: string,            // 'public-domain' | 'rss' | 'restricted' | 'api'
  contentType: string,        // 'article' | 'poem'
  createdAt: Timestamp,       // When added to Firestore
  important: boolean          // Default false
}
```

### Collection Metrics (Firestore)

```javascript
// Document: collection_metrics/latest
{
  timestamp: Timestamp,
  feedsAttempted: number,
  feedsSucceeded: number,
  newItemsAdded: number,
  totalItemsInFirestore: number,
  duration: number,           // milliseconds
  errors: Array<{
    source: string,
    error: string
  }>
}
```

### Last Collection Run (Firestore)

```javascript
// Document: last_collection_run/state
{
  timestamp: Timestamp,
  totalItems: number,
  perSourceStats: {
    'newsapi': { attempted: 3, succeeded: 2, items: 45 },
    'guardian': { attempted: 1, succeeded: 1, items: 20 },
    // ...
  }
}
```

### Gorse Item Format

```javascript
{
  ItemId: string,             // Same as Firestore doc ID
  IsHidden: boolean,          // false
  Categories: string[],       // Same as tags
  Timestamp: string,          // ISO 8601
  Labels: string[],           // ['important'] if applicable
  Comment: string             // Title
}
```

## Error Handling

### Retry Strategy

```javascript
const retryWithBackoff = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 || error.status >= 500) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
};
```

### Error Isolation

- Each fetcher runs in try-catch
- Failed fetchers don't stop others
- Errors logged and aggregated
- Partial success is acceptable

## Concurrency Control

```javascript
const pLimit = require('p-limit');
const limit = pLimit(FETCH_CONCURRENCY); // Default 5

const promises = sources.map(source => 
  limit(() => fetchFromSource(source))
);

await Promise.allSettled(promises);
```

## Deduplication Strategy

```javascript
const crypto = require('crypto');

function generateDocId(url) {
  // Normalize URL
  const normalized = url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(/[^a-z0-9]/g, '_');
  
  // Hash for consistent length
  const hash = crypto
    .createHash('md5')
    .update(normalized)
    .digest('hex')
    .substring(0, 20);
  
  return hash;
}
```

## Rate Limiting Implementation

```javascript
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
    
    // Remove old timestamps
    while (queue.length && queue[0] < now - 1000) {
      queue.shift();
    }
    
    // Check limit
    if (queue.length >= this.maxPerSecond) {
      const oldestTimestamp = queue[0];
      const delay = 1000 - (now - oldestTimestamp);
      await sleep(delay);
    }
    
    queue.push(Date.now());
  }
}
```

## Testing Strategy

### Unit Tests
- Test each fetcher independently
- Mock external APIs
- Verify normalization logic
- Test deduplication

### Integration Tests
- Test end-to-end collection
- Verify Firestore writes
- Verify Gorse sync
- Test error handling

### Manual Testing
- Use `/collect/test?source=guardian`
- Use dry-run mode: `/collect?dry=true`
- Monitor logs for errors
- Check Firestore console

## Performance Considerations

### Optimization Strategies

1. **Batch Writes**
   - Collect items in memory
   - Write to Firestore in batches of 500
   - Reduces write operations

2. **Parallel Fetching**
   - Use concurrency limit (5)
   - Prevents overwhelming system
   - Balances speed and safety

3. **Caching**
   - Cache feed results for 1 hour
   - Reduces redundant fetches
   - Improves response time

4. **Incremental Collection**
   - Track last fetch timestamp per source
   - Only fetch new items
   - Reduces processing time

### Scalability

- **Horizontal**: Run multiple instances with different source groups
- **Vertical**: Increase FETCH_CONCURRENCY for more powerful servers
- **Sharding**: Partition sources across multiple collectors

## Security Considerations

1. **API Keys**
   - Store in environment variables
   - Never commit to version control
   - Rotate regularly

2. **Rate Limiting**
   - Respect external API limits
   - Implement backoff strategies
   - Monitor for abuse

3. **Input Validation**
   - Sanitize all external content
   - Strip malicious HTML
   - Validate URLs

4. **Error Exposure**
   - Don't expose internal errors to clients
   - Log detailed errors server-side
   - Return generic error messages

## Monitoring & Observability

### Metrics to Track

- Items collected per source
- Success/failure rates
- Average fetch time per source
- Firestore write latency
- Gorse sync latency
- Error rates by type

### Logging Format

```javascript
{
  timestamp: '2025-11-09T10:30:00Z',
  level: 'info',
  source: 'newsapi',
  action: 'fetch_complete',
  itemsFound: 45,
  itemsNew: 12,
  duration: 2340
}
```

## Deployment

### Environment Variables

```bash
FIREBASE_SERVICE_ACCOUNT_JSON='{...}'
GORSE_BASE_URL=http://localhost:8087
NEWSAPI_KEY=your_key_here
GUARDIAN_API_KEY=your_key_here
AUTO_COLLECT_INTERVAL_MINUTES=360
MAX_NEW_ITEMS_PER_RUN=2000
FETCH_CONCURRENCY=5
FETCH_TIMEOUT_MS=10000
```

### Startup Sequence

1. Load environment variables
2. Initialize Firebase Admin SDK
3. Verify Gorse connectivity
4. Start Express server
5. Schedule automatic collection
6. Log ready status

## Future Enhancements

1. **Machine Learning**
   - Content quality scoring
   - Automatic tagging
   - Duplicate detection improvements

2. **Additional Sources**
   - Twitter/X API
   - Reddit API
   - Academic databases

3. **Advanced Features**
   - Content summarization
   - Image extraction
   - Multi-language support

4. **Performance**
   - Distributed collection
   - Message queue integration
   - Real-time streaming
