import { ProjectManager, Track } from './project';
import { TransportController } from './transport';
import { MidiManager } from '../midi/MidiManager';
import { InstrumentManager } from '../instruments/InstrumentManager';
import AudioEngine from '../audio-engine/audioEngine';

export interface StoreInterface {
  getAudioEngine(): AudioEngine;
  getTransport(): TransportController;
  projectManager: ProjectManager;
  initialize(): Promise<void>;
  createTrack(name: string, type: string): Track;
  getInstrumentManager(): InstrumentManager;
  getMidiManager(): MidiManager;
}

export class Store implements StoreInterface {
  private audioEngine: AudioEngine;
  public projectManager: ProjectManager;
  private transportController: TransportController;
  private initialized: boolean = false;

  constructor() {
    this.audioEngine = AudioEngine.getInstance();
    this.projectManager = new ProjectManager();
    this.transportController = new TransportController();
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.audioEngine.initialize();
      this.initialized = true;
    } catch (error) {
      console.error('Store: Initialization failed:', error);
      throw error;
    }
  }

  public getTransport(): TransportController {
    return this.transportController;
  }

  public createTrack(name: string, type: Track['type'] = 'audio'): Track {
    if (!this.initialized) {
      throw new Error('Store must be initialized before creating tracks');
    }
    return this.projectManager.addTrack(name, type);
  }

  public async loadAudioFile(trackId: string, file: File): Promise<void> {
    await this.transportController.loadAudioFile(trackId, file);
  }

  public removeTrack(id: string): void {
    this.projectManager.removeTrack(id);
    this.audioEngine.removeTrack(id);
  }

  public getAudioEngine(): AudioEngine {
    return this.audioEngine;
  }

  public getInstrumentManager(): InstrumentManager {
    // Implementation needed
    throw new Error('Method not implemented');
  }

  public getMidiManager(): MidiManager {
    // Implementation needed
    throw new Error('Method not implemented');
  }
}
