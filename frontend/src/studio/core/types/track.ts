import * as Tone from 'tone';
import { Track as TrackType } from '../state/project';
import { AudioTrack } from '../audio-engine/audioEngine';
import { DrumPad } from '../state/store';

export interface Position {
    x: number; // Position in pixels from left (ticks)
    y: number; // Position in pixels from top (track order)
}

export interface BaseTrackState {
    id: string;
    name: string;
    type: 'audio' | 'midi' | 'drum' | 'sampler';
    channel: Tone.Channel;
    volume: number;
    pan: number;
    muted: boolean;
    soloed: boolean;
    position: Position; // Track's position in the grid
    dbId?: string;
    duration?: number; // Duration in seconds
    _calculatedWidth?: number; // Width in pixels based on duration and BPM
    storage_key?: string; // Storage key for cloud-stored files
    index?: number; // Index of the track in the project
    instrumentId?: string; // ID of the instrument
    instrumentName?: string; // Name of the instrument
    instrumentStorageKey?: string; // Storage key for the instrument
    trimStartTicks?: number; // Trim start ticks
    trimEndTicks?: number; // Trim end ticks
    originalDurationTicks?: number; // Original duration ticks
    audioFile?: File;
}

export interface AudioTrackState extends BaseTrackState {
    type: 'audio';
    audioFile?: File;
    player?: Tone.Player;
}

export interface MidiTrackState extends BaseTrackState {
    type: 'midi';
    instrumentId?: string; // ID of the instrument
    instrumentName?: string; // Name of the instrument
    instrumentStorageKey?: string; // Storage key for the instrument
}

export interface DrumTrackState extends BaseTrackState {
    type: 'drum';
    drumPads?: DrumPad[]; // For drum machine tracks - Keep for now
    drumPattern?: boolean[][] | null; // Add field to store the grid pattern
    samplerTrackIds?: string[]; // <-- Add array to store associated sampler track IDs
}

export interface SamplerTrackState extends BaseTrackState {
    type: 'sampler';
    sampleFile?: File;
    baseMidiNote?: number; // The MIDI note number that represents the sample's original pitch (default: 60/C4)
    grainSize?: number;    // Granular synthesis grain size (seconds)
    overlap?: number;      // Granular synthesis overlap amount
    sampleBuffer?: AudioBuffer; // Optional cached buffer for faster loading
}

export type TrackState = AudioTrackState | MidiTrackState | DrumTrackState | SamplerTrackState;