# Priority Fixes for Studio Component

This document outlines the immediate priority fixes needed to achieve basic parity with the original implementation.

## 1. Add Track Menu Implementation

### Current Issues
- The current "Add Track" dropdown is basic and lacks file upload capabilities
- No visual differentiation between track types during creation
- Missing drag-and-drop support for files

### Implementation Plan

1. **Create AddTrackMenu Component**
   ```tsx
   // components/AddTrackMenu.tsx
   export const AddTrackMenu = ({ 
     isOpen, 
     anchorEl, 
     onClose, 
     onAddTrack, 
     onFileUpload 
   }) => {
     const handleFileUpload = (event) => {
       const file = event.target.files[0];
       if (file) onFileUpload(file);
       onClose();
     };
     
     return (
       <Menu
         open={isOpen}
         anchorEl={anchorEl}
         onClose={onClose}
         PaperProps={{
           sx: { bgcolor: '#222', color: 'white', minWidth: 180 }
         }}
       >
         <MenuItem onClick={() => { onAddTrack('midi'); onClose(); }}>
           <ListItemIcon><PianoIcon sx={{ color: '#2196f3' }} /></ListItemIcon>
           <ListItemText primary="MIDI Track" />
         </MenuItem>
         
         <MenuItem onClick={() => { onAddTrack('drum'); onClose(); }}>
           <ListItemIcon><DrumIcon sx={{ color: '#ff9800' }} /></ListItemIcon>
           <ListItemText primary="Drum Machine" />
         </MenuItem>
         
         <Divider sx={{ bgcolor: '#444' }} />
         
         <MenuItem>
           <label style={{ display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer' }}>
             <ListItemIcon><AudioFileIcon sx={{ color: '#4caf50' }} /></ListItemIcon>
             <ListItemText primary="Import Audio" />
             <input 
               type="file" 
               accept="audio/*" 
               style={{ display: 'none' }} 
               onChange={handleFileUpload} 
             />
           </label>
         </MenuItem>
       </Menu>
     );
   };
   ```

2. **Add File Upload Capability to Store**
   ```ts
   // stores/useStudioStore.ts - add to StudioState interface
   uploadAudioFile: (file: File) => Promise<void>;
   
   // Implementation
   uploadAudioFile: async (file) => {
     const { store, tracks } = get();
     if (!store || !isInitialized) return;
     
     try {
       // Create a new track for the audio file
       const trackName = file.name.split('.')[0];
       const newTrack = await store.createTrack(trackName, 'audio');
       
       // Load the audio file into the track
       await store.loadAudioFile(newTrack.id, file);
       
       // Get the track from audio engine after loading
       const audioTrack = await store.getAudioEngine().getTrackById(newTrack.id);
       
       if (!audioTrack) throw new Error("Failed to create audio track");
       
       // Set proper position and calculate width
       const trackData: TrackState = {
         ...newTrack,
         ...audioTrack,
         position: { x: 0, y: tracks.length * 40 },
         audioFile: file,
         type: 'audio',
         _calculatedWidth: calculateTrackWidth(audioTrack.duration || 0, get().bpm, get().timeSignature)
       };
       
       // Set track position in audio engine
       store.getAudioEngine().setTrackPosition(trackData.id, 0, tracks.length * 40);
       
       // Add track to state
       set({ tracks: [...tracks, trackData] });
       
       console.log(`Added audio track from file:`, trackData);
     } catch (error) {
       console.error("Failed to upload audio file:", error);
     }
   }
   ```

3. **Connect to Studio Component**
   ```tsx
   // In Studio.tsx
   const {
     addMenuAnchor,
     setAddMenuAnchor,
     handleAddTrack,
     uploadAudioFile
   } = useStudioStore();
   
   // Replace existing menu with component
   <AddTrackMenu
     isOpen={Boolean(addMenuAnchor)}
     anchorEl={addMenuAnchor}
     onClose={() => setAddMenuAnchor(null)}
     onAddTrack={handleAddTrack}
     onFileUpload={uploadAudioFile}
   />
   ```

## 2. Track Dragging Implementation

