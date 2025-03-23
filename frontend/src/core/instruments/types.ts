import * as Tone from 'tone';

export interface InstrumentConfig {
  id: string;
  name: string;
  type: 'synth' | 'sampler' | 'custom';
  settings?: any; // Instrument-specific settings
}

export interface InstrumentInstance {
  id: string;
  config: InstrumentConfig;
  toneInstrument: Tone.PolySynth | Tone.Sampler;
}

export interface InstrumentManagerInterface {
  // Instrument lifecycle
  createInstrument(config: InstrumentConfig): Promise<InstrumentInstance>;
  deleteInstrument(id: string): void;
  getInstrument(id: string): InstrumentInstance | undefined;
  
  // Playback
  playNote(instrumentId: string, note: number, duration?: number, time?: number): void;
  stopNote(instrumentId: string, note: number, time?: number): void;
  
  // Settings
  updateInstrumentSettings(id: string, settings: any): void;
  
  // State
  dispose(): void;
} 