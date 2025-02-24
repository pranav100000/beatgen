import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { Button, Modal, Box } from '@mui/material';
import { Note } from '../../core/types/note';
import { NoteCreateAction, NoteMoveAction, NoteResizeAction } from '../../core/state/history/actions/NoteActions';
import { historyManager } from '../../core/state/history/HistoryManager';
import { useStore } from '../../core/state/StoreContext';

// Types and interfaces remain the same as before
interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface DragOffset {
  x: number;
  y: number;
}

interface PianoRollContextType {
  isOpen: boolean;
  openPianoRoll: () => void;
  closePianoRoll: () => void;
}

interface DraggableModalProps {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
}

// Create context
const PianoRollContext = createContext<PianoRollContextType | null>(null);


// Simple button component to open the piano roll
export const PianoRollButton: React.FC = () => {
  const { openPianoRoll } = usePianoRoll();
  
  return (
    <Button 
      onClick={openPianoRoll}
      variant="contained"
      sx={{
        bgcolor: '#2196f3',
        color: 'white',
        '&:hover': {
          bgcolor: '#1976d2'
        }
      }}
    >
      Open Piano Roll
    </Button>
  );
};

// Provider component that manages the piano roll state
export const PianoRollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const openPianoRoll = () => setIsOpen(true);
  const closePianoRoll = () => setIsOpen(false);

  return (
    <PianoRollContext.Provider value={{ isOpen, openPianoRoll, closePianoRoll }}>
      {children}
      {isOpen && (
        <DraggableModal title="Piano Roll" onClose={closePianoRoll}>
          <PianoRoll />
        </DraggableModal>
      )}
    </PianoRollContext.Provider>
  );
};

// Hook to access the piano roll context
export const usePianoRoll = (): PianoRollContextType => {
  const context = useContext(PianoRollContext);
  if (!context) {
    throw new Error('usePianoRoll must be used within a PianoRollProvider');
  }
  return context;
};

