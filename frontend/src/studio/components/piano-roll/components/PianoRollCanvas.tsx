import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Line, Group, Text } from 'react-konva';
import { Box } from '@mui/material';
import { Note } from '../../../core/types/note';
import { usePianoRoll } from '../context/PianoRollContext';

interface PianoRollCanvasProps {
  trackId: string;
  color: string;
}

const PianoRollCanvas: React.FC<PianoRollCanvasProps> = ({ trackId, color }) => {
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
  const [hoveredNote, setHoveredNote] = useState<number | null>(null);
  
  // Container refs and dimensions
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  
  // Grid configuration
  const octaves = 10;
  const notesPerOctave = 12;
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const totalNotes = octaves * notesPerOctave;
  
  const cellWidth = 24;
  const cellHeight = 20;
  const keyWidth = 64;
  const minGridColumns = 32;
  const [gridColumns, setGridColumns] = useState(minGridColumns);
  
  // Calculate content dimensions
  const gridWidth = gridColumns * cellWidth;
  const gridHeight = totalNotes * cellHeight;
  const contentWidth = keyWidth + gridWidth;
  
  // Local state for notes being manipulated (for performance)
  const [localNotes, setLocalNotes] = useState<Note[]>([]);
  // Removed visibleNotes state - using memoizedVisibleNotes directly
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  
  // Initialize local notes from context
  useEffect(() => {
    setLocalNotes(notes);
  }, [notes]);
  
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
  
  // Update dimensions when container resizes
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateDimensions = () => {
      if (!containerRef.current) return;
      
      const { clientWidth, clientHeight } = containerRef.current;
      setDimensions({
        width: clientWidth,
        height: clientHeight
      });
      
      // Calculate grid columns based on container width
      const visibleWidth = clientWidth - keyWidth;
      const idealColumns = Math.floor(visibleWidth / cellWidth);
      
      // Calculate how many columns would fit the visible area plus a small buffer (20%)
      const columnsWithBuffer = Math.ceil(idealColumns * 1.2);
      
      // If we're close to the grid's edge (within 20% of visible width), expand the grid
      // Or if the grid is significantly larger than needed, shrink it
      const threshold = visibleWidth * 0.2; // 20% buffer
      const currentGridWidthPx = gridColumns * cellWidth;
      
      if (Math.abs(currentGridWidthPx - visibleWidth) < threshold) {
        // We're close to the edge - expand slightly beyond visible area
        setGridColumns(Math.max(minGridColumns, columnsWithBuffer));
      }
    };
    
    updateDimensions();
    
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
  }, [gridColumns, cellWidth, minGridColumns, keyWidth]);
  
  // Calculate which notes are visible based on scroll position
  // Using useMemo directly to avoid the need for a separate state variable
  const memoizedVisibleNotes = useMemo(() => {
    const visibleStartColumn = Math.floor(scrollPosition.x / cellWidth);
    const visibleEndColumn = visibleStartColumn + Math.ceil(dimensions.width / cellWidth);
    const visibleStartRow = Math.floor(scrollPosition.y / cellHeight);
    const visibleEndRow = visibleStartRow + Math.ceil(dimensions.height / cellHeight);
    
    // Filter notes to only those visible in the viewport
    return localNotes.filter(note => {
      const displayRow = actualRowToDisplayRow(note.row);
      return (
        note.column + note.length >= visibleStartColumn &&
        note.column <= visibleEndColumn &&
        displayRow >= visibleStartRow &&
        displayRow <= visibleEndRow
      );
    });
  }, [localNotes, scrollPosition, dimensions, cellWidth, cellHeight, actualRowToDisplayRow]);
  
  // No need for calculateVisibleNotes function or separate effect
  // This way we avoid the circular dependency that was causing the infinite loop
  
  // Simple scroll handler based on the working implementation
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    
    // Update scroll position for rendering
    setScrollPosition({
      x: target.scrollLeft,
      y: target.scrollTop
    });
    
    // Don't expand grid if currently dragging
    if (isDragging) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = target;
    const scrollRatio = (scrollLeft + clientWidth) / scrollWidth;
    
    // Simple threshold-based expansion - if we're near the end (80% scrolled)
    // Using the exact same logic as in the working implementation
    const expandThreshold = 0.8;
    
    if (scrollRatio > expandThreshold) {
      // Add just 1 column at a time - this prevents crashes by not growing too quickly
      // The working implementation used this approach
      setGridColumns(prev => prev + 1);
    }
  }, [isDragging]);
  
  // Create a grid of clickable cells for precise note creation
  const handleGridCellClick = useCallback((e: any) => {
    // Early return if dragging
    if (isDragging) return;
    
    // The target is the grid cell itself, which knows its exact position
    const gridCell = e.target;
    const { column, row } = gridCell.attrs.gridPosition;
    
    // Convert to actual MIDI note row
    const actualRow = displayRowToActualRow(row);
    
    // Check if there's already a note at this position
    const noteExists = localNotes.some(note => 
      note.row === actualRow && note.column === column
    );
    
    if (!noteExists) {
      const newNote: Note = {
        id: Date.now(), // Use timestamp as unique ID
        row: actualRow,
        column,
        length: 1,
        velocity: 100,
        trackId
      };
      
      // Update local state immediately for responsiveness
      setLocalNotes(prev => [...prev, newNote]);
      
      // Create note through context (which will update history)
      createNote(trackId, newNote);
      
      // Play the note for auditory feedback
      playPreview(actualRow);
      setTimeout(() => stopPreview(actualRow), 300);
    }
  }, [isDragging, localNotes, createNote, trackId, displayRowToActualRow, playPreview, stopPreview]);
  
  // Handle start of note dragging
  const handleNoteDragStart = useCallback((e: any, noteId: number) => {
    e.evt.stopPropagation();
    const note = localNotes.find(n => n.id === noteId);
    if (!note) return;
    
    setIsDragging(true);
    setDraggedNote(noteId);
    setDragStartPosition({ row: note.row, column: note.column });
    
    // Calculate offset between click position and note's top-left corner
    // This ensures the note is dragged from the exact point where the user clicked
    const pointerPos = stageRef.current.getPointerPosition();
    
    // Calculate grid position of the click, including scroll position
    const noteX = keyWidth + (note.column * cellWidth) - scrollPosition.x;
    const noteY = actualRowToDisplayRow(note.row) * cellHeight - scrollPosition.y;
    
    setDragOffset({
      x: pointerPos.x - noteX, 
      y: pointerPos.y - noteY
    });
    
    // Play the note for auditory feedback
    playPreview(note.row);
  }, [localNotes, playPreview, keyWidth, cellWidth, cellHeight, actualRowToDisplayRow, scrollPosition]);
  
  // Handle start of note resizing
  const handleResizeStart = useCallback((e: any, noteId: number, side: 'left' | 'right') => {
    e.evt.stopPropagation();
    const note = localNotes.find(n => n.id === noteId);
    if (!note) return;
    
    setResizingNote(noteId);
    setResizeSide(side);
    setResizeStartLength(note.length);
    setResizeStartColumn(note.column);
    setIsDragging(true);
  }, [localNotes]);
  
  // Handle mouse movement for dragging or resizing
  const handleMouseMove = useCallback((e: any) => {
    if (!stageRef.current) return;
    
    const stage = stageRef.current;
    const pointerPos = stage.getPointerPosition();
    
    if (resizingNote !== null) {
      // Handle note resizing
      const note = localNotes.find(n => n.id === resizingNote);
      if (!note) return;
      
      // Get direct grid coordinates
      const viewportX = pointerPos.x - keyWidth;
      const gridX = viewportX + scrollPosition.x;
      const mouseGridPosition = Math.floor(gridX / cellWidth);
      
      if (resizeSide === 'right') {
        // Resize from right side (change length)
        const newLength = Math.max(1, mouseGridPosition - note.column + 1);
        const maxLength = gridColumns - note.column;
        const clampedLength = Math.min(newLength, maxLength);
        
        // Update local notes state for immediate visual feedback
        setLocalNotes(prev => prev.map(n => 
          n.id === resizingNote 
            ? { ...n, length: clampedLength }
            : n
        ));
      } else {
        // Resize from left side (change column and length)
        const originalEnd = note.column + note.length - 1;
        const newStart = Math.max(0, Math.min(mouseGridPosition, originalEnd));
        const newLength = originalEnd - newStart + 1;
        
        // Update local notes state for immediate visual feedback
        setLocalNotes(prev => prev.map(n => 
          n.id === resizingNote 
            ? { ...n, column: newStart, length: newLength }
            : n
        ));
      }
    } else if (draggedNote !== null) {
      // Handle note dragging with direct pointer position
      // Calculate the grid cell position where the mouse is pointing
      // We need to account for the key sidebar width and drag offset
      const mouseX = pointerPos.x - dragOffset.x;
      const mouseY = pointerPos.y - dragOffset.y;
      
      // Convert mouse position to grid coordinates
      // Subtract keyWidth to get position within the grid area
      const gridX = (mouseX - keyWidth) + scrollPosition.x;
      const gridY = mouseY + scrollPosition.y;
      
      // Calculate visible area to constrain dragging
      const visibleStartColumn = Math.floor(scrollPosition.x / cellWidth);
      const visibleColumns = Math.ceil(dimensions.width / cellWidth);
      const visibleEndColumn = visibleStartColumn + visibleColumns;
      
      // Clamp column to visible area plus a small buffer (2 bars)
      const extraBuffer = 32; // 2 bars of buffer
      const maxDragColumn = Math.min(visibleEndColumn + extraBuffer, gridColumns - 1);
      
      // Calculate target grid cell
      const column = Math.max(0, Math.min(Math.floor(gridX / cellWidth), maxDragColumn));
      const displayRow = Math.max(0, Math.min(Math.floor(gridY / cellHeight), totalNotes - 1));
      const actualRow = displayRowToActualRow(displayRow);
      
      // Update local notes state for immediate visual feedback
      const updatedNotes = localNotes.map(note => {
        if (note.id === draggedNote) {
          // Constrain to visible area to prevent excessive scrolling
          const maxColumn = Math.min(maxDragColumn - note.length, gridColumns - note.length);
          const clampedColumn = Math.min(column, maxColumn);
          
          // Only update if position changed
          if (note.row !== actualRow || note.column !== clampedColumn) {
            // Play the new note for auditory feedback if row changed
            if (note.row !== actualRow) {
              stopPreview(note.row);
              playPreview(actualRow);
            }
            
            return { ...note, row: actualRow, column: clampedColumn };
          }
        }
        return note;
      });
      
      setLocalNotes(updatedNotes);
    }
  }, [resizingNote, draggedNote, localNotes, gridColumns, scrollPosition, dragOffset, cellWidth, cellHeight, playPreview, stopPreview, displayRowToActualRow]);
  
  // Handle mouse up - finalize drag or resize operation
  const handleMouseUp = useCallback(async () => {
    if (draggedNote !== null && dragStartPosition) {
      // Finalize note drag
      const note = localNotes.find(n => n.id === draggedNote);
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
      const note = localNotes.find(n => n.id === resizingNote);
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
  }, [draggedNote, dragStartPosition, resizingNote, resizeStartLength, resizeStartColumn, resizeSide, localNotes, trackId, moveNote, resizeNote, stopPreview]);
  
  // Play note when clicking on a note
  const handleNoteClick = useCallback((e: any, noteId: number) => {
    e.evt.stopPropagation();
    const note = localNotes.find(n => n.id === noteId);
    if (!note) return;
    
    playPreview(note.row);
    setTimeout(() => stopPreview(note.row), 300); // Stop after 300ms
  }, [localNotes, playPreview, stopPreview]);
  
  // Render grid lines (visual only)
  const renderGridLines = useCallback(() => {
    const lines = [];
    
    // Horizontal grid lines (rows)
    for (let row = 0; row <= totalNotes; row++) {
      const actualIndex = displayRowToActualRow(row);
      const octave = Math.floor(actualIndex / 12);
      const noteInOctave = actualIndex % 12;
      const isC = noteInOctave === 0;
      
      lines.push(
        <Line
          key={`h-line-${row}`}
          points={[keyWidth, row * cellHeight, keyWidth + gridWidth, row * cellHeight]}
          stroke={isC ? 'rgba(100, 100, 100, 0.5)' : 'rgba(50, 50, 50, 0.5)'}
          strokeWidth={1}
          listening={false} // Not interactive
          perfectDrawEnabled={true}
        />
      );
    }
    
    // Vertical grid lines (columns)
    for (let col = 0; col <= gridColumns; col++) {
      lines.push(
        <Line
          key={`v-line-${col}`}
          points={[keyWidth + (col * cellWidth), 0, keyWidth + (col * cellWidth), gridHeight]}
          stroke={col % 4 === 0 ? 'rgba(100, 100, 100, 0.5)' : 'rgba(50, 50, 50, 0.5)'}
          strokeWidth={1}
          listening={false} // Not interactive
          perfectDrawEnabled={true}
        />
      );
    }
    
    return lines;
  }, [gridWidth, gridHeight, gridColumns, cellWidth, cellHeight, totalNotes, displayRowToActualRow, keyWidth]);
  
  // Render clickable grid cells (for precise note creation)
  const renderGridCells = useCallback(() => {
    const cells = [];
    
    // Calculate visible range for optimization
    const visibleStartRow = Math.floor(scrollPosition.y / cellHeight);
    const visibleEndRow = Math.min(totalNotes, visibleStartRow + Math.ceil(dimensions.height / cellHeight) + 1);
    
    const visibleStartCol = Math.floor(scrollPosition.x / cellWidth);
    const visibleEndCol = Math.min(gridColumns, visibleStartCol + Math.ceil(dimensions.width / cellWidth) + 1);
    
    // Create clickable cells only for visible area plus a small buffer
    for (let row = visibleStartRow; row < visibleEndRow; row++) {
      for (let col = visibleStartCol; col < visibleEndCol; col++) {
        cells.push(
          <Rect
            key={`cell-${row}-${col}`}
            x={col * cellWidth}
            y={row * cellHeight}
            width={cellWidth}
            height={cellHeight}
            fill="transparent"
            // Store grid position directly in the shape attrs for precise interaction
            gridPosition={{ row, column: col }}
            onClick={handleGridCellClick}
          />
        );
      }
    }
    
    return cells;
  }, [
    cellWidth, 
    cellHeight, 
    gridColumns, 
    totalNotes, 
    handleGridCellClick,
    scrollPosition,
    dimensions
  ]);
  
  // Render piano keys
  const renderPianoKeys = useCallback(() => {
    const keys = [];
    
    for (let row = 0; row < totalNotes; row++) {
      const actualIndex = displayRowToActualRow(row);
      const octave = Math.floor(actualIndex / 12);
      const noteInOctave = actualIndex % 12;
      const isBlack = isBlackKey(actualIndex);
      const isC = noteInOctave === 0;
      
      keys.push(
        <Group key={`key-${row}`}>
          <Rect
            x={0}
            y={row * cellHeight}
            width={keyWidth}
            height={cellHeight}
            fill={isBlack ? '#222' : '#333'}
            stroke="#444"
            strokeWidth={1}
            onClick={() => playPreview(actualIndex)}
            onMouseDown={() => playPreview(actualIndex)}
            onMouseUp={() => stopPreview(actualIndex)}
          />
          {isC && (
            <Text
              x={5}
              y={row * cellHeight + 5}
              text={`C${octave}`}
              fontSize={11}
              fill="#aaa"
            />
          )}
        </Group>
      );
    }
    
    return keys;
  }, [cellHeight, totalNotes, displayRowToActualRow, playPreview, stopPreview]);
  
  // Render notes - use memoized notes for better performance
  const renderNotes = useCallback(() => {
    // Use memoizedVisibleNotes directly to prevent re-renders during playback
    return memoizedVisibleNotes.map((note) => {
      const isBeingDragged = draggedNote === note.id;
      const isBeingResized = resizingNote === note.id;
      const isHovered = hoveredNote === note.id;
      const displayRow = actualRowToDisplayRow(note.row);
      
      return (
        <Group 
          key={`note-${note.id}`}
          x={note.column * cellWidth}
          y={displayRow * cellHeight}
          onClick={(e) => handleNoteClick(e, note.id)}
          onMouseDown={(e) => handleNoteDragStart(e, note.id)}
          onMouseEnter={() => {
            document.body.style.cursor = 'pointer';
            setHoveredNote(note.id);
          }}
          onMouseLeave={() => {
            document.body.style.cursor = 'default';
            setHoveredNote(null);
          }}
        >
          <Rect
            width={note.length * cellWidth - 1}
            height={cellHeight - 1}
            fill={color}
            cornerRadius={3}
            opacity={isBeingDragged || isBeingResized ? 0.75 : 1}
            shadowColor="rgba(0,0,0,0.5)"
            shadowBlur={isBeingDragged || isBeingResized || isHovered ? 5 : 0}
            shadowOffset={isHovered && !isBeingDragged && !isBeingResized ? { x: 0, y: 2 } : { x: 0, y: 0 }}
            perfectDrawEnabled={true}
          />
          
          {/* Left resize handle */}
          <Rect
            x={0}
            y={0}
            width={4}
            height={cellHeight - 1}
            fill="rgba(0,0,0,0.3)"
            onMouseDown={(e) => handleResizeStart(e, note.id, 'left')}
            onMouseOver={(e) => {
              document.body.style.cursor = 'ew-resize';
              e.target.opacity(1);
            }}
            onMouseOut={(e) => {
              document.body.style.cursor = 'default';
              e.target.opacity(0.5);
            }}
            opacity={0.5}
          />
          
          {/* Right resize handle */}
          <Rect
            x={note.length * cellWidth - 5}
            y={0}
            width={4}
            height={cellHeight - 1}
            fill="rgba(0,0,0,0.3)"
            onMouseDown={(e) => handleResizeStart(e, note.id, 'right')}
            onMouseOver={(e) => {
              document.body.style.cursor = 'ew-resize';
              e.target.opacity(1);
            }}
            onMouseOut={(e) => {
              document.body.style.cursor = 'default';
              e.target.opacity(0.5);
            }}
            opacity={0.5}
          />
        </Group>
      );
    });
  }, [memoizedVisibleNotes, cellWidth, cellHeight, draggedNote, resizingNote, hoveredNote, color, handleNoteClick, handleNoteDragStart, handleResizeStart, actualRowToDisplayRow]);

  return (
    <Box 
      ref={containerRef}
      sx={{ 
        display: 'flex', 
        height: '100%', 
        bgcolor: '#111',
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
      <Stage 
        ref={stageRef}
        width={contentWidth}
        height={gridHeight}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Background and Grid Layer - all non-interactive elements */}
        <Layer>
          {/* Grid area background */}
          <Rect
            x={keyWidth}
            y={0}
            width={gridWidth}
            height={gridHeight}
            fill="#181818"
            perfectDrawEnabled={true}
            listening={false}
          />
          
          {/* Piano keys background */}
          <Rect
            x={0}
            y={0}
            width={keyWidth}
            height={gridHeight}
            fill="#111"
            perfectDrawEnabled={true}
            listening={false}
          />
          
          {/* Row backgrounds for black keys */}
          {[...Array(totalNotes)].map((_, row) => {
            const actualIndex = displayRowToActualRow(row);
            const isBlack = isBlackKey(actualIndex);
            if (isBlack) {
              return (
                <Rect
                  key={`row-bg-${row}`}
                  x={keyWidth}
                  y={row * cellHeight}
                  width={gridWidth}
                  height={cellHeight}
                  fill="rgba(0, 0, 0, 0.2)"
                  perfectDrawEnabled={true}
                  listening={false}
                />
              );
            }
            return null;
          })}
          
          {/* Grid lines */}
          {renderGridLines()}
          
          {/* Divider between piano keys and grid */}
          <Line
            points={[keyWidth, 0, keyWidth, gridHeight]}
            stroke="rgba(100, 100, 100, 0.8)"
            strokeWidth={2}
            listening={false}
            perfectDrawEnabled={true}
          />
        </Layer>
        
        {/* New gridcell layer - for precise note creation */}
        <Layer>
          <Group x={keyWidth}>
            {renderGridCells()}
          </Group>
        </Layer>
        
        {/* Piano Keys Layer - interactive */}
        <Layer>
          {renderPianoKeys()}
        </Layer>
        
        {/* Notes Layer - interactive */}
        <Layer>
          <Group x={keyWidth}>
            {renderNotes()}
          </Group>
        </Layer>
      
      
      </Stage>
    </Box>
  );
};

export default PianoRollCanvas;