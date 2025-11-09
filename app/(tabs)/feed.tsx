import { StyleSheet, View, Text, Pressable, ScrollView, RefreshControl, ActivityIndicator, Animated, Share, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getRecommendations, invalidateRecommendationCache, RecommendationItem } from '@/services/recommendationService';
import { saveInteraction, dismissInsight } from '@/services/interactionService';
import { saveBookmark, removeBookmark } from '@/services/bookmarkService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import InsightCard from '@/components/InsightCard';

// Helper functions
const getTimeBasedGreeting = (name: string) => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return { text: `Good morning, ${name}`, emoji: '🌞' };
  } else if (hour >= 12 && hour < 17) {
    return { text: `Good afternoon, ${name}`, emoji: '👋' };
  } else if (hour >= 17 && hour < 22) {
    return { text: `Good evening, ${name}`, emoji: '✨' };
  } else {
    return { text: `Burning the midnight oil, ${name}?`, emoji: '🌙' };
  }
};

const getReadingTime = (text: string): number => {
  const wordsPerMinute = 200;
  const words = text.split(/\s+/).filter(word => word.length > 0).length;
  
  // If text is very short (like just a title), estimate based on typical article length
  if (words < 50) {
    return 3; // Assume 3 min for short excerpts
  }
  
  return Math.max(1, Math.ceil(words / wordsPerMinute));
};

