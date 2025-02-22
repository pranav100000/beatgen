import * as Tone from 'tone';
import { Track as TrackType } from '../state/project';
import { AudioTrack } from '../audio-engine/audioEngine';

export interface Position {
    x: number; // Position in pixels from left (time)
    y: number; // Position in pixels from top (track order)
}

export interface TrackState extends TrackType, Omit<AudioTrack, 'id'> {
    audioFile?: File;
    channel: Tone.Channel;
    volume: number;
    pan: number;
    muted: boolean;
    soloed: boolean;
    dbId?: number;
    position: Position; // Track's position in the grid
} 