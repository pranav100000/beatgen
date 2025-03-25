import { TrackContentProps, TrackTypeHandler } from './TrackPreviewTypes';
import { TrackState } from '../../core/types/track';
import MidiTrackContent from './MidiTrackContent';
import { usePianoRoll } from '../piano-roll/PianoRollWindow';
import React from 'react';
import { MidiTrack } from '../../core/tracks/MidiTrack';
import { useStore } from '../../core/state/StoreContext';
import { Note } from '../../core/types/note';

export class MidiTrackHandler implements TrackTypeHandler {
  private pianoRollHook?: ReturnType<typeof usePianoRoll>;
  private storeHook?: () => ReturnType<typeof useStore>;
  private midiTrackCache: Map<string, MidiTrack> = new Map();
  private trackSubscriptions: Map<string, () => void> = new Map(); // Track-specific unsubscribe functions
  private forceRerenderCallbacks: Map<string, () => void> = new Map();
  private activeTracks: Set<string> = new Set(); // Track which tracks have been activated
  private activationTimeouts: Map<string, NodeJS.Timeout> = new Map(); // Track active timeouts for cleanup
  private pendingActivations: Set<string> = new Set(); // Track tracks with pending activation
  private activationAttempts: Map<string, number> = new Map(); // Count activation attempts per track
  private static MAX_ACTIVATION_ATTEMPTS = 3; // Maximum number of activation attempts per track
  private static initialized = false; // Static flag to ensure one-time setup

  // Method to set the piano roll hook from the component
  setPianoRollHook(hook: ReturnType<typeof usePianoRoll>) {
    // Only set up once per app session
    const isFirstSetup = !MidiTrackHandler.initialized;
    
    this.pianoRollHook = hook;
    
    // When hook changes, recreate all track subscriptions
    this.refreshAllSubscriptions();
    
    if (isFirstSetup) {
      MidiTrackHandler.initialized = true;
      console.log('MidiTrackHandler: First-time setup complete - additional activations will be limited');
    }
    
    console.log('MidiTrackHandler: PianoRoll hook set, subscriptions refreshed');
  }
  
  // Method to set the store hook from the component
  setStoreHook(store: ReturnType<typeof useStore>) {
    this.storeHook = () => store;
  }
  
  // Refresh all track subscriptions
  private refreshAllSubscriptions() {
    if (!this.pianoRollHook) return;
    
    // Clean up existing subscriptions
    this.trackSubscriptions.forEach(unsubscribe => unsubscribe());
    this.trackSubscriptions.clear();
    
    // Create new subscriptions for each track we're handling
    this.midiTrackCache.forEach((_, trackId) => {
      this.subscribeToTrackChanges(trackId);
    });
  }
  
  // Queue track activation with a delay to ensure store is initialized
  private queueTrackActivation(trackId: string, delayMs: number = 200) {
    // Don't queue if already activated or already pending
    if (this.activeTracks.has(trackId) || this.pendingActivations.has(trackId)) {
      return;
    }
    
    // Check activation attempt count
    const attempts = this.activationAttempts.get(trackId) || 0;
    if (attempts >= MidiTrackHandler.MAX_ACTIVATION_ATTEMPTS) {
      console.warn(`MidiTrackHandler: Maximum activation attempts (${MidiTrackHandler.MAX_ACTIVATION_ATTEMPTS}) reached for track ${trackId}, will not retry`);
      return;
    }
    
    // Increment attempt counter
    this.activationAttempts.set(trackId, attempts + 1);
    
    console.log(`MidiTrackHandler: Queueing activation for track ${trackId} with ${delayMs}ms delay (attempt ${attempts + 1}/${MidiTrackHandler.MAX_ACTIVATION_ATTEMPTS})`);
    
    // Mark this track as having pending activation
    this.pendingActivations.add(trackId);
    
    // Clear any existing timeout for this track
    if (this.activationTimeouts.has(trackId)) {
      clearTimeout(this.activationTimeouts.get(trackId));
      this.activationTimeouts.delete(trackId);
    }
    
    // Set a timeout to try activating the track after a delay
    const timeoutId = setTimeout(() => {
      this.pendingActivations.delete(trackId); // Clear pending status
      this.activationTimeouts.delete(trackId); // Remove from active timeouts
      
      if (!this.activeTracks.has(trackId)) {
        console.log(`MidiTrackHandler: Attempting delayed activation for track ${trackId} (attempt ${attempts + 1}/${MidiTrackHandler.MAX_ACTIVATION_ATTEMPTS})`);
        this.ensureTrackIsActive(trackId);
      }
    }, delayMs);
    
    // Store the timeout ID for cleanup
    this.activationTimeouts.set(trackId, timeoutId);
  }
  
