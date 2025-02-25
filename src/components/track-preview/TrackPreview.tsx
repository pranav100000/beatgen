import React, { useMemo, useRef, useEffect } from 'react';
import { TrackPreviewProps } from './TrackPreviewTypes';
import BaseTrackPreview from './BaseTrackPreview';
import { AudioTrackHandler } from './AudioTrackHandler';
import { MidiTrackHandler } from './MidiTrackHandler';
import { usePianoRoll } from '../piano-roll/PianoRollWindow';
import { useStore } from '../../core/state/StoreContext';

// Create a static cache to ensure handler reuse across component instances
const handlerCache = new Map<string, AudioTrackHandler | MidiTrackHandler>();

// Factory component that creates the appropriate track handler
const TrackPreview: React.FC<TrackPreviewProps> = (props) => {
  const pianoRoll = usePianoRoll();
  const store = useStore();
  const handlerRef = useRef<AudioTrackHandler | MidiTrackHandler | null>(null);
  
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
    
    let newHandler: AudioTrackHandler | MidiTrackHandler;
    
    // Create handler based on track type
    switch (props.track.type) {
      case 'audio':
        newHandler = new AudioTrackHandler();
        break;
      case 'midi':
        newHandler = new MidiTrackHandler();
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
    if (props.track.type === 'midi' && handlerRef.current instanceof MidiTrackHandler) {
      // Only set hooks if they've changed
      (handlerRef.current as MidiTrackHandler).setPianoRollHook(pianoRoll);
      (handlerRef.current as MidiTrackHandler).setStoreHook(store);
    }
  }, [pianoRoll, store, props.track.type]);
  
  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      // No cleanup needed - we keep handlers in cache for reuse
    };
  }, []);

  return (
    <BaseTrackPreview
      {...props}
      renderContent={(contentProps) => handler.renderContent(contentProps)}
      onTrackClick={(track) => handler.handleClick(track)}
    />
  );
};

export default TrackPreview; 