### Current Issues
- Dragging tracks on the timeline doesn't work properly
- No snap-to-grid functionality
- Missing visual feedback during drag

### Implementation Plan

1. **Fix TrackPreview Drag Implementation**
   ```tsx
   // components/track-preview/TrackPreview.tsx
   
   // Update handleMouseDown function
   const handleMouseDown = (e: React.MouseEvent) => {
     if (!trackRef.current) return;
     
     // Prevent clicks on control elements from initiating drag
     if ((e.target as HTMLElement).closest('.track-control')) {
       return;
     }

     // Store the initial mouse position including scroll offsets
     const container = trackRef.current.closest('.timeline-container');
     if (!container) return;
     
     const scrollLeft = container.scrollLeft || 0;
     const scrollTop = container.scrollTop || 0;
     
     setStartDragMousePosition({
       x: e.clientX + scrollLeft,
       y: e.clientY + scrollTop
     });

     // Store the initial track position
     setStartDragTrackPosition({
       x: track.position.x,
       y: track.position.y
     });

     // Initialize last moved position
     lastMovedPositionRef.current = track.position;

     setIsDragging(true);
     e.preventDefault(); // Prevent text selection while dragging
   };
   
   // Update handleMouseMove function with better grid snapping
   const handleMouseMove = React.useCallback((e: MouseEvent) => {
     if (!isDragging || !trackRef.current) return;

     const container = trackRef.current.closest('.timeline-container');
     if (!container) return;

     // Calculate the current mouse position including scroll
     const currentMouseX = e.clientX + container.scrollLeft;
     const currentMouseY = e.clientY + container.scrollTop;

     // Calculate the delta from the start position
     const deltaX = currentMouseX - startDragMousePosition.x;
     const deltaY = currentMouseY - startDragMousePosition.y;

     // Calculate new position based on the original position plus the delta
     const newX = startDragTrackPosition.x + deltaX;
     const newY = startDragTrackPosition.y + deltaY;

     // Snap to grid implementation
     const snapToGrid = (value: number, gridSize: number) => {
       return Math.round(value / gridSize) * gridSize;
     };

     // Calculate grid size based on time signature and BPM
     const beatsPerMeasure = timeSignature[0];
     const beatsPerGrid = 1 / 4; // Snap to 16th notes (1/4 of a beat)
     const pixelsPerBeat = GRID_CONSTANTS.measureWidth / beatsPerMeasure;
     const gridSize = pixelsPerBeat * beatsPerGrid;
     
     // Snap X to grid and track lanes for Y
     const snappedX = snapToGrid(newX, gridSize);
     const snappedY = snapToGrid(newY, GRID_CONSTANTS.trackHeight);

     const newPosition = {
       x: Math.max(0, snappedX), // Prevent negative X
       y: Math.max(0, snappedY)  // Prevent negative Y
     };

     // Add visual indicator for snap points (using a ref to avoid re-renders)
     if (gridIndicatorRef.current) {
       gridIndicatorRef.current.style.left = `${snappedX}px`;
       gridIndicatorRef.current.style.display = 'block';
     }
     
     // Store the last moved position
     lastMovedPositionRef.current = newPosition;

     // Update position (without setting isDragEnd=true)
     onPositionChange(newPosition, false);
   }, [isDragging, startDragMousePosition, startDragTrackPosition, timeSignature, onPositionChange]);
   
   // Update the render function to include grid indicators
   return (
     <Box
       ref={trackRef}
       onMouseDown={handleMouseDown}
       className="track"
       sx={trackStyle}
     >
       {/* Track Timeline content */}
       
       {/* Grid line indicator for snap feedback */}
       {isDragging && (
         <Box
           ref={gridIndicatorRef}
           sx={{
             position: 'absolute',
             height: GRID_CONSTANTS.trackHeight * 10,
             width: '1px',
             backgroundColor: 'rgba(255, 255, 255, 0.5)',
             top: -GRID_CONSTANTS.trackHeight * 4,
             pointerEvents: 'none',
             zIndex: 1000
           }}
         />
       )}
     </Box>
   );
   ```

