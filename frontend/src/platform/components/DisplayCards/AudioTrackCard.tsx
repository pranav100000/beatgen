import React from 'react';
import {
  Card, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { PlayArrow as PlayIcon, Pause as PauseIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';
import { AudioTrackRead as Sound } from '../../../platform/types/track_models/audio_track'; 
import { formatTime, formatFileSize } from '../../../studio/utils/audioProcessing';

interface AudioTrackCardProps {
  sound: Sound;
  playingId: string | null;
  currentTime: number;
  duration: number | null;
  handlePlaySound: (sound: Sound) => void;
  handleDeleteSound: (soundId: string) => void;
  handleSeek: (soundId: string, position: number) => void;
  sectionColor: string;
}

const AudioTrackCard: React.FC<AudioTrackCardProps> = ({
  sound,
  playingId,
  handlePlaySound,
  handleDeleteSound,
  sectionColor,
}) => {
  const isPlaying = playingId === sound.id;

  return (
    <Card 
      className="audio-track-card w-full rounded-lg hover-shadow-card"
      style={{ '--hover-shadow-color': sectionColor } as React.CSSProperties}
    >
      <CardHeader className="flex flex-row items-center justify-between p-3">
        <CardTitle className="text-sm font-medium truncate mr-2">{sound.name}</CardTitle>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button 
            variant="ghost"
            size="icon"
            onClick={() => handlePlaySound(sound)}
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-7 w-7"
          >
            {isPlaying ? <PauseIcon fontSize="small" /> : <PlayIcon fontSize="small" />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => handleDeleteSound(sound.id)}
            className="text-muted-foreground hover:bg-accent hover:text-destructive h-7 w-7"
          >
            <DeleteIcon fontSize="small" />
          </Button>
        </div>
      </CardHeader>
      
      <CardFooter className="p-3 pt-1 flex justify-end items-center">
        <p className="text-xs text-muted-foreground">
          {formatTime(sound.audio_file_duration, false)}
        </p>
      </CardFooter>
    </Card>
  );
};

export default AudioTrackCard;
