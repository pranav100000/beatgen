import { Box } from '@mui/material';
import { useEffect, useRef } from 'react';
import * as Tone from 'tone';

interface WaveformDisplayProps {
  audioFile: File;
  color?: string;
  isPlaying: boolean;
}

function WaveformDisplay({ audioFile, color = '#4CAF50', isPlaying }: WaveformDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!audioFile || !containerRef.current || !canvasRef.current) return;

    const drawWaveform = async () => {
      try {
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d');
        if (!context) return;

        const container = containerRef.current!;
        
        // Increase resolution for sharper rendering
        const dpr = window.devicePixelRatio || 1;
        canvas.width = container.clientWidth * dpr;
        canvas.height = container.clientHeight * dpr;
        context.scale(dpr, dpr);

        const width = container.clientWidth;
        const height = container.clientHeight;

        // Load and decode audio
        const arrayBuffer = await audioFile.arrayBuffer();
        const audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);

        // Clear with semi-transparent background
        context.fillStyle = 'rgba(0, 0, 0, 0.2)';
        context.fillRect(0, 0, width, height);

        // Draw center line
        context.beginPath();
        context.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        context.moveTo(0, height / 2);
        context.lineTo(width, height / 2);
        context.stroke();

        // Draw waveform
        const padding = 4;
        const drawHeight = height - (padding * 2);
        const step = Math.ceil(channelData.length / width);
        const amp = (drawHeight / 2) * 0.9;

        // Main waveform
        context.beginPath();
        context.strokeStyle = color;
        context.lineWidth = 1.5;

        let prevX = 0;
        let prevYMin = height / 2;
        let prevYMax = height / 2;

        for (let i = 0; i < width; i++) {
          const startIdx = i * step;
          const endIdx = startIdx + step;
          const slice = channelData.slice(startIdx, endIdx);
          
          let min = 1.0;
          let max = -1.0;
          
          for (let j = 0; j < slice.length; j++) {
            const sample = slice[j];
            if (sample < min) min = sample;
            if (sample > max) max = sample;
          }

          const x = i;
          const yMin = (height / 2) + (min * amp);
          const yMax = (height / 2) + (max * amp);

          // Draw filled area
          context.fillStyle = `${color}33`;
          context.fillRect(x, yMin, 1, yMax - yMin);

          // Connect lines smoothly
          if (i > 0) {
            context.beginPath();
            context.moveTo(prevX, prevYMin);
            context.lineTo(x, yMin);
            context.stroke();

            context.beginPath();
            context.moveTo(prevX, prevYMax);
            context.lineTo(x, yMax);
            context.stroke();
          }

          prevX = x;
          prevYMin = yMin;
          prevYMax = yMax;
        }

      } catch (error) {
        console.error('Error drawing waveform:', error);
      }
    };

    drawWaveform();
  }, [audioFile, color]);

  return (
    <Box 
      ref={containerRef}
      sx={{ 
        width: '100%',
        height: '100%',
        position: 'relative',
        bgcolor: 'transparent',
        zIndex: 'inherit',
        borderRadius: 1,
        overflow: 'hidden'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          display: 'block',
          zIndex: 'inherit'
        }}
      />
    </Box>
  );
}

export default WaveformDisplay; 