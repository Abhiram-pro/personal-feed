/**
 * Extended user profile model with fields for personalization and insights
 */
export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  name?: string;
  interests: string[];
  createdAt: Date;
  
  // New fields for insights and personalization
  articlesRead?: number;
  lastInsightDismissed?: {
    [key: string]: Date;
  };
}

/**
 * Helper to create a default user profile
 */
export function createDefaultUserProfile(uid: string, email: string): Partial<UserProfile> {
  return {
    uid,
    email,
    interests: [],
    articlesRead: 0,
    lastInsightDismissed: {},
    createdAt: new Date(),
  };
}
