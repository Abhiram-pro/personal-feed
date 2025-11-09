/**
 * Recommendation Service
 * 
 * Client-side service to fetch personalized content recommendations
 * from the Gorse sync service
 */

import { auth } from '@/config/firebase';

export interface RecommendationItem {
  contentId: string;
  score: number;
  title: string;
  excerpt?: string;
  tags?: string[];
  publishedAt?: string;
  url?: string;
}

export interface RecommendationResponse {
  items: RecommendationItem[];
  source: 'gorse' | 'fallback';
  cached?: boolean;
  reason?: string;
}

// Get recommender service URL from environment
const RECOMMENDER_URL = process.env.EXPO_PUBLIC_RECOMMENDER_URL || 'http://localhost:3000';

/**
 * Fetch personalized recommendations for the current user
 */
export async function getRecommendations(count: number = 20): Promise<RecommendationResponse> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(
      `${RECOMMENDER_URL}/recommendations?uid=${user.uid}&count=${count}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error fetching recommendations:', error);
    throw error;
  }
}

/**
 * Invalidate recommendation cache (call after interests change)
 */
export async function invalidateRecommendationCache(): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) return;

    await fetch(`${RECOMMENDER_URL}/invalidate-cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uid: user.uid }),
    });
  } catch (error) {
    console.error('Error invalidating cache:', error);
  }
}

/**
 * Check service health
 */
export async function checkServiceHealth(): Promise<{
  status: string;
  firestore: string;
  gorse: string;
}> {
  const response = await fetch(`${RECOMMENDER_URL}/health`);
  return response.json();
}
