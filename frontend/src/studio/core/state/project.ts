import { CombinedTrack, Project, ProjectBase, ProjectWithTracks, TrackType } from "src/platform/types/project";
export class ProjectManager {
  private currentProject?: ProjectWithTracks;

  public createProject(name: string): ProjectWithTracks {
    this.currentProject = {
      id: crypto.randomUUID(),
      name,
      bpm: 120,
      time_signature_numerator: 4,
      time_signature_denominator: 4,
      key_signature: 'C',
      user_id: null,
      tracks: []
    };
    return this.currentProject;
  }

  public setProjectName(name: string): void {
    if (this.currentProject) {
      this.currentProject.name = name;
    }
  }

  public getCurrentProject(): ProjectWithTracks | undefined {
    return this.currentProject;
  }

  // public addTrack(track: CombinedTrack): CombinedTrack {
  //   if (!this.currentProject) {
  //     throw new Error('No project loaded');
  //   }

  //   this.currentProject.tracks.push(track);
  //   return track;
  // }
  

  // public getTrackById(id: string): CombinedTrack | undefined {
  //   return this.currentProject?.tracks.find(track => track.id === id);
  // }

  // public removeTrack(id: string): void {
  //   if (!this.currentProject) return;
    
  //   this.currentProject.tracks = this.currentProject.tracks.filter(
  //     track => track.id !== id
  //   );
  // }

  public getTempo(): number {
    return this.currentProject.bpm;
  }

  public getTimeSignature(): [number, number] {
    return [this.currentProject.time_signature_numerator, this.currentProject.time_signature_denominator];
  }

  public getKey(): string {
    return this.currentProject.key_signature;
  }

  public setTempo(tempo: number): void {
    if (this.currentProject) {
      this.currentProject.bpm = tempo;
    }
  }

  public setTimeSignature(numerator: number, denominator: number): void {
    if (this.currentProject) {
      this.currentProject.time_signature_numerator = numerator;
      this.currentProject.time_signature_denominator = denominator;
    }
  }

  public setKey(key: string): void {
    if (this.currentProject) {
      this.currentProject.key_signature = key;
    }
  }
}

export default ProjectManager;