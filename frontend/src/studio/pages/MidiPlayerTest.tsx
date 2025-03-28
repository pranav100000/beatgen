import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import MidiPlayerTestComponent from '../components/MidiPlayerTestComponent';

/**
 * Page for testing MIDI playback with soundfonts
 */
const MidiPlayerTestPage: React.FC = () => {
  return (
    <Box sx={{ bgcolor: '#121212', minHeight: '100vh', color: 'white', p: 3 }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1">
            MIDI Soundfont Player Test
          </Typography>
          
          <Button 
            href="/studio" 
            variant="outlined" 
            color="primary"
          >
            Back to Studio
          </Button>
        </Box>
        
        <Box sx={{ mb: 4 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            This page tests the SoundfontMidiPlayer that loads and plays MIDI files with soundfonts.
            The test uses a simple piano MIDI file and a piano soundfont.
          </Typography>
          
          <Typography variant="body2" color="text.secondary">
            Files being used:
            <ul>
              <li>MIDI: Grand Piano.mid</li>
              <li>Soundfont: AI-APiano01trans.SF2</li>
              <li>Worklet: worklet_processor.min.js</li>
            </ul>
          </Typography>
        </Box>
        
        <Box sx={{ 
          border: '1px solid rgba(255,255,255,0.1)', 
          borderRadius: 2, 
          p: 3, 
          bgcolor: '#1e1e1e' 
        }}>
          <MidiPlayerTestComponent />
        </Box>
      </Box>
    </Box>
  );
};

export default MidiPlayerTestPage;