  // Subscribe to changes for a specific track
  private subscribeToTrackChanges(trackId: string) {
    if (!this.pianoRollHook) {
      console.log(`MidiTrackHandler: Cannot subscribe to track ${trackId} - pianoRollHook not available`);
      return;
    }
    
    try {
      // Clean up existing subscription for this track
      if (this.trackSubscriptions.has(trackId)) {
        const unsubscribe = this.trackSubscriptions.get(trackId);
        if (unsubscribe) unsubscribe();
        this.trackSubscriptions.delete(trackId);
      }
      
      // Create new subscription that listens for all notes from PianoRollContext
      // but only processes ones for this specific track
      const unsubscribe = this.pianoRollHook.subscribeToNoteChanges(
        (changedTrackId, notes) => {
          // Only process notes for this specific track
          if (changedTrackId === trackId) {
            console.log(`MidiTrackHandler: Subscription received notes for track ${trackId}`, {
              noteCount: notes.length,
              fromPianoRoll: true
            });
            this.handleNoteChanges(trackId, notes);
          }
        }
      );
      
      // Store the unsubscribe function
      this.trackSubscriptions.set(trackId, unsubscribe);
      
      // Also check if there are notes in the MidiManager for initial display
      if (this.storeHook) {
        try {
          const store = this.storeHook();
          if (store) {
            const midiManager = store.getMidiManager();
            if (midiManager) {
              const managerNotes = midiManager.getNotesForTrack(trackId);
              
              if (managerNotes.length > 0) {
                console.log(`MidiTrackHandler: Found ${managerNotes.length} notes in MidiManager for track ${trackId} during subscription`);
                this.handleNoteChanges(trackId, managerNotes);
              }
            }
          }
        } catch (error) {
          console.warn(`MidiTrackHandler: Error checking for notes in MidiManager for track ${trackId}:`, error);
        }
      }
      
      console.log(`MidiTrackHandler: Subscribed to note changes for track ${trackId}`);
      
      // We no longer queue activation here - that will be handled by renderContent
      // This prevents potential activation loops
    } catch (error) {
      console.warn(`MidiTrackHandler: Error subscribing to track changes for ${trackId}:`, error);
    }
  }

  // Ensure a track is "active" in the piano roll context
  private ensureTrackIsActive(trackId: string) {
    // Only do this once per track to avoid overhead
    if (this.activeTracks.has(trackId)) {
      console.log(`MidiTrackHandler: Track ${trackId} is already active, skipping activation`);
      return;
    }
    
    // Clear any pending activation for this track since we're handling it now
    this.pendingActivations.delete(trackId);
    
    // Make sure both hooks are available and the store is initialized
    if (!this.pianoRollHook || !this.storeHook) {
      console.log(`MidiTrackHandler: Cannot activate track ${trackId} - hooks not available yet`);
      return;
    }
    
    try {
      // Try to get the MidiManager, but handle errors carefully
      let midiManager;
      try {
        const store = this.storeHook();
        if (!store) return;
        midiManager = store.getMidiManager();
      } catch (error) {
        console.warn(`MidiTrackHandler: Store not initialized yet - cannot activate track ${trackId}`, error);
        return; // Exit early if store is not ready
      }
      
      // If we can't get the MidiManager, the store might not be initialized yet
      if (!midiManager) {
        console.log(`MidiTrackHandler: Cannot activate track ${trackId} - MidiManager not available yet`);
        return;
      }
      
      const notes = midiManager.getNotesForTrack(trackId);
      
      // Temporarily "activate" the track in the PianoRollContext
      // This doesn't actually open the piano roll UI but sets the track as active in the context
      // Use the current track color (already set by TrackPreview)
      this.pianoRollHook.openPianoRoll(trackId, trackId, notes);
      
      // Close the piano roll UI immediately (without clearing the active track)
      if (this.pianoRollHook.isOpen) {
        this.pianoRollHook.closePianoRoll(true); // Pass true to maintain the active track
      }
      
      // Mark this track as activated
      this.activeTracks.add(trackId);
      
      console.log(`MidiTrackHandler: Automatically activated track ${trackId} with ${notes.length} notes`);
    } catch (error) {
      console.warn(`MidiTrackHandler: Error activating track ${trackId}:`, error);
    }
  }

  // Handle note changes from the piano roll
  private handleNoteChanges(trackId: string, notes: Note[]) {
    console.log(`MidiTrackHandler: Received note changes for track ${trackId}`, {
      noteCount: notes.length
    });
    
    // Update our cached MidiTrack
    this.updateNotes(trackId, notes);
    
    // Trigger re-render if we have a callback for this track
    this.triggerTrackRerender(trackId);
  }
  