2. **Add Proper Class Name to Timeline Container**
   ```tsx
   // components/Timeline/Timeline.tsx
   <Box 
     ref={ref}
     className="timeline-container"
     sx={{ 
       flex: 1, 
       position: 'relative', 
       overflow: 'auto',
     }}
   >
   ```

3. **Update Store with Better Position Change Handling**
   ```tsx
   // stores/useStudioStore.ts
   handleTrackPositionChange: (trackId, newPosition, isDragEnd) => {
     const { store, tracks } = get();
     if (!store) return;
     
     // Find the track
     const track = tracks.find(t => t.id === trackId);
     if (!track) return;

     // Update track positions in state
     const updatedTracks = tracks.map(t => 
       t.id === trackId 
         ? { ...t, position: newPosition }
         : t
     );
     
     set({ tracks: updatedTracks });
     
     // Update audio engine
     store.getAudioEngine().setTrackPosition(
       trackId,
       newPosition.x,
       newPosition.y
     );
     
     // If this is the end of a drag operation, adjust playback
     if (isDragEnd) {
       // Tell the transport controller to adjust playback if playing
       store.getTransport().handleTrackPositionChange?.(trackId, newPosition.x);
     }
   }
   ```

## 3. Consistent Track Controls

### Current Issues
- Track controls aren't consistent across track types
- Missing specialized controls for different track types

### Implementation Plan

1. **Update TrackControls Component for Consistency**
   ```tsx
   // components/TrackControlsSidebar.tsx
   
   // Add track type specific controls based on type
   const renderTypeSpecificControls = () => {
     switch(track.type) {
       case 'midi':
         return (
           <Box sx={{ mb: 1 }}>
             <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
               Instrument
             </Typography>
             <Select
               size="small"
               value="synth"
               fullWidth
               sx={{ 
                 mt: 0.5,
                 fontSize: '12px',
                 '.MuiSelect-select': { py: 0.5 },
                 bgcolor: 'rgba(0,0,0,0.2)'
               }}
             >
               <MenuItem value="synth">Synth</MenuItem>
               <MenuItem value="piano">Piano</MenuItem>
               <MenuItem value="bass">Bass</MenuItem>
             </Select>
           </Box>
         );
       
       case 'drum':
         return (
           <Box sx={{ mb: 1 }}>
             <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
               Drum Kit
             </Typography>
             <Select
               size="small"
               value="808"
               fullWidth
               sx={{ 
                 mt: 0.5,
                 fontSize: '12px',
                 '.MuiSelect-select': { py: 0.5 },
                 bgcolor: 'rgba(0,0,0,0.2)'
               }}
             >
               <MenuItem value="808">808 Kit</MenuItem>
               <MenuItem value="acoustic">Acoustic Kit</MenuItem>
               <MenuItem value="electronic">Electronic Kit</MenuItem>
             </Select>
           </Box>
         );
         
       case 'audio':
         return (
           <Box sx={{ mb: 1 }}>
             <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
               Audio File
             </Typography>
             <Box sx={{ 
               mt: 0.5,
               fontSize: '12px',
               color: 'rgba(255,255,255,0.8)',
               bgcolor: 'rgba(0,0,0,0.2)',
               p: 0.5,
               borderRadius: 1,
               overflow: 'hidden',
               textOverflow: 'ellipsis',
               whiteSpace: 'nowrap'
             }}>
               {track.audioFile?.name || 'No file loaded'}
             </Box>
           </Box>
         );
         
       default:
         return null;
     }
   };
   
   // Insert renderTypeSpecificControls() in appropriate place in component
   // After the track type indicator and before the volume controls
   ```

