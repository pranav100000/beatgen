import React from 'react';
import {
  Card, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { PlayArrow as PlayIcon, Pause as PauseIcon, DeleteOutline as DeleteIcon, MusicNote as MusicNoteIcon } from '@mui/icons-material';
import { MidiTrackRead } from '../../../platform/types/track_models/midi_track'; 
import { formatTime } from '../../../studio/utils/audioProcessing';

interface MidiTrackCardProps {
  track: MidiTrackRead;
  playingId: string | null;
  currentTime: number;
  duration: number;
  handlePlayTrack: (track: MidiTrackRead) => void;
  handleDeleteTrack: (trackId: string) => void;
  handleEditTrack?: (trackId: string) => void;
}

const MidiTrackCard: React.FC<MidiTrackCardProps> = ({
  track,
  playingId,
  currentTime,
  duration,
  handlePlayTrack,
  handleDeleteTrack,
  handleEditTrack,
}) => {
  const isPlaying = playingId === track.id;
  
  // Calculate the number of notes in the track (if available)
  const noteCount = track.midi_notes_json && track.midi_notes_json.notes ? 
    (track.midi_notes_json.notes as any[]).length : 
    0;

  return (
    <Card className="midi-track-card w-full bg-neutral-900 border-neutral-800 text-white rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between p-3">
        <div className="flex items-center">
          <MusicNoteIcon className="text-blue-400 mr-2" fontSize="small" />
          <CardTitle className="text-sm font-medium truncate mr-2">{track.name}</CardTitle>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button 
            variant="ghost"
            size="icon"
            onClick={() => handlePlayTrack(track)}
            className="text-neutral-300 hover:bg-neutral-700 hover:text-blue-400 h-7 w-7"
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
              <MusicNoteIcon fontSize="small" />
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
        <p className="text-xs text-neutral-400">
          Instrument: {track.instrument_file?.display_name || 'Unknown'}
        </p>
        <p className="text-xs text-neutral-400">
          {noteCount} notes {isPlaying && `� ${formatTime(currentTime, false)} / ${formatTime(duration, false)}`}
        </p>
      </CardFooter>
    </Card>
  );
};

export default MidiTrackCard;