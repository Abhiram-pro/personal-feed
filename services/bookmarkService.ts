import { db } from '@/config/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where,
  serverTimestamp 
} from 'firebase/firestore';

export interface Bookmark {
  userId: string;
  contentId: string;
  title: string;
  url: string;
  excerpt?: string;
  tags: string[];
  bookmarkedAt: Date;
}

/**
 * Save an article as a bookmark
 */
export async function saveBookmark(
  userId: string,
  contentId: string,
  title: string,
  url: string,
  excerpt?: string,
  tags: string[] = []
): Promise<void> {
  try {
    const bookmarkRef = doc(db, 'bookmarks', `${userId}_${contentId}`);
    
    await setDoc(bookmarkRef, {
      userId,
      contentId,
      title,
      url,
      excerpt,
      tags,
      bookmarkedAt: serverTimestamp(),
    });
    
    console.log('Bookmark saved:', contentId);
  } catch (error) {
    console.error('Error saving bookmark:', error);
    throw new Error('Failed to save bookmark');
  }
}

/**
 * Remove a bookmark
 */
export async function removeBookmark(
  userId: string,
  contentId: string
): Promise<void> {
  try {
    const bookmarkRef = doc(db, 'bookmarks', `${userId}_${contentId}`);
    await deleteDoc(bookmarkRef);
    
    console.log('Bookmark removed:', contentId);
  } catch (error) {
    console.error('Error removing bookmark:', error);
    throw new Error('Failed to remove bookmark');
  }
}

/**
 * Check if an article is bookmarked
 */
export async function isBookmarked(
  userId: string,
  contentId: string
): Promise<boolean> {
  try {
    const bookmarkRef = doc(db, 'bookmarks', `${userId}_${contentId}`);
    const bookmarkDoc = await getDocs(
      query(collection(db, 'bookmarks'), where('__name__', '==', bookmarkRef.id))
    );
    
    return !bookmarkDoc.empty;
  } catch (error) {
    console.error('Error checking bookmark:', error);
    return false;
  }
}

/**
 * Get all bookmarks for a user
 */
export async function getUserBookmarks(userId: string): Promise<Bookmark[]> {
  try {
    const bookmarksQuery = query(
      collection(db, 'bookmarks'),
      where('userId', '==', userId)
    );
    
    const snapshot = await getDocs(bookmarksQuery);
    const bookmarks: Bookmark[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      bookmarks.push({
        userId: data.userId,
        contentId: data.contentId,
        title: data.title,
        url: data.url,
        excerpt: data.excerpt,
        tags: data.tags || [],
        bookmarkedAt: data.bookmarkedAt?.toDate() || new Date(),
      });
    });
    
    return bookmarks;
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    return [];
  }
}
