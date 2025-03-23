import { TrackState } from './types/track';

export interface DrumPad {
  row: number;
  column: number;
  velocity: number;
}

export class BeatgenStore {
  private _tracks: TrackState[] = [];
  private _listeners: Function[] = [];

  /**
   * Add a listener for track changes
   */
  public addListener(listener: Function): void {
    this._listeners.push(listener);
  }

  /**
   * Remove a listener
   */
  public removeListener(listener: Function): void {
    const index = this._listeners.indexOf(listener);
    if (index !== -1) {
      this._listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of changes
   */
  private _notifyListeners(): void {
    this._listeners.forEach(listener => listener());
  }

  public getDrumPads(trackId: string): DrumPad[] {
    const track = this._tracks.find(t => t.id === trackId);
    if (!track || track.type !== 'drum') {
      return [];
    }
    
    if (!track.drumPads) {
      track.drumPads = [];
    }
    
    return track.drumPads;
  }

  public toggleDrumPad(trackId: string, column: number, row: number): void {
    const track = this._tracks.find(t => t.id === trackId);
    if (!track || track.type !== 'drum') {
      return;
    }
    
    if (!track.drumPads) {
      track.drumPads = [];
    }
    
    const existingPadIndex = track.drumPads.findIndex(
      p => p.column === column && p.row === row
    );
    
    if (existingPadIndex >= 0) {
      track.drumPads.splice(existingPadIndex, 1);
    } else {
      track.drumPads.push({
        row,
        column,
        velocity: 100
      });
    }
    
    this._notifyListeners();
  }
} 