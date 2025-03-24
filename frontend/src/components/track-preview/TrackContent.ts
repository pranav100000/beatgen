/**
 * Props for track content components
 */
export interface TrackContentProps {
  /**
   * Width of the track in pixels
   */
  width: number;
  
  /**
   * Height of the track in pixels
   */
  height: number;
  
  /**
   * Current playhead position in pixels
   */
  playheadPosition: number;
  
  /**
   * Whether the transport is playing
   */
  isPlaying?: boolean;
  
  /**
   * Current time in seconds
   */
  currentTime?: number;
  
  /**
   * Beats per minute
   */
  bpm?: number;
  
  /**
   * Track width in pixels
   */
  trackWidth?: number;
  
  /**
   * Track data
   */
  track?: any;

  /**
   * Color of the track
   */
  trackColor?: string;
} 