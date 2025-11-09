# Implementation Plan: Large-Scale Content Collection Pipeline

## Task Overview

This implementation plan breaks down the content collection pipeline into discrete, manageable coding steps that build incrementally.

- [x] 1. Set up core infrastructure and utilities
- [x] 1.1 Install required dependencies (p-limit, crypto)
  - Add p-limit for concurrency control
  - Use built-in crypto for hashing
  - _Requirements: 1.1, 9.1_

- [x] 1.2 Create rate limiter class
  - Implement token bucket algorithm
  - Track per-host request timestamps
  - Add throttle method with 10 req/sec limit
  - _Requirements: 9.3_

- [x] 1.3 Create content normalizer utility
  - Strip HTML tags
  - Limit excerpt to 200 characters
  - Generate document ID from URL hash
  - Convert timestamps to Firestore format
  - _Requirements: 7.1, 7.2, 7.3, 8.1_

- [x] 2. Implement RSS feed fetchers
- [x] 2.1 Create base RSS fetcher function
  - Use rss-parser library
  - Handle timeouts and errors
  - Return normalized items array
  - _Requirements: 2.3, 2.4, 3.1-3.4, 4.3, 5.1-5.2, 6.1-6.2_

- [x] 2.2 Implement News RSS fetchers
  - BBC News RSS
  - Reuters RSS
  - Tag with 'news', 'world'
  - _Requirements: 2.3, 2.4, 2.5_

- [x] 2.3 Implement AI/Tech RSS fetchers
  - Medium AI RSS
  - Towards Data Science RSS
  - The Verge RSS
  - Ars Technica RSS
  - Tag with 'ai', 'technology'
  - _Requirements: 3.1-3.5_

- [x] 2.4 Implement Science RSS fetchers
  - Science Daily RSS
  - Nature News RSS
  - Tag with 'science', 'research'
  - _Requirements: 4.3, 4.4, 4.5_

- [x] 2.5 Implement Poetry/Literature RSS fetchers
  - Poetry Foundation RSS
  - The Marginalian RSS
  - Tag with 'poetry', 'literature'
  - Set contentType to 'poem'
  - _Requirements: 5.1, 5.2, 5.4, 5.5_

- [x] 2.6 Implement Environment RSS fetchers
  - NASA Earth Observatory RSS
  - UNEP RSS
  - Tag with 'environment', 'climate'
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 3. Implement API fetchers
- [x] 3.1 Create NewsAPI.org fetcher
  - Use fetch with API key
  - Query for science, technology, world topics
  - Handle pagination
  - Set license to 'api'
  - _Requirements: 2.1, 2.5_

- [x] 3.2 Create Guardian API fetcher
  - Use fetch with API key
  - Query relevant sections
  - Parse Guardian-specific response format
  - Set license to 'api'
  - _Requirements: 2.2, 2.5_

- [x] 3.3 Create arXiv API fetcher
  - Query arXiv API with search parameters
  - Parse XML response
  - Limit to 50 results
  - Tag with 'science', 'research', 'academic'
  - Set license to 'restricted'
  - _Requirements: 4.1, 4.2, 4.5_

- [x] 4. Implement collection orchestrator
- [x] 4.1 Create collectAllContent function
  - Initialize metrics tracking
  - Create concurrency pool (limit 5)
  - Call all fetcher functions
  - Aggregate results
  - _Requirements: 1.1, 1.2_

- [x] 4.2 Implement deduplication logic
  - Check if document ID exists in Firestore
  - Skip existing items
  - Track new vs existing counts
  - _Requirements: 8.1, 8.2_

- [x] 4.3 Implement Firestore batch writes
  - Collect new items
  - Write in batches of 500
  - Limit to MAX_NEW_ITEMS_PER_RUN
  - _Requirements: 8.3, 8.4_

- [x] 4.4 Implement Gorse synchronization
  - Format items for Gorse API
  - Call /api/items/batch endpoint
  - Log sync count
  - Handle sync errors gracefully
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 4.5 Implement metrics collection
  - Track feedsAttempted, feedsSucceeded
  - Track newItemsAdded, totalItemsInFirestore
  - Store in collection_metrics/latest
  - Store in last_collection_run/state
  - _Requirements: 1.3, 1.4, 1.5_

