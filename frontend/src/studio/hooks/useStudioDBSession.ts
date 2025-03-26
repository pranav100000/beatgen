import { useEffect } from 'react';
import { db } from '../core/db/dexie-client';

// This key tracks the active studio session
const STUDIO_SESSION_KEY = 'studioSessionActive';

/**
 * Custom hook that manages the database lifecycle for the Studio component.
 * - Creates a persistent session identifier
 * - Cleans up database when navigating away from Studio
 * - Handles browser close/refresh via beforeunload
 * - Detects and repairs orphaned sessions from crashes/refresh
 */
export function useStudioDBSession() {
  useEffect(() => {
    const startSession = async () => {
      // Check if a previous session didn't clean up properly
      const lastSessionActive = localStorage.getItem(STUDIO_SESSION_KEY) === 'true';
      
      if (lastSessionActive) {
        // If there was a previous session that didn't clean up, do it now
        console.log('Detected orphaned studio session, cleaning up database...');
        await db.clearAllFiles();
      }
      
      // Mark that we're starting a new session
      localStorage.setItem(STUDIO_SESSION_KEY, 'true');
      console.log('Studio session started - database ready');
    };
    
    // Handle beforeunload for browser close/refresh
    const handleBeforeUnload = () => {
      // We can't do async operations in beforeunload,
      // but we can mark the session as ended
      localStorage.removeItem(STUDIO_SESSION_KEY);
      console.log('Browser closing/refreshing - marked session as inactive');
    };
    
    // Start session and add listener
    startSession();
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Cleanup function
    return () => {
      // This runs when navigating away from Studio
      console.log('Studio session ending, cleaning up database...');
      
      // Clear database
      db.clearAllFiles().catch(err => {
        console.error('Error clearing database:', err);
      });
      
      // Remove session flag
      localStorage.removeItem(STUDIO_SESSION_KEY);
      
      // Remove beforeunload listener
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      console.log('Studio database session cleanup complete');
    };
  }, []);
}