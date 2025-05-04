import { useEffect } from 'react';
import { historyManager } from '../core/state/history/HistoryManager';
import { useStudioStore } from '../stores/studioStore';

/**
 * Custom hook to sync HistoryManager state with StudioStore
 * This centralizes the canUndo/canRedo state updates
 */
export const useHistorySync = () => {
  const { setCanUndo, setCanRedo } = useStudioStore();
  
  useEffect(() => {
    // Function to update the store based on history state
    const updateHistoryState = () => {
      setCanUndo(historyManager.canUndo());
      setCanRedo(historyManager.canRedo());
    };
    
    // Subscribe to history changes
    historyManager.subscribe(updateHistoryState);
    
    // Initial sync
    updateHistoryState();
    
    // Cleanup on unmount
    return () => {
      historyManager.unsubscribe(updateHistoryState);
    };
  }, [setCanUndo, setCanRedo]);
};