const getTagColor = (tag: string): string => {
  const tagColors: { [key: string]: string } = {
    'ai': '#60A5FA',
    'technology': '#60A5FA',
    'startups': '#34D399',
    'business': '#34D399',
    'design': '#A78BFA',
    'science': '#F472B6',
    'news': '#FBBF24',
    'world': '#FBBF24',
    'policy': '#FB923C',
    'finance': '#10B981',
    'health': '#EC4899',
    'psychology': '#8B5CF6',
  };
  
  return tagColors[tag.toLowerCase()] || '#94B2C7';
};

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [allRecommendations, setAllRecommendations] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'gorse' | 'fallback'>('gorse');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [userName, setUserName] = useState<string>('there');
  const [greeting, setGreeting] = useState<{ text: string; emoji: string }>({ text: 'For You', emoji: '' });
  const [bookmarkedItems, setBookmarkedItems] = useState<Set<string>>(new Set());
  const [articlesRead, setArticlesRead] = useState<number>(0);
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());
  const [showInsight, setShowInsight] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const greetingFadeAnim = useRef(new Animated.Value(0)).current;

  // Load user profile (name and interests)
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          
          // Set user interests
          if (data.interests) {
            setUserInterests(data.interests);
          }
          
          // Set user name (fallback to 'there' if not available)
          const displayName = data.displayName || data.name || user.displayName || 'there';
          setUserName(displayName);
          
          // Load user stats for insights
          setArticlesRead(data.articlesRead || 0);
          
          // Load dismissed insights
          if (data.lastInsightDismissed) {
            setDismissedInsights(new Set(Object.keys(data.lastInsightDismissed)));
          }
          
          // Determine which insight to show
          const interestsCount = data.interests?.length || 0;
          const readCount = data.articlesRead || 0;
          
          if (interestsCount < 3 && !dismissedInsights.has('add-interests')) {
            setShowInsight('add-interests');
          } else if (readCount < 5 && !dismissedInsights.has('how-it-works')) {
            setShowInsight('how-it-works');
          }
          
          // Set initial greeting
          const initialGreeting = getTimeBasedGreeting(displayName);
          setGreeting(initialGreeting);
          
          // Fade in greeting
          Animated.timing(greetingFadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
        // Set default greeting on error
        const defaultGreeting = getTimeBasedGreeting('there');
        setGreeting(defaultGreeting);
        Animated.timing(greetingFadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    };
    
    loadUserProfile();
  }, [user]);

  // Update greeting every hour
  useEffect(() => {
    const updateGreeting = () => {
      const newGreeting = getTimeBasedGreeting(userName);
      
      // Crossfade animation
      Animated.sequence([
        Animated.timing(greetingFadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(greetingFadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
      
      setGreeting(newGreeting);
    };

    // Update greeting every hour
    const greetingInterval = setInterval(updateGreeting, 60 * 60 * 1000);
    
    return () => clearInterval(greetingInterval);
  }, [userName]);

  const fetchRecommendations = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setPage(1);
        // Invalidate cache to force fresh recommendations
        await invalidateRecommendationCache();
        console.log('Cache invalidated - fetching fresh recommendations');
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await getRecommendations(50); // Fetch more for filtering
      setAllRecommendations(result.items);
      
      // Apply filter
      const filtered = selectedFilter === 'all' 
        ? result.items 
        : result.items.filter(item => 
            item.tags?.some(tag => tag.toLowerCase() === selectedFilter.toLowerCase())
          );
      
      setRecommendations(filtered);
      setSource(result.source);
      setHasMore(result.items.length >= 50);
      
      console.log(`Loaded ${result.items.length} recommendations from ${result.source}`);
    } catch (err: any) {
      console.error('Failed to fetch recommendations:', err);
      setError(err.message || 'Failed to load recommendations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleFilterChange = (filter: string) => {
    if (filter === selectedFilter) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFilter(filter);
    
    // Smooth fade animation
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Filter recommendations
    const filtered = filter === 'all'
      ? allRecommendations
      : allRecommendations.filter(item =>
          item.tags?.some(tag => tag.toLowerCase() === filter.toLowerCase())
        );
    
    setRecommendations(filtered);
    console.log(`Filtered to ${filter}: ${filtered.length} articles`);
  };

  const loadMoreRecommendations = async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      
      // Request more items (20 per page)
      const result = await getRecommendations(20 * nextPage);
      
      // Only add new items that aren't already in the list
      const existingIds = new Set(recommendations.map(r => r.contentId));
      const newItems = result.items.filter(item => !existingIds.has(item.contentId));
      
      if (newItems.length > 0) {
        setRecommendations(prev => [...prev, ...newItems]);
        setPage(nextPage);
        setHasMore(newItems.length >= 20);
        console.log(`Loaded ${newItems.length} more recommendations`);
      } else {
        setHasMore(false);
        console.log('No more recommendations available');
      }
    } catch (err: any) {
      console.error('Failed to load more recommendations:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
    
    // Auto-refresh every 5 minutes
    const autoRefreshInterval = setInterval(() => {
      console.log('Auto-refreshing recommendations...');
      fetchRecommendations(true);
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(autoRefreshInterval);
  }, []);

  const handleArticlePress = (item: RecommendationItem) => {
    if (item.url) {
      router.push({
        pathname: '/reader',
        params: {
          url: item.url,
          title: item.title,
          contentId: item.contentId,
        },
      });
    }
  };

  const onRefresh = () => {
    fetchRecommendations(true);
  };

  const handleDismiss = async (item: RecommendationItem) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Save interaction and sync to Gorse
      await saveInteraction(item.contentId, 'dismiss');
      
      // Remove from list
      setRecommendations(prev => prev.filter(rec => rec.contentId !== item.contentId));
    } catch (error) {
      console.error('Error dismissing article:', error);
    }
  };

  const handleBookmark = async (item: RecommendationItem) => {
    if (!user) return;
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const isCurrentlyBookmarked = bookmarkedItems.has(item.contentId);
      
      if (isCurrentlyBookmarked) {
        // Remove bookmark
        await removeBookmark(user.uid, item.contentId);
        setBookmarkedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(item.contentId);
          return newSet;
        });
      } else {
        // Add bookmark
        await saveBookmark(
          user.uid,
          item.contentId,
          item.title,
          item.url || '',
          item.excerpt,
          item.tags
        );
        setBookmarkedItems(prev => new Set(prev).add(item.contentId));
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleShare = async (item: RecommendationItem) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      if (!item.url) {
        console.error('No URL to share');
        return;
      }
      
      await Share.share({
        message: Platform.OS === 'ios' ? item.title : `${item.title}\n\n${item.url}`,
        url: item.url,
        title: item.title,
      });
    } catch (error: any) {
      if (error.message !== 'User did not share') {
        console.error('Error sharing article:', error);
      }
    }
  };

  const handleDismissInsight = async (insightType: string) => {
    try {
      await dismissInsight(insightType);
      setDismissedInsights(prev => new Set(prev).add(insightType));
      setShowInsight(null);
    } catch (error) {
      console.error('Error dismissing insight:', error);
    }
  };

  const handleInsightAction = (insightType: string) => {
    if (insightType === 'add-interests') {
      router.push('/edit-interests');
    }
  };

  const renderRightActions = (item: RecommendationItem) => {
    return (
      <View style={styles.swipeAction}>
        <Ionicons name="close-circle" size={32} color="#FFFFFF" />
        <Text style={styles.swipeActionText}>Not Interested</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Loading recommendations...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar style="light" />
        <Text style={styles.errorText}>⚠️ {error}</Text>
        <Pressable style={styles.retryButton} onPress={() => fetchRecommendations()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (recommendations.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar style="light" />
        <Text style={styles.emptyText}>No recommendations yet</Text>
        <Text style={styles.emptySubtext}>
          Add some interests in your profile to get personalized content
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="light" />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top }
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
          />
        }
      >
        {/* Header */}
        <Animated.View style={[styles.headerContainer, { opacity: greetingFadeAnim }]}>
          <View style={styles.greetingWrapper}>
            <Text style={styles.greetingEmoji}>{greeting.emoji}</Text>
            <Text style={styles.greetingText}>{greeting.text}</Text>
          </View>
          <View style={styles.subtitleRow}>
            <View style={[styles.statusDot, source === 'gorse' ? styles.statusDotActive : styles.statusDotFallback]} />
            <Text style={styles.subtitle}>
              {source === 'gorse' ? 'Personalized' : 'Discovering your interests'}
            </Text>
            <Text style={styles.subtitleDivider}>•</Text>
            <Text style={styles.subtitle}>
              {allRecommendations.length} new
            </Text>
          </View>
        </Animated.View>

        {/* Interest Filters */}
        {userInterests.length > 0 && (
          <View style={styles.filtersContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersScrollContent}
            >
              <Pressable
                style={[
                  styles.filterChip,
                  selectedFilter === 'all' && styles.filterChipActive,
                ]}
                onPress={() => handleFilterChange('all')}
              >
                <Text style={[
                  styles.filterChipText,
                  selectedFilter === 'all' && styles.filterChipTextActive,
                ]}>
                  All
                </Text>
                {selectedFilter === 'all' && (
                  <View style={styles.filterChipBadge}>
                    <Text style={styles.filterChipBadgeText}>{allRecommendations.length}</Text>
                  </View>
                )}
              </Pressable>
              
              {userInterests.map((interest, index) => {
                const count = allRecommendations.filter(item =>
                  item.tags?.some(tag => tag.toLowerCase() === interest.toLowerCase())
                ).length;
                
                return (
                  <Pressable
                    key={index}
                    style={[
                      styles.filterChip,
                      selectedFilter === interest && styles.filterChipActive,
                    ]}
                    onPress={() => handleFilterChange(interest)}
                  >
                    <Text style={[
                      styles.filterChipText,
                      selectedFilter === interest && styles.filterChipTextActive,
                    ]}>
                      {interest.charAt(0).toUpperCase() + interest.slice(1)}
                    </Text>
                    {count > 0 && (
                      <View style={[
                        styles.filterChipBadge,
                        selectedFilter === interest && styles.filterChipBadgeActive,
                      ]}>
                        <Text style={[
                          styles.filterChipBadgeText,
                          selectedFilter === interest && styles.filterChipBadgeTextActive,
                        ]}>{count}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Articles List */}
        <Animated.View style={[styles.articlesContainer, { opacity: fadeAnim }]}>
          {/* Insight Cards */}
          {showInsight === 'add-interests' && (
            <InsightCard
              icon="bulb-outline"
              title="Get Better Recommendations"
              message="Add more interests to your profile to discover content tailored just for you"
              actionLabel="Add Interests"
              onAction={() => handleInsightAction('add-interests')}
              onDismiss={() => handleDismissInsight('add-interests')}
            />
          )}
          
          {showInsight === 'how-it-works' && (
            <InsightCard
              icon="sparkles-outline"
              title="Your Feed Learns"
              message="The more you read and interact with articles, the better your recommendations become"
              onDismiss={() => handleDismissInsight('how-it-works')}
            />
          )}
          
          {recommendations.map((item, index) => (
            <Swipeable
              key={`${item.contentId}-${index}`}
              renderRightActions={() => renderRightActions(item)}
              onSwipeableOpen={() => handleDismiss(item)}
              overshootRight={false}
              rightThreshold={40}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.articleCard,
                  pressed && styles.articleCardPressed,
                ]}
                onPress={() => handleArticlePress(item)}
              >
              <View style={styles.articleContent}>
                <View style={styles.articleTextContainer}>
                  <View style={styles.articleHeader}>
                    {item.tags && item.tags.length > 0 && (
                      <View style={styles.tagsContainer}>
                      {item.tags.slice(0, 3).map((tag, idx) => {
                        const tagColor = getTagColor(tag);
                        return (
                          <View 
                            key={idx} 
                            style={[
                              styles.tagChip,
                              { backgroundColor: `${tagColor}33` } // 20% opacity
                            ]}
                          >
                            <Text style={[styles.tagText, { color: tagColor }]}>
                              {tag}
                            </Text>
                          </View>
                        );
                      })}
                      </View>
                    )}
                    <View style={styles.interactionIcons}>
                      <Pressable 
                        onPress={(e) => {
                          e.stopPropagation();
                          handleBookmark(item);
                        }}
                        hitSlop={8}
                        accessibilityLabel={bookmarkedItems.has(item.contentId) ? "Remove bookmark" : "Bookmark article"}
                        accessibilityRole="button"
                      >
                        <Ionicons 
                          name={bookmarkedItems.has(item.contentId) ? "bookmark" : "bookmark-outline"} 
                          size={20} 
                          color={bookmarkedItems.has(item.contentId) ? "#4A9EFF" : "#94B2C7"} 
                        />
                      </Pressable>
                      <Pressable 
                        onPress={(e) => {
                          e.stopPropagation();
                          handleShare(item);
                        }}
                        hitSlop={8}
                        accessibilityLabel="Share article"
                        accessibilityRole="button"
                      >
                        <Ionicons name="share-outline" size={20} color="#94B2C7" />
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.articleTitleContainer}>
                    <Text style={styles.articleTitle} numberOfLines={3}>
                      {item.title}
                    </Text>
                  </View>
                  {item.excerpt && (
                    <View style={styles.articleDescriptionContainer}>
                      <Text style={styles.articleDescription} numberOfLines={3}>
                        {item.excerpt}
                      </Text>
                    </View>
                  )}
                  <View style={styles.metaContainer}>
                    <View style={styles.metaRow}>
                      <View style={styles.readTimeContainer}>
                        <Ionicons name="time-outline" size={14} color="#94B2C7" />
                        <Text style={styles.readTimeText}>
                          {getReadingTime(item.excerpt || item.title)} min read
                        </Text>
                      </View>
                      <View style={styles.scoreContainer}>
                        <View style={styles.scoreBar}>
                          <View style={[styles.scoreBarFill, { width: `${Math.min(Math.round(item.score * 100), 100)}%` }]} />
                        </View>
                        <Text style={styles.scoreText}>
                          {Math.min(Math.round(item.score * 100), 100)}% match
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
              </Pressable>
            </Swipeable>
          ))}
          
          {/* Load More Button */}
          {hasMore && !loading && (
            <View style={styles.loadMoreContainer}>
              <Pressable
                style={({ pressed }) => [
                  styles.loadMoreButton,
                  pressed && styles.loadMoreButtonPressed,
                  loadingMore && styles.loadMoreButtonDisabled,
                ]}
                onPress={loadMoreRecommendations}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="arrow-down-circle-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.loadMoreText}>Load More Articles</Text>
                  </>
                )}
              </Pressable>
              <Text style={styles.loadMoreHint}>
                {recommendations.length} articles loaded • Tap to see more
              </Text>
            </View>
          )}
          
          {/* End of Feed Message */}
          {!hasMore && recommendations.length > 0 && (
            <View style={styles.endOfFeedContainer}>
              <Ionicons name="checkmark-circle" size={32} color="#4ADE80" />
              <Text style={styles.endOfFeedText}>You're all caught up!</Text>
              <Text style={styles.endOfFeedSubtext}>
                Pull down to refresh for new articles
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121C21',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },
  greetingWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 6,
  },
  greetingEmoji: {
    fontSize: 32,
    lineHeight: 32,
  },
  greetingText: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 32,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  subtitleDivider: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 12,
    color: '#94B2C7',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotActive: {
    backgroundColor: '#4ADE80',
  },
  statusDotFallback: {
    backgroundColor: '#FFA500',
  },
  subtitle: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#94B2C7',
  },
  filtersContainer: {
    paddingVertical: 12,
  },
  filtersScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2730',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#243847',
  },
  filterChipActive: {
    backgroundColor: '#4A9EFF',
    borderColor: '#4A9EFF',
  },
  filterChipText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 14,
    color: '#94B2C7',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterChipBadge: {
    backgroundColor: '#243847',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  filterChipBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  filterChipBadgeText: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 11,
    color: '#94B2C7',
  },
  filterChipBadgeTextActive: {
    color: '#FFFFFF',
  },
  articlesContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  articleCard: {
    marginBottom: 16,
    backgroundColor: 'rgba(26, 39, 48, 0.7)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 178, 199, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  articleCardPressed: {
    backgroundColor: 'rgba(36, 56, 71, 0.8)',
    transform: [{ scale: 0.98 }],
  },
  articleContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  articleTextContainer: {
    flex: 1,
    gap: 8,
  },
  articleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  interactionIcons: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  tagChip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 12,
  },
  articleTitleContainer: {
    alignSelf: 'stretch',
  },
  articleTitle: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  articleDescriptionContainer: {
    alignSelf: 'stretch',
  },
  articleDescription: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#94B2C7',
  },
  metaContainer: {
    marginTop: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  readTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readTimeText: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: 12,
    color: '#94B2C7',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  scoreBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#243847',
    borderRadius: 2,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    backgroundColor: '#4A9EFF',
    borderRadius: 2,
  },
  scoreText: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: 11,
    color: '#94B2C7',
    minWidth: 60,
  },
  loadingText: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 16,
    color: '#94B2C7',
    marginTop: 16,
  },
  errorText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 16,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#4A9EFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 16,
    color: '#FFFFFF',
  },
  emptyText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 14,
    color: '#94B2C7',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  swipeAction: {
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    width: 120,
    marginBottom: 16,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 20,
  },
  swipeActionText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 4,
    textAlign: 'center',
  },
  loadMoreContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A9EFF',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 8,
    minWidth: 200,
  },
  loadMoreButtonPressed: {
    backgroundColor: '#3A7FDF',
    transform: [{ scale: 0.98 }],
  },
  loadMoreButtonDisabled: {
    backgroundColor: '#3A7FDF',
    opacity: 0.7,
  },
  loadMoreText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 16,
    color: '#FFFFFF',
  },
  loadMoreHint: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 12,
    color: '#94B2C7',
    marginTop: 8,
    textAlign: 'center',
  },
  endOfFeedContainer: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  endOfFeedText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  endOfFeedSubtext: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 14,
    color: '#94B2C7',
    textAlign: 'center',
  },
});
