# Requirements Document: Large-Scale Content Collection Pipeline

## Introduction

This specification defines a comprehensive content ingestion system that collects diverse public content from multiple sources (APIs, RSS feeds, public datasets) and stores them in Firestore for ML-powered recommendations via Gorse. The system is designed for continuous, unattended operation at scale.

## Glossary

- **Content Collector**: The orchestration system that manages fetching from multiple sources
- **Fetcher**: Individual module responsible for collecting content from a specific source
- **Firestore**: Google Cloud Firestore database for content storage
- **Gorse**: ML recommendation engine that receives synced content
- **Deduplication**: Process of preventing duplicate content using URL/GUID hashing
- **Rate Limiting**: Mechanism to prevent overwhelming external APIs
- **Backoff Strategy**: Exponential delay when encountering rate limits or errors

## Requirements

### Requirement 1: Content Collection Orchestration

**User Story:** As a system administrator, I want an orchestrator that manages content collection from multiple sources concurrently, so that the system can efficiently gather diverse content without overwhelming any single source.

#### Acceptance Criteria

1. THE Content Collector SHALL implement a function `collectAllContent()` that orchestrates all content fetchers
2. WHEN `collectAllContent()` executes, THE Content Collector SHALL limit concurrent fetches to a maximum of 5 simultaneous operations
3. THE Content Collector SHALL track metrics including feedsAttempted, feedsSucceeded, newItemsAdded, and totalItemsInFirestore
4. THE Content Collector SHALL store collection statistics in Firestore document `collection_metrics/latest`
5. THE Content Collector SHALL store run metadata in Firestore document `last_collection_run` including timestamp, total items, and per-source statistics

### Requirement 2: News & General Content Sources

**User Story:** As a content curator, I want to collect news articles from reputable sources, so that users receive current and reliable news content.

#### Acceptance Criteria

1. THE Content Collector SHALL fetch news from NewsAPI.org with topic queries for science, technology, and world news
2. THE Content Collector SHALL fetch news from The Guardian Open Platform API
3. THE Content Collector SHALL parse BBC News RSS feed at http://feeds.bbci.co.uk/news/rss.xml
4. THE Content Collector SHALL parse Reuters RSS feed at https://www.reutersagency.com/feed/?best-topics=world-news
5. WHEN fetching news content, THE Content Collector SHALL tag items with appropriate categories including 'news', 'world', 'science', or 'technology'

### Requirement 3: AI & Technology Content Sources

**User Story:** As a technology enthusiast, I want to receive AI and tech articles from specialized publications, so that I stay informed about technological developments.

#### Acceptance Criteria

1. THE Content Collector SHALL parse Medium RSS feed at https://medium.com/feed/tag/artificial-intelligence
2. THE Content Collector SHALL parse Towards Data Science RSS feed at https://towardsdatascience.com/feed
3. THE Content Collector SHALL parse The Verge RSS feed at https://www.theverge.com/rss/index.xml
4. THE Content Collector SHALL parse Ars Technica RSS feed at https://feeds.arstechnica.com/arstechnica/index
5. WHEN fetching AI/tech content, THE Content Collector SHALL tag items with 'ai', 'technology', or 'machine-learning'

### Requirement 4: Science & Research Content Sources

**User Story:** As a researcher, I want access to scientific papers and research news, so that I can stay current with academic developments.

#### Acceptance Criteria

1. THE Content Collector SHALL query arXiv API at https://export.arxiv.org/api/query with search parameters for AI and science topics
2. THE Content Collector SHALL limit arXiv queries to 50 results per request
3. THE Content Collector SHALL parse Science Daily RSS feed at https://www.sciencedaily.com/rss/top/science.xml
4. THE Content Collector SHALL parse Nature News RSS feed at https://www.nature.com/feeds/newsroom.xml
5. WHEN fetching research content, THE Content Collector SHALL tag items with 'science', 'research', or 'academic'

### Requirement 5: Poetry & Literature Content Sources

**User Story:** As a literature lover, I want access to poetry and literary content, so that I can discover and enjoy creative writing.

#### Acceptance Criteria

1. THE Content Collector SHALL parse Poetry Foundation RSS feed at https://www.poetryfoundation.org/rss/poems
2. THE Content Collector SHALL parse The Marginalian RSS feed at https://www.themarginalian.org/feed/
3. THE Content Collector SHALL access Project Gutenberg catalog at gutenberg.org/cache/epub/feeds/catalog.rdf for public domain works
4. WHEN fetching poetry content, THE Content Collector SHALL set contentType to 'poem'
5. WHEN fetching literature content, THE Content Collector SHALL tag items with 'poetry', 'literature', or 'creative-writing'

### Requirement 6: Environmental Content Sources

**User Story:** As an environmental advocate, I want access to climate and environmental news, so that I stay informed about environmental issues.

#### Acceptance Criteria

1. THE Content Collector SHALL parse NASA Earth Observatory RSS feed at https://earthobservatory.nasa.gov/feeds/rss/eo.rss
2. THE Content Collector SHALL parse UNEP RSS feed at https://www.unep.org/rss.xml
3. WHEN fetching environmental content, THE Content Collector SHALL tag items with 'environment', 'climate', or 'sustainability'

### Requirement 7: Content Normalization

**User Story:** As a system architect, I want all content normalized to a consistent format, so that downstream systems can process content uniformly.

#### Acceptance Criteria

