import * as Tone from 'tone';
import { InstrumentConfig, InstrumentInstance, InstrumentManagerInterface } from './types';

export class InstrumentManager implements InstrumentManagerInterface {
  private instruments: Map<string, InstrumentInstance> = new Map();

  async createInstrument(config: InstrumentConfig): Promise<InstrumentInstance> {
    let toneInstrument: Tone.PolySynth | Tone.Sampler;

    switch (config.type) {
      case 'synth':
        toneInstrument = new Tone.PolySynth(Tone.Synth, {
          ...config.settings
        }).toDestination();
        break;
      
      case 'sampler':
        toneInstrument = new Tone.Sampler({
          ...config.settings
        }).toDestination();
        break;
      
      case 'custom':
        // Handle custom instrument types
        throw new Error('Custom instruments not implemented yet');
      
      default:
        throw new Error(`Unknown instrument type: ${config.type}`);
    }

    const instance: InstrumentInstance = {
      id: config.id,
      config,
      toneInstrument
    };

    this.instruments.set(config.id, instance);
    return instance;
  }

  deleteInstrument(id: string): void {
    const instrument = this.instruments.get(id);
    if (instrument) {
      instrument.toneInstrument.dispose();
      this.instruments.delete(id);
    }
  }

  getInstrument(id: string): InstrumentInstance | undefined {
    return this.instruments.get(id);
  }

  playNote(instrumentId: string, note: number, duration?: number, time?: number): void {
    const instrument = this.instruments.get(instrumentId);
    if (!instrument) return;

    const freq = Tone.Frequency(note, "midi").toFrequency();
    if (duration) {
      instrument.toneInstrument.triggerAttackRelease([freq], duration, time);
    } else {
      instrument.toneInstrument.triggerAttack([freq], time);
    }
  }

  stopNote(instrumentId: string, note: number, time?: number): void {
    const instrument = this.instruments.get(instrumentId);
    if (!instrument) return;

    const freq = Tone.Frequency(note, "midi").toFrequency();
    instrument.toneInstrument.triggerRelease([freq], time);
  }

  updateInstrumentSettings(id: string, settings: any): void {
    const instrument = this.instruments.get(id);
    if (!instrument) return;

    // Update the instrument's settings
    Object.entries(settings).forEach(([key, value]) => {
      if (typeof instrument.toneInstrument.set === 'function') {
        instrument.toneInstrument.set({ [key]: value });
      }
    });
  }

  dispose(): void {
    this.instruments.forEach(instrument => {
      instrument.toneInstrument.dispose();
    });
    this.instruments.clear();
  }
} 