2. **Add Track Name Editing**
   ```tsx
   // Add to TrackControls component
   const [isEditingName, setIsEditingName] = useState(false);
   const [editedName, setEditedName] = useState(track.name);
   const nameInputRef = useRef<HTMLInputElement>(null);
   
   const handleNameChange = () => {
     if (editedName.trim() !== '') {
       onTrackNameChange(track.id, editedName);
     }
     setIsEditingName(false);
   };
   
   useEffect(() => {
     if (isEditingName && nameInputRef.current) {
       nameInputRef.current.focus();
     }
   }, [isEditingName]);
   
   // Replace track name typography with:
   {isEditingName ? (
     <TextField
       inputRef={nameInputRef}
       size="small"
       value={editedName}
       onChange={(e) => setEditedName(e.target.value)}
       onBlur={handleNameChange}
       onKeyDown={(e) => {
         if (e.key === 'Enter') handleNameChange();
         if (e.key === 'Escape') {
           setEditedName(track.name);
           setIsEditingName(false);
         }
       }}
       sx={{
         minWidth: '120px',
         '.MuiInputBase-input': {
           color: 'white',
           fontSize: '13px',
           py: 0.5,
           px: 1
         }
       }}
     />
   ) : (
     <Typography 
       variant="subtitle2" 
       sx={{ 
         fontWeight: 'bold',
         cursor: 'pointer',
         '&:hover': { textDecoration: 'underline' }
       }}
       onClick={() => setIsEditingName(true)}
     >
       {track.name}
     </Typography>
   )}
   ```

3. **Add Track Name Change to Store**
   ```tsx
   // Add to StudioState interface
   handleTrackNameChange: (trackId: string, name: string) => void;
   
   // Implementation
   handleTrackNameChange: (trackId, name) => {
     const { store, tracks } = get();
     if (!store) return;
     
     // Update local state
     const updatedTracks = tracks.map(t => 
       t.id === trackId ? { ...t, name } : t
     );
     
     set({ tracks: updatedTracks });
     
     // Update in audio engine
     store.getAudioEngine().setTrackName(trackId, name);
   }
   ```

## 4. Audio File Upload Functionality

### Current Issues
- No way to upload audio files
- Missing waveform visualization
- No drag-and-drop support

### Implementation Plan

1. **Implement Audio File Loading in Store**
   ```ts
   // stores/useStudioStore.ts
   uploadAudioFile: async (file: File) => {
     const { store, tracks, bpm, timeSignature } = get();
     if (!store || !get().isInitialized) return;
     
     try {
       // First create a track with default name
       const trackName = file.name.split('.')[0];
       const newTrack = await store.createTrack(trackName, 'audio');
       
       // Load the file into the audio engine
       await store.loadAudioFile(newTrack.id, file);
       
       // Get the updated track from audio engine (including duration)
       const audioTrack = store.getAudioEngine().getAllTracks().find(t => t.id === newTrack.id);
       if (!audioTrack) throw new Error("Failed to get created audio track");
       
       // Calculate track width based on file duration
       const audioFileDuration = audioTrack.player?.buffer?.duration || 0;
       
       // Create track data with position and calculated width
       const trackData: TrackState = {
         ...newTrack,
         ...audioTrack,
         position: { 
           x: 0, 
           y: tracks.length * 40 // Track height constant
         },
         duration: audioFileDuration,
         audioFile: file,
         type: 'audio',
         _calculatedWidth: calculateTrackWidth(audioFileDuration, bpm, timeSignature)
       };
       
       // Update track position in audio engine
       store.getAudioEngine().setTrackPosition(
         trackData.id,
         trackData.position.x,
         trackData.position.y
       );
       
       // Add track to state
       set({ tracks: [...tracks, trackData] });
       
       console.log(`Added audio track from file:`, trackData);
     } catch (error) {
       console.error("Failed to upload audio file:", error);
     }
   }
   ```