- [x] 5. Add error handling and safety
- [x] 5.1 Implement exponential backoff
  - Detect 429 and 5xx responses
  - Calculate backoff delay
  - Retry up to 3 times
  - _Requirements: 9.4, 9.5_

- [x] 5.2 Add per-source error isolation
  - Wrap each fetcher in try-catch
  - Continue on individual failures
  - Aggregate errors for logging
  - _Requirements: 9.6_

- [x] 5.3 Add timeout handling
  - Set FETCH_TIMEOUT_MS for all requests
  - Cancel slow requests
  - Log timeout errors
  - _Requirements: 9.2_

- [x] 6. Implement HTTP endpoints
- [x] 6.1 Add POST /collect endpoint
  - Accept optional JSON body {sources, dry}
  - Call collectAllContent
  - Return collection statistics
  - _Requirements: 12.1, 12.2, 12.3_

- [x] 6.2 Add GET /collect/test endpoint
  - Accept query parameter 'source'
  - Run single fetcher
  - Return parsed titles only
  - _Requirements: 13.1, 13.2_

- [x] 6.3 Add dry-run mode support
  - Check for dry=true query parameter
  - Fetch and normalize without writing
  - Return what would be collected
  - _Requirements: 13.3, 13.4_

- [x] 6.4 Update GET /content/count endpoint
  - Query Firestore content collection
  - Return total document count
  - _Requirements: (existing functionality)_

- [x] 7. Add automated scheduling
- [x] 7.1 Implement automatic collection scheduler
  - Read AUTO_COLLECT_INTERVAL_MINUTES from env
  - Use setInterval for scheduling
  - Default to 360 minutes (6 hours)
  - Log scheduled runs
  - _Requirements: 11.1, 11.2, 11.3_

- [x] 8. Add logging and observability
- [x] 8.1 Implement structured logging
  - Log source group start/completion
  - Include timestamps in all logs
  - Log error messages with context
  - Log summary statistics
  - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [x] 9. Add configuration management
- [x] 9.1 Read all environment variables
  - FIREBASE_SERVICE_ACCOUNT_JSON
  - GORSE_BASE_URL
  - NEWSAPI_KEY
  - GUARDIAN_API_KEY
  - AUTO_COLLECT_INTERVAL_MINUTES (default 360)
  - MAX_NEW_ITEMS_PER_RUN (default 2000)
  - FETCH_CONCURRENCY (default 5)
  - FETCH_TIMEOUT_MS (default 10000)
  - _Requirements: 15.1-15.8_

- [x] 10. Implement copyright compliance
- [x] 10.1 Add license field to all content
  - Set 'public-domain' for Gutenberg
  - Set 'rss' for RSS feeds
  - Set 'restricted' for copyrighted APIs
  - Set 'api' for API sources
  - _Requirements: 16.1, 16.2, 16.4_

- [x] 10.2 Limit content storage for restricted sources
  - Store only excerpt (max 200 chars) for restricted
  - Store full text only for public domain
  - Always include URL for attribution
  - _Requirements: 16.1, 16.3_

- [x] 11. Create documentation
- [x] 11.1 Update README with collection system section
  - Explain all content sources
  - Document API key requirements
  - Explain rate limits
  - Provide setup instructions
  - Include example curl commands
  - _Requirements: (documentation)_

- [x] 12. Testing and validation
- [x] 12.1 Test individual fetchers
  - Use /collect/test endpoint
  - Verify each source returns data
  - Check data normalization
  - _Requirements: 13.1, 13.2_

- [x] 12.2 Test dry-run mode
  - Call /collect?dry=true
  - Verify no Firestore writes
  - Check returned data structure
  - _Requirements: 13.3, 13.4_

- [x] 12.3 Test full collection
  - Run POST /collect
  - Verify Firestore writes
  - Verify Gorse sync
  - Check metrics storage
  - _Requirements: 1.1-1.5, 8.1-8.4, 10.1-10.4_

- [x] 12.4 Test error handling
  - Simulate API failures
  - Verify retry logic
  - Check error isolation
  - Verify partial success
  - _Requirements: 9.4, 9.5, 9.6_

- [x] 12.5 Test rate limiting
  - Monitor request timing
  - Verify 10 req/sec limit
  - Check backoff on 429
  - _Requirements: 9.3, 9.4_
