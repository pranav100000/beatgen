export interface Track {
  id: string;
  name: string;
  type: 'audio' | 'midi' | 'video' | 'drum';
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
}

export interface Project {
  id: string;
  name: string;
  tempo: number;
  timeSignature: [number, number];
  key: string;
  tracks: Track[];
}

export class ProjectManager {
  private currentProject?: Project;

  public createProject(name: string): Project {
    this.currentProject = {
      id: crypto.randomUUID(),
      name,
      tempo: 120,
      timeSignature: [4, 4],
      key: 'C',
      tracks: []
    };
    return this.currentProject;
  }

  public setProjectName(name: string): void {
    if (this.currentProject) {
      this.currentProject.name = name;
    }
  }

  public getCurrentProject(): Project | undefined {
    return this.currentProject;
  }

  public addTrack(name: string, type: Track['type'] = 'audio'): Track {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    const track: Track = {
      id: crypto.randomUUID(),
      name,
      type,
      volume: 80,
      pan: 0,
      muted: false,
      soloed: false
    };

    this.currentProject.tracks.push(track);
    return track;
  }
  
  /**
   * Add a track with a specific ID and properties (for loading saved projects)
   * This ensures track IDs and settings are preserved across saves
   */
  public addTrackWithProperties(trackProps: {
    id: string;
    name: string;
    type: Track['type'];
    volume?: number;
    pan?: number;
    muted?: boolean;
    soloed?: boolean;
  }): Track {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    const track: Track = {
      id: trackProps.id,
      name: trackProps.name,
      type: trackProps.type,
      volume: trackProps.volume ?? 80,
      pan: trackProps.pan ?? 0,
      muted: trackProps.muted ?? false,
      soloed: trackProps.soloed ?? false
    };

    this.currentProject.tracks.push(track);
    return track;
  }

  public getTrackById(id: string): Track | undefined {
    return this.currentProject?.tracks.find(track => track.id === id);
  }

  public removeTrack(id: string): void {
    if (!this.currentProject) return;
    
    this.currentProject.tracks = this.currentProject.tracks.filter(
      track => track.id !== id
    );
  }

  public setTempo(tempo: number): void {
    if (this.currentProject) {
      this.currentProject.tempo = tempo;
    }
  }

  public setTimeSignature(numerator: number, denominator: number): void {
    if (this.currentProject) {
      this.currentProject.timeSignature = [numerator, denominator];
    }
  }

  public setKey(key: string): void {
    if (this.currentProject) {
      this.currentProject.key = key;
    }
  }
}
