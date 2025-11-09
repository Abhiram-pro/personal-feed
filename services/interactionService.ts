/**
 * Interaction Service
 * 
 * Handles user interactions and syncs them to Gorse for ML learning
 */

import { db, auth } from '@/config/firebase';
import { collection, addDoc, Timestamp, doc, updateDoc, increment, setDoc, getDoc } from 'firebase/firestore';

const RECOMMENDER_URL = process.env.EXPO_PUBLIC_RECOMMENDER_URL || 'http://localhost:3000';

export type InteractionType = 'like' | 'dismiss' | 'view' | 'save';

/**
 * Save interaction to Firestore and sync to Gorse immediately
 */
export async function saveInteraction(
  contentId: string,
  type: InteractionType
): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Save to Firestore
    await addDoc(collection(db, 'interactions'), {
      userId: user.uid,
      contentId,
      type,
      timestamp: Timestamp.now(),
    });

    // Sync to Gorse immediately for real-time learning
    await fetch(`${RECOMMENDER_URL}/interaction/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.uid,
        contentId,
        type,
      }),
    });

    console.log(`✓ Interaction synced: ${type} on ${contentId}`);
    
    // Increment articlesRead counter when user views an article
    if (type === 'view') {
      await incrementArticlesRead(user.uid);
    }
  } catch (error) {
    console.error('Error saving interaction:', error);
    throw error;
  }
}

/**
 * Increment the articles read counter for a user
 */
async function incrementArticlesRead(userId: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    
    // Check if user document exists
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      // Update existing document
      await updateDoc(userRef, {
        articlesRead: increment(1),
      });
    } else {
      // Create new document with initial count
      await setDoc(userRef, {
        articlesRead: 1,
      }, { merge: true });
    }
    
    console.log('✓ Articles read counter incremented');
  } catch (error) {
    console.error('Error incrementing articles read:', error);
  }
}

/**
 * Dismiss an insight card and track it in user profile
 */
export async function dismissInsight(
  insightType: string
): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const userRef = doc(db, 'users', user.uid);
    
    await updateDoc(userRef, {
      [`lastInsightDismissed.${insightType}`]: Timestamp.now(),
    });
    
    console.log(`✓ Insight dismissed: ${insightType}`);
  } catch (error) {
    console.error('Error dismissing insight:', error);
    throw error;
  }
}