// The main PianoRoll component
const PianoRoll: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draggedNote, setDraggedNote] = useState<number | null>(null);
  const [dragStartPosition, setDragStartPosition] = useState<{ row: number; column: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<DragOffset>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [resizingNote, setResizingNote] = useState<number | null>(null);
  const [resizeStartLength, setResizeStartLength] = useState<number | null>(null);
  const [resizeStartColumn, setResizeStartColumn] = useState<number | null>(null);
  const [resizeSide, setResizeSide] = useState<'left' | 'right' | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const store = useStore();

  const octaves = 10;
  const notesPerOctave = 12;
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const totalNotes = octaves * notesPerOctave;
  
  const cellWidth = 24;
  const cellHeight = 20;
  const minGridColumns = 32;
  const [gridColumns, setGridColumns] = useState(minGridColumns);
  const expandThreshold = 0.8; // When to add more columns (80% of visible width)

  // Helper function to convert display row to actual row
  const displayRowToActualRow = (displayRow: number): number => {
    return totalNotes - 1 - displayRow;
  };

  // Helper function to convert actual row to display row
  const actualRowToDisplayRow = (actualRow: number): number => {
    return totalNotes - 1 - actualRow;
  };

  // Helper function to handle scroll and expand grid if needed
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

  const isBlackKey = (noteIndex: number): boolean => {
    const noteInOctave = noteIndex % 12;
    return [1, 3, 6, 8, 10].includes(noteInOctave);
  };

  const handleGridClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!gridRef.current || isDragging) return;
    
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const column = Math.floor(x / cellWidth);
    const displayRow = Math.floor(y / cellHeight);
    const actualRow = displayRowToActualRow(displayRow);
    
    const noteExists = notes.some(note => note.row === actualRow && note.column === column);
    if (!noteExists) {
      const newNote: Note = {
        row: actualRow,
        column,
        id: Date.now(),
        length: 1
      };

      const action = new NoteCreateAction(
        store,
        setNotes,
        newNote,
        notes
      );
      await historyManager.executeAction(action);
    }
  };

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
  };

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

  const handleGridMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!gridRef.current) return;
    
    const rect = gridRef.current.getBoundingClientRect();
    
    if (resizingNote !== null) {
      const note = notes.find(n => n.id === resizingNote);
      if (!note) return;

      const x = e.clientX - rect.left;
      const mouseGridPosition = Math.floor(x / cellWidth);

      if (resizeSide === 'right') {
        const newLength = Math.max(1, mouseGridPosition - note.column + 1);
        const maxLength = gridColumns - note.column;
        const clampedLength = Math.min(newLength, maxLength);
        
        setNotes(notes.map(n => 
          n.id === resizingNote 
            ? { ...n, length: clampedLength }
            : n
        ));
      } else {
        const originalEnd = note.column + note.length - 1;
        const newStart = Math.max(0, Math.min(mouseGridPosition, originalEnd));
        const newLength = originalEnd - newStart + 1;
        
        setNotes(notes.map(n => 
          n.id === resizingNote 
            ? { ...n, column: newStart, length: newLength }
            : n
        ));
      }
    } else if (draggedNote !== null) {
      const x = e.clientX - rect.left - dragOffset.x;
      const y = e.clientY - rect.top - dragOffset.y;
      
      const column = Math.max(0, Math.min(Math.floor(x / cellWidth), gridColumns - 1));
      const displayRow = Math.floor(y / cellHeight);
      const actualRow = displayRowToActualRow(displayRow);

      setNotes(notes.map(note => {
        if (note.id === draggedNote) {
          const maxColumn = gridColumns - note.length;
          const clampedColumn = Math.min(column, maxColumn);
          return { ...note, row: actualRow, column: clampedColumn };
        }
        return note;
      }));
    }
  };

  const handleGridMouseUp = async () => {
    if (draggedNote !== null && dragStartPosition) {
      const note = notes.find(n => n.id === draggedNote);
      if (note) {
        const action = new NoteMoveAction(
          store,
          setNotes,
          draggedNote,
          { x: dragStartPosition.column, y: dragStartPosition.row },
          { x: note.column, y: note.row },
          notes
        );
        await historyManager.executeAction(action);
      }
    }

    if (resizingNote !== null && resizeStartLength !== null) {
      const note = notes.find(n => n.id === resizingNote);
      if (note) {
        const action = new NoteResizeAction(
          store,
          setNotes,
          resizingNote,
          resizeStartLength,
          note.length,
          notes,
          resizeSide === 'left' ? (resizeStartColumn ?? undefined) : undefined,
          resizeSide === 'left' ? note.column : undefined
        );
        await historyManager.executeAction(action);
      }
    }

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

  return (
    <Box sx={{ 
      display: 'flex', 
      height: '100%', 
      bgcolor: 'grey.100',
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
            backgroundColor: '#f0f0f0'
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#888',
            borderRadius: 2,
            '&:hover': {
              backgroundColor: '#666'
            }
          },
          '&::-webkit-scrollbar-corner': {
            backgroundColor: '#f0f0f0'
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
            borderColor: 'grey.300',
            position: 'sticky',
            left: 0,
            zIndex: 3,
            backgroundColor: 'background.paper'
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
                    bgcolor: isBlack ? 'black' : 'white',
                    color: isBlack ? 'white' : 'black',
                    display: 'flex',
                    alignItems: 'center',
                    pl: 0.5,
                    fontSize: '12px',
                    boxSizing: 'border-box',
                    borderBottom: 1,
                    borderColor: 'grey.300',
                    position: 'relative',
                    '&::after': isBlack ? {
                      content: '""',
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      width: '50%',
                      height: '100%',
                      bgcolor: 'rgba(0, 0, 0, 0.1)',
                      pointerEvents: 'none'
                    } : {}
                  }}
                >
                  {!isBlack && `${noteNames[noteInOctave]}${octave}`}
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
                backgroundColor: 'white',
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
                  return (
                    <Box
                      key={`row-bg-${index}`}
                      sx={{
                        position: 'absolute',
                        width: '100%',
                        height: `${cellHeight}px`,
                        top: `${index * cellHeight}px`,
                        bgcolor: isBlackKey(actualIndex) ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                        borderBottom: 1,
                        borderColor: 'grey.200',
                        boxSizing: 'border-box'
                      }}
                    />
                  );
                })}
              </Box>

              {/* Draw grid lines */}
              {[...Array(gridColumns)].map((_, index) => (
                <Box
                  key={`gridline-${index}`}
                  sx={{
                    position: 'absolute',
                    height: '100%',
                    width: '1px',
                    left: `${index * cellWidth}px`,
                    bgcolor: index % 4 === 0 ? 'grey.300' : 'grey.200',
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
                    bgcolor: 'primary.main',
                    borderRadius: '2px',
                    cursor: 'move',
                    opacity: draggedNote === note.id || resizingNote === note.id ? 0.75 : 1,
                    '&:hover .resize-handle': {
                      opacity: 1
                    },
                    zIndex: 2
                  }}
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
                      bgcolor: 'primary.dark',
                      opacity: 0,
                      transition: 'opacity 0.2s'
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
                      bgcolor: 'primary.dark',
                      opacity: 0,
                      transition: 'opacity 0.2s'
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

// DraggableModal component
const DraggableModal: React.FC<DraggableModalProps> = ({ children, title, onClose }) => {
  const [position, setPosition] = useState<Position>({ x: 100, y: 100 });
  const [size, setSize] = useState<Size>({ width: 800, height: 500 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        setPosition({ x: newX, y: newY });
      } else if (isResizing) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        setSize(prev => ({
          width: Math.max(400, prev.width + deltaX),
          height: Math.max(300, prev.height + deltaY)
        }));
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, isResizing, dragStart]);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if ((e.target as HTMLElement).closest('.close-button')) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY
    });
  };

  return (
    <Modal
      open={true}
      disableAutoFocus
      disableEscapeKeyDown
      onClose={() => {}}
      sx={{
        pointerEvents: 'none',  // Make the modal container non-blocking
        '& .MuiBackdrop-root': {
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          pointerEvents: 'none'
        }
      }}
      keepMounted
    >
      <Box
        ref={modalRef}
        sx={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          bgcolor: '#333333',
          boxShadow: 24,
          borderRadius: 1,
          display: 'flex',
          flexDirection: 'column',
          outline: 'none',
          overflow: 'hidden',
          pointerEvents: 'auto'  // Re-enable pointer events for the modal content
        }}
        onMouseDown={handleHeaderMouseDown}
      >
        <Box sx={{ 
          height: '8px',
          cursor: 'move',
          borderTopLeftRadius: 'inherit',
          borderTopRightRadius: 'inherit'
        }} />
        
        <Button 
          onClick={onClose} 
          className="close-button"
          sx={{
            position: 'absolute',
            right: 2,
            top: 8,
            minWidth: 'auto',
            width: 16,
            height: 16,
            p: 0,
            color: '#999999',
            zIndex: 10,
            fontSize: '14px',
            lineHeight: 1,
            '&:hover': {
              color: '#ffffff',
              bgcolor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
        >
          ×
        </Button>

        <Box sx={{ 
          flex: 1, 
          overflow: 'hidden',
          bgcolor: 'background.paper',
          borderBottomLeftRadius: 'inherit',
          borderBottomRightRadius: 'inherit'
        }}>
          {children}
        </Box>

        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 20,
            height: 20,
            cursor: 'se-resize',
            bgcolor: 'grey.300',
            clipPath: 'polygon(100% 0, 100% 100%, 0 100%)'
          }}
          onMouseDown={handleResizeMouseDown}
        />
      </Box>
    </Modal>
  );
};