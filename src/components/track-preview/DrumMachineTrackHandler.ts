import { useCallback, useEffect, useRef, useState } from 'react';
import { TrackContentProps } from './TrackContent';
import { TrackTypeHandler } from './TrackTypeHandler';
import { GRID_CONSTANTS } from '../../constants/gridConstants';
import { TrackState } from '../../core/types/track';
import { Store, DrumPad } from '../../core/state/store';
import React from 'react';
import { historyManager } from '../../core/state/history/HistoryManager';
import { ToggleDrumPadAction } from '../../core/state/history/types';

// Define the number of drum rows to match the DRUM_SOUNDS array in DrumMachineTrackContent
const DRUM_ROW_COUNT = 4;

/**
 * Interface for our internal drum machine pad structure
 */
interface DrumMachinePad {
  row: number;
  column: number;
  velocity: number;
}

/**
 * Handler for drum machine tracks
 */
export class DrumMachineTrackHandler implements TrackTypeHandler {
  private trackId: string;
  private storeHook: () => Store | null = () => null;
  private reRenderCallbacks: Map<string, () => void> = new Map();

  constructor(trackId: string) {
    this.trackId = trackId;
    console.log(`DrumMachineTrackHandler created for track: ${trackId}`);
    
    // Subscribe to history manager to refresh UI on undo/redo
    historyManager.subscribe(() => {
      this.triggerRerender();
    });
  }

  /**
   * Set the store hook
   */
  public setStoreHook(store: Store): void {
    console.log(`DrumMachineTrackHandler.setStoreHook for track: ${this.trackId}`, store);
    this.storeHook = () => store;
  }

  /**
   * Register a callback to force rerender
   */
  private registerRerenderCallback(id: string, callback: () => void): void {
    this.reRenderCallbacks.set(id, callback);
  }
  
  /**
   * Trigger a rerender for all registered callbacks
   */
  private triggerRerender(): void {
    this.reRenderCallbacks.forEach(callback => callback());
  }

  /**
   * Get the drum pads from the store
   */
  public useDrumPads = (): DrumMachinePad[] => {
    const [pads, setPads] = useState<DrumMachinePad[]>([]);
    const store = this.storeHook();
    const forceUpdate = useState<number>(0)[1];
    
    // Register the force update function
    useEffect(() => {
      const updateId = `pad-update-${Date.now()}`;
      this.registerRerenderCallback(updateId, () => forceUpdate(prev => prev + 1));
      
      return () => {
        this.reRenderCallbacks.delete(updateId);
      };
    }, [forceUpdate]);
    
    // Load pads from store and set up subscription
    useEffect(() => {
      if (!store) {
        console.warn(`Store not available for drum pads in track ${this.trackId}`);
        return;
      }
      
      console.log(`Setting up store listener for track ${this.trackId}`);
      
      const loadPads = () => {
        try {
          // Get track from store to check if it exists
          const track = store.getTrackById(this.trackId);
          if (!track) {
            console.warn(`Track ${this.trackId} not found in store when loading drum pads`);
            return;
          }
          
          // Get initial pads
          const storePads = store.getDrumPads(this.trackId);
          
          // Filter out any pads that are beyond our row count
          const validPads = storePads.filter(pad => pad.row < DRUM_ROW_COUNT);
          
          console.log(`Loaded ${validPads.length} drum pads for track ${this.trackId}`, validPads);
          setPads(validPads);
        } catch (error) {
          console.error(`Error loading drum pads for track ${this.trackId}:`, error);
        }
      };
      
      // Initial load
      loadPads();
      
      // Listen for changes
      const handleChange = () => {
        console.log(`Store change detected for track ${this.trackId}`);
        loadPads();
      };
      
      store.addListener(handleChange);
      return () => store.removeListener(handleChange);
    }, [store, forceUpdate]);
    
    return pads;
  };
  
  /**
   * Get track data
   */
  public useTrackData = (): TrackState | null => {
    const [track, setTrack] = useState<TrackState | null>(null);
    const store = this.storeHook();
    
    useEffect(() => {
      if (!store) return;
      
      const trackData = store.getTrackById(this.trackId);
      if (trackData) {
        setTrack(trackData);
      }
      
      // Listen for changes
      const handleChange = () => {
        const updatedTrack = store.getTrackById(this.trackId);
        if (updatedTrack) {
          setTrack(updatedTrack);
        }
      };
      
      store.addListener(handleChange);
      return () => store.removeListener(handleChange);
    }, [store]);
    
    return track;
  };
  
  /**
   * Handle click on the drum grid
   */
  public useHandleClick = (): ((row: number, column: number) => void) => {
    const store = this.storeHook();
    
    return useCallback((row: number, column: number) => {
      if (!store) return;
      if (row >= DRUM_ROW_COUNT) return; // Ensure we only handle clicks within our row count
      
      console.log(`Toggle drum pad: row=${row}, column=${column}`);
      
      // Create a toggle drum pad action and execute it via the history manager
      const toggleAction = new ToggleDrumPadAction(store, this.trackId, column, row);
      historyManager.executeAction(toggleAction);
    }, [store]);
  };
  
  /**
   * No-op for track click - the click should be handled by the grid cells directly
   */
  public handleClick = (track: TrackState): void => {
    // No-op - we're always in editing mode
    console.log(`Drum machine track clicked: ${track.id}`);
  };
  
  /**
   * Always return true since we're always in editing mode
   */
  public isEditing = (): boolean => {
    return true;
  };
  
  /**
   * Render the track content
   */
  public renderContent = (props: TrackContentProps): React.ReactElement => {
    // The actual rendering is done in DrumMachineTrackContent.tsx
    // This just returns the JSX element with appropriate props
    const DrumMachineTrackContent = require('./DrumMachineTrackContent').default;
    return React.createElement(DrumMachineTrackContent, {
      handler: this,
      width: props.width,
      height: props.height,
      playheadPosition: props.playheadPosition
    });
  };
} 