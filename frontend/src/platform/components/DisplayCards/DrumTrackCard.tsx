import React from 'react';
import {
  Card, 
  CardFooter, 
  CardHeader, 
  CardTitle,
  CardContent
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { 
  PlayArrow as PlayIcon, 
  Pause as PauseIcon, 
  DeleteOutline as DeleteIcon,
  DriveFileMove as EditIcon
} from '@mui/icons-material';
import { Drum } from 'lucide-react';
import { DrumTrackRead } from '../../../platform/types/track_models/drum_track';
import { Badge } from "../../../components/ui/badge";

interface DrumTrackCardProps {
  track: DrumTrackRead;
  playingId: string | null;
  handlePlayTrack: (track: DrumTrackRead) => void;
  handleDeleteTrack: (trackId: string) => void;
  handleEditTrack?: (trackId: string) => void;
  sectionColor: string; // <<< ADD THIS LINE
}

const DrumTrackCard: React.FC<DrumTrackCardProps> = ({
  track,
  playingId,
  handlePlayTrack,
  handleDeleteTrack,
  handleEditTrack,
  sectionColor
}) => {
  const isPlaying = playingId === track.id;
  const samplerCount = track.sampler_tracks?.length || 0;

  return (
    <Card
    className="drum-track-card w-full rounded-lg hover-shadow-card" // <<< ADD hover-shadow-card
    style={{ '--hover-shadow-color': sectionColor } as React.CSSProperties} // <<< ADD THIS LINE
    >
      <CardHeader className="flex flex-row items-center justify-between p-3">
        <div className="flex items-center">
          <Drum className="text-primary mr-2" size={18} />
          <CardTitle className="text-sm font-medium truncate mr-2">{track.name}</CardTitle>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button 
            variant="ghost"
            size="icon"
            onClick={() => handlePlayTrack(track)}
            className="text-muted-foreground hover:bg-accent hover:text-primary h-7 w-7"
          >
            {isPlaying ? <PauseIcon fontSize="small" /> : <PlayIcon fontSize="small" />}
          </Button>
          {handleEditTrack && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => handleEditTrack(track.id)}
              className="text-muted-foreground hover:bg-accent hover:text-yellow-500 dark:hover:text-yellow-400 h-7 w-7"
            >
              <EditIcon fontSize="small" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => handleDeleteTrack(track.id)}
            className="text-muted-foreground hover:bg-accent hover:text-destructive h-7 w-7"
          >
            <DeleteIcon fontSize="small" />
          </Button>
        </div>
      </CardHeader>
      
      {samplerCount > 0 && (
        <CardContent className="py-0 px-3">
          <div className="flex flex-wrap gap-1">
            {track.sampler_tracks?.map((sampler) => (
              <Badge 
                key={sampler.id} 
                variant="outline" 
                className="text-xs"
              >
                {sampler.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      )}
      
      <CardFooter className="p-3 pt-1 flex justify-end items-center">
        <p className="text-xs text-muted-foreground">
          {samplerCount} {samplerCount === 1 ? 'sample' : 'samples'}
        </p>
      </CardFooter>
    </Card>
  );
};

export default DrumTrackCard;