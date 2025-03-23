import React, { useState } from 'react';
import { 
  Button, 
  CircularProgress, 
  TextField, 
  Box, 
  Typography, 
  Alert,
  IconButton
} from '@mui/material';
import { CloudUpload as CloudUploadIcon, Close as CloseIcon } from '@mui/icons-material';
import { getUploadUrl, createSoundRecord } from '../api/sounds';

/**
 * Process audio file to extract metadata
 */
async function processAudioFile(file: File): Promise<{
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
function generateWaveform(audioBuffer: AudioBuffer, pointCount: number): number[] {
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
async function uploadFileWithProgress(file: File, url: string, onProgress: (progress: number) => void): Promise<void> {
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

interface SoundUploaderProps {
  onSoundUploaded?: (soundId: string) => void;
  onCancel?: () => void;
}

export default function SoundUploader({ onSoundUploaded, onCancel }: SoundUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [soundName, setSoundName] = useState('');
  
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    // Default name from file name without extension
    setSoundName(selectedFile.name.split('.')[0]);
  };
  
  const handleUpload = async () => {
    if (!file || !soundName) return;
    
    setUploading(true);
    setProgress(0);
    setError(null);
    
    try {
      // 1. Get presigned URL
      const { id, upload_url, storage_key } = await getUploadUrl(file.name);
      
      // 2. Upload file with progress tracking
      await uploadFileWithProgress(
        file, 
        upload_url,
        (percent) => setProgress(percent)
      );
      
      // 3. Process file to get metadata
      const metadata = await processAudioFile(file);
      
      // 4. Create database record
      await createSoundRecord({
        id,
        name: soundName,
        file_format: metadata.format,
        duration: metadata.duration,
        file_size: file.size,
        sample_rate: metadata.sampleRate,
        waveform_data: metadata.waveform,
        storage_key
      });
      
      // 5. Call success callback
      if (onSoundUploaded) {
        onSoundUploaded(id);
      }
      
      // Reset state
      setFile(null);
      setSoundName('');
      setProgress(0);
    } catch (err) {
      setError('Upload failed: ' + (err as Error).message);
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <Box sx={{ 
      p: 3, 
      border: '1px solid #444', 
      borderRadius: 1,
      bgcolor: '#1E1E1E',
      position: 'relative'
    }}>
      {onCancel && (
        <IconButton 
          size="small" 
          sx={{ position: 'absolute', top: 8, right: 8 }}
          onClick={onCancel}
        >
          <CloseIcon />
        </IconButton>
      )}
      
      <Typography variant="h6" gutterBottom>
        Upload Sound
      </Typography>
      
      <Box sx={{ mb: 2 }}>
        <input
          accept="audio/*"
          style={{ display: 'none' }}
          id="sound-file-input"
          type="file"
          onChange={handleFileSelected}
          disabled={uploading}
        />
        <label htmlFor="sound-file-input">
          <Button 
            variant="outlined" 
            component="span"
            disabled={uploading}
            startIcon={<CloudUploadIcon />}
            sx={{ mb: 2 }}
          >
            Select Audio File
          </Button>
        </label>
        {file && (
          <Typography variant="body2" sx={{ mt: 1, color: '#ccc' }}>
            Selected: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
          </Typography>
        )}
      </Box>
      
      {file && (
        <TextField
          fullWidth
          label="Sound Name"
          value={soundName}
          onChange={(e) => setSoundName(e.target.value)}
          disabled={uploading}
          sx={{ 
            mb: 2,
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: '#555',
              },
              '&:hover fieldset': {
                borderColor: '#777',
              },
            },
            '& .MuiInputLabel-root': {
              color: '#aaa',
            },
            '& .MuiInputBase-input': {
              color: 'white',
            }
          }}
        />
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {uploading && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <CircularProgress size={24} sx={{ mr: 1 }} />
          <Typography sx={{ color: '#ccc' }}>
            {progress < 100 ? `Uploading: ${progress}%` : 'Processing...'}
          </Typography>
        </Box>
      )}
      
      <Button
        variant="contained"
        onClick={handleUpload}
        disabled={!file || !soundName || uploading}
        fullWidth
        sx={{
          bgcolor: '#6a3de8',
          '&:hover': {
            bgcolor: '#7b50f3',
          }
        }}
      >
        Upload Sound
      </Button>
    </Box>
  );
}