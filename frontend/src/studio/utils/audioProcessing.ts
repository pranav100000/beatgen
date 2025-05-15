/**
 * Converts a linear volume value (0-100) to decibels (-Infinity to 0)
 * @param linearVolume Volume on a scale of 0-100
 * @param muted Whether the track is muted
 * @returns Decibel value for volume
 */
export function convertVolumeToDecibels(linearVolume: number, muted = false): number {
  if (muted) return -Infinity;
  
  // If volume is 0, return -Infinity (silence)
  if (linearVolume <= 0) return -Infinity;
  
  // Map 0-100 to -60dB to 6dB with 80 being 0dB (original volume)
  // This provides a more natural volume mapping where:
  // - 80 is the "normal" volume (0dB, the original volume)
  // - 0-80 ranges from -Infinity to 0dB
  // - 80-100 ranges from 0dB to +6dB (allowing for some amplification)
  
  // Ensure volume is between 0-100
  const safeVolume = Math.max(0, Math.min(100, linearVolume));
  
  // Special case at 80 to ensure exactly 0dB
  if (safeVolume === 80) return 0;
  
  if (safeVolume > 80) {
    // For 80-100, map to 0dB to +6dB (some amplification)
    // Convert 80-100 range to 0-1
    const normalized = (safeVolume - 80) / 20;
    // Linear mapping to 0dB to +6dB
    return normalized * 6; // Allows up to +6dB of gain
  } else {
    // For 0-80, map to -60dB to 0dB
    // Convert 0-80 range to 0-1
    const normalized = safeVolume / 80;
    
    if (normalized === 0) return -Infinity;
    
    // Cubic curve for volume transform - feels more natural than linear
    const transformedValue = normalized * normalized * normalized;
    
    // Logarithmic formula that maps 0-1 to -60dB-0dB
    const minDb = -60;
    const dbValue = minDb * (1 - transformedValue);
    
    return dbValue;
  }
}

/**
 * Converts decibels (-Infinity to 6) to linear volume (0-100)
 * @param dbValue Decibel value for volume
 * @returns Volume on a scale of 0-100
 */
export function convertDecibelsToVolume(dbValue: number): number {
  // If -Infinity, return 0
  if (dbValue === -Infinity) return 0;
  
  // Special case for 0dB
  if (dbValue === 0) return 80;
  
  // Handle positive dB values (0 to +6dB maps to 80-100)
  if (dbValue > 0) {
    // Ensure the dB value is in the expected range
    const safeDbValue = Math.min(6, dbValue);
    // Linear mapping from 0-6dB to 80-100
    return 80 + (safeDbValue / 6) * 20;
  } else {
    // Handle negative dB values (-60dB to 0dB maps to 0-80)
    // Ensure the dB value is in the expected range
    const safeDbValue = Math.max(-60, dbValue);
    
    // Reverse the logarithmic mapping
    const minDb = -60;
    
    // Calculate the normalized value (0-1)
    const normalizedValue = 1 - (safeDbValue / minDb);
    
    // Apply cubic root to reverse the cubic transform
    const linearValue = Math.cbrt(normalizedValue);
    
    // Convert to 0-80 range
    return linearValue * 80;
  }
}

/**
 * Formats a volume value (0-100) to a display string
 * @param volume Volume on a scale of 0-100
 * @returns Formatted string representation
 */
export function formatVolumeLabel(volume: number): string {
  if (volume <= 0) return "-∞ dB";
  
  // Convert to dB for display
  const dbValue = convertVolumeToDecibels(volume);
  
  // Special case for very low values
  if (dbValue <= -40) return "-∞ dB";
  
  // Handle positive dB values specially
  if (dbValue > 0) {
    // Round to 1 decimal place and add + sign
    return `+${Math.round(dbValue * 10) / 10} dB`;
  }
  
  // For 0dB value, don't show decimal
  if (dbValue === 0) return "0 dB";
  
  // For negative values, round to 1 decimal place
  return `${Math.round(dbValue * 10) / 10} dB`;
}

/**
 * Format time (in seconds) to MM:SS:MS format
 * @param seconds Time in seconds
 * @param showMilliseconds Whether to include milliseconds in the output
 * @returns Formatted time string
 */
export function formatTime(seconds: number, showMilliseconds: boolean = true): string {
  if (isNaN(seconds) || seconds < 0) {
    return showMilliseconds ? '00:00:000' : '00:00';
  }

  // Calculate minutes, seconds, and milliseconds
  const minutes = Math.floor(seconds / 60);
  const secondsRemainder = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  // Format with leading zeros
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(secondsRemainder).padStart(2, '0');
  
  if (showMilliseconds) {
    const formattedMilliseconds = String(milliseconds).padStart(3, '0');
    return `${formattedMinutes}:${formattedSeconds}:${formattedMilliseconds}`;
  } else {
    return `${formattedMinutes}:${formattedSeconds}`;
  }
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
 * Format file size into a human-readable string (B, KB, MB).
 * @param bytes File size in bytes.
 * @returns Formatted file size string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
