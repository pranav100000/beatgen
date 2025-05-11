export interface TrackPlayer {
  play(position: number): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  setTrackVolume(id: string, volume: number): Promise<void>;
  setTrackPan(id: string, pan: number): Promise<void>;
  setTrackMute(id: string, mute: boolean): Promise<void>;
  setTrackPositionTicks(id: string, position: number): Promise<void>;
  setTrackTrimStartTicks(id: string, start: number): Promise<void>;
  setTrackTrimEndTicks(id: string, end: number): Promise<void>;  
}

