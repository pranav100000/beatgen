import { Box } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

function WaveformDisplay({ audioFile, color = '#666', isPlaying }) {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const [audioBuffer, setAudioBuffer] = useState(null);
  const currentTimeRef = useRef(0);
  const startTimeRef = useRef(0);

  // Initialize audio context and load audio file
  useEffect(() => {
    if (!audioFile) return;

    const loadAudio = async () => {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      try {
        const arrayBuffer = await audioFile.arrayBuffer();
        const decodedBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
        setAudioBuffer(decodedBuffer);

        // Draw waveform
        const buffer = decodedBuffer.getChannelData(0);
        const step = Math.ceil(buffer.length / canvas.width);
        
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.beginPath();
        context.strokeStyle = color;
        context.lineWidth = 1;

        for (let i = 0; i < canvas.width; i++) {
          const min = Math.min(...buffer.slice(i * step, (i + 1) * step));
          const max = Math.max(...buffer.slice(i * step, (i + 1) * step));
          
          context.moveTo(i, (1 + min) * canvas.height / 2);
          context.lineTo(i, (1 + max) * canvas.height / 2);
        }
        
        context.stroke();
      } catch (error) {
        console.error('Error loading audio:', error);
      }
    };

    loadAudio();
    return () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current = null;
      }
    };
  }, [audioFile, color]);

  // Handle play/pause
  useEffect(() => {
    if (!audioBuffer || !audioContextRef.current) return;

    if (isPlaying) {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      
      if (!sourceNodeRef.current) {
        // Create new source
        sourceNodeRef.current = audioContextRef.current.createBufferSource();
        sourceNodeRef.current.buffer = audioBuffer;
        sourceNodeRef.current.connect(audioContextRef.current.destination);

        // Start playback from current position
        startTimeRef.current = audioContextRef.current.currentTime;
        sourceNodeRef.current.start(0, currentTimeRef.current);

        sourceNodeRef.current.onended = () => {
          currentTimeRef.current = 0;
          sourceNodeRef.current = null;
        };
      }
    } else {
      if (sourceNodeRef.current) {
        // Calculate elapsed time and store it
        const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
        currentTimeRef.current += elapsed;
        
        sourceNodeRef.current.stop();
        sourceNodeRef.current = null;
      }
    }

    return () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current = null;
      }
    };
  }, [isPlaying, audioBuffer]);

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0
        }}
      />
    </Box>
  );
}

export default WaveformDisplay; 