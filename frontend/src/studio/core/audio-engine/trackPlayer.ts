export interface TrackPlayer {
  play(position: number): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  setVolume(volume: number): Promise<void>;
  setPan(pan: number): Promise<void>;
  setMute(mute: boolean): Promise<void>;
  setPositionTicks(position: number): Promise<void>;
  setTrimStartTicks(start: number): Promise<void>;
  setTrimEndTicks(end: number): Promise<void>;  
}

