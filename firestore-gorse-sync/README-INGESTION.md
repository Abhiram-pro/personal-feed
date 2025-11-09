# Content Ingestion Guide

## Overview

The firestore-gorse-sync service now includes automatic content ingestion from RSS feeds and public APIs. This eliminates the need to manually seed content and keeps your recommendation system fresh with real articles, news, and poetry.

## RSS Feed Sources

The service automatically ingests from 13+ curated feeds across 4 categories:

**AI & Technology:**
- Medium AI Tag
- Towards Data Science
- Ars Technica

**Science & Health:**
- Science Daily
- Nature News
- NIH News Releases

**Poetry & Literature:**
- Poetry Foundation
- LitHub
- The Paris Review
- The Marginalian

**Environment:**
- NASA Earth Observatory
- UNEP News

## API Endpoints

### POST /sync

Ingest content from RSS feeds and sync to Firestore + Gorse.

**Request:**
```bash
curl -X POST http://localhost:3000/sync \
  -H "Content-Type: application/json" \
  -d '{"mode":"full"}'
```

**Parameters:**
- `mode` (optional): `"full"` or `"incremental"` (default: `"full"`)
  - `full`: Fetch all feeds regardless of cooldown
  - `incremental`: Respect 1-hour cooldown per feed
- `debug` (optional): `true` or `false` - Include detailed feed-by-feed stats

**Response:**
```json
{
  "status": "complete",
  "newItems": 45,
  "syncedToGorse": 45,
  "duration": 12.34
}
```

**With debug=true:**
```bash
curl -X POST http://localhost:3000/sync \
  -H "Content-Type: application/json" \
  -d '{"mode":"full","debug":true}'
```

Response includes:
```json
{
  "status": "complete",
  "newItems": 45,
  "syncedToGorse": 45,
  "duration": 12.34,
  "details": {
    "totalFeeds": 13,
    "successfulFeeds": 12,
    "failedFeeds": 1,
    "feedDetails": [
      {
        "feedUrl": "https://medium.com/feed/tag/artificial-intelligence",
        "category": "ai-tech",
        "totalItems": 25,
        "newItems": 8
      }
    ]
  },
  "errors": [
    {
      "feedUrl": "https://example.com/feed",
      "error": "Request timeout"
    }
  ]
}
```

### GET /feeds/test

Test a single RSS feed without storing data.

**Request:**
```bash
curl "http://localhost:3000/feeds/test?url=https://medium.com/feed/tag/artificial-intelligence"
```

**Response:**
```json
{
  "success": true,
  "feedUrl": "https://medium.com/feed/tag/artificial-intelligence",
  "title": "Stories tagged with Artificial Intelligence",
  "itemCount": 25,
  "items": [
    {
      "title": "The Future of AI",
      "link": "https://medium.com/...",
      "pubDate": "2025-11-07T10:00:00.000Z"
    }
  ]
}
```

### GET /content/count

Get total number of content items in Firestore.

**Request:**
```bash
curl http://localhost:3000/content/count
```

**Response:**
```json
{
  "success": true,
  "count": 127
}
```

## Environment Variables

Add to your `.env` file:

```bash
# Content Ingestion Configuration
AUTO_SYNC_INTERVAL_MINUTES=0    # Set to enable automatic ingestion (e.g., 60 for hourly)
MAX_ITEMS_PER_SYNC=500          # Maximum items to ingest per sync run
```

## Automatic Ingestion

To enable automatic background ingestion, set `AUTO_SYNC_INTERVAL_MINUTES`:

```bash
# Run ingestion every 6 hours
AUTO_SYNC_INTERVAL_MINUTES=360
```

The service will automatically:
1. Fetch new content from all RSS feeds
2. Store in Firestore `content` collection
3. Sync to Gorse for recommendations
4. Respect 1-hour cooldown per feed to avoid rate limits

## Content Structure

Each ingested item is stored in Firestore with:

```javascript
{
  title: "Article Title",
  excerpt: "First 300 characters of content...",
  plain_text: "First 500 characters of plain text...",
  tags: ["ai", "technology"],
  publishedAt: Timestamp,
  source: "https://feed-url.com/rss",
  url: "https://article-url.com",
  important: false,
  contentType: "article",
  createdAt: Timestamp
}
```

## Safety Features

1. **Deduplication**: Uses URL/GUID as document ID to prevent duplicates
2. **Rate Limiting**: 1-hour cooldown per feed in incremental mode
3. **Item Cap**: Maximum 500 items per sync run (configurable)
4. **Error Handling**: Failed feeds don't stop the entire sync
5. **Timeout Protection**: 10-second timeout per feed request

## Usage Examples

### Initial Content Population

```bash
# First time setup - fetch all content
curl -X POST http://localhost:3000/sync \
  -H "Content-Type: application/json" \
  -d '{"mode":"full"}'
```

### Daily Updates

```bash
# Incremental sync (respects cooldowns)
curl -X POST http://localhost:3000/sync \
  -H "Content-Type: application/json" \
  -d '{"mode":"incremental"}'
```

### Debugging Feed Issues

```bash
# Test a specific feed
curl "http://localhost:3000/feeds/test?url=https://medium.com/feed/tag/artificial-intelligence"

# Run sync with debug info
curl -X POST http://localhost:3000/sync \
  -H "Content-Type: application/json" \
  -d '{"mode":"full","debug":true}'
```

### Check Content Status

```bash
# See how many items are in Firestore
curl http://localhost:3000/content/count

# Check service health
curl http://localhost:3000/health
```

## Workflow

1. **Start the service:**
   ```bash
   npm start
   ```

2. **Run initial ingestion:**
   ```bash
   curl -X POST http://localhost:3000/sync -H "Content-Type: application/json" -d '{"mode":"full"}'
   ```

3. **Wait for completion** (usually 10-30 seconds depending on feeds)

4. **Verify content:**
   ```bash
   curl http://localhost:3000/content/count
   ```

5. **Test recommendations in your app** - Pull to refresh in the Feed tab

6. **(Optional) Enable auto-sync:**
   - Set `AUTO_SYNC_INTERVAL_MINUTES=360` in `.env`
   - Restart service
   - Content will auto-update every 6 hours

## Troubleshooting

**No new items found:**
- Check if content already exists: `curl http://localhost:3000/content/count`
- Try with `debug=true` to see feed-by-feed results
- Test individual feeds with `/feeds/test`

**Feed timeout errors:**
- Some feeds may be slow or temporarily unavailable
- Failed feeds don't stop the sync - other feeds will continue
- Check the `errors` array in the response

**Rate limiting:**
- Feeds have 1-hour cooldown in incremental mode
- Use `mode=full` to bypass cooldowns (use sparingly)
- Adjust `MAX_ITEMS_PER_SYNC` if hitting limits

**Gorse sync failures:**
- Check Gorse is running: `curl http://localhost:8087/api/items?n=1`
- Verify `GORSE_BASE_URL` in `.env`
- Content is still saved to Firestore even if Gorse sync fails

## Adding Custom Feeds

Edit `ingestion.js` and add to `FEED_SOURCES`:

```javascript
'custom-category': {
  feeds: [
    'https://your-feed-url.com/rss',
  ],
  tags: ['custom', 'category'],
},
```

Restart the service and run `/sync`.
