/**
 * Utility functions for audio and MIDI file processing
 */

/**
 * Process audio file to extract metadata
 */
export async function processAudioFile(file: File): Promise<{
  duration: number;
  sampleRate: number;
  format: string;
  waveform: number[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const AudioContextClass = (window.AudioContext || 
          (window as any).webkitAudioContext) as typeof AudioContext;
        const audioContext = new AudioContextClass();
        const audioBuffer = await audioContext.decodeAudioData(e.target.result as ArrayBuffer);
        
        const format = file.type.split('/')[1]?.toUpperCase() || 'UNKNOWN';
        const duration = audioBuffer.duration;
        const sampleRate = audioBuffer.sampleRate;
        
        // Generate waveform data (100 points)
        const waveform = generateWaveform(audioBuffer, 100);
        
        resolve({
          duration,
          sampleRate,
          format,
          waveform
        });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Generate waveform data from audio buffer
 */
export function generateWaveform(audioBuffer: AudioBuffer, pointCount: number): number[] {
  const channelData = audioBuffer.getChannelData(0); // Use first channel
  const blockSize = Math.floor(channelData.length / pointCount);
  
  const waveform = [];
  for (let i = 0; i < pointCount; i++) {
    const start = blockSize * i;
    let max = 0;
    for (let j = 0; j < blockSize; j++) {
      if (start + j < channelData.length) {
        const amplitude = Math.abs(channelData[start + j]);
        if (amplitude > max) max = amplitude;
      }
    }
    waveform.push(max);
  }
  
  return waveform;
}

/**
 * Upload file with progress tracking
 */
export async function uploadFileWithProgress(
  file: File, 
  url: string, 
  onProgress: (progress: number) => void
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        onProgress(percentComplete);
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });
    
    xhr.addEventListener('error', () => reject(new Error('Upload failed')));
    
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}