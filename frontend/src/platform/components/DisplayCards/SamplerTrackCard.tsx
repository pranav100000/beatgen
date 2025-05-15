import React from 'react';
import {
  Card, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { 
  PlayArrow as PlayIcon, 
  Pause as PauseIcon, 
  DeleteOutline as DeleteIcon,
  SettingsSuggest as SettingsIcon
} from '@mui/icons-material';
import { IconWaveSine } from '@tabler/icons-react';
import { SamplerTrackRead } from '../../../platform/types/track_models/sampler_track';
import { formatTime, formatFileSize } from '../../../studio/utils/audioProcessing';

interface SamplerTrackCardProps {
  track: SamplerTrackRead;
  playingId: string | null;
  currentTime: number;
  duration: number;
  handlePlayTrack: (track: SamplerTrackRead) => void;
  handleDeleteTrack: (trackId: string) => void;
  handleEditTrack?: (trackId: string) => void;
  handleSeek?: (trackId: string, position: number) => void;
}

const SamplerTrackCard: React.FC<SamplerTrackCardProps> = ({
  track,
  playingId,
  currentTime,
  duration,
  handlePlayTrack,
  handleDeleteTrack,
  handleEditTrack,
  handleSeek,
}) => {
  const isPlaying = playingId === track.id;
  
  // Calculate the number of notes in the track (if available)
  const noteCount = track.midi_notes_json ? 
    Object.keys(track.midi_notes_json).length : 
    0;
  
  // Format the base MIDI note to a more readable format (e.g., C3, D#4)
  const formatMidiNote = (midiNote: number): string => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteName = noteNames[midiNote % 12];
    const octave = Math.floor(midiNote / 12) - 1;
    return `${noteName}${octave}`;
  };

  return (
    <Card className="sampler-track-card w-full bg-neutral-900 border-neutral-800 text-white rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between p-3">
        <div className="flex items-center">
          <IconWaveSine className="text-green-400 mr-2" size={18} />
          <CardTitle className="text-sm font-medium truncate mr-2">{track.name}</CardTitle>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button 
            variant="ghost"
            size="icon"
            onClick={() => handlePlayTrack(track)}
            className="text-neutral-300 hover:bg-neutral-700 hover:text-green-400 h-7 w-7"
          >
            {isPlaying ? <PauseIcon fontSize="small" /> : <PlayIcon fontSize="small" />}
          </Button>
          {handleEditTrack && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => handleEditTrack(track.id)}
              className="text-neutral-300 hover:bg-neutral-700 hover:text-amber-400 h-7 w-7"
            >
              <SettingsIcon fontSize="small" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => handleDeleteTrack(track.id)}
            className="text-neutral-300 hover:bg-neutral-700 hover:text-red-500 h-7 w-7"
          >
            <DeleteIcon fontSize="small" />
          </Button>
        </div>
      </CardHeader>
      
      <CardFooter className="p-3 pt-1 flex justify-between items-center">
        <div className="flex flex-col">
          <p className="text-xs text-neutral-400 mb-1">
            Base Note: {formatMidiNote(track.base_midi_note)}
          </p>
          <p className="text-xs text-neutral-400">
            {formatTime(track.audio_file_duration, false)} � {formatFileSize(track.audio_file_size)}
          </p>
        </div>
        {isPlaying && (
          <p className="text-xs text-neutral-400">
            {formatTime(currentTime, false)} / {formatTime(duration, false)}
          </p>
        )}
      </CardFooter>
    </Card>
  );
};

export default SamplerTrackCard;