  // Trigger re-render for a specific track
  private triggerTrackRerender(trackId: string) {
    if (this.forceRerenderCallbacks.has(trackId)) {
      const forceRerender = this.forceRerenderCallbacks.get(trackId);
      if (forceRerender) {
        console.log(`MidiTrackHandler: Forcing re-render for track ${trackId}`);
        forceRerender();
      }
    }
  }

  // Register a callback to force re-render for a specific track
  registerRerenderCallback(trackId: string, callback: () => void) {
    this.forceRerenderCallbacks.set(trackId, callback);
    console.log(`MidiTrackHandler: Registered re-render callback for track ${trackId}`);
    
    // Ensure we have a subscription for this track
    if (!this.trackSubscriptions.has(trackId) && this.pianoRollHook) {
      this.subscribeToTrackChanges(trackId);
    }
    
    // Return unregister function
    return () => {
      this.forceRerenderCallbacks.delete(trackId);
      console.log(`MidiTrackHandler: Unregistered re-render callback for track ${trackId}`);
    };
  }

  // Get or create a MidiTrack instance for the provided track state
  getMidiTrack(track: TrackState): MidiTrack | null {
    // Check if we already have a cached instance
    if (this.midiTrackCache.has(track.id)) {
      return this.midiTrackCache.get(track.id) || null;
    }

    // Create a new instance if we have the store
    try {
      if (!this.storeHook) {
        console.warn('MidiTrackHandler: Cannot create MidiTrack - store hook not available');
        return null;
      }
      
      const store = this.storeHook();
      if (!store) {
        console.warn('MidiTrackHandler: Cannot create MidiTrack - store not available');
        return null;
      }
      
      try {
        // This might throw if store isn't initialized yet
        const midiManager = store.getMidiManager();
        
        if (!midiManager) {
          console.warn('MidiTrackHandler: Cannot create MidiTrack - MidiManager not available');
          return null;
        }
        
        // For now, use track ID as default instrument ID
        const instrumentId = track.id;
        
        // Create a new MidiTrack with the MidiManager for synchronization
        const midiTrack = new MidiTrack("midi track", track.id, instrumentId, [], midiManager);
        
        // Cache the track for future use
        this.midiTrackCache.set(track.id, midiTrack);
        
        // Set up subscription for this track
        this.subscribeToTrackChanges(track.id);
        
        // Don't auto-activate here - we'll do that separately after track creation is complete
        // This helps avoid lifecycle issues when store might not be fully initialized
        
        console.log('Created MidiTrack for track:', {
          trackId: track.id,
          instrumentId
        });
        
        return midiTrack;
      } catch (error) {
        console.warn('MidiTrackHandler: Error creating MidiTrack:', error);
        return null;
      }
    } catch (error) {
      console.warn('MidiTrackHandler: Could not create MidiTrack:', error);
      return null;
    }
  }

  // Update notes for a track
  updateNotes(trackId: string, notes: Note[]) {
    const track = this.midiTrackCache.get(trackId);
    if (track) {
      track.updateNotes(notes);
      
      // If we have a MidiManager, update it as well to ensure consistency
      if (this.storeHook) {
        const store = this.storeHook();
        if (store) {
          const midiManager = store.getMidiManager();
          midiManager.updateTrack(trackId, notes);
        }
      }
      
      console.log(`MidiTrackHandler: Updated notes for track ${trackId}`, {
        noteCount: notes.length
      });
      return true;
    }
    return false;
  }

