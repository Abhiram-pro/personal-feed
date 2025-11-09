# Implementation Plan

- [x] 1. Implement dynamic greeting system
  - Fetch user's display name from Firestore user document
  - Connect existing `getTimeBasedGreeting()` helper to header
  - Add state management for userName and greeting
  - Implement fade-in animation for greeting display
  - Add hourly timer to update greeting when time period changes
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 2. Add read time calculation to article cards
  - Connect existing `getReadingTime()` helper to article rendering
  - Calculate read time from article excerpt or full text
  - Add clock icon and read time display to metadata section
  - Style read time indicator to match existing metadata
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Implement glassmorphism design for article cards
  - Update article card styles with semi-transparent background
  - Add subtle border with low opacity
  - Install and configure expo-blur for backdrop blur effect
  - Implement scale animation on press (0.98)
  - Test text readability over glassmorphism background
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Implement color-coded tag system
  - Connect existing `getTagColor()` helper to tag rendering
  - Update tag chip styles to use dynamic background colors
  - Apply tag colors with 20% opacity for backgrounds
  - Use full opacity tag colors for text
  - Ensure text contrast meets accessibility standards
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 5. Add interaction icons to article cards
  - [x] 5.1 Implement bookmark functionality
    - Create bookmarks collection structure in Firestore
    - Add bookmark icon to article card header
    - Implement handleBookmark function to save/remove bookmarks
    - Add state management for bookmark status per article
    - Apply haptic feedback on bookmark tap
    - _Requirements: 5.1, 5.3, 5.5_
  
  - [x] 5.2 Implement share functionality
    - Install expo-sharing library
    - Add share icon next to bookmark icon
    - Implement handleShare function with native share sheet
    - Add fallback to clipboard for unsupported platforms
    - Apply haptic feedback on share tap
    - _Requirements: 5.2, 5.4, 5.5_
  
  - [x] 5.3 Style interaction icons container
    - Position icons in top-right of article cards
    - Add proper spacing between icons
    - Ensure touch targets are minimum 44x44 points
    - _Requirements: 5.1, 5.2_

- [x] 6. Create contextual insight card component
  - [x] 6.1 Build InsightCard component
    - Create reusable InsightCard component with gradient background
    - Add icon, title, message, and action button props
    - Implement dismiss functionality with animation
    - Style with gradient from blue to purple
    - _Requirements: 6.3, 6.4_
  
  - [x] 6.2 Implement insight card logic
    - Add state for tracking dismissed insights per session
    - Create logic to determine which insight to show
    - Fetch user stats (interests count, articles read) from Firestore
    - Implement "Add More Interests" card (shown when interests < 3)
    - Implement "How Recommendations Work" card (shown when articles read < 5)
    - _Requirements: 6.1, 6.2, 6.5_
  
  - [x] 6.3 Integrate insight cards into feed
    - Insert insight cards at appropriate positions in feed
    - Handle navigation to edit-interests screen from action buttons
    - Persist dismissed insights to prevent re-showing
    - _Requirements: 6.1, 6.2, 6.4, 6.5_

- [x] 7. Enhance header with personality
  - Update header layout to prominently display greeting
  - Increase greeting text size to 24px with bold weight
  - Position greeting emoji (32px) before text
  - Update subtitle to show article count
  - Apply fade-in animation on header mount
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 8. Update data models and services
  - [x] 8.1 Extend user profile model
    - Add displayName field to user document structure
    - Add articlesRead counter field
    - Add lastInsightDismissed map field
    - _Requirements: 1.1, 6.1, 6.2_
  
  - [x] 8.2 Create bookmark service
    - Create bookmarkService.ts with save/remove/list functions
    - Implement Firestore operations for bookmarks collection
    - Add error handling with retry logic
    - _Requirements: 5.3_
  
  - [x] 8.3 Update interaction service
    - Increment articlesRead counter when user reads article
    - Track insight dismissals in user document
    - _Requirements: 6.2, 6.5_

- [x] 9. Add error handling and fallbacks
  - Implement fallback to "there" when displayName is missing
  - Add error toast for bookmark save failures
  - Implement clipboard fallback for share functionality
  - Add graceful degradation when insight stats unavailable
  - _Requirements: 1.1, 5.3, 5.4, 6.1_

- [x] 10. Optimize performance and accessibility
  - Add useMemo for read time calculations
  - Implement useNativeDriver for all animations
  - Add accessibility labels for interaction icons
  - Verify color contrast ratios for all tag colors
  - Add platform checks for haptic feedback
  - Test reduced motion preference support
  - _Requirements: 2.1, 3.4, 4.8, 5.5_
