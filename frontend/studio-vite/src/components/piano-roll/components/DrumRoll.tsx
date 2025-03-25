import React, { useState, useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import { Note } from '../../../core/types/note';
import { usePianoRoll } from '../context/PianoRollContext';

interface DrumRollProps {
  trackId: string;
}

// Common drum names for visualization
const drumNames = [
  "Kick",
  "Snare",
  "Hi-Hat Closed",
  "Hi-Hat Open",
  "Tom 1",
  "Tom 2",
  "Tom 3",
  "Crash",
  "Ride",
  "Clap"
];

// Map standard drum note numbers to names
const drumMappings: Record<number, string> = {
  36: "Kick",
  38: "Snare",
  42: "Hi-Hat Closed",
  46: "Hi-Hat Open",
  41: "Tom 1",
  43: "Tom 2",
  45: "Tom 3",
  49: "Crash",
  51: "Ride",
  39: "Clap"
};

const DrumRoll: React.FC<DrumRollProps> = ({ trackId }) => {
  // Get notes and actions from context
  const { notesByTrack, createNote, moveNote, resizeNote, playPreview, stopPreview } = usePianoRoll();
  const notes = notesByTrack[trackId] || [];

  // State for drag and resize operations
  const [draggedNote, setDraggedNote] = useState<number | null>(null);
  const [dragStartPosition, setDragStartPosition] = useState<{ row: number; column: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [resizingNote, setResizingNote] = useState<number | null>(null);
  const [resizeStartLength, setResizeStartLength] = useState<number | null>(null);
  const [resizeSide, setResizeSide] = useState<'left' | 'right' | null>(null);
  
  // Refs for DOM elements
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Grid configuration
  const cellWidth = 24;
  const cellHeight = 30;
  const minGridColumns = 32;
  const [gridColumns, setGridColumns] = useState(minGridColumns);
  const expandThreshold = 0.8;
  
  // Use standard drum rows
  const drumRows = Object.keys(drumMappings).map(Number).sort((a, b) => a - b);
  const totalRows = drumRows.length;
  
  // Handle scroll and expand grid if needed
  const handleScroll = () => {
    if (!scrollContainerRef.current || !gridRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    const scrollRatio = (scrollLeft + clientWidth) / scrollWidth;

    // If we've scrolled past the threshold, add more columns
    if (scrollRatio > expandThreshold) {
      setGridColumns(prev => prev + minGridColumns);
    }
  };

  // Update grid width on container resize
  useEffect(() => {
    const updateGridColumns = () => {
      if (!gridRef.current) return;
      const containerWidth = gridRef.current.clientWidth;
      setGridColumns(Math.max(minGridColumns, Math.floor(containerWidth / cellWidth)));
    };

    const resizeObserver = new ResizeObserver(updateGridColumns);
    if (gridRef.current) {
      resizeObserver.observe(gridRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Convert from display row to MIDI note number
  const getRowNoteNumber = (rowIndex: number): number => {
    return drumRows[rowIndex] || 36; // Default to kick drum
  };

  // Convert from MIDI note number to display row
  const getNoteDisplayRow = (noteNumber: number): number => {
    return drumRows.indexOf(noteNumber);
  };

  // Handle grid click to create new notes
  const handleGridClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!gridRef.current || isDragging) return;
    
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const column = Math.floor(x / cellWidth);
    const rowIndex = Math.floor(y / cellHeight);
    
    if (rowIndex < 0 || rowIndex >= totalRows) return;
    
    const noteNumber = getRowNoteNumber(rowIndex);
    
    // Check if there's already a note at this position
    const noteExists = notes.some(note => note.row === noteNumber && note.column === column);
    if (!noteExists) {
      const newNote: Note = {
        id: Date.now(), // Use timestamp as unique ID
        row: noteNumber,
        column,
        length: 1,
        velocity: 100,
        trackId
      };

      await createNote(trackId, newNote);
      
      // Play the sound for auditory feedback
      playPreview(noteNumber);
      setTimeout(() => stopPreview(noteNumber), 300);
    }
  };

  // Handle start of note dragging
  const handleNoteDragStart = (e: React.MouseEvent, noteId: number) => {
    e.stopPropagation();
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    setIsDragging(true);
    setDraggedNote(noteId);
    setDragStartPosition({ row: note.row, column: note.column });
    
    // Play the note for auditory feedback
    playPreview(note.row);
  };

  // Handle start of note resizing
  const handleResizeStart = (e: React.MouseEvent, noteId: number, side: 'left' | 'right') => {
    e.stopPropagation();
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    setResizingNote(noteId);
    setResizeSide(side);
    setResizeStartLength(note.length);
    setIsDragging(true);
  };

  // Handle mouse movement for dragging or resizing
  const handleGridMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!gridRef.current) return;
    
    const rect = gridRef.current.getBoundingClientRect();
    
    if (resizingNote !== null) {
      // Handle note resizing
      const note = notes.find(n => n.id === resizingNote);
      if (!note) return;

      const x = e.clientX - rect.left;
      const mouseGridPosition = Math.floor(x / cellWidth);

      if (resizeSide === 'right') {
        // Resize from right side
        const newLength = Math.max(1, mouseGridPosition - note.column + 1);
        const maxLength = gridColumns - note.column;
        const clampedLength = Math.min(newLength, maxLength);
        
        // Update locally for visual feedback
        const updatedNotes = notes.map(n => 
          n.id === resizingNote 
            ? { ...n, length: clampedLength }
            : n
        );
        
        // Update context
        notesByTrack[trackId] = updatedNotes;
      } else {
        // Resize from left side
        const originalEnd = note.column + note.length - 1;
        const newStart = Math.max(0, Math.min(mouseGridPosition, originalEnd));
        const newLength = originalEnd - newStart + 1;
        
        // Update locally for visual feedback
        const updatedNotes = notes.map(n => 
          n.id === resizingNote 
            ? { ...n, column: newStart, length: newLength }
            : n
        );
        
        // Update context
        notesByTrack[trackId] = updatedNotes;
      }
    } else if (draggedNote !== null) {
      // Handle note dragging
      const note = notes.find(n => n.id === draggedNote);
      if (!note) return;
      
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const column = Math.max(0, Math.min(Math.floor(x / cellWidth), gridColumns - 1));
      const rowIndex = Math.floor(y / cellHeight);
      
      if (rowIndex >= 0 && rowIndex < totalRows) {
        const noteNumber = getRowNoteNumber(rowIndex);
        
        // Update locally for visual feedback
        const updatedNotes = notes.map(n => {
          if (n.id === draggedNote) {
            const maxColumn = gridColumns - n.length;
            const clampedColumn = Math.min(column, maxColumn);
            return { ...n, row: noteNumber, column: clampedColumn };
          }
          return n;
        });
        
        // Update context
        notesByTrack[trackId] = updatedNotes;
        
        // If the note number changed, stop the old sound and play the new one
        if (note.row !== noteNumber) {
          stopPreview(note.row);
          playPreview(noteNumber);
        }
      }
    }
  };

  // Handle mouse up - finalize drag or resize operation
  const handleGridMouseUp = async () => {
    if (draggedNote !== null && dragStartPosition) {
      // Finalize note drag
      const note = notes.find(n => n.id === draggedNote);
      if (note) {
        // Stop the preview sound
        stopPreview(note.row);
        
        // Only add to history if position actually changed
        if (note.column !== dragStartPosition.column || note.row !== dragStartPosition.row) {
          await moveNote(
            trackId,
            draggedNote,
            { x: dragStartPosition.column, y: dragStartPosition.row },
            { x: note.column, y: note.row }
          );
        }
      }
    }

    if (resizingNote !== null && resizeStartLength !== null) {
      // Finalize note resize
      const note = notes.find(n => n.id === resizingNote);
      if (note && note.length !== resizeStartLength) {
        await resizeNote(
          trackId,
          resizingNote,
          resizeStartLength,
          note.length
        );
      }
    }

    // Reset drag/resize state
    setDraggedNote(null);
    setDragStartPosition(null);
    setResizingNote(null);
    setResizeStartLength(null);
    setResizeSide(null);
    setTimeout(() => {
      setIsDragging(false);
    }, 10);
  };

  // Play note when clicking on a note
  const handleNoteClick = (e: React.MouseEvent, noteId: number) => {
    e.stopPropagation();
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    
    playPreview(note.row);
    setTimeout(() => stopPreview(note.row), 300);
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      height: '100%', 
      bgcolor: '#111',
      overflow: 'hidden'
    }}>
      {/* Main scrollable container */}
      <Box
        ref={scrollContainerRef}
        sx={{
          display: 'flex',
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            width: 10,
            height: 10,
            backgroundColor: '#222'
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#444',
            borderRadius: 2,
            '&:hover': {
              backgroundColor: '#555'
            }
          },
          '&::-webkit-scrollbar-corner': {
            backgroundColor: '#222'
          }
        }}
        onScroll={handleScroll}
      >
        <Box sx={{ 
          display: 'flex',
          minWidth: '100%',
          height: 'fit-content'
        }}>
          {/* Drum Names Column */}
          <Box sx={{ 
            width: '120px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: 1,
            borderColor: '#333',
            position: 'sticky',
            left: 0,
            zIndex: 3,
            backgroundColor: '#111'
          }}>
            {drumRows.map((noteNumber, index) => {
              const drumName = drumMappings[noteNumber] || `Note ${noteNumber}`;
              return (
                <Box
                  key={`drum-${noteNumber}`}
                  sx={{
                    height: `${cellHeight}px`,
                    bgcolor: index % 2 === 0 ? '#222' : '#1A1A1A',
                    color: '#aaa',
                    display: 'flex',
                    alignItems: 'center',
                    pl: 1,
                    fontSize: '12px',
                    borderBottom: 1,
                    borderColor: '#333',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: '#2a2a2a'
                    }
                  }}
                  onClick={() => {
                    playPreview(noteNumber);
                    setTimeout(() => stopPreview(noteNumber), 300);
                  }}
                >
                  {drumName}
                </Box>
              );
            })}
          </Box>

          {/* Grid Container */}
          <Box
            ref={gridRef}
            sx={{
              position: 'relative',
              overflow: 'visible',
              display: 'flex'
            }}
            onClick={handleGridClick}
            onMouseMove={handleGridMouseMove}
            onMouseUp={handleGridMouseUp}
            onMouseLeave={handleGridMouseUp}
          >
            <Box 
              sx={{ 
                position: 'relative',
                height: `${totalRows * cellHeight}px`,
                width: `${gridColumns * cellWidth}px`,
                minWidth: '100%',
                backgroundColor: '#181818',
                flexShrink: 0
              }}
            >
              {/* Draw the row backgrounds */}
              <Box sx={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                height: `${totalRows * cellHeight}px`,
                zIndex: 0 
              }}>
                {[...Array(totalRows)].map((_, index) => (
                  <Box
                    key={`row-bg-${index}`}
                    sx={{
                      position: 'absolute',
                      width: '100%',
                      height: `${cellHeight}px`,
                      top: `${index * cellHeight}px`,
                      bgcolor: index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                      borderBottom: 1,
                      borderColor: 'rgba(50, 50, 50, 0.5)',
                      boxSizing: 'border-box'
                    }}
                  />
                ))}
              </Box>

              {/* Draw grid lines */}
              {[...Array(gridColumns + 1)].map((_, index) => (
                <Box
                  key={`gridline-${index}`}
                  sx={{
                    position: 'absolute',
                    height: '100%',
                    width: '1px',
                    left: `${index * cellWidth}px`,
                    bgcolor: index % 4 === 0 ? 'rgba(100, 100, 100, 0.5)' : 'rgba(50, 50, 50, 0.5)',
                    zIndex: 1
                  }}
                />
              ))}

              {/* Draw notes (drum hits) */}
              {notes.map((note) => {
                const displayRow = getNoteDisplayRow(note.row);
                // Skip notes that don't match our drum mapping
                if (displayRow === -1) return null;
                
                return (
                  <Box
                    key={note.id}
                    sx={{
                      position: 'absolute',
                      top: `${displayRow * cellHeight + 2}px`,
                      left: `${note.column * cellWidth}px`,
                      width: `${note.length * cellWidth - 1}px`,
                      height: `${cellHeight - 4}px`,
                      bgcolor: '#ff9800',
                      backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.1) 100%)',
                      borderRadius: '3px',
                      cursor: 'move',
                      opacity: draggedNote === note.id || resizingNote === note.id ? 0.75 : 1,
                      '&:hover': {
                        boxShadow: '0 0 0 1px rgba(255,255,255,0.5)',
                        '& .resize-handle': {
                          opacity: 1
                        }
                      },
                      zIndex: 2
                    }}
                    onClick={(e) => handleNoteClick(e, note.id)}
                    onMouseDown={(e) => handleNoteDragStart(e, note.id)}
                  >
                    <Box 
                      className="resize-handle"
                      sx={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: '4px',
                        cursor: 'ew-resize',
                        bgcolor: 'rgba(0,0,0,0.3)',
                        opacity: 0,
                        transition: 'opacity 0.2s',
                        borderTopLeftRadius: '3px',
                        borderBottomLeftRadius: '3px',
                        '&:hover': {
                          opacity: 1,
                          bgcolor: 'rgba(0,0,0,0.5)'
                        }
                      }}
                      onMouseDown={(e) => handleResizeStart(e, note.id, 'left')}
                    />
                    <Box 
                      className="resize-handle"
                      sx={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: '4px',
                        cursor: 'ew-resize',
                        bgcolor: 'rgba(0,0,0,0.3)',
                        opacity: 0,
                        transition: 'opacity 0.2s',
                        borderTopRightRadius: '3px',
                        borderBottomRightRadius: '3px',
                        '&:hover': {
                          opacity: 1,
                          bgcolor: 'rgba(0,0,0,0.5)'
                        }
                      }}
                      onMouseDown={(e) => handleResizeStart(e, note.id, 'right')}
                    />
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default DrumRoll;