  renderContent(props: TrackContentProps): React.ReactElement {
    // Ensure the track has a MidiTrack instance if possible
    let notesToPass: Note[] = [];
    
    try {
      if (!this.storeHook) {
        console.log(`MidiTrackHandler: Cannot render content for track ${props.track.id} - store hook not available yet`);
      } else {
        // Try to get the MidiManager - might throw if store is not initialized
        let midiManager;
        try {
          const store = this.storeHook();
          if (!store) throw new Error("Store not available");
          midiManager = store.getMidiManager();
        } catch (error) {
          console.log(`MidiTrackHandler: Store not ready for track ${props.track.id} rendering - will retry later`);
          
          // Only queue activation if within attempt limits
          const attempts = this.activationAttempts.get(props.track.id) || 0;
          if (attempts < MidiTrackHandler.MAX_ACTIVATION_ATTEMPTS && 
              !this.activeTracks.has(props.track.id) && 
              !this.pendingActivations.has(props.track.id)) {
            this.queueTrackActivation(props.track.id, 500); // Use longer delay for store initialization
          }
          
          // Still return component with empty notes
          const modifiedProps = {
            ...props,
            notes: [],
            trackId: props.track.id,
            registerRerenderCallback: (callback: () => void) => 
              this.registerRerenderCallback(props.track.id, callback)
          };
          
          return React.createElement(MidiTrackContent, modifiedProps);
        }
        
        if (!midiManager) {
          console.log(`MidiTrackHandler: Cannot render content for track ${props.track.id} - MidiManager not available yet`);
        } else {
          const midiTrack = this.getMidiTrack(props.track);
          
          // Only queue activation if track not active, not pending activation, and within attempt limits
          const attempts = this.activationAttempts.get(props.track.id) || 0;
          if (attempts < MidiTrackHandler.MAX_ACTIVATION_ATTEMPTS && 
              !this.activeTracks.has(props.track.id) && 
              !this.pendingActivations.has(props.track.id)) {
            this.queueTrackActivation(props.track.id);
          }
          
          // If this is the first time we're rendering this track, try to get notes from MidiManager
          if (midiTrack) {
            const managerNotes = midiManager.getNotesForTrack(props.track.id);
            
            console.log(`MidiTrackHandler: Checking for notes in MidiManager for track ${props.track.id}`, {
              managerNotesCount: managerNotes.length,
              trackNotesCount: midiTrack.getNotes().length
            });
            
            // Always check MidiManager for the most up-to-date notes
            if (managerNotes.length > 0) {
              // Ensure our MidiTrack is in sync with the MidiManager
              midiTrack.updateNotes(managerNotes);
              // Use the manager notes directly to ensure we have the latest data
              notesToPass = [...managerNotes]; 
              console.log(`MidiTrackHandler: Using notes from MidiManager for track ${props.track.id}`, {
                noteCount: notesToPass.length
              });
            } else {
              // Fall back to notes from the MidiTrack cache
              notesToPass = midiTrack.getNotes();
              console.log(`MidiTrackHandler: Using cached notes for track ${props.track.id}`, {
                noteCount: notesToPass.length
              });
            }
          }
        }
      }
    } catch (error) {
      console.warn(`MidiTrackHandler: Error rendering content for track ${props.track.id}:`, error);
    }
    
    // Create modified props including the notes and a forceUpdate callback
    const modifiedProps = {
      ...props,
      notes: notesToPass,
      trackId: props.track.id,
      registerRerenderCallback: (callback: () => void) => 
        this.registerRerenderCallback(props.track.id, callback)
    };
    
    return React.createElement(MidiTrackContent, modifiedProps);
  }
  
  handleClick(track: TrackState) {
    console.log('MidiTrackHandler: Opening piano roll for track', track.id);
    
    try {
      // Ensure we have a MidiTrack instance for this track
      const midiTrack = this.getMidiTrack(track);
      
      // Subscribe to track changes if not yet subscribed
      if (!this.trackSubscriptions.has(track.id) && this.pianoRollHook) {
        this.subscribeToTrackChanges(track.id);
      }
      
      // Open the piano roll with this track's ID and notes
      if (!this.pianoRollHook) {
        console.warn('MidiTrackHandler: Cannot open piano roll - hook not available');
        return;
      }
      
      try {
        // Get the track's notes to pass to the piano roll
        const notes = midiTrack?.getNotes() || [];
        
        // Pass trackId, instrumentId, and notes to the piano roll
        this.pianoRollHook.openPianoRoll(track.id, track.id, notes);
        
        // Directly mark the track as active since the user has clicked on it
        // This bypasses the queue system entirely for user-initiated actions
        this.activeTracks.add(track.id);
        
        // Cancel any pending activation timeouts for this track
        if (this.activationTimeouts.has(track.id)) {
          clearTimeout(this.activationTimeouts.get(track.id));
          this.activationTimeouts.delete(track.id);
        }
        
        // Clear the pending flag
        this.pendingActivations.delete(track.id);
        
        console.log('MidiTrackHandler: Opened piano roll and marked track as active:', {
          trackId: track.id,
          noteCount: notes.length
        });
      } catch (error) {
        console.warn(`MidiTrackHandler: Error opening piano roll for track ${track.id}:`, error);
      }
    } catch (error) {
      console.warn(`MidiTrackHandler: Error handling click for track ${track.id}:`, error);
    }
  }

  // Clean up resources when the handler is no longer needed
  dispose() {
    // Clear all subscriptions
    this.trackSubscriptions.forEach(unsubscribe => unsubscribe());
    this.trackSubscriptions.clear();
    
    // Clear all re-render callbacks
    this.forceRerenderCallbacks.clear();
    
    // Clean up all MidiTrack instances
    this.midiTrackCache.forEach(track => track.dispose());
    this.midiTrackCache.clear();
    
    // Clear all activation timeouts
    this.activationTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.activationTimeouts.clear();
    
    // Clear activation tracking
    this.activeTracks.clear();
    this.pendingActivations.clear();
    this.activationAttempts.clear();
    
    console.log('MidiTrackHandler: Disposed and cleaned up all resources');
  }
} 