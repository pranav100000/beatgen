interface Transport {
    position: number;        // Current playback position
    isPlaying: boolean;
    tempo: number;
    timeSignature: [number, number];
    
    play(): void;
    pause(): void;
    stop(): void;
    seek(position: number): void;
  }