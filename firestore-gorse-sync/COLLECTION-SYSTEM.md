# Large-Scale Content Collection System

## Overview

The content collection system fetches diverse content from 15+ sources including news APIs, RSS feeds, and research databases. It normalizes, deduplicates, stores in Firestore, and syncs to Gorse for ML recommendations.

## Content Sources

### News & General (4 sources)
- **NewsAPI.org** - Science, technology, world news (requires API key)
- **The Guardian API** - Quality journalism (requires API key)
- **BBC News RSS** - Global news coverage
- **Reuters RSS** - World news and business

### AI & Technology (4 sources)
- **Medium AI** - AI articles and tutorials
- **Towards Data Science** - Data science and ML content
- **The Verge** - Tech news and reviews
- **Ars Technica** - In-depth tech analysis

### Science & Research (3 sources)
- **arXiv API** - Academic papers and preprints
- **Science Daily** - Science news
- **Nature News** - Research news

### Poetry & Literature (2 sources)
- **Poetry Foundation** - Curated poems
- **The Marginalian** - Essays and literature

### Environment (2 sources)
- **NASA Earth Observatory** - Climate and earth science
- **UNEP** - Environmental news

## API Endpoints

### POST /collect

Run large-scale content collection.

**Request:**
```bash
curl -X POST http://localhost:3000/collect \
  -H "Content-Type: application/json" \
  -d '{}'
```

**With options:**
```bash
# Dry run (fetch without writing)
curl -X POST http://localhost:3000/collect \
  -H "Content-Type: application/json" \
  -d '{"dry": true}'

# Specific sources only
curl -X POST http://localhost:3000/collect \
  -H "Content-Type: application/json" \
  -d '{"sources": ["news", "ai-tech"]}'
```

**Response:**
```json
{
  "status": "complete",
  "feedsAttempted": 15,
  "feedsSucceeded": 13,
  "newItemsAdded": 342,
  "totalItemsInFirestore": 1205,
  "syncedToGorse": 342,
  "duration": 45.23,
  "errors": [
    {
      "source": "https://www.nature.com/feeds/newsroom.xml",
      "error": "HTTP 403"
    }
  ]
}
```

### GET /collect/test

Test a single source without writing data.

**Request:**
```bash
curl "http://localhost:3000/collect/test?source=guardian"
```

**Available sources:**
- `bbc`, `reuters`, `medium`, `verge`, `arxiv`, `newsapi`, `guardian`

**Response:**
```json
{
  "success": true,
  "source": "Guardian",
  "itemCount": 50,
  "titles": [
    "AI breakthrough in medical diagnosis",
    "Climate summit reaches agreement",
    "..."
  ]
}
```

## Configuration

### Required Environment Variables

```bash
# Firebase (required)
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'

# Gorse (required)
GORSE_BASE_URL=http://localhost:8087
```

### Optional API Keys

Get better results with these API keys:

**NewsAPI.org:**
1. Sign up at https://newsapi.org/
2. Get free API key (500 requests/day)
3. Add to `.env`: `NEWSAPI_KEY=your_key_here`

**The Guardian:**
1. Register at https://open-platform.theguardian.com/
2. Get free API key
3. Add to `.env`: `GUARDIAN_API_KEY=your_key_here`

### Collection Settings

```bash
# Run collection automatically every 6 hours
AUTO_COLLECT_INTERVAL_MINUTES=360

# Maximum items to collect per run
MAX_NEW_ITEMS_PER_RUN=2000

# Concurrent fetches (5 recommended)
FETCH_CONCURRENCY=5

# Timeout for each fetch (10 seconds)
FETCH_TIMEOUT_MS=10000
```

## Features

### Deduplication
- Uses MD5 hash of normalized URL as document ID
- Automatically skips existing content
- Prevents duplicate storage

### Rate Limiting
- Maximum 10 requests per second per host
- Prevents overwhelming external services
- Respects API rate limits

### Error Handling
- Exponential backoff on 429 (rate limit) errors
- Retry up to 3 times on 5xx errors
- Failed sources don't stop collection
- All errors logged and returned

### Copyright Compliance
- Stores only excerpts (200 chars max) for restricted content
- Full text only for public domain
- License field tracks content rights
- Always includes source URL

### Metrics & Monitoring
- Tracks feeds attempted/succeeded
- Counts new vs existing items
- Stores metrics in Firestore
- Logs execution time

## Usage Examples

### Initial Population

```bash
# Collect from all sources
curl -X POST http://localhost:3000/collect
```

### Test Before Running

```bash
# Dry run - see what would be collected
curl -X POST http://localhost:3000/collect \
  -H "Content-Type: application/json" \
  -d '{"dry": true}'

# Test specific source
curl "http://localhost:3000/collect/test?source=medium"
```

### Targeted Collection

```bash
# Only collect news
curl -X POST http://localhost:3000/collect \
  -H "Content-Type: application/json" \
  -d '{"sources": ["news", "newsapi", "guardian"]}'

# Only collect AI/tech
curl -X POST http://localhost:3000/collect \
  -H "Content-Type: application/json" \
  -d '{"sources": ["ai-tech"]}'
```

