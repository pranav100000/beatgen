import React, { useState, useCallback } from 'react';
import { TrackControlsSidebar } from '../Sidebar/TrackControlsSidebar';
import { Timeline } from '../Timeline/Timeline';
import { AudioTrack } from '../../core/audio-engine/audioEngine';
import AudioEngine from '../../core/audio-engine/audioEngine';

export const MainLayout: React.FC = () => {
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const audioEngine = AudioEngine.getInstance();

  const handleVolumeChange = useCallback((trackId: string, volume: number) => {
    audioEngine.setTrackVolume(trackId, volume);
    setTracks(audioEngine.getAllTracks());
  }, []);

  const handlePanChange = useCallback((trackId: string, pan: number) => {
    audioEngine.setTrackPan(trackId, pan);
    setTracks(audioEngine.getAllTracks());
  }, []);

  const handleMute = useCallback((trackId: string, muted: boolean) => {
    audioEngine.setTrackMute(trackId, muted);
    setTracks(audioEngine.getAllTracks());
  }, []);

  const handleSolo = useCallback((trackId: string, soloed: boolean) => {
    // Assuming you'll add solo functionality to AudioEngine
    const track = tracks.find(t => t.id === trackId);
    if (track) {
      track.soloed = soloed;
      setTracks([...tracks]);
    }
  }, [tracks]);

  const handleTrackNameChange = useCallback((trackId: string, name: string) => {
    audioEngine.setTrackName(trackId, name);
    setTracks(audioEngine.getAllTracks());
  }, []);

  const handleAddTrack = useCallback(async () => {
    const newTrackId = `track-${tracks.length + 1}`;
    await audioEngine.createTrack(newTrackId);
    setTracks(audioEngine.getAllTracks());
  }, [tracks.length]);

  const handleDeleteTrack = useCallback((index: number) => {
    const trackToDelete = tracks[index];
    if (trackToDelete) {
      audioEngine.removeTrack(trackToDelete.id);
      setTracks(audioEngine.getAllTracks());
    }
  }, [tracks]);

  return (
    <div className="main-layout">
      <div className="sidebar">
        <button 
          className="add-track-button"
          onClick={handleAddTrack}
        >
          ADD TRACK
        </button>
        <TrackControlsSidebar
          tracks={tracks}
          onVolumeChange={handleVolumeChange}
          onPanChange={handlePanChange}
          onMute={handleMute}
          onSolo={handleSolo}
          onTrackNameChange={handleTrackNameChange}
          onDeleteTrack={handleDeleteTrack}
        />
      </div>
      
      <div className="timeline-container">
        <Timeline tracks={tracks} />
      </div>
    </div>
  );
}; 