1. THE Content Collector SHALL extract title, excerpt (maximum 200 characters), plain_text, tags, publishedAt, source, and url from each item
2. THE Content Collector SHALL strip HTML tags from content text
3. THE Content Collector SHALL convert all timestamps to Firestore Timestamp format
4. THE Content Collector SHALL include a license field with values: "public-domain", "rss", "restricted", or "api"
5. THE Content Collector SHALL set contentType to 'article' or 'poem' based on source type
6. THE Content Collector SHALL generate a document ID from URL or GUID for deduplication

### Requirement 8: Deduplication & Storage

**User Story:** As a database administrator, I want duplicate content prevented, so that storage remains efficient and users don't see repeated content.

#### Acceptance Criteria

1. THE Content Collector SHALL use normalized URL hash as document ID
2. WHEN a document ID already exists in Firestore, THE Content Collector SHALL skip that item
3. THE Content Collector SHALL write new items to Firestore collection 'content'
4. THE Content Collector SHALL limit new items per run to MAX_NEW_ITEMS_PER_RUN (default 2000)

### Requirement 9: Rate Limiting & Safety

**User Story:** As a system operator, I want rate limiting and error handling, so that the system operates reliably without overwhelming external services.

#### Acceptance Criteria

1. THE Content Collector SHALL limit concurrent fetches to FETCH_CONCURRENCY (default 5)
2. THE Content Collector SHALL set fetch timeout to FETCH_TIMEOUT_MS (default 10000 milliseconds)
3. THE Content Collector SHALL implement per-host rate limiting of maximum 10 requests per second
4. WHEN receiving HTTP 429 response, THE Content Collector SHALL implement exponential backoff
5. WHEN receiving HTTP 5xx response, THE Content Collector SHALL retry with exponential backoff up to 3 attempts
6. THE Content Collector SHALL continue processing other sources when one source fails

### Requirement 10: Gorse Synchronization

**User Story:** As a recommendation system operator, I want collected content automatically synced to Gorse, so that new content becomes available for recommendations immediately.

#### Acceptance Criteria

1. WHEN new items are added to Firestore, THE Content Collector SHALL sync them to Gorse via /api/items/batch endpoint
2. THE Content Collector SHALL include ItemId, Categories (tags), Timestamp, Labels, and Comment (title) in Gorse sync
3. THE Content Collector SHALL log the count of items successfully synced to Gorse
4. IF Gorse sync fails, THE Content Collector SHALL log the error but continue operation

### Requirement 11: Automated Scheduling

**User Story:** As a system administrator, I want content collection to run automatically, so that fresh content is continuously available without manual intervention.

#### Acceptance Criteria

1. WHEN AUTO_COLLECT_INTERVAL_MINUTES is set to a value greater than 0, THE Content Collector SHALL run `collectAllContent()` automatically at that interval
2. THE Content Collector SHALL use setInterval for scheduling automatic collection
3. THE default value for AUTO_COLLECT_INTERVAL_MINUTES SHALL be 360 (6 hours)

### Requirement 12: Manual Triggering

**User Story:** As a system administrator, I want to manually trigger content collection, so that I can refresh content on demand.

#### Acceptance Criteria

1. THE service SHALL expose endpoint POST /collect for manual collection triggering
2. WHEN POST /collect is called, THE service SHALL execute `collectAllContent()` and return collection statistics
3. THE service SHALL accept optional JSON body parameter 'sources' to limit collection to specific source groups

### Requirement 13: Testing & Debugging

**User Story:** As a developer, I want testing endpoints and dry-run mode, so that I can verify collection logic without affecting production data.

#### Acceptance Criteria

1. THE service SHALL expose endpoint GET /collect/test with query parameter 'source' to test individual fetchers
2. WHEN /collect/test is called, THE service SHALL return parsed titles without writing to Firestore
3. THE service SHALL support query parameter 'dry=true' on /collect endpoint to fetch without writing
4. WHEN dry=true, THE service SHALL return what would be collected without modifying Firestore

### Requirement 14: Logging & Observability

**User Story:** As a system operator, I want structured logging, so that I can monitor system health and troubleshoot issues.

#### Acceptance Criteria

1. THE Content Collector SHALL log structured console messages for each source group start and completion
2. THE Content Collector SHALL log error messages with source name, error type, and error message
3. THE Content Collector SHALL log summary statistics after each collection run
4. THE Content Collector SHALL include timestamps in all log messages

### Requirement 15: Configuration Management

**User Story:** As a deployment engineer, I want environment-based configuration, so that the system can be deployed across different environments.

#### Acceptance Criteria

1. THE service SHALL read FIREBASE_SERVICE_ACCOUNT_JSON from environment variables
2. THE service SHALL read GORSE_BASE_URL from environment variables
3. THE service SHALL read NEWSAPI_KEY from environment variables for NewsAPI.org access
4. THE service SHALL read GUARDIAN_API_KEY from environment variables for Guardian API access
5. THE service SHALL read AUTO_COLLECT_INTERVAL_MINUTES from environment variables with default 360
6. THE service SHALL read MAX_NEW_ITEMS_PER_RUN from environment variables with default 2000
7. THE service SHALL read FETCH_CONCURRENCY from environment variables with default 5
8. THE service SHALL read FETCH_TIMEOUT_MS from environment variables with default 10000

### Requirement 16: Copyright Compliance

**User Story:** As a legal compliance officer, I want the system to respect copyright, so that the service operates within legal boundaries.

#### Acceptance Criteria

1. WHEN content is from a restricted source, THE Content Collector SHALL store only excerpt (maximum 200 characters) and URL
2. THE Content Collector SHALL include license metadata for each item
3. THE Content Collector SHALL NOT store full text for copyrighted content unless explicitly allowed by license
4. WHEN content is public domain, THE Content Collector SHALL set license field to "public-domain"
