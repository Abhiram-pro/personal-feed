# Design Document

## Overview

This design document outlines the implementation approach for enhancing the Feed Screen with personalized UI elements, modern visual design patterns, and contextual information. The enhancements will transform the feed from a functional list into an engaging, personality-driven experience that adapts to user context and preferences.

## Architecture

### Component Structure

The Feed Screen will maintain its existing architecture with the following additions:

1. **Header Enhancement**: Extend the existing header to include dynamic greeting
2. **Article Card Redesign**: Apply glassmorphism styling and add metadata displays
3. **Tag System Enhancement**: Implement color-coding logic for category tags
4. **Insight Card Component**: New component for contextual tips and information
5. **Interaction Controls**: Add bookmark and share functionality to cards

### Data Flow

```
User Profile (Firestore) → userName, interests
    ↓
Feed Screen State → greeting, recommendations, insights
    ↓
UI Components → Header, ArticleCards, InsightCards
    ↓
User Interactions → bookmark, share, dismiss insights
    ↓
Firebase/Gorse → save interactions
```

## Components and Interfaces

### 1. Dynamic Greeting System

**Implementation:**
- Use existing `getTimeBasedGreeting()` helper function
- Fetch user's display name from Firestore user document
- Update greeting every hour while app is active
- Apply fade-in animation on mount

**Data Structure:**
```typescript
interface Greeting {
  text: string;  // e.g., "Good morning, Alex"
  emoji: string; // e.g., "🌞"
}
```

**Time Periods:**
- 5:00 AM - 11:59 AM: "Good morning" 🌞
- 12:00 PM - 4:59 PM: "Good afternoon" 👋
- 5:00 PM - 9:59 PM: "Good evening" ✨
- 10:00 PM - 4:59 AM: "Burning the midnight oil" 🌙

### 2. Read Time Calculation

**Implementation:**
- Use existing `getReadingTime()` helper function
- Calculate based on article excerpt or full text if available
- Assume 200 words per minute reading speed
- Display with clock icon in metadata section

**Formula:**
```
readTime = Math.max(1, Math.ceil(wordCount / 200))
```

### 3. Glassmorphism Article Cards

**Visual Design:**
- Background: `rgba(26, 39, 48, 0.7)` with backdrop blur
- Border: `1px solid rgba(148, 178, 199, 0.1)`
- Border radius: `16px`
- Shadow: `0 8px 32px rgba(0, 0, 0, 0.2)`
- Pressed state: Scale to 0.98 with darker background

**Style Properties:**
```typescript
{
  backgroundColor: 'rgba(26, 39, 48, 0.7)',
  borderRadius: 16,
  borderWidth: 1,
  borderColor: 'rgba(148, 178, 199, 0.1)',
  backdropFilter: 'blur(10px)', // Note: Limited support in React Native
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.2,
  shadowRadius: 32,
}
```

### 4. Color-Coded Tag System

**Implementation:**
- Use existing `getTagColor()` helper function
- Apply colors to tag chip backgrounds
- Ensure text contrast meets WCAG AA standards

**Color Mapping:**
```typescript
const tagColors = {
  'ai': '#60A5FA',           // Blue
  'technology': '#60A5FA',   // Blue
  'startups': '#34D399',     // Green
  'business': '#34D399',     // Green
  'design': '#A78BFA',       // Purple
  'science': '#F472B6',      // Pink
  'news': '#FBBF24',         // Yellow
  'world': '#FBBF24',        // Yellow
  'policy': '#FB923C',       // Orange
  'finance': '#10B981',      // Emerald
  'health': '#EC4899',       // Pink
  'psychology': '#8B5CF6',   // Violet
  'default': '#94B2C7',      // Gray
};
```

**Tag Chip Design:**
- Background: Tag color with 20% opacity
- Text: Tag color at full opacity
- Border radius: `8px`
- Padding: `6px 12px`

### 5. Interaction Icons

**Bookmark Icon:**
- Position: Top-right of article card
- Icon: `bookmark-outline` (unfilled) / `bookmark` (filled)
- Color: `#4A9EFF` when active, `#94B2C7` when inactive
- Action: Save to user's bookmarks collection in Firestore

**Share Icon:**
- Position: Next to bookmark icon
- Icon: `share-outline`
- Color: `#94B2C7`
- Action: Open native share sheet with article URL and title

**Implementation:**
```typescript
<View style={styles.interactionIcons}>
  <Pressable onPress={() => handleBookmark(item)}>
    <Ionicons 
      name={isBookmarked ? "bookmark" : "bookmark-outline"} 
      size={20} 
      color={isBookmarked ? "#4A9EFF" : "#94B2C7"} 
    />
  </Pressable>
  <Pressable onPress={() => handleShare(item)}>
    <Ionicons name="share-outline" size={20} color="#94B2C7" />
  </Pressable>
</View>
```

### 6. Contextual Insight Cards

**Card Types:**

1. **Add More Interests** (shown when interests < 3)
   - Icon: `bulb-outline`
   - Message: "Add more interests to get better recommendations"
   - Action: Navigate to edit-interests screen

