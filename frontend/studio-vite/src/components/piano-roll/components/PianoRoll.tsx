import React, { useState, useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import { Note } from '../../../core/types/note';
import { usePianoRoll } from '../context/PianoRollContext';

interface PianoRollProps {
  trackId: string;
}

const PianoRoll: React.FC<PianoRollProps> = ({ trackId }) => {
  // Get notes and actions from context
  const { notesByTrack, createNote, moveNote, resizeNote, playPreview, stopPreview } = usePianoRoll();
  const notes = notesByTrack[trackId] || [];

  // State for drag and resize operations
  const [draggedNote, setDraggedNote] = useState<number | null>(null);
  const [dragStartPosition, setDragStartPosition] = useState<{ row: number; column: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [resizingNote, setResizingNote] = useState<number | null>(null);
  const [resizeStartLength, setResizeStartLength] = useState<number | null>(null);
  const [resizeStartColumn, setResizeStartColumn] = useState<number | null>(null);
  const [resizeSide, setResizeSide] = useState<'left' | 'right' | null>(null);
  
  // Refs for DOM elements
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Grid configuration
  const octaves = 10;
  const notesPerOctave = 12;
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const totalNotes = octaves * notesPerOctave;
  
  const cellWidth = 24;
  const cellHeight = 20;
  const minGridColumns = 32; // Reduced from 32 to show less empty space initially
  const [gridColumns, setGridColumns] = useState(minGridColumns);
  const expandThreshold = 0.8; // When to add more columns (80% of visible width)

  // Helper function to convert display row to actual row (MIDI note number)
  const displayRowToActualRow = (displayRow: number): number => {
    return totalNotes - 1 - displayRow;
  };

  // Helper function to convert actual row to display row
  const actualRowToDisplayRow = (actualRow: number): number => {
    return totalNotes - 1 - actualRow;
  };

  // Check if a note represents a black key
  const isBlackKey = (noteIndex: number): boolean => {
    const noteInOctave = noteIndex % 12;
    return [1, 3, 6, 8, 10].includes(noteInOctave);
  };

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

  // Handle grid click to create new notes
  const handleGridClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!gridRef.current || isDragging) return;
    
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const column = Math.floor(x / cellWidth);
    const displayRow = Math.floor(y / cellHeight);
    const actualRow = displayRowToActualRow(displayRow);
    
    // Check if there's already a note at this position
    const noteExists = notes.some(note => note.row === actualRow && note.column === column);
    if (!noteExists) {
      const newNote: Note = {
        id: Date.now(), // Use timestamp as unique ID
        row: actualRow,
        column,
        length: 1,
        velocity: 100,
        trackId
      };

      await createNote(trackId, newNote);
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
    
    const noteElement = e.currentTarget as HTMLElement;
    const rect = noteElement.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    
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
    setResizeStartColumn(note.column);
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
        // Resize from right side (change length)
        const newLength = Math.max(1, mouseGridPosition - note.column + 1);
        const maxLength = gridColumns - note.column;
        const clampedLength = Math.min(newLength, maxLength);
        
        // Update notes state locally for immediate visual feedback
        const updatedNotes = notes.map(n => 
          n.id === resizingNote 
            ? { ...n, length: clampedLength }
            : n
        );
        
        // Update context
        notesByTrack[trackId] = updatedNotes;
      } else {
        // Resize from left side (change column and length)
        const originalEnd = note.column + note.length - 1;
        const newStart = Math.max(0, Math.min(mouseGridPosition, originalEnd));
        const newLength = originalEnd - newStart + 1;
        
        // Update notes state locally for immediate visual feedback
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
      const x = e.clientX - rect.left - dragOffset.x;
      const y = e.clientY - rect.top - dragOffset.y;
      
      const column = Math.max(0, Math.min(Math.floor(x / cellWidth), gridColumns - 1));
      const displayRow = Math.max(0, Math.min(Math.floor(y / cellHeight), totalNotes - 1));
      const actualRow = displayRowToActualRow(displayRow);

      // Update notes state locally for immediate visual feedback
      const updatedNotes = notes.map(note => {
        if (note.id === draggedNote) {
          const maxColumn = gridColumns - note.length;
          const clampedColumn = Math.min(column, maxColumn);
          return { ...note, row: actualRow, column: clampedColumn };
        }
        return note;
      });
      
      // Update context
      notesByTrack[trackId] = updatedNotes;

      // Play the new note for auditory feedback if row changed
      const oldNote = notes.find(n => n.id === draggedNote);
      const newNote = updatedNotes.find(n => n.id === draggedNote);
      if (oldNote && newNote && oldNote.row !== newNote.row) {
        stopPreview(oldNote.row);
        playPreview(newNote.row);
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
      if (note) {
        // Only add to history if length or position actually changed
        const lengthChanged = note.length !== resizeStartLength;
        const columnChanged = resizeSide === 'left' && resizeStartColumn !== null && note.column !== resizeStartColumn;
        
        if (lengthChanged || columnChanged) {
          await resizeNote(
            trackId,
            resizingNote,
            resizeStartLength,
            note.length,
            resizeSide === 'left' ? resizeStartColumn : undefined,
            resizeSide === 'left' ? note.column : undefined
          );
        }
      }
    }

    // Reset drag/resize state
    setDraggedNote(null);
    setDragStartPosition(null);
    setResizingNote(null);
    setResizeStartLength(null);
    setResizeStartColumn(null);
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
    setTimeout(() => stopPreview(note.row), 300); // Stop after 300ms
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
          {/* Piano Keys */}
          <Box sx={{ 
            width: '64px',
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
            {[...Array(totalNotes)].map((_, index) => {
              const actualIndex = displayRowToActualRow(index);
              const octave = Math.floor(actualIndex / 12);
              const noteInOctave = actualIndex % 12;
              const isBlack = isBlackKey(actualIndex);
              return (
                <Box
                  key={`key-${index}`}
                  sx={{
                    height: `${cellHeight}px`,
                    bgcolor: isBlack ? '#222' : '#333',
                    color: isBlack ? '#888' : '#aaa',
                    display: 'flex',
                    alignItems: 'center',
                    pl: 0.5,
                    fontSize: '11px',
                    boxSizing: 'border-box',
                    borderBottom: 1,
                    borderColor: '#444',
                    position: 'relative',
                    '&:hover': {
                      bgcolor: isBlack ? '#2a2a2a' : '#3a3a3a',
                    },
                    cursor: 'pointer'
                  }}
                  onClick={() => playPreview(actualIndex)}
                  onMouseDown={() => playPreview(actualIndex)}
                  onMouseUp={() => stopPreview(actualIndex)}
                  onMouseLeave={() => stopPreview(actualIndex)}
                >
                  {noteInOctave === 0 && <span style={{ opacity: 0.8 }}>{`C${octave}`}</span>}
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
                height: `${totalNotes * cellHeight}px`,
                width: `${gridColumns * cellWidth}px`,
                minWidth: '100%',
                backgroundColor: '#181818',
                flexShrink: 0
              }}
            >
              {/* Draw the row backgrounds first */}
              <Box sx={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                height: `${totalNotes * cellHeight}px`,
                zIndex: 0 
              }}>
                {[...Array(totalNotes)].map((_, index) => {
                  const actualIndex = displayRowToActualRow(index);
                  const octave = Math.floor(actualIndex / 12);
                  const noteInOctave = actualIndex % 12;
                  const isC = noteInOctave === 0; // Highlight C notes for each octave
                  
                  return (
                    <Box
                      key={`row-bg-${index}`}
                      sx={{
                        position: 'absolute',
                        width: '100%',
                        height: `${cellHeight}px`,
                        top: `${index * cellHeight}px`,
                        bgcolor: isBlackKey(actualIndex) ? 'rgba(0, 0, 0, 0.2)' : 'transparent',
                        borderBottom: 1,
                        borderColor: isC ? 'rgba(100, 100, 100, 0.5)' : 'rgba(50, 50, 50, 0.5)',
                        boxSizing: 'border-box'
                      }}
                    />
                  );
                })}
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

              {/* Draw notes on top */}
              {notes.map((note) => (
                <Box
                  key={note.id}
                  sx={{
                    position: 'absolute',
                    top: `${actualRowToDisplayRow(note.row) * cellHeight}px`,
                    left: `${note.column * cellWidth}px`,
                    width: `${note.length * cellWidth - 1}px`,
                    height: `${cellHeight - 1}px`,
                    bgcolor: '#2196f3',
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
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default PianoRoll;