import React from 'react';
// import SoundUploader from './SoundUploader'; // Path might need adjustment if SoundUploader is in a different directory
import SoundLibrary from './SoundLibrary'; // Assuming SoundLibrary is in the same components folder or adjust path

interface AudioTracksDisplayProps {
  onReloadSounds: () => void;
  sectionColor: string;
  // If SoundUploader becomes active, we'll need more props:
  // showSoundUploader: boolean;
  // onToggleSoundUploader: () => void; // Or separate setShow for true/false
  // onSoundUploaded: (soundId: string) => void;
  // onCancelUpload: () => void;
  // showSnackbar: (message: string, severity: 'success' | 'error') => void;
}

const AudioTracksDisplay: React.FC<AudioTracksDisplayProps> = ({
  onReloadSounds,
  sectionColor,
  // showSoundUploader,
  // onToggleSoundUploader,
  // onSoundUploaded,
  // onCancelUpload,
  // showSnackbar,
}) => {
  return (
    <SoundLibrary onReload={onReloadSounds} sectionColor={sectionColor} />
  );
};

export default AudioTracksDisplay;
