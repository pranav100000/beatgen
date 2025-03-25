import * as Tone from 'tone';
import { Track as TrackType } from '../state/project';
import { AudioTrack } from '../audio-engine/audioEngine';
import { DrumPad } from '../state/store';

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
    dbId?: string;
    position: Position; // Track's position in the grid
    duration?: number; // Duration in seconds
    _calculatedWidth?: number; // Width in pixels based on duration and BPM
    drumPads?: DrumPad[]; // For drum machine tracks
    storage_key?: string; // Storage key for cloud-stored files
    index?: number; // Index of the track in the project
} 