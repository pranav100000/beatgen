import React, { useMemo, useRef, useEffect } from 'react';
import { TrackPreviewProps } from './TrackPreviewTypes';
import BaseTrackPreview from './BaseTrackPreview';
import { AudioTrackHandler } from './AudioTrackHandler';
import { MidiTrackHandler } from './MidiTrackHandler';
import { DrumMachineTrackHandler } from './DrumMachineTrackHandler';
import { TrackTypeHandler } from './TrackTypeHandler';
import { usePianoRoll } from '../piano-roll/PianoRollWindow';
import { useStore } from '../../core/state/StoreContext';
import { Store } from '../../core/state/store';
import { GRID_CONSTANTS, getTrackColor } from '../../constants/gridConstants';

// Constants for drum machine grid subdivisions
const COLUMNS_PER_BEAT = 4; // 16th note resolution

// Create a static cache to ensure handler reuse across component instances
const handlerCache = new Map<string, AudioTrackHandler | MidiTrackHandler | DrumMachineTrackHandler>();

// Factory component that creates the appropriate track handler
const TrackPreview: React.FC<TrackPreviewProps> = (props) => {
  const pianoRoll = usePianoRoll();
  const store = useStore();
  const handlerRef = useRef<AudioTrackHandler | MidiTrackHandler | DrumMachineTrackHandler | null>(null);
  
  // Use useMemo with track.id in deps to ensure stability
  const handler = useMemo(() => {
    // Check if we already have a handler for this track
    if (handlerCache.has(props.track.id)) {
      const cachedHandler = handlerCache.get(props.track.id)!;
      console.log(`TrackPreview: Reusing cached handler for track ${props.track.id}`);
      handlerRef.current = cachedHandler;
      return cachedHandler;
    }
    
    // Create a new handler if we don't have one yet
    console.log(`TrackPreview: Creating new handler for track ${props.track.id} of type ${props.track.type}`);
    
    let newHandler: AudioTrackHandler | MidiTrackHandler | DrumMachineTrackHandler;
    
    // Create handler based on track type
    switch (props.track.type) {
      case 'midi':
        newHandler = new MidiTrackHandler();
        break;
      case 'audio':
        newHandler = new AudioTrackHandler();
        break;
      case 'drum':
        newHandler = new DrumMachineTrackHandler(props.track.id);
        break;
      default:
        console.warn(`Unknown track type: ${props.track.type}. Defaulting to audio.`);
        newHandler = new AudioTrackHandler();
    }
    
    // Cache the handler for future use
    handlerCache.set(props.track.id, newHandler);
    handlerRef.current = newHandler;
    return newHandler;
  }, [props.track.id, props.track.type]);
  
  // Update the hooks separately from handler creation to prevent unnecessary recreations
  useEffect(() => {
    if (!handlerRef.current) return;
    
    if (handlerRef.current instanceof MidiTrackHandler) {
      // Update the MidiTrackHandler with the current hooks
      (handlerRef.current as MidiTrackHandler).setPianoRollHook(pianoRoll);
      (handlerRef.current as MidiTrackHandler).setStoreHook(store);
    } else if (handlerRef.current instanceof DrumMachineTrackHandler) {
      // Set store hook for drum machine tracks
      (handlerRef.current as DrumMachineTrackHandler).setStoreHook(store as Store);
    }
  }, [pianoRoll, store, props.track.type]);
  
  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      // No cleanup needed - we keep handlers in cache for reuse
    };
  }, []);

  // Calculate playhead position for proper alignment
  const playheadPosition = useMemo(() => {
    if (!props.isPlaying) return -1;
    
    // Position calculation for 16th note resolution
    const beatsElapsed = props.currentTime * (props.bpm / 60);
    const sixteenthNotesElapsed = beatsElapsed * COLUMNS_PER_BEAT;
    const gridPosition = sixteenthNotesElapsed * (GRID_CONSTANTS.measureWidth / (COLUMNS_PER_BEAT * 4));
    
    return gridPosition;
  }, [props.isPlaying, props.currentTime, props.bpm]);

  // Get track color based on the track index (default to 0 if not provided)
  const trackColor = getTrackColor(props.trackIndex || 0);
  
  // Prepare the content props for the handler
  const contentProps = {
    width: props.track._calculatedWidth || 500,
    height: GRID_CONSTANTS.trackHeight,
    playheadPosition,
    isPlaying: props.isPlaying,
    currentTime: props.currentTime,
    bpm: props.bpm,
    track: props.track,
    measureCount: props.measureCount || 4,
    timeSignature: props.timeSignature || [4, 4], // Pass timeSignature from props
    trackWidth: typeof props.track._calculatedWidth === 'number' ? props.track._calculatedWidth : 500, // Ensure it's always a number
    trackColor: trackColor // Pass the track color to content renderers
  };

  return (
    <BaseTrackPreview
      {...props}
      renderContent={() => handler.renderContent(contentProps)}
      onTrackClick={(track) => handler.handleClick(track)}
    />
  );
};

export default TrackPreview; 