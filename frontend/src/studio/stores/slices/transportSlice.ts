import { Store } from '../../core/state/store';
import { RootState, SetFn, GetFn, StoreSliceCreator, PlaybackCommand } from '../types';

// Define the state properties and actions for this slice
export interface TransportSlice {
  isPlaying: boolean;
  currentTime: number;
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  handlePlaybackCommand: (command: PlaybackCommand, arg?: any) => Promise<void>;
  playPause: () => Promise<void>;
  stop: () => Promise<void>;
  seekToPosition: (position: number) => void;
}

// Create the slice function
export const createTransportSlice: StoreSliceCreator<TransportSlice> = (set, get) => {
  const rootGet = get as GetFn; // Helper for root state access

  // Utility to set state within this slice
  const setTransportState = (partial: Partial<TransportSlice> | ((state: TransportSlice) => Partial<TransportSlice>)) => set(partial);
  
  // Consolidated playback command handler (extracted from original store)
  const handlePlaybackCommand = async (command: PlaybackCommand, arg?: any) => {
    const { store, isPlaying, _withStore, _withErrorHandling } = rootGet();

    if (!_withStore || !_withErrorHandling) {
        console.error("_withStore or _withErrorHandling not available for playback command");
        return;
    }

    const commandLogic = async (store: Store) => {
        const transport = store.getTransport();
        if (!transport) {
            console.error("Transport not available in store");
            return;
        }

        const currentIsPlaying = rootGet().isPlaying; // Get potentially updated state

        switch(command) {
            case 'play':
                if (!currentIsPlaying) {
                    await transport.play();
                    setTransportState({ isPlaying: true });
                }
                break;
            case 'pause':
                if (currentIsPlaying) {
                    transport.pause(); // Pause is usually synchronous
                    setTransportState({ isPlaying: false });
                }
                break;
            case 'stop':
                await transport.stop();
                setTransportState({ isPlaying: false, currentTime: 0 });
                break;
            case 'seek':
                if (typeof arg === 'number') {
                    transport.setPosition(arg);
                    setTransportState({ currentTime: arg });
                } else {
                    console.error('Seek command requires a numeric argument (position)');
                }
                break;
            default:
                 console.error(`Unknown playback command: ${command}`);
        }
    };

    // Wrap the logic
    await _withErrorHandling(async () => _withStore(commandLogic)(), `handlePlaybackCommand: ${command}`)();
  };

  return {
    // Initial state
    isPlaying: false,
    currentTime: 0,
    
    // Basic setters
    setIsPlaying: (isPlaying) => setTransportState({ isPlaying }),
    setCurrentTime: (time) => setTransportState({ currentTime: time }),
    
    // Actions
    handlePlaybackCommand,
    playPause: async () => {
      // Read current isPlaying state *inside* the action
      const currentlyPlaying = rootGet().isPlaying;
      await handlePlaybackCommand(currentlyPlaying ? 'pause' : 'play');
    },
    stop: () => handlePlaybackCommand('stop'),
    seekToPosition: (position) => handlePlaybackCommand('seek', position), // No need to await void
  };
};
