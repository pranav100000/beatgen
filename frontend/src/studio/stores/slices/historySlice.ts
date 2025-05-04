import { Store } from '../../core/state/store';
import { RootState, SetFn, GetFn, StoreSliceCreator } from '../types';
import { historyManager } from '../../core/state/history/HistoryManager';
import { Action } from '../../core/state/history/actions/BaseAction';

// Define the state properties and actions for this slice
export interface HistorySlice {
  canUndo: boolean;
  canRedo: boolean;
  setCanUndo: (canUndo: boolean) => void; // Basic setters might still be useful
  setCanRedo: (canRedo: boolean) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  executeHistoryAction: (action: Action) => Promise<void>; // Action type needs to be consistent
  _updateHistoryState: () => void; // Internal helper to sync state
}

// Create the slice function
export const createHistorySlice: StoreSliceCreator<HistorySlice> = (set, get) => {
  const rootGet = get as GetFn; // Helper for root state access

  // Utility to set state within this slice
  const setHistoryState = (partial: Partial<HistorySlice> | ((state: HistorySlice) => Partial<HistorySlice>)) => set(partial);

  // Update canUndo/canRedo state based on the HistoryManager
  const _updateHistoryState = () => {
    if (historyManager) {
      setHistoryState({
        canUndo: historyManager.canUndo(),
        canRedo: historyManager.canRedo()
      });
    } else {
       console.error("Critical: HistoryManager singleton instance not available!");
       setHistoryState({ canUndo: false, canRedo: false });
    }
  };

  // Execute a history action and update state
  const executeHistoryAction = async (action: Action) => {
    const { _withErrorHandling } = rootGet();

    if (!historyManager) {
        console.error("Critical: HistoryManager singleton instance not available for execute!");
        return;
    }
    if (!_withErrorHandling) {
        console.error("_withErrorHandling not available for executeHistoryAction");
        return; 
    }

    const execute = async () => {
        await historyManager.executeAction(action);
        _updateHistoryState();
    };

    await _withErrorHandling(execute, `executeHistoryAction: ${action.constructor.name}`)();
  };

  const undo = async () => {
    const { _withErrorHandling } = rootGet();

     if (!historyManager) {
        console.error("Critical: HistoryManager singleton instance not available for undo!");
        return;
    }
     if (!_withErrorHandling) {
        console.error("_withErrorHandling not available for undo");
        return; 
    }

    const undoAction = async () => {
        if (historyManager.canUndo()) {
             await historyManager.undo();
            _updateHistoryState();
        } else {
            console.warn("Undo called but nothing to undo.");
        }
    };

    await _withErrorHandling(undoAction, 'undo')();
  };

  const redo = async () => {
    const { _withErrorHandling } = rootGet();

     if (!historyManager) {
        console.error("Critical: HistoryManager singleton instance not available for redo!");
        return;
    }
     if (!_withErrorHandling) {
        console.error("_withErrorHandling not available for redo");
        return; 
    }

    const redoAction = async () => {
        if (historyManager.canRedo()) {
            await historyManager.redo();
            _updateHistoryState();
        } else {
             console.warn("Redo called but nothing to redo.");
        }
    };

     await _withErrorHandling(redoAction, 'redo')();
  };

  return {
    // Initial state
    canUndo: false,
    canRedo: false,

    // Basic setters (might not be needed if _updateHistoryState is always used)
    setCanUndo: (canUndo) => setHistoryState({ canUndo }),
    setCanRedo: (canRedo) => setHistoryState({ canRedo }),

    // Actions
    undo,
    redo,
    executeHistoryAction,
    _updateHistoryState, // Expose helper if needed externally (e.g., after project load)
  };
};
