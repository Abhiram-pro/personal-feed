import { StyleSheet, View, Text, Pressable, ActivityIndicator, ScrollView, useWindowDimensions, Animated, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import RenderHTML from 'react-native-render-html';
import * as Haptics from 'expo-haptics';
import { saveInteraction } from '@/services/interactionService';

const RECOMMENDER_URL = process.env.EXPO_PUBLIC_RECOMMENDER_URL || 'http://localhost:3000';

interface ArticleData {
  title: string;
  byline?: string;
  content: string;
  excerpt?: string;
  siteName?: string;
  publishedTime?: string;
}

export default function ReaderScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams();
  const { url, title: paramTitle, contentId } = params;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [userAction, setUserAction] = useState<'like' | 'dislike' | null>(null);
  const [showActions, setShowActions] = useState(false);
  
  const likeScale = useRef(new Animated.Value(1)).current;
  const dislikeScale = useRef(new Animated.Value(1)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchArticle();
    
    // Show action buttons after a delay
    const timer = setTimeout(() => {
      setShowActions(true);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [url]);

  const handleLike = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Animate button
      Animated.sequence([
        Animated.timing(likeScale, {
          toValue: 1.2,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(likeScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
      
      setUserAction('like');
      showFeedback('Liked! 👍');
      
      // Save interaction and sync to Gorse
      if (contentId) {
        await saveInteraction(contentId as string, 'like');
      }
    } catch (error) {
      console.error('Error saving like:', error);
    }
  };

  const handleDislike = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Animate button
      Animated.sequence([
        Animated.timing(dislikeScale, {
          toValue: 1.2,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(dislikeScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
      
      setUserAction('dislike');
      showFeedback('Not interested');
      
      // Save interaction and sync to Gorse
      if (contentId) {
        await saveInteraction(contentId as string, 'dismiss');
      }
      
      // Close article with smooth animation after a delay
      setTimeout(() => {
        Animated.timing(screenOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          router.back();
        });
      }, 1000);
    } catch (error) {
      console.error('Error saving dislike:', error);
    }
  };

  const showFeedback = (message: string) => {
    Animated.sequence([
      Animated.timing(feedbackOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(feedbackOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const fetchArticle = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${RECOMMENDER_URL}/article/parse?url=${encodeURIComponent(url as string)}`
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to parse article');
      }

      setArticle({
        title: data.title,
        byline: data.byline,
        content: data.content,
        excerpt: data.excerpt,
        siteName: data.siteName,
        publishedTime: data.publishedTime,
      });
    } catch (err: any) {
      console.error('Error fetching article:', err);
      setError(err.message || 'Failed to load article');
    } finally {
      setLoading(false);
    }
  };

  // Custom HTML renderers for dark theme with refined typography
  const tagsStyles = {
    body: {
      color: '#E8E8E8',
      fontSize: 18,
      lineHeight: 30,
      fontFamily: 'System',
      fontWeight: '400',
    },
    p: {
      marginBottom: 20,
      color: '#E8E8E8',
      fontSize: 18,
      lineHeight: 30,
    },
    h1: {
      color: '#FFFFFF',
      fontSize: 32,
      fontWeight: '700',
      marginTop: 32,
      marginBottom: 16,
      lineHeight: 40,
    },
    h2: {
      color: '#FFFFFF',
      fontSize: 26,
      fontWeight: '700',
      marginTop: 28,
      marginBottom: 14,
      lineHeight: 34,
    },
    h3: {
      color: '#FFFFFF',
      fontSize: 22,
      fontWeight: '600',
      marginTop: 24,
      marginBottom: 12,
      lineHeight: 30,
    },
    h4: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '600',
      marginTop: 20,
      marginBottom: 10,
      lineHeight: 28,
    },
    h5: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
      marginTop: 18,
      marginBottom: 8,
      lineHeight: 26,
    },
    h6: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginTop: 16,
      marginBottom: 6,
      lineHeight: 24,
    },
    a: {
      color: '#5BA3FF',
      textDecorationLine: 'underline',
      textDecorationColor: '#5BA3FF',
    },
    strong: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    b: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    em: {
      fontStyle: 'italic',
      color: '#E8E8E8',
    },
    i: {
      fontStyle: 'italic',
      color: '#E8E8E8',
    },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: '#5BA3FF',
      paddingLeft: 20,
      marginLeft: 0,
      marginVertical: 20,
      fontStyle: 'italic',
      color: '#B0B0B0',
      backgroundColor: '#1A2730',
      paddingVertical: 12,
      paddingRight: 16,
      borderRadius: 4,
    },
    code: {
      backgroundColor: '#1A2730',
      color: '#5BA3FF',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      fontFamily: 'Courier',
      fontSize: 16,
    },
    pre: {
      backgroundColor: '#1A2730',
      padding: 16,
      borderRadius: 8,
      marginVertical: 16,
      overflow: 'scroll',
    },
    ul: {
      marginVertical: 12,
      paddingLeft: 24,
    },
    ol: {
      marginVertical: 12,
      paddingLeft: 24,
    },
    li: {
      marginBottom: 10,
      color: '#E8E8E8',
      fontSize: 18,
      lineHeight: 28,
    },
    img: {
      marginVertical: 20,
      borderRadius: 12,
      backgroundColor: '#1A2730',
    },
    figure: {
      marginVertical: 24,
    },
    figcaption: {
      color: '#94B2C7',
      fontSize: 14,
      fontStyle: 'italic',
      marginTop: 8,
      textAlign: 'center',
    },
    hr: {
      marginVertical: 24,
      borderBottomWidth: 1,
      borderBottomColor: '#243847',
    },
    table: {
      marginVertical: 16,
      borderWidth: 1,
      borderColor: '#243847',
      borderRadius: 8,
    },
    th: {
      backgroundColor: '#1A2730',
      color: '#FFFFFF',
      fontWeight: '600',
      padding: 12,
      borderBottomWidth: 2,
      borderBottomColor: '#243847',
    },
    td: {
      color: '#E8E8E8',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#243847',
    },
  };

  const classesStyles = {
    'article-content': {
      padding: 0,
    },
  };

  const renderersProps = {
    img: {
      enableExperimentalPercentWidth: true,
    },
    a: {
      onPress: (event: any, href: string) => {
        console.log('Link pressed:', href);
        // Could open in browser or show preview
      },
    },
  };

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      
      {/* Back Button - Floating */}
      <View style={[styles.backButtonContainer, { top: insets.top + 8 }]}>
        <Pressable 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Action Buttons - Floating */}
      {showActions && article && !loading && !error && (
        <View style={[styles.actionButtonsContainer, { bottom: insets.bottom + 24 }]}>
          <Animated.View style={{ transform: [{ scale: dislikeScale }] }}>
            <Pressable
              style={[
                styles.actionButton,
                styles.dislikeButton,
                userAction === 'dislike' && styles.actionButtonActive,
              ]}
              onPress={handleDislike}
              disabled={userAction !== null}
            >
              <Ionicons 
                name={userAction === 'dislike' ? 'close-circle' : 'close-circle-outline'} 
                size={28} 
                color={userAction === 'dislike' ? '#FF6B6B' : '#FFFFFF'} 
              />
            </Pressable>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <Pressable
              style={[
                styles.actionButton,
                styles.likeButton,
                userAction === 'like' && styles.actionButtonActive,
              ]}
              onPress={handleLike}
              disabled={userAction !== null}
            >
              <Ionicons 
                name={userAction === 'like' ? 'heart' : 'heart-outline'} 
                size={28} 
                color={userAction === 'like' ? '#FF6B6B' : '#FFFFFF'} 
              />
            </Pressable>
          </Animated.View>
        </View>
      )}

      {/* Feedback Toast */}
      <Animated.View 
        style={[
          styles.feedbackToast,
          { 
            opacity: feedbackOpacity,
            bottom: insets.bottom + 100,
          }
        ]}
        pointerEvents="none"
      >
        <Text style={styles.feedbackText}>
          {userAction === 'like' ? 'Liked! 👍' : 'Not interested'}
        </Text>
      </Animated.View>

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading article...</Text>
        </View>
      )}

      {/* Error State */}
      {error && !loading && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#FF6B6B" />
          <Text style={styles.errorTitle}>Unable to Load Article</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>
            Some websites block article parsing. You can open it in your browser instead.
          </Text>
          <Pressable 
            style={styles.openBrowserButton} 
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Linking.openURL(url as string);
            }}
          >
            <Ionicons name="open-outline" size={20} color="#FFFFFF" />
            <Text style={styles.openBrowserButtonText}>Open in Browser</Text>
          </Pressable>
          <Pressable style={styles.retryButton} onPress={fetchArticle}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
          <Pressable style={styles.backButtonAlt} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      )}

      {/* Reading Progress Bar */}
      {article && !loading && !error && (
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${readingProgress}%` }]} />
        </View>
      )}

      {/* Article Content */}
      {article && !loading && !error && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            const progress = (contentOffset.y / (contentSize.height - layoutMeasurement.height)) * 100;
            setReadingProgress(Math.min(Math.max(progress, 0), 100));
          }}
          scrollEventThrottle={16}
        >
          {/* Article Header */}
          <View style={styles.articleHeader}>
            <Text style={styles.articleTitle}>{article.title}</Text>
            
            <View style={styles.metadataContainer}>
              {article.byline && (
                <View style={styles.metadataRow}>
                  <Ionicons name="person-outline" size={14} color="#94B2C7" />
                  <Text style={styles.articleByline}>{article.byline}</Text>
                </View>
              )}
              
              {article.publishedTime && (
                <View style={styles.metadataRow}>
                  <Ionicons name="time-outline" size={14} color="#94B2C7" />
                  <Text style={styles.articleDate}>
                    {new Date(article.publishedTime).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
              )}
              
              {article.excerpt && (
                <Text style={styles.articleExcerpt}>{article.excerpt}</Text>
              )}
            </View>
          </View>

          {/* Article Body */}
          <View style={styles.articleBody}>
            <RenderHTML
              contentWidth={width - 40}
              source={{ html: article.content }}
              tagsStyles={tagsStyles}
              classesStyles={classesStyles}
              renderersProps={renderersProps}
              defaultTextProps={{
                selectable: true,
              }}
              enableExperimentalMarginCollapsing={true}
            />
          </View>
          
          {/* End of Article Indicator */}
          <View style={styles.endIndicator}>
            <View style={styles.endDivider} />
            <Text style={styles.endText}>End of Article</Text>
            <View style={styles.endDivider} />
          </View>
        </ScrollView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121C21',
  },
  backButtonContainer: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(26, 39, 48, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  articleHeader: {
    paddingHorizontal: 20,
    paddingTop: 80,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#243847',
    backgroundColor: '#121C21',
  },
  articleTitle: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 32,
    lineHeight: 42,
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  metadataContainer: {
    marginTop: 16,
    gap: 10,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  articleByline: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: 14,
    color: '#B0B0B0',
    letterSpacing: 0.2,
  },
  articleDate: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 13,
    color: '#94B2C7',
    letterSpacing: 0.3,
  },
  articleExcerpt: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 24,
    color: '#94B2C7',
    marginTop: 12,
    fontStyle: 'italic',
  },
  articleBody: {
    paddingHorizontal: 20,
    paddingTop: 28,
    maxWidth: 680,
    alignSelf: 'center',
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 16,
    color: '#94B2C7',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 20,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: 14,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorHint: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 14,
    color: '#94B2C7',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  openBrowserButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4A9EFF',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginBottom: 12,
  },
  openBrowserButtonText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 16,
    color: '#FFFFFF',
  },
  retryButton: {
    backgroundColor: 'rgba(74, 158, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#4A9EFF',
  },
  retryButtonText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 16,
    color: '#4A9EFF',
  },
  backButtonAlt: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 16,
    color: '#94B2C7',
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: '#1A2730',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#5BA3FF',
  },
  endIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 16,
  },
  endDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#243847',
  },
  endText: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: 12,
    color: '#94B2C7',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  actionButtonsContainer: {
    position: 'absolute',
    right: 20,
    flexDirection: 'column',
    gap: 16,
    zIndex: 10,
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(26, 39, 48, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  likeButton: {
    backgroundColor: 'rgba(26, 39, 48, 0.95)',
  },
  dislikeButton: {
    backgroundColor: 'rgba(26, 39, 48, 0.95)',
  },
  actionButtonActive: {
    borderColor: '#5BA3FF',
    backgroundColor: 'rgba(91, 163, 255, 0.2)',
  },
  feedbackToast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(26, 39, 48, 0.95)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  feedbackText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
