// Export main Track component and Factory
export { default as Track } from './Track';
export { default as TrackFactory } from './TrackFactory';

// Export specialized track components
export { default as AudioTrackPreview } from './audio/AudioTrackPreview';
export { default as MidiTrackPreview } from './midi/MidiTrackPreview';
export { default as DrumTrackPreview } from './drum/DrumTrackPreview';

// Export base components
export { default as BaseTrackPreview } from './base/BaseTrackPreview';
export { default as WaveformDisplay } from './WaveformDisplay';

// Export types
export * from './types';