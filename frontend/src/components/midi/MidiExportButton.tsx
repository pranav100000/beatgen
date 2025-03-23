import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { Note } from '../../core/types/note';
import { MidiManager } from '../../core/midi/MidiManager';

interface MidiExportButtonProps {
  trackId: string;
  trackName: string;
  notes: Note[];
  bpm: number;
  timeSignature?: [number, number];
}

/**
 * Button component for exporting piano roll notes as a MIDI file
 */
const MidiExportButton: React.FC<MidiExportButtonProps> = ({
  trackId,
  trackName,
  notes,
  bpm,
  timeSignature = [4, 4]
}) => {
  const handleExport = () => {
    if (!notes || notes.length === 0) {
      console.warn('No notes to export');
      alert('This track has no notes to export');
      return;
    }

    try {
      // Create a new instance of MidiManager
      const midiManager = new MidiManager();
      
      // Convert notes to MIDI format
      const midiData = midiManager.notesToMidi(notes, bpm);
      
      // Update time signature
      midiData.timeSignature = timeSignature;
      
      // Create the MIDI file
      const midiBlob = midiManager.createMidiFile(midiData);
      
      // Create a download link and trigger download
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(midiBlob);
      
      // Generate filename from track name or ID
      const sanitizedName = trackName 
        ? trackName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
        : `track_${trackId}`;
      
      downloadLink.download = `${sanitizedName}.mid`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      
      // Clean up
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(downloadLink.href);
      
      console.log(`Exported MIDI file for track ${trackId} with ${notes.length} notes`);
    } catch (error) {
      console.error('Error exporting MIDI:', error);
      alert('Failed to export MIDI file');
    }
  };

  return (
    <Tooltip title="Export as MIDI">
      <IconButton
        size="small"
        onClick={handleExport}
        sx={{ 
          position: 'absolute',
          top: '5px',
          right: '5px',
          zIndex: 5,
          bgcolor: 'rgba(30, 30, 30, 0.7)',
          color: '#4CAF50',
          padding: '3px',
          '&:hover': { 
            bgcolor: 'rgba(60, 60, 60, 0.9)',
            color: '#81c784'
          }
        }}
      >
        <FileDownloadIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
};

export default MidiExportButton;