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
}

const DrumTrackCard: React.FC<DrumTrackCardProps> = ({
  track,
  playingId,
  handlePlayTrack,
  handleDeleteTrack,
  handleEditTrack,
}) => {
  const isPlaying = playingId === track.id;
  const samplerCount = track.sampler_tracks?.length || 0;

  return (
    <Card className="drum-track-card w-full bg-neutral-900 border-neutral-800 text-white rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between p-3">
        <div className="flex items-center">
          <Drum className="text-orange-400 mr-2" size={18} />
          <CardTitle className="text-sm font-medium truncate mr-2">{track.name}</CardTitle>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button 
            variant="ghost"
            size="icon"
            onClick={() => handlePlayTrack(track)}
            className="text-neutral-300 hover:bg-neutral-700 hover:text-orange-400 h-7 w-7"
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
              <EditIcon fontSize="small" />
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
      
      {samplerCount > 0 && (
        <CardContent className="py-0 px-3">
          <div className="flex flex-wrap gap-1">
            {track.sampler_tracks?.map((sampler) => (
              <Badge 
                key={sampler.id} 
                variant="outline" 
                className="text-xs bg-neutral-800 text-neutral-300 border-neutral-700"
              >
                {sampler.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      )}
      
      <CardFooter className="p-3 pt-1 flex justify-end items-center">
        <p className="text-xs text-neutral-400">
          {samplerCount} {samplerCount === 1 ? 'sample' : 'samples'}
        </p>
      </CardFooter>
    </Card>
  );
};

export default DrumTrackCard;