2. **Add Waveform Display Component**
   ```tsx
   // components/WaveformDisplay.tsx
   import React, { useEffect, useRef } from 'react';
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
       if (!audioFile || !canvasRef.current) return;
       
       const canvas = canvasRef.current;
       const ctx = canvas.getContext('2d');
       if (!ctx) return;
       
       // Clear canvas
       ctx.clearRect(0, 0, canvas.width, canvas.height);
       
       // Draw placeholder waveform
       // In a real implementation, you'd decode the audio file and draw the actual waveform
       const drawPlaceholderWaveform = () => {
         const height = canvas.height;
         const middle = height / 2;
         
         ctx.beginPath();
         ctx.strokeStyle = trackColor;
         ctx.lineWidth = 1.5;
         
         const sampleCount = Math.min(width, 400);
         const step = width / sampleCount;
         
         for (let i = 0; i < sampleCount; i++) {
           const x = i * step;
           const amplitude = Math.sin(i * 0.1) * 0.3 + Math.random() * 0.4;
           const y = middle + amplitude * middle;
           
           if (i === 0) {
             ctx.moveTo(x, y);
           } else {
             ctx.lineTo(x, y);
           }
         }
         
         ctx.stroke();
       };
       
       // Set canvas dimensions
       canvas.width = width;
       canvas.height = 30;
       
       drawPlaceholderWaveform();
       
       // For a real implementation, you would:
       // 1. Read the file
       // 2. Decode it with AudioContext
       // 3. Get the audio data
       // 4. Draw the actual waveform
       
     }, [audioFile, trackColor, width]);
     
     return (
       <Box sx={{ 
         height: '100%', 
         display: 'flex', 
         alignItems: 'center',
         overflow: 'hidden',
         position: 'relative'
       }}>
         <canvas 
           ref={canvasRef} 
           style={{ 
             width: '100%', 
             height: '30px'
           }} 
         />
       </Box>
     );
   };
   ```

3. **Add File Upload Component**
   ```tsx
   // components/AudioFileUpload.tsx
   import React, { useRef } from 'react';
   import { Box, Button, Typography } from '@mui/material';
   import AudioFileIcon from '@mui/icons-material/AudioFile';
   
   interface AudioFileUploadProps {
     onFileSelect: (file: File) => void;
   }
   
   export const AudioFileUpload: React.FC<AudioFileUploadProps> = ({ onFileSelect }) => {
     const fileInputRef = useRef<HTMLInputElement>(null);
     
     const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
       const files = event.target.files;
       if (files && files.length > 0) {
         onFileSelect(files[0]);
       }
     };
     
     const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
       event.preventDefault();
       event.stopPropagation();
       
       const files = event.dataTransfer.files;
       if (files && files.length > 0) {
         onFileSelect(files[0]);
       }
     };
     
     const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
       event.preventDefault();
       event.stopPropagation();
     };
     
     return (
       <Box 
         sx={{ 
           border: '2px dashed #666',
           borderRadius: 2,
           padding: 2,
           textAlign: 'center',
           bgcolor: 'rgba(0,0,0,0.2)',
           cursor: 'pointer',
           transition: 'all 0.2s',
           '&:hover': {
             borderColor: '#aaa',
             bgcolor: 'rgba(30,30,30,0.4)',
           }
         }}
         onClick={() => fileInputRef.current?.click()}
         onDrop={handleDrop}
         onDragOver={handleDragOver}
       >
         <AudioFileIcon sx={{ fontSize: 40, color: '#4caf50', mb: 1 }} />
         <Typography variant="body2">
           Drag & drop an audio file here
         </Typography>
         <Typography variant="caption" sx={{ color: '#999', display: 'block', mt: 0.5 }}>
           or click to browse
         </Typography>
         <Button 
           variant="outlined" 
           size="small"
           sx={{ mt: 1, textTransform: 'none', fontSize: '12px' }}
         >
           Select File
         </Button>
         <input
           type="file"
           ref={fileInputRef}
           onChange={handleFileChange}
           accept="audio/*"
           style={{ display: 'none' }}
         />
       </Box>
     );
   };
   ```

4. **Integrate Waveform Display in TrackPreview**
   ```tsx
   // components/track-preview/TrackPreview.tsx
   
   // Add import
   import { WaveformDisplay } from '../WaveformDisplay';
   
   // Add to track timeline content
   {track.type === 'audio' && track.audioFile && (
     <WaveformDisplay
       audioFile={track.audioFile}
       trackColor={trackColor}
       duration={track.duration || 0}
       width={typeof trackWidth === 'number' ? trackWidth : 500}
     />
   )}
   ```

## Next Steps

After implementing these priority fixes, we should:

1. Test each feature thoroughly for proper integration
2. Review performance, especially when dragging tracks and handling audio files
3. Improve error handling and user feedback
4. Document the implementation for the remaining items in the migration plan

By completing these priority items, we will significantly improve the user experience and achieve better parity with the original implementation.