2. **How Recommendations Work** (shown when articles read < 5)
   - Icon: `sparkles-outline`
   - Message: "Your feed learns from what you read and like"
   - Action: Dismissible

3. **Explore New Topics** (shown randomly after 20+ articles)
   - Icon: `compass-outline`
   - Message: "Try exploring a new interest area"
   - Action: Navigate to edit-interests screen

**Visual Design:**
- Background: Gradient from `#4A9EFF` to `#A78BFA`
- Border radius: `16px`
- Padding: `20px`
- Icon size: `32px`
- Dismiss button: Top-right corner

**Data Structure:**
```typescript
interface InsightCard {
  id: string;
  type: 'add-interests' | 'how-it-works' | 'explore-topics';
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
  actionRoute?: string;
  dismissible: boolean;
}
```

### 7. Enhanced Header

**Layout:**
```
┌─────────────────────────────┐
│  🌞 Good morning, Alex      │
│  ● Personalized • 1,234 new │
└─────────────────────────────┘
```

**Components:**
- Greeting emoji (32px)
- Greeting text (24px, bold)
- Status indicator (6px dot)
- Subtitle (12px, secondary color)

**Animation:**
- Fade in on mount (300ms)
- Update greeting with crossfade when time period changes

## Data Models

### User Profile Extension

```typescript
interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;  // Used for greeting
  interests: string[];
  createdAt: Date;
  // New fields for insights
  articlesRead?: number;
  lastInsightDismissed?: {
    [key: string]: Date;
  };
}
```

### Bookmark Model

```typescript
interface Bookmark {
  userId: string;
  contentId: string;
  title: string;
  url: string;
  excerpt?: string;
  tags: string[];
  bookmarkedAt: Date;
}
```

### Insight Dismissal Tracking

```typescript
interface InsightDismissal {
  userId: string;
  insightType: string;
  dismissedAt: Date;
  sessionId: string;
}
```

## Error Handling

### User Name Loading
- **Error**: User document doesn't exist or displayName is missing
- **Fallback**: Use "there" as default name
- **Recovery**: Prompt user to complete profile

### Read Time Calculation
- **Error**: Article text is unavailable
- **Fallback**: Don't display read time
- **Recovery**: Fetch full article content in background

### Bookmark Save Failure
- **Error**: Network error or permission denied
- **Fallback**: Show error toast, revert icon state
- **Recovery**: Retry with exponential backoff

### Share Sheet Failure
- **Error**: Share API unavailable on platform
- **Fallback**: Copy URL to clipboard
- **Recovery**: Show success message

### Insight Card Loading
- **Error**: Failed to fetch user stats
- **Fallback**: Don't show insight cards
- **Recovery**: Retry on next app launch

## Testing Strategy

### Unit Tests

1. **Greeting Logic**
   - Test all time periods return correct greeting
   - Test name interpolation
   - Test emoji selection

2. **Read Time Calculation**
   - Test various word counts
   - Test minimum 1 minute
   - Test rounding behavior

3. **Tag Color Mapping**
   - Test all defined categories
   - Test default fallback
   - Test case insensitivity

### Integration Tests

1. **User Profile Loading**
   - Test fetching display name from Firestore
   - Test fallback when name is missing
   - Test greeting updates

2. **Bookmark Functionality**
   - Test saving bookmark to Firestore
   - Test bookmark state persistence
   - Test removing bookmarks

3. **Share Functionality**
   - Test share sheet opens with correct data
   - Test fallback to clipboard
   - Test haptic feedback

### Visual Tests

1. **Glassmorphism Rendering**
   - Verify transparency and blur effects
   - Test on different backgrounds
   - Verify text readability

2. **Tag Color Display**
   - Verify all colors render correctly
   - Test contrast ratios
   - Verify multiple tags layout

3. **Insight Card Display**
   - Test card positioning in feed
   - Test dismiss animation
   - Test action button navigation

### Performance Tests

1. **Greeting Update**
   - Verify no unnecessary re-renders
   - Test timer cleanup on unmount

2. **Read Time Calculation**
   - Test performance with long articles
   - Verify memoization works

3. **Tag Color Lookup**
   - Test performance with many tags
   - Verify no blocking operations

## Implementation Notes

### React Native Limitations

1. **Backdrop Blur**: Not natively supported in React Native
   - Solution: Use `expo-blur` library for iOS/Android
   - Fallback: Solid background with opacity on web

2. **Share API**: Different implementations per platform
   - Use `expo-sharing` for cross-platform support
   - Fallback to clipboard on unsupported platforms

3. **Haptic Feedback**: iOS and Android only
   - Use `expo-haptics` with platform checks
   - Gracefully degrade on web

### Accessibility Considerations

1. **Color Contrast**: All tag colors must meet WCAG AA standards
2. **Touch Targets**: Interaction icons minimum 44x44 points
3. **Screen Readers**: Proper labels for all interactive elements
4. **Reduced Motion**: Respect system preference for animations

### Performance Optimizations

1. **Memoization**: Use `useMemo` for read time calculations
2. **Lazy Loading**: Load insight cards only when needed
3. **Animation**: Use `useNativeDriver` for smooth 60fps animations
4. **Image Optimization**: Lazy load article thumbnails if added later