### Check Results

```bash
# Total content count
curl http://localhost:3000/content/count

# View metrics in Firestore
# Collection: collection_metrics
# Document: latest
```

## Automatic Collection

Enable automatic collection by setting the interval:

```bash
# In .env file
AUTO_COLLECT_INTERVAL_MINUTES=360  # Every 6 hours
```

Restart the service and it will automatically:
1. Collect new content every 6 hours
2. Deduplicate against existing content
3. Sync to Gorse for recommendations
4. Store metrics for monitoring

## Data Structure

### Firestore Content Document

```javascript
{
  // Document ID: MD5 hash of normalized URL
  title: "Article Title",
  excerpt: "First 200 characters...",
  plain_text: "Full text or excerpt",
  tags: ["ai", "technology"],
  publishedAt: Timestamp,
  source: "https://source-url.com",
  url: "https://article-url.com",
  license: "rss" | "api" | "restricted" | "public-domain",
  contentType: "article" | "poem",
  important: false,
  createdAt: Timestamp
}
```

### Collection Metrics

```javascript
// Document: collection_metrics/latest
{
  timestamp: Timestamp,
  feedsAttempted: 15,
  feedsSucceeded: 13,
  newItemsAdded: 342,
  totalItemsInFirestore: 1205,
  syncedToGorse: 342,
  duration: 45230,
  errors: [...]
}
```

## Performance

### Typical Collection Run

- **Duration**: 30-60 seconds
- **Items collected**: 200-500 new items
- **Sources processed**: 15 feeds/APIs
- **Firestore writes**: Batched for efficiency
- **Gorse sync**: Single batch operation

### Scalability

- **Concurrency**: 5 simultaneous fetches
- **Rate limiting**: 10 req/sec per host
- **Max items**: 2000 per run (configurable)
- **Deduplication**: Prevents storage bloat

## Troubleshooting

### No new items collected

**Check:**
- Run with `dry=true` to see what would be collected
- Check if content already exists: `curl http://localhost:3000/content/count`
- Test individual sources: `curl "http://localhost:3000/collect/test?source=medium"`

### API errors (403, 401)

**Solution:**
- Add API keys to `.env` file
- NewsAPI: Get key from https://newsapi.org/
- Guardian: Get key from https://open-platform.theguardian.com/

### Rate limit errors (429)

**Automatic handling:**
- System automatically retries with exponential backoff
- Waits 1s, 2s, 4s between retries
- Continues with other sources

### Gorse sync failures

**Check:**
- Verify Gorse is running: `curl http://localhost:8087/api/items?n=1`
- Check `GORSE_BASE_URL` in `.env`
- Content is still saved to Firestore even if Gorse sync fails

### Slow collection

**Optimize:**
- Increase `FETCH_CONCURRENCY` (try 10)
- Decrease `FETCH_TIMEOUT_MS` (try 5000)
- Use `sources` parameter to collect specific categories only

## Monitoring

### View Metrics

```bash
# Check Firestore console
# Collection: collection_metrics
# Document: latest

# Or query via API
curl http://localhost:3000/content/count
```

### View Logs

Service logs show:
- Each source start/completion
- Items found per source
- Errors with details
- Summary statistics
- Execution time

### Gorse Dashboard

View recommendation stats:
```
http://localhost:8088
```

## Best Practices

1. **Start with dry run** to verify sources work
2. **Test individual sources** before full collection
3. **Add API keys** for better results
4. **Enable auto-collection** for continuous updates
5. **Monitor metrics** to track system health
6. **Check errors** and adjust sources as needed

## Example Workflow

```bash
# 1. Test a source
curl "http://localhost:3000/collect/test?source=medium"

# 2. Dry run to preview
curl -X POST http://localhost:3000/collect \
  -H "Content-Type: application/json" \
  -d '{"dry": true}'

# 3. Run actual collection
curl -X POST http://localhost:3000/collect

# 4. Check results
curl http://localhost:3000/content/count

# 5. Enable auto-collection
# Edit .env: AUTO_COLLECT_INTERVAL_MINUTES=360
# Restart service

# 6. Monitor in Gorse dashboard
open http://localhost:8088
```

## License Compliance

The system respects copyright:

- **RSS feeds**: Stores excerpt + URL (fair use)
- **API content**: Stores excerpt + URL per API terms
- **Public domain**: Can store full text
- **Restricted**: Excerpt only (200 chars max)

All content includes:
- Source attribution
- Original URL
- License metadata
- Publication date

## Next Steps

1. **Add API keys** for NewsAPI and Guardian (optional but recommended)
2. **Run initial collection**: `curl -X POST http://localhost:3000/collect`
3. **Enable auto-collection**: Set `AUTO_COLLECT_INTERVAL_MINUTES=360` in `.env`
4. **Monitor results**: Check `/content/count` and Firestore console
5. **Test recommendations**: Pull to refresh in your app

Your recommendation system will now have thousands of diverse articles for personalized recommendations!
