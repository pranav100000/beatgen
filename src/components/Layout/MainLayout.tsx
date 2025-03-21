import React, { useState, useCallback } from 'react';
import { TrackControlsSidebar } from '../Sidebar/TrackControlsSidebar';
import { Timeline } from '../Timeline/Timeline';
import { AudioTrack } from '../../core/audio-engine/audioEngine';
import AudioEngine from '../../core/audio-engine/audioEngine';
import { TrackState, Position } from '../../core/types/track';
import { GRID_CONSTANTS } from '../../constants/gridConstants';
import { Track as TrackType } from '../../core/state/project';

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

  // Add the missing properties to your tracks
  const tracksWithPosition: TrackState[] = tracks.map((track, index) => {
    // Determine track type based on track properties
    let trackType: TrackType['type'];
    
    if ('audioFile' in track) {
      trackType = 'audio';
    } else if ('midiData' in track) {
      trackType = 'midi';
    } else if ('drumPattern' in track) {
      trackType = 'drum';
    } else {
      // Default fallback - you might want to adjust this based on your needs
      trackType = 'audio';
    }

    return {
      ...track,
      position: {
        x: 0,
        y: index * GRID_CONSTANTS.trackHeight
      },
      type: trackType
    };
  });

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
        <Timeline 
          tracks={tracksWithPosition}
          currentTime={0}
          isPlaying={false}
          measureCount={GRID_CONSTANTS.measureCount}
          zoomLevel={1}
          bpm={120}
        />
      </div>
    </div>
  );
}; 