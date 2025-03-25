import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';

interface WaveformDisplayProps {
  audioFile?: File;
  trackColor: string;
  duration: number;
  width: number;
}

export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({ 
  audioFile, 
  trackColor,
  duration,
  width
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!audioFile || !canvasRef.current) {
      console.error("Missing audio file or canvas reference");
      return;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Failed to get canvas context");
      return;
    }
    
    // Debug canvas dimensions
    console.log('Canvas initial dimensions:', {
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
      offsetWidth: canvas.offsetWidth,
      offsetHeight: canvas.offsetHeight,
      parentWidth: canvas.parentElement?.clientWidth,
      parentHeight: canvas.parentElement?.clientHeight
    });
    
    // Set up high-DPI canvas for sharper rendering
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = width;
    // Use a larger default height to ensure the waveform is visible
    const displayHeight = canvas.parentElement?.clientHeight || 80;
    
    // Set display size in CSS pixels
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    
    // Set canvas size accounting for device pixel ratio for sharper rendering
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    
    // Scale all drawing operations to account for the device pixel ratio
    ctx.scale(dpr, dpr);
    
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    
    // Process and draw the audio file
    const reader = new FileReader();
    
    reader.onload = (event) => {
      if (!event.target?.result) {
        console.error("Failed to read file");
        return;
      }
      
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Convert array buffer to audio buffer
      audioContext.decodeAudioData(event.target.result as ArrayBuffer)
        .then(audioBuffer => {
          // Get the raw audio data from the first channel
          const channelData = audioBuffer.getChannelData(0);
          
          // Draw the waveform
          drawWaveform(channelData, canvas, ctx, trackColor);
        })
        .catch(error => {
          console.error("Error decoding audio data:", error);
          throw new Error("Failed to decode audio data");
        });
    };
    
    reader.onerror = () => {
      console.error("Error reading file");
      throw new Error("Failed to read audio file");
    };
    
    // Start reading the file
    reader.readAsArrayBuffer(audioFile);
  }, [audioFile, trackColor, width]);
  
  return (
    <Box sx={{ 
      height: '100%',
      width: '100%',
      display: 'flex', 
      alignItems: 'center',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <canvas 
        ref={canvasRef} 
        style={{ 
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%', 
          height: '100%',
          display: 'block',
        }} 
      />
    </Box>
  );
};

// Draw the waveform from audio data
function drawWaveform(
  channelData: Float32Array, 
  canvas: HTMLCanvasElement, 
  ctx: CanvasRenderingContext2D, 
  trackColor: string
) {
  const dpr = window.devicePixelRatio || 1;
  // Get logical dimensions (not the scaled canvas dimensions)
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  const middle = height / 2;
  
  console.log('Drawing waveform with dimensions:', { width, height, middle, dpr })
  
  // Clear canvas with a transparent background
  ctx.clearRect(0, 0, width, height);
  
  // Enable anti-aliasing for smoother rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Calculate how many samples per pixel for optimal resolution
  const totalSamples = channelData.length;
  const samplesPerPixel = Math.max(1, Math.floor(totalSamples / width));
  
  // Store the waveform points for drawing the outline
  const topPoints: {x: number, y: number}[] = [];
  const bottomPoints: {x: number, y: number}[] = [];
  
  // Draw center line for reference
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(0, middle, width, 1);
  
  // Change this line to use white with 75% opacity instead of the track color
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  
  // For each pixel column in the canvas
  for (let x = 0; x < width; x++) {
    // Find the starting sample index for this pixel
    const startSample = Math.floor(x * totalSamples / width);
    
    // Find min and max in this sample range for better visualization
    let min = 0;
    let max = 0;
    
    // Analyze all samples for this pixel location
    for (let i = 0; i < samplesPerPixel; i++) {
      const sampleIndex = startSample + i;
      if (sampleIndex < totalSamples) {
        const sample = channelData[sampleIndex];
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }
    }
    
    // Ensure we have at least some height (important for quieter parts)
    const minHeight = height * 0.05; // At least 5% of height
    
    // Calculate bar height with a minimum size and proper scaling
    const normalizedMin = Math.min(0, min); // Ensure some negative value 
    const normalizedMax = Math.max(0, max);  // Ensure some positive value
    
    // Scale the values (audio can be very quiet, so we apply some amplification)
    const scaleFactor = 0.5; // Reduced scale factor for 50% height
    
    // Calculate top and bottom y-coordinates
    const topY = middle + (normalizedMin * height * scaleFactor);
    const bottomY = middle + (normalizedMax * height * scaleFactor);
    
    // Store points for outline drawing
    topPoints.push({x, y: topY});
    bottomPoints.push({x, y: bottomY});
    
    // Draw the bar for this pixel (fill)
    const barHeight = bottomY - topY;
    ctx.fillRect(x, topY, 1, barHeight);
  }

  // Keep the outline white but maybe make it a bit more visible
  ctx.strokeStyle = 'rgba(255,255,255,1.0)'; // Slightly more opaque white outline
  ctx.lineWidth = 1;
  
  // Top outline
  ctx.beginPath();
  if (topPoints.length > 0) {
    ctx.moveTo(topPoints[0].x, topPoints[0].y);
    
    // Draw the top outline path
    for (let i = 1; i < topPoints.length; i++) {
      ctx.lineTo(topPoints[i].x, topPoints[i].y);
    }
    
    // Draw the stroke
    ctx.stroke();
  }
  
  // Bottom outline
  ctx.beginPath();
  if (bottomPoints.length > 0) {
    ctx.moveTo(bottomPoints[0].x, bottomPoints[0].y);
    
    // Draw the bottom outline path
    for (let i = 1; i < bottomPoints.length; i++) {
      ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
    }
    
    // Draw the stroke
    ctx.stroke();
  }
}

export default WaveformDisplay;