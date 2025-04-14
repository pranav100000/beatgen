import React, { useState, useRef, useEffect, ReactElement, useMemo } from "react";
import { Rnd } from "react-rnd";
import { Stage, Layer, Line, Rect } from "react-konva";
import Konva from "konva";
// Import Material UI components
import { Menu, MenuItem } from "@mui/material";
// Import PianoKeyboard component
import PianoKeyboard from "./PianoKeyboard";

// Define a constant grid size to use throughout the component
const GRID_SIZE = 48; // pixels
const TICKS_PER_BEAT = 960; // Standard MIDI ticks per beat (quarter note)
const TICKS_PER_STEP = TICKS_PER_BEAT / 4; // 4 steps per beat, 240 ticks per step
const PIXELS_PER_TICK = GRID_SIZE / TICKS_PER_STEP; // Pixels per tick at 1.0 zoom

// Define our note state interface (normalized values independent of zoom)
export interface NoteState {
  id: number;
  length: number;  // Length in ticks (1/960th of a beat)
  row: number;     // Row index (0-131 for our 132 keys)
  column: number;  // Column position in ticks (1/960th of a beat)
}

// Custom scrollbar styles
const customStyles = `
  /* Google Material Symbols */
  @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
  
  .material-symbols-outlined {
    font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
    font-size: 18px;
    vertical-align: middle;
    cursor: pointer;
    color: #fff;
    user-select: none;
  }
  
  /* Completely hide default scrollbar but keep functionality */
  .piano-scroll-container::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
  
  /* Firefox scrollbar hiding */
  .piano-scroll-container {
    scrollbar-width: none;
  }
  
  /* Piano key styling */
  .piano-key {
    height: 24px;
    border-bottom: 1px solid #333;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 8px;
    font-size: 11px;
    color: #aaa;
  }

  .piano-key-white {
    background: #333333;
  }

  .piano-key-black {
    background: #252525;
  }
  
  /* Make sure scrollbar doesn't interfere with RND */
  .scrollbar-track {
    pointer-events: auto !important;
  }
  
  /* Hide default vertical scrollbar */
  .vertical-scroll-container::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
  
  .vertical-scroll-container {
    scrollbar-width: none;
  }
`;

// Define interfaces for our components
interface GridLayerProps {
  width: number;
  height: number;
  gridSize: number;
  measureSize: number;
  scrollX: number;
  scrollY: number;
  snapOption: number; // Add the snap option
  keyHeight: number; // Add keyHeight for vertical alignment
  totalKeys: number; // Add total keys for black key rows
  scaleNotes?: number[]; // Add scale notes array
}

interface Note {
  id: number;
  start: number;
  top: number;
  width: number;
  color: string;
}

interface NotesLayerProps {
  notes: Note[];
  scrollX: number;
  scrollY: number;
  onNoteClick?: (id: number) => void;
  onNoteDragStart?: (id: number, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onNoteDragMove?: (id: number, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onNoteDragEnd?: (id: number) => void;
  onNoteResizeStart?: (id: number, direction: 'left' | 'right', e: Konva.KonvaEventObject<MouseEvent>) => void;
  draggedNoteId?: number | null;
  resizingNoteId?: number | null;
  selectedNoteIds?: number[];
  keyHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  gridSize: number;
  snapEnabled: boolean;
  zoomLevel: number;
  selectedTool: 'select' | 'pen' | 'highlighter' | 'eraser';
}

interface PlayheadLayerProps {
  position: number;
  height: number;
  scrollX: number;
}

interface PianoRollProps {
  initialWidth?: number;
  initialHeight?: number;
  initialX?: number;
  initialY?: number;
  contentWidth?: number;
  keyboardWidth?: number;
  onNotesChange?: (notes: NoteState[]) => void; // Add callback for note changes
  initialNotes?: NoteState[]; // Add initial notes prop
  scaleNotes?: number[]; // Add scale notes prop (0-11 representing notes in the scale)
  title?: string; // Add title prop
  onClose?: () => void; // Add callback for close button
}

// Add this utility function at the top of your file, near the other helper functions
const simulateScroll = (element: HTMLElement, deltaX: number, deltaY: number) => {
  if (element) {
    // Apply scrolling
    element.scrollLeft += deltaX;
    element.scrollTop += deltaY;
  }
};

// Define theme colors - purely cosmetic
const DARK_THEME = {
  background: "#252525",
  headerBackground: "#222222",
  headerText: "#ffffff",
  border: "#444444",
  gridBackground: "#2a2a2a",
  whiteKeyStripe: "#303030",
  blackKeyStripe: "#252525",
  gridLine: "#333333",
  beatLine: "#444444",
  barLine: "#555555",
  playhead: "#ff5252",
  noteColor: "#3a7bd5",
  notePreviewFill: "rgba(58, 123, 213, 0.3)",
  notePreviewStroke: "rgba(58, 123, 213, 0.7)"
};

// Grid component using Konva for optimized rendering
const GridLayer: React.FC<GridLayerProps> = ({
  width,
  height,
  gridSize,
  measureSize,
  scrollX,
  scrollY,
  snapOption,
  keyHeight,
  totalKeys,
  scaleNotes,
}) => {
  // Calculate visible area based on scroll position
  const visibleStartX = Math.floor(scrollX / gridSize) * gridSize;
  const visibleEndX = visibleStartX + width + gridSize;

  // For vertical lines, use keyHeight instead of gridSize
  const visibleStartY = Math.floor(scrollY / keyHeight) * keyHeight;
  const visibleEndY = visibleStartY + height + keyHeight;

  // Establish sizes for grid calculations
  const beatSize = 4 * gridSize;      // 4 steps = 1 beat
  const barSize = 4 * beatSize;       // 4 beats = 1 measure/bar
  
  // Helper function to check if a row is a black key
  const isBlackKey = (rowIndex: number): boolean => {
    // Convert from visual row index to note index (reversed)
    const noteIndex = totalKeys - 1 - rowIndex;
    // Check if this is a black key (using the same logic as in PianoKeyboard)
    const noteModulo = noteIndex % 12;
    return [1, 3, 6, 8, 10].includes(noteModulo);
  };
  
  // Helper function to check if a note is in the scale
  const isInScale = (rowIndex: number): boolean => {
    if (!scaleNotes || scaleNotes.length === 0) return true; // If no scale provided, all notes are "in scale"
    
    // Convert from visual row index to note index (reversed)
    const noteIndex = totalKeys - 1 - rowIndex;
    // Get the note number within the octave (0-11, where 0 is C)
    const noteModulo = noteIndex % 12;
    
    // Check if this note number is in the scale
    return scaleNotes.includes(noteModulo);
  };
  
  // Memoize the row backgrounds
  const { blackKeyBackgrounds, outOfKeyBackgrounds } = React.useMemo(() => {
    const blackBgs: ReactElement[] = [];
    const outOfKeyBgs: ReactElement[] = [];
    
    // Draw row backgrounds for visible rows
    for (let y = visibleStartY; y <= visibleEndY; y += keyHeight) {
      // Calculate the row index for this y position
      const rowIndex = Math.floor(y / keyHeight);
      
      // Check if this row should be specially colored
      if (!isInScale(rowIndex)) {
        // This note is not in the scale, make it very dark
        outOfKeyBgs.push(
          <Rect
            key={`row-bg-scale-${rowIndex}`}
            x={0}
            y={y - scrollY}
            width={width}
            height={keyHeight}
            fill="#111111" // Very dark, almost black
            listening={false}
            opacity={0.8}
          />
        );
      } else if (isBlackKey(rowIndex)) {
        // This is a black key row that is in scale, make it darker as before
        blackBgs.push(
          <Rect
            key={`row-bg-${rowIndex}`}
            x={0}
            y={y - scrollY}
            width={width}
            height={keyHeight}
            fill="#242424" // Between #1e1e1e and #2a2a2a
            listening={false}
          />
        );
      }
    }
    
    return { blackKeyBackgrounds: blackBgs, outOfKeyBackgrounds: outOfKeyBgs };
  }, [visibleStartY, visibleEndY, keyHeight, width, scrollY, totalKeys, scaleNotes]);
  
  // Memoize the bar lines (thickest)
  const barLines = React.useMemo(() => {
    const lines: ReactElement[] = [];
    // Draw bar lines at every barSize interval
    for (let x = Math.floor(visibleStartX / barSize) * barSize; x <= visibleEndX; x += barSize) {
      const adjustedX = x - scrollX;
      if (adjustedX >= -1 && adjustedX <= width) {
        lines.push(
          <Line
            key={`bar-${x}`}
            points={[adjustedX, 0, adjustedX, height]}
            stroke={DARK_THEME.barLine}
            strokeWidth={2}
          />
        );
      }
    }
    return lines;
  }, [visibleStartX, visibleEndX, barSize, scrollX, width, height]);
  
  // Memoize the beat lines
  const beatLines = React.useMemo(() => {
    const lines: ReactElement[] = [];
    // Draw beat lines at every beatSize interval, skipping where bar lines exist
    for (let x = Math.floor(visibleStartX / beatSize) * beatSize; x <= visibleEndX; x += beatSize) {
      // Skip if this is a bar line
      if (x % barSize === 0) continue;
      
      const adjustedX = x - scrollX;
      if (adjustedX >= -1 && adjustedX <= width) {
        lines.push(
          <Line
            key={`beat-${x}`}
            points={[adjustedX, 0, adjustedX, height]}
            stroke={DARK_THEME.beatLine}
            strokeWidth={1.5}
          />
        );
      }
    }
    return lines;
  }, [visibleStartX, visibleEndX, beatSize, barSize, scrollX, width, height]);
  
  // Memoize the step lines and step division lines
  const { stepLines, stepDivisionLines } = React.useMemo(() => {
    const steps: ReactElement[] = [];
    const stepDivs: ReactElement[] = [];
    
    // 3. STEP LINES or BEAT DIVISION LINES
    if (snapOption >= 6 && snapOption <= 9) {
      // BEAT DIVISION CASE: Replace step lines with beat division lines
      let divisor;
      switch(snapOption) {
        case 6: divisor = 6; break; // 1/6 beat
        case 7: divisor = 4; break; // 1/4 beat
        case 8: divisor = 3; break; // 1/3 beat
        case 9: divisor = 2; break; // 1/2 beat
        default: divisor = 1;
      }
      
      const beatDivision = beatSize / divisor;
      const startX = Math.floor(visibleStartX / beatDivision) * beatDivision;
      
      for (let x = startX; x <= visibleEndX; x += beatDivision) {
        // Skip if this is a beat or bar line
        if (x % beatSize === 0) continue;
        
        const adjustedX = x - scrollX;
        if (adjustedX >= -1 && adjustedX <= width) {
          steps.push(
            <Line
              key={`beat-div-${x}`}
              points={[adjustedX, 0, adjustedX, height]}
              stroke={DARK_THEME.gridLine}
              strokeWidth={1}
            />
          );
        }
      }
    } else if (snapOption !== 0) {
      // DEFAULT CASE: Draw normal step lines (4 per beat)
      // Skip this for "None" option
      for (let x = visibleStartX; x <= visibleEndX; x += gridSize) {
        // Skip if this is a beat or bar line
        if (x % beatSize === 0) continue;
        
        const adjustedX = x - scrollX;
        steps.push(
          <Line
            key={`step-${x}`}
            points={[adjustedX, 0, adjustedX, height]}
            stroke={DARK_THEME.gridLine}
            strokeWidth={1}
          />
        );
      }
    }
    
    // 4. STEP DIVISION LINES (thinnest)
    // These appear only for options 1-4 (step divisions)
    if (snapOption >= 1 && snapOption <= 4) {
      let divisor;
      switch(snapOption) {
        case 1: divisor = 6; break; // 1/6 step
        case 2: divisor = 4; break; // 1/4 step
        case 3: divisor = 3; break; // 1/3 step
        case 4: divisor = 2; break; // 1/2 step
        default: divisor = 1;
      }
      
      const stepDivision = gridSize / divisor;
      
      for (let x = visibleStartX; x <= visibleEndX; x += stepDivision) {
        // Skip if this is a step, beat, or bar line
        if (x % gridSize === 0) continue;
        
        const adjustedX = x - scrollX;
        stepDivs.push(
          <Line
            key={`step-div-${x}`}
            points={[adjustedX, 0, adjustedX, height]}
            stroke={DARK_THEME.gridLine}
            strokeWidth={1}
            opacity={0.5}
            dash={[2, 2]} // Dashed line
          />
        );
      }
    }
    
    return { stepLines: steps, stepDivisionLines: stepDivs };
  }, [visibleStartX, visibleEndX, snapOption, beatSize, gridSize, scrollX, width, height]);
  
  // Memoize the horizontal grid lines
  const horizontalLines = React.useMemo(() => {
    const lines: ReactElement[] = [];
    for (let y = visibleStartY; y <= visibleEndY; y += keyHeight) {
      const adjustedY = y - scrollY;
      lines.push(
        <Line
          key={`hline-${y}`}
          points={[0, adjustedY, width, adjustedY]}
          stroke={DARK_THEME.gridLine}
          strokeWidth={1}
        />
      );
    }
    return lines;
  }, [visibleStartY, visibleEndY, keyHeight, scrollY, width]);

  return (
    <Layer>
      {/* Render black key backgrounds first (below grid lines) */}
      {blackKeyBackgrounds}
      
      {/* Render grid lines */}
      {horizontalLines}
      {stepDivisionLines}
      {stepLines}
      {beatLines}
      {barLines}
      
      {/* Render out-of-key backgrounds last (above grid lines) */}
      {outOfKeyBackgrounds}
    </Layer>
  );
};

// Notes layer with drag capability
const NoteWithDrag: React.FC<{
  note: Note,
  scrollX: number,
  scrollY: number,
  keyHeight: number,
  onDragStart: (id: number, e: Konva.KonvaEventObject<MouseEvent>) => void,
  onDragMove: (id: number, e: Konva.KonvaEventObject<MouseEvent>) => void,
  onDragEnd: (id: number) => void,
  onClick: (id: number) => void,
  onResizeStart: (id: number, direction: 'left' | 'right', e: Konva.KonvaEventObject<MouseEvent>) => void,
  isDragged: boolean,
  isResizing: boolean,
  isSelected: boolean,
  gridSize: number,
  snapEnabled: boolean,
  zoomLevel: number,
  selectedTool: 'select' | 'pen' | 'highlighter' | 'eraser',
  isGhost?: boolean,
  draggedNoteId: number | null | undefined,
  dragOffset?: {x: number, y: number} | null
}> = ({ 
  note, 
  scrollX, 
  scrollY, 
  keyHeight, 
  onDragStart, 
  onDragMove, 
  onDragEnd, 
  onClick,
  onResizeStart,
  isDragged,
  isResizing,
  isSelected,
  gridSize,
  snapEnabled,
  zoomLevel,
  selectedTool,
  isGhost = false,
  draggedNoteId = null,
  dragOffset = null
}) => {
  // Reference to the Konva rectangle
  const rectRef = useRef<Konva.Rect>(null);
  
  // Store the mouse offset from the note's top-left corner
  const mouseOffsetRef = useRef({ x: 0, y: 0 });
  
  // State for tracking edge hover
  const [hoveredEdge, setHoveredEdge] = useState<'left' | 'right' | null>(null);
  
  // Edge detection threshold
  const EDGE_THRESHOLD = 10; // pixels
  
  // Check if mouse is near an edge
  const checkEdgeHover = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // If eraser tool is selected, don't show edge hover effects
    if (selectedTool === 'eraser' || isGhost) {
      setHoveredEdge(null);
      return;
    }
    
    const stage = e.target.getStage();
    if (!stage) return;
    
    const mousePos = stage.getPointerPosition();
    if (!mousePos) return;
    
    const noteX = note.start - scrollX;
    const noteRight = noteX + note.width;
    
    // Check if near left edge
    if (Math.abs(mousePos.x - noteX) < EDGE_THRESHOLD) {
      setHoveredEdge('left');
      stage.container().style.cursor = 'ew-resize';
      return;
    }
    
    // Check if near right edge
    if (Math.abs(mousePos.x - noteRight) < EDGE_THRESHOLD) {
      setHoveredEdge('right');
      stage.container().style.cursor = 'ew-resize';
      return;
    }
    
    // Not near any edge
    setHoveredEdge(null);
    // Only set cursor to move if not using eraser
    stage.container().style.cursor = 'move';
  };
  
  // Determine the fill color based on selection state
  const getFillColor = () => {
    if (isSelected) {
      return "#5a97f5"; // Lighter blue for selected notes
    }
    return note.color;
  };

  // Calculate the visual position for the note
  const calcPosition = () => {
    // If this is a ghost note, return base position
    if (isGhost) {
      return {
        x: note.start - scrollX + 1,
        y: note.top - scrollY + 1
      };
    }
    
    // If the note is selected and another note is being dragged
    if (isSelected && draggedNoteId !== null && draggedNoteId !== note.id && dragOffset) {
      // Apply the same drag offset to this note for real-time updates
      return {
        x: note.start - scrollX + dragOffset.x + 1,
        y: note.top - scrollY + dragOffset.y + 1
      };
    }
    
    // Default position
    return {
      x: note.start - scrollX + 1,
      y: note.top - scrollY + 1
    };
  };
  
  // Get the calculated position
  const position = calcPosition();
  
  // Set opacity based on state
  const opacity = isGhost ? 0.6 : (isDragged || isResizing) ? 0.7 : 1;
  
  return (
    <Rect
      ref={rectRef}
      key={`note-${note.id}${isGhost ? '-ghost' : ''}`}
      x={position.x}
      y={position.y}
      width={note.width - 2}
      height={keyHeight - 2} // Leave a small gap between rows
      fill={getFillColor()}
      cornerRadius={3}
      opacity={opacity}
      stroke={(isDragged || isResizing || isSelected) ? "#fff" : undefined}
      strokeWidth={(isDragged || isResizing) ? 1 : (isSelected ? 1 : 0)}
      draggable={!isGhost && selectedTool !== 'eraser' && hoveredEdge === null} // Ghost notes aren't draggable
      listening={!isGhost} // Ghost notes shouldn't listen for events
      onDragStart={(e) => {
        if (hoveredEdge !== null || selectedTool === 'eraser') return; // Don't start drag if on resize edge or using eraser
        
        e.cancelBubble = true; // Prevent event bubbling
        
        // Get stage and mouse position
        const stage = e.target.getStage();
        if (!stage) return;
        
        const mousePos = stage.getPointerPosition();
        if (!mousePos) return;
        
        // Calculate the offset between mouse position and note's top-left corner on screen
        // This records exactly where on the note the user clicked
        const noteScreenX = note.start - scrollX;
        const noteScreenY = note.top - scrollY;
        
        mouseOffsetRef.current = {
          x: mousePos.x - noteScreenX,
          y: mousePos.y - noteScreenY
        };
        
        onDragStart(note.id, e);
      }}
      onDragMove={(e) => {
        e.cancelBubble = true; // Prevent event bubbling
        
        // Get stage and mouse position
        const stage = e.target.getStage();
        if (!stage) return;
        
        const mousePos = stage.getPointerPosition();
        if (!mousePos) return;
        
        if (snapEnabled) {
          // For grid snapping, calculate where the note's top-left corner should be
          // based on mouse position and offset
          const noteX = mousePos.x - mouseOffsetRef.current.x + scrollX;
          
          // Snap the note to the grid, not the mouse position
          const snappedNoteX = Math.floor(noteX / gridSize) * gridSize;
          
          // For vertical position, snap to key row under the mouse
          const mouseY = mousePos.y + scrollY;
          const snappedNoteY = Math.floor(mouseY / keyHeight) * keyHeight;
          
          // Update visual position
          const node = e.target;
          node.x(snappedNoteX - scrollX);
          node.y(snappedNoteY - scrollY);
          
          // Pass the event to the parent handler with the position
          onDragMove(note.id, e);
        } else {
          // Regular dragging - using tick-based precision
          // Calculate where the note's top-left corner should be based on mouse position and offset
          const noteX = mousePos.x - mouseOffsetRef.current.x + scrollX;
          const noteY = mousePos.y - mouseOffsetRef.current.y + scrollY;
          
          // Snap to tick grid even when grid snap is disabled
          const pixelsPerTickScaled = PIXELS_PER_TICK * zoomLevel;
          const snappedNoteX = Math.floor(noteX / pixelsPerTickScaled) * pixelsPerTickScaled;
          
          // Still snap vertically to key rows
          const snappedY = Math.floor(noteY / keyHeight) * keyHeight;
          
          // Update visual position
          const node = e.target;
          node.x(snappedNoteX - scrollX);
          node.y(snappedY - scrollY);
          
          // Pass the event to the parent handler with the position
          onDragMove(note.id, e);
        }
      }}
      onDragEnd={() => {
        onDragEnd(note.id);
      }}
      onClick={(e) => {
        if (isGhost) return; // Ghost notes don't respond to clicks
        
        e.cancelBubble = true; // Prevent event bubbling
        
        // For debugging
        console.log(`Note clicked: ${note.id} with tool: ${selectedTool} (isResizing: ${isResizing})`);
        
        // Don't trigger clicks during or right after resizing
        if (isResizing) {
          console.log("Ignoring click during resize");
          return;
        }
        
        if (selectedTool === 'eraser') {
          // If eraser tool is active, delete the note
          console.log(`Erasing note: ${note.id}`);
          onClick(note.id);
          return;
        }
        
        // Don't trigger click if resizing
        if (hoveredEdge !== null) {
          onResizeStart(note.id, hoveredEdge, e);
          return;
        }
        
        onClick(note.id);
      }}
      onMouseDown={(e) => {
        if (isGhost) return; // Ghost notes don't respond to mouse events
        
        e.cancelBubble = true; // Prevent event bubbling to background
        
        // For eraser tool, trigger onClick immediately on mousedown
        if (selectedTool === 'eraser') {
          console.log(`Erasing note on mousedown: ${note.id}`);
          onClick(note.id);
          return;
        }
        
        // Handle resize start if on edge
        if (hoveredEdge !== null) {
          onResizeStart(note.id, hoveredEdge, e);
          return;
        }
      }}
      onMouseMove={(e) => {
        if (isGhost) return; // Ghost notes don't respond to mouse events
        
        // If using eraser tool with mouse button pressed, delete the note
        if (selectedTool === 'eraser' && e.evt.buttons === 1) {
          console.log(`Erasing note on mousemove: ${note.id}`);
          onClick(note.id);
          return;
        }
        
        checkEdgeHover(e);
      }}
      onMouseEnter={(e) => {
        if (isGhost) return; // Ghost notes don't respond to mouse events
        
        // If using eraser tool with mouse button pressed, delete the note
        if (selectedTool === 'eraser') {
          if (e.evt.buttons === 1) {
            console.log(`Erasing note on mouseenter: ${note.id}`);
            onClick(note.id);
          }
          
          const stage = e.target.getStage();
          if (stage) stage.container().style.cursor = 'default';
          return;
        }
        
        checkEdgeHover(e);
      }}
      onMouseLeave={(e) => {
        if (isGhost) return; // Ghost notes don't respond to mouse events
        
        setHoveredEdge(null);
        const stage = e.target.getStage();
        if (stage) {
          // If using eraser, keep default cursor
          if (selectedTool === 'eraser') {
            stage.container().style.cursor = 'default';
          } else {
            stage.container().style.cursor = 'default';
          }
        }
      }}
    />
  );
};

// Updated NotesLayer component with drag support and memo optimization
const NotesLayer = React.memo<NotesLayerProps>(
  ({
    notes,
    scrollX,
    scrollY,
    onNoteClick,
    onNoteDragStart,
    onNoteDragMove,
    onNoteDragEnd,
    onNoteResizeStart,
    draggedNoteId,
    resizingNoteId,
    selectedNoteIds = [], // Default to empty array
    keyHeight,
    viewportWidth,
    viewportHeight,
    gridSize,
    snapEnabled,
    zoomLevel,
    selectedTool
  }) => {
    // Memoize visible notes calculation
    const visibleNotes = React.useMemo(() => {
      // Only render notes that are visible in the current viewport (virtualization)
      return notes.filter((note) => {
        // Check if note is in horizontal viewport
        const noteRight = note.start + note.width;
        const noteLeft = note.start;
        const viewportLeft = scrollX;
        const viewportRight = scrollX + viewportWidth;

        // Check if note is in vertical viewport
        const noteBottom = note.top + keyHeight;
        const noteTop = note.top;
        const viewportTop = scrollY;
        const viewportBottom = scrollY + viewportHeight;

        // Note is visible if any part of it is in the viewport
        return (
          noteRight >= viewportLeft &&
          noteLeft <= viewportRight &&
          noteBottom >= viewportTop &&
          noteTop <= viewportBottom
        );
      });
    }, [notes, scrollX, scrollY, viewportWidth, viewportHeight, keyHeight]);

    // Track drag info for real-time updates
    const [dragOrigin, setDragOrigin] = useState<{noteId: number, startX: number, startY: number} | null>(null);
    const [dragOffset, setDragOffset] = useState<{x: number, y: number}>({x: 0, y: 0});
    
    // When a note drag starts, store its original position as the reference point
    useEffect(() => {
      if (draggedNoteId) {
        const draggedNote = notes.find(n => n.id === draggedNoteId);
        if (draggedNote) {
          setDragOrigin({
            noteId: draggedNoteId,
            startX: draggedNote.start,
            startY: draggedNote.top
          });
          setDragOffset({x: 0, y: 0});
        }
      } else {
        // Clear when drag ends
        setDragOrigin(null);
        setDragOffset({x: 0, y: 0});
      }
    }, [draggedNoteId, notes]);

    // Generate ghost notes for selected notes (excluding the dragged one) if needed
    // With our optimized approach, we may not need ghost notes anymore, but keeping them with reduced opacity
    const ghostNotes = useMemo(() => {
      if (!dragOrigin || !dragOffset) return [];
      
      // Only show ghosts when dragging a selected note
      if (!selectedNoteIds.includes(dragOrigin.noteId)) return [];
      
      // Create ghost versions of all other selected notes for improved visual feedback
      return visibleNotes
        .filter(note => 
          selectedNoteIds.includes(note.id) && 
          note.id !== dragOrigin.noteId
        )
        .map(note => ({
          ...note,
          // Apply the same offset that the dragged note has moved
          start: note.start + dragOffset.x,
          top: note.top + dragOffset.y
        }));
    }, [dragOrigin, dragOffset, selectedNoteIds, visibleNotes]);

    // Custom handler to update notes during drag with improved performance
    const handleNoteDragWithGhosts = (id: number, e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!dragOrigin || dragOrigin.noteId !== id) return;
      
      // Get the dragged node's current position
      const node = e.target;
      if (!node) return;
      
      // Get the current position from the visual element
      // Cast to number because we know these methods return numbers for Konva.Rect
      const currentX = (node.x() as number) + scrollX - 1; // Adjust for the +1 in NoteWithDrag
      const currentY = (node.y() as number) + scrollY - 1; // Adjust for the +1 in NoteWithDrag
      
      // Calculate the offset from the original position
      const newOffset = {
        x: currentX - dragOrigin.startX,
        y: currentY - dragOrigin.startY
      };
      
      // Update the offset which will update all selected notes in real-time
      setDragOffset(newOffset);
      
      // Call the original handler
      if (onNoteDragMove) {
        onNoteDragMove(id, e);
      }
    };

    return (
      <Layer>
        {/* Render the regular notes including the ones being dragged */}
        {visibleNotes.map((note) => (
          <NoteWithDrag
            key={`note-${note.id}`}
            note={note}
            scrollX={scrollX}
            scrollY={scrollY}
            keyHeight={keyHeight}
            onDragStart={onNoteDragStart || (() => {})}
            onDragMove={handleNoteDragWithGhosts}
            onDragEnd={onNoteDragEnd || (() => {})}
            onClick={onNoteClick || (() => {})}
            onResizeStart={onNoteResizeStart || (() => {})}
            isDragged={draggedNoteId === note.id}
            isResizing={resizingNoteId === note.id}
            isSelected={selectedNoteIds.includes(note.id)}
            gridSize={gridSize} // Pass the current grid size
            snapEnabled={snapEnabled}
            zoomLevel={zoomLevel}
            selectedTool={selectedTool}
            draggedNoteId={draggedNoteId}
            dragOffset={dragOffset}
          />
        ))}
        
        {/* Optional: Render ghost notes with very low opacity for better visual feedback */}
        {ghostNotes.map((ghost) => (
          <NoteWithDrag
            key={`ghost-${ghost.id}`}
            note={ghost}
            scrollX={scrollX}
            scrollY={scrollY}
            keyHeight={keyHeight}
            onDragStart={() => {}}
            onDragMove={() => {}}
            onDragEnd={() => {}}
            onClick={() => {}}
            onResizeStart={() => {}}
            isDragged={true}
            isResizing={false}
            isSelected={true}
            gridSize={gridSize}
            snapEnabled={snapEnabled}
            zoomLevel={zoomLevel}
            selectedTool={selectedTool}
            isGhost={true}
            draggedNoteId={draggedNoteId}
            dragOffset={null}
          />
        ))}
      </Layer>
    );
  },
  (prevProps, nextProps) => {
    // Deep comparison of arrays would be expensive
    // Only re-render if scroll changed or notes array reference changed
    return (
      prevProps.scrollX === nextProps.scrollX &&
      prevProps.scrollY === nextProps.scrollY &&
      prevProps.notes === nextProps.notes &&
      prevProps.keyHeight === nextProps.keyHeight &&
      prevProps.draggedNoteId === nextProps.draggedNoteId &&
      prevProps.resizingNoteId === nextProps.resizingNoteId &&
      prevProps.gridSize === nextProps.gridSize &&
      prevProps.snapEnabled === nextProps.snapEnabled &&
      prevProps.zoomLevel === nextProps.zoomLevel &&
      prevProps.selectedTool === nextProps.selectedTool && // Add this comparison
      JSON.stringify(prevProps.selectedNoteIds) === JSON.stringify(nextProps.selectedNoteIds) // Compare selected notes
    );
  }
);

// Playhead component
const PlayheadLayer: React.FC<PlayheadLayerProps> = ({ position, height, scrollX }) => {
  return (
    <Layer>
      <Line
        points={[position - scrollX, 0, position - scrollX, height]}
        stroke={DARK_THEME.playhead}
        strokeWidth={2}
      />
    </Layer>
  );
};

// Note Preview component to show shadow of where a note would be placed
interface NotePreviewProps {
  position: { x: number, y: number } | null;
  scrollX: number;
  scrollY: number;
  keyHeight: number;
  noteWidth: number;
}

const NotePreview: React.FC<NotePreviewProps> = ({ 
  position, 
  scrollX, 
  scrollY, 
  keyHeight,
  noteWidth
}) => {
  if (!position) return null;
  
  return (
    <Layer listening={false}>
      <Rect
        x={position.x - scrollX + 1}
        y={position.y - scrollY + 1}
        width={noteWidth - 2}
        height={keyHeight - 2} // Leave a small gap between rows
        fill={DARK_THEME.notePreviewFill}
        stroke={DARK_THEME.notePreviewStroke}
        strokeWidth={1}
        cornerRadius={3}
        dash={[5, 2]} // Dashed outline for preview
        listening={false} // This disables event handling on this shape
        perfectDrawEnabled={false} // Performance optimization
        shadowForStrokeEnabled={false} // Performance optimization
      />
    </Layer>
  );
};

// Selection Rectangle component
const SelectionRectangle: React.FC<{
  rect: {startX: number, startY: number, width: number, height: number} | null;
  scrollX: number;
  scrollY: number;
}> = ({ rect, scrollX, scrollY }) => {
  if (!rect) return null;
  
  // Ensure width and height are positive, but keep track of direction
  const x = rect.width < 0 ? rect.startX + rect.width : rect.startX;
  const y = rect.height < 0 ? rect.startY + rect.height : rect.startY;
  const width = Math.abs(rect.width);
  const height = Math.abs(rect.height);
  
  return (
    <Layer>
      <Rect
        x={x - scrollX}
        y={y - scrollY}
        width={width}
        height={height}
        fill="rgba(58, 123, 213, 0.2)"
        stroke="rgba(58, 123, 213, 0.7)"
        strokeWidth={1}
        dash={[4, 2]}
        listening={false}
      />
    </Layer>
  );
};

const PianoRoll: React.FC<PianoRollProps> = ({
  initialWidth = 600,
  initialHeight = 400,
  initialX = 100,
  initialY = 100,
  contentWidth: initialContentWidth = 100000, // Much wider than viewport
  keyboardWidth = 80,
  onNotesChange,
  initialNotes = [], // Default to empty array
  scaleNotes = [], // Default to empty array (all notes in scale)
  title = "Piano Roll (132 Keys)", // Default title
  onClose
}) => {
  // Add mouseOffsetRef at the top of the component
  const mouseOffsetRef = useRef({ x: 0, y: 0 });
  
  // State for viewport dimensions and position
  const [dimensions, setDimensions] = useState({
    width: initialWidth,
    height: initialHeight,
    x: initialX,
    y: initialY,
  });

  // Grid snap settings
  const [gridSnapEnabled, setGridSnapEnabled] = useState(true);
  const [gridSnapSize, setGridSnapSize] = useState(5); // Default to "Step"
  const [gridSnapAnchorEl, setGridSnapAnchorEl] = useState<null | HTMLElement>(null);
  const gridSnapMenuOpen = Boolean(gridSnapAnchorEl);
  
  // Zoom control
  const [zoomLevel, setZoomLevel] = useState(1.0); // Default zoom level
  const [prevZoomLevel, setPrevZoomLevel] = useState(1.0); // Previous zoom level for calculations
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 4.0;
  const ZOOM_STEP = 0.25; // Increment/decrement by 25%
  
  // Tool selection state
  const [selectedTool, setSelectedTool] = useState<'select' | 'pen' | 'highlighter' | 'eraser'>('pen'); // Default to pen
  
  // Selection rectangle state
  const [selectionRect, setSelectionRect] = useState<{startX: number, startY: number, width: number, height: number} | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<number[]>([]);
  
  // Handle tool selection with note deselection
  const handleToolSelect = (tool: 'select' | 'pen' | 'highlighter' | 'eraser') => {
    // If switching away from select tool, clear the selection
    if (selectedTool === 'select' && tool !== 'select') {
      setSelectedNoteIds([]);
    }
    setSelectedTool(tool);
  };
  
  // Handle zoom in
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  };
  
  // Handle zoom out
  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  };
  
  // Calculate effective grid size based on zoom level
  const effectiveGridSize = GRID_SIZE * zoomLevel;
  
  // Get snap option display name
  const getSnapOptionName = (option: number): string => {
    switch(option) {
      case 0: return "None";
      case 1: return "1/6 step";
      case 2: return "1/4 step";
      case 3: return "1/3 step";
      case 4: return "1/2 step";
      case 5: return "Step";
      case 6: return "1/6 beat";
      case 7: return "1/4 beat";
      case 8: return "1/3 beat";
      case 9: return "1/2 beat";
      case 10: return "Beat";
      case 11: return "Bar";
      default: return "Step";
    }
  };
  
  // Convert snap option to actual pixel size
  const getSnapSizeInPixels = (option: number): number => {
    switch(option) {
      case 0: return 1; // No snapping, but need a minimum value
      case 1: return Math.ceil(effectiveGridSize / 6);
      case 2: return Math.ceil(effectiveGridSize / 4);
      case 3: return Math.ceil(effectiveGridSize / 3);
      case 4: return Math.ceil(effectiveGridSize / 2);
      case 5: return effectiveGridSize; // One step (default grid size)
      case 6: return effectiveGridSize * 4 / 6; // Assuming a beat is 4 steps
      case 7: return effectiveGridSize; // 1/4 beat equals one step with 48px grid
      case 8: return effectiveGridSize * 4 / 3;
      case 9: return effectiveGridSize * 2; // 1/2 beat equals 2 steps with 48px grid
      case 10: return effectiveGridSize * 4; // One beat
      case 11: return effectiveGridSize * 16; // One bar (4 beats)
      default: return effectiveGridSize;
    }
  };
  
  // Handle grid snap menu open
  const handleGridSnapClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setGridSnapAnchorEl(event.currentTarget);
  };

  // Handle grid snap menu close
  const handleGridSnapClose = () => {
    setGridSnapAnchorEl(null);
  };
  
  // Handle grid snap size change
  const handleGridSnapSizeChange = (option: number) => {
    setGridSnapSize(option);
    handleGridSnapClose();
  };
  
  // Toggle grid snap on/off
  const toggleGridSnap = () => {
    setGridSnapEnabled(!gridSnapEnabled);
  };

  // Track scroll position
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // State for tracking horizontal scrollbar dragging
  const [isHDragging, setIsHDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [scrollStartX, setScrollStartX] = useState(0);
  const hScrollbarTrackRef = useRef<HTMLDivElement>(null);

  // State for tracking vertical scrollbar dragging
  const [isVDragging, setIsVDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [scrollStartY, setScrollStartY] = useState(0);
  const vScrollbarTrackRef = useRef<HTMLDivElement>(null);

  // Calculate total content height based on number of keys
  const totalKeys = 132;
  const keyHeight = 25;
  const contentHeight = totalKeys * keyHeight;
  const measureSize = 4 * effectiveGridSize; // Size of measure lines in pixels (every 4 grid cells)
  
  // Calculate common factors for scrollbar calculations
  const contentAreaWidth = dimensions.width - keyboardWidth;
  const contentAreaHeight = dimensions.height - 28 - 16; // Minus header and horizontal scrollbar

  // Handle scroll event with requestAnimationFrame for better performance
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Use requestAnimationFrame to optimize scroll performance
    requestAnimationFrame(() => {
      const target = e.target as HTMLDivElement;
      setScrollX(target.scrollLeft);
      setScrollY(target.scrollTop);

      // Sync keyboard scroll with main content
      if (keyboardRef.current) {
        keyboardRef.current.scrollTop = target.scrollTop;
      }
    });
  };

  // Set initial scroll position to 50% of vertical height on mount
  useEffect(() => {
    if (viewportRef.current) {
      // Calculate 50% of the scrollable height (accounting for viewport size)
      const middleScrollPosition = (contentHeight - contentAreaHeight) / 2;
      
      // Set the scroll position
      viewportRef.current.scrollTop = middleScrollPosition;
      
      // Also update the state
      setScrollY(middleScrollPosition);
      
      // Sync keyboard scroll
      if (keyboardRef.current) {
        keyboardRef.current.scrollTop = middleScrollPosition;
      }
    }
  }, [contentHeight, contentAreaHeight, zoomLevel]);

  // Calculate scaled content width based on zoom
  const contentWidth = initialContentWidth * zoomLevel;

  const availableContentWidth = contentWidth - contentAreaWidth;
  const availableContentHeight = contentHeight - contentAreaHeight;

  const hScrollRatio =
    availableContentWidth > 0 ? scrollX / availableContentWidth : 0;
  const vScrollRatio =
    availableContentHeight > 0 ? scrollY / availableContentHeight : 0;

  // Calculate visual scrollbar dimensions based on scroll positions
  const maxHScrollbarWidth = 400;
  const minScrollbarWidth = 10;
  const hScrollbarWidth = Math.max(maxHScrollbarWidth - hScrollRatio * 490, minScrollbarWidth);
  const vScrollbarHeight = Math.max(
    (contentAreaHeight / contentHeight) * contentAreaHeight,
    20
  );

  // Calculate scrollbar positions with safety buffer
  const maxHScrollbarPosition = contentAreaWidth - hScrollbarWidth - 4;
  const maxVScrollbarPosition = contentAreaHeight - vScrollbarHeight - 4;

  const hScrollbarPosition = Math.min(
    hScrollRatio * maxHScrollbarPosition,
    maxHScrollbarPosition - 16 // Extra buffer to prevent overlapping
  );

  const vScrollbarPosition = Math.min(
    vScrollRatio * maxVScrollbarPosition,
    maxVScrollbarPosition
  );

  // Handle horizontal scrollbar track click
  const handleHScrollbarTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent event propagation to RND
    e.stopPropagation();

    // Only handle if not already dragging
    if (!isHDragging) {
      const trackRect = e.currentTarget.getBoundingClientRect();
      const clickPosition = e.clientX - trackRect.left;

      // Check if clicked on thumb
      const thumbLeft = hScrollbarPosition;
      const thumbRight = hScrollbarPosition + hScrollbarWidth;
      const isThumbClick =
        clickPosition >= thumbLeft && clickPosition <= thumbRight;

      if (!isThumbClick) {
        // Calculate target scroll position
        const clickRatio = clickPosition / trackRect.width;
        const targetScrollLeft = clickRatio * availableContentWidth;

        // Apply scroll
        if (viewportRef.current) {
          viewportRef.current.scrollLeft = targetScrollLeft;
        }
      }
    }
  };

  // Handle vertical scrollbar track click
  const handleVScrollbarTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent event propagation to RND
    e.stopPropagation();

    // Only handle if not already dragging
    if (!isVDragging) {
      const trackRect = e.currentTarget.getBoundingClientRect();
      const clickPosition = e.clientY - trackRect.top;

      // Check if clicked on thumb
      const thumbTop = vScrollbarPosition;
      const thumbBottom = vScrollbarPosition + vScrollbarHeight;
      const isThumbClick =
        clickPosition >= thumbTop && clickPosition <= thumbBottom;

      if (!isThumbClick) {
        // Calculate target scroll position
        const clickRatio = clickPosition / trackRect.height;
        const targetScrollTop = clickRatio * availableContentHeight;

        // Apply scroll
        if (viewportRef.current) {
          viewportRef.current.scrollTop = targetScrollTop;
          if (keyboardRef.current) {
            keyboardRef.current.scrollTop = targetScrollTop;
          }
        }
      }
    }
  };

  // Handle horizontal scrollbar thumb mousedown
  const handleHScrollbarThumbMouseDown = (e: React.MouseEvent) => {
    // Prevent event propagation to RND
    e.stopPropagation();
    e.preventDefault();

    setIsHDragging(true);
    setDragStartX(e.clientX);
    setScrollStartX(scrollX);
  };

  // Handle vertical scrollbar thumb mousedown
  const handleVScrollbarThumbMouseDown = (e: React.MouseEvent) => {
    // Prevent event propagation to RND
    e.stopPropagation();
    e.preventDefault();

    setIsVDragging(true);
    setDragStartY(e.clientY);
    setScrollStartY(scrollY);
  };

  // Add event listeners for horizontal dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isHDragging && viewportRef.current && hScrollbarTrackRef.current) {
        e.preventDefault();

        const trackRect = hScrollbarTrackRef.current.getBoundingClientRect();
        const trackWidth = trackRect.width;

        const deltaX = e.clientX - dragStartX;
        const deltaRatio = deltaX / trackWidth;

        const newScrollX = Math.max(
          0,
          Math.min(
            scrollStartX + deltaRatio * availableContentWidth,
            availableContentWidth
          )
        );

        viewportRef.current.scrollLeft = newScrollX;
      }
    };

    const handleMouseUp = () => {
      setIsHDragging(false);
    };

    if (isHDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      // Disable text selection while dragging
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      // Re-enable text selection
      if (isHDragging) {
        document.body.style.userSelect = "";
      }
    };
  }, [isHDragging, dragStartX, scrollStartX, availableContentWidth]);

  // Add event listeners for vertical dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (
        isVDragging &&
        viewportRef.current &&
        vScrollbarTrackRef.current &&
        keyboardRef.current
      ) {
        e.preventDefault();

        const trackRect = vScrollbarTrackRef.current.getBoundingClientRect();
        const trackHeight = trackRect.height;

        const deltaY = e.clientY - dragStartY;
        const deltaRatio = deltaY / trackHeight;

        const newScrollY = Math.max(
          0,
          Math.min(
            scrollStartY + deltaRatio * availableContentHeight,
            availableContentHeight
          )
        );

        viewportRef.current.scrollTop = newScrollY;
        keyboardRef.current.scrollTop = newScrollY;
      }
    };

    const handleMouseUp = () => {
      setIsVDragging(false);
    };

    if (isVDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      // Disable text selection while dragging
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      // Re-enable text selection
      if (isVDragging) {
        document.body.style.userSelect = "";
      }
    };
  }, [isVDragging, dragStartY, scrollStartY, availableContentHeight]);

  // Sync keyboard scroll with viewport
  const handleKeyboardScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (viewportRef.current) {
      const target = e.target as HTMLDivElement;
      viewportRef.current.scrollTop = target.scrollTop;
      setScrollY(target.scrollTop);
    }
  };

  // Update Konva stage size when dimensions change
  useEffect(() => {
    // Calculate the new stage dimensions
    const stageWidth = dimensions.width - keyboardWidth;
    const stageHeight = dimensions.height - 28 - 16; // Minus header and horizontal scrollbar
    
    // Force update of stage dimensions
    const canvasContainer = canvasContainerRef.current;
    if (canvasContainer) {
      // Use requestAnimationFrame for smoother updates
      requestAnimationFrame(() => {
        canvasContainer.style.width = `${stageWidth}px`;
        canvasContainer.style.height = `${stageHeight}px`;
      });
    }
  }, [dimensions, keyboardWidth]);

  // Make sure scrolling with trackpad works
  useEffect(() => {
    const stage = canvasContainerRef.current?.querySelector('canvas');
    if (stage) {
      // Allow wheel events to propagate to parent scrollable container
      stage.addEventListener('wheel', (e) => {
        e.stopPropagation();
      }, { passive: true });
    }
    
    return () => {
      const stage = canvasContainerRef.current?.querySelector('canvas');
      if (stage) {
        stage.removeEventListener('wheel', (e) => {
          e.stopPropagation();
        });
      }
    };
  }, []);

  // State for managing notes
  const [notes, setNotes] = useState<Note[]>([]);
  const [nextNoteId, setNextNoteId] = useState(1);
  
  // Add a ref to track the last time a note was created
  const lastNoteCreationTime = useRef<number>(0);
  // Debounce time in milliseconds
  const DEBOUNCE_TIME = 10; 

  // Helper function for creating a new note with debouncing
  const createNewNote = (startPos: number, topPos: number): Note | null => {
    const currentTime = Date.now();
    
    // Check if we're creating notes too rapidly
    if (currentTime - lastNoteCreationTime.current < DEBOUNCE_TIME) {
      return null; // Debounce - don't create a note if one was created very recently
    }
    
    // Update the last creation time
    lastNoteCreationTime.current = currentTime;
    
    // Create the new note
    const newNoteWidth = lastNoteWidth * zoomLevel;
    
    const newNote: Note = {
      id: nextNoteId,
      start: startPos,
      top: topPos,
      width: newNoteWidth,
      color: noteColor,
    };
    
    // Always increment the ID after creating a note
    setNextNoteId(prevId => prevId + 1);
    
    return newNote;
  };
  
  // Colors for new notes (cycle through these)
  const noteColor = DARK_THEME.noteColor;

  // Add state to track the most recently used note width
  // Default to one beat (quarter note) at default zoom
  const [lastNoteWidth, setLastNoteWidth] = useState(TICKS_PER_BEAT * PIXELS_PER_TICK);

  // Create a ref to hold the last processed notes state to prevent infinite loops
  const lastProcessedNotesRef = useRef<Note[]>([]);

  // Convert visual notes to normalized note states
  const convertNotesToState = (notes: Note[], currentZoomLevel = zoomLevel): NoteState[] => {
    return notes.map(note => ({
      id: note.id,
      // Convert pixel values to ticks, independent of zoom
      // Each beat is 960 ticks, and at zoom 1.0 each beat is 4*GRID_SIZE pixels wide
      length: Math.round(note.width / (PIXELS_PER_TICK * currentZoomLevel)),
      // The row is now inverted - convert from pixel position to note index
      row: totalKeys - 1 - Math.floor(note.top / keyHeight),
      column: Math.round(note.start / (PIXELS_PER_TICK * currentZoomLevel)),
    }));
  };

  // Update parent component when notes change due to user interactions
  useEffect(() => {
    if (onNotesChange) {
      // Check if the notes have actually changed to prevent infinite loops
      const notesChanged = 
        // First check if the internal reference has been updated by user interactions
        // rather than by the initialNotes update effect
        lastProcessedNotesRef.current !== notes &&
        // Then check if there's an actual difference in the notes
        (notes.length !== lastProcessedNotesRef.current.length ||
        notes.some((note, index) => {
          const prevNote = lastProcessedNotesRef.current[index];
          return !prevNote || 
            prevNote.id !== note.id ||
            prevNote.start !== note.start ||
            prevNote.top !== note.top ||
            prevNote.width !== note.width;
        }));
        
      if (notesChanged) {
        const noteStates = convertNotesToState(notes);
        // Store current notes to compare against next time
        lastProcessedNotesRef.current = [...notes];
        onNotesChange(noteStates);
      }
    }
  }, [notes, onNotesChange, zoomLevel, keyHeight, totalKeys]);
  
  // Modify the handleStageMouseDown function
  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // If the target is the stage itself (not a note), create a new note or start selection
    const targetIsStage = e.target === e.target.getStage();
    if (targetIsStage) {
      // Get stage and pointer position
      const stage = e.target.getStage();
      if (!stage) return;
      
      const pointerPos = stage.getPointerPosition();
      if (!pointerPos) return;
      
      // Convert pointer position to absolute position with scroll
      const x = pointerPos.x + scrollX;
      const y = pointerPos.y + scrollY;

      if (selectedTool === 'select') {
        // Start selection rectangle
        setSelectionRect({
          startX: x,
          startY: y,
          width: 0,
          height: 0
        });
        setIsSelecting(true);
        // Clear selected notes when starting a new selection unless shift key is pressed
        if (!e.evt.shiftKey) {
          setSelectedNoteIds([]);
        }
      } else if (selectedTool === 'pen' || selectedTool === 'highlighter') {
        // Get current snap size in pixels (already accounts for zoom)
        const actualGridSize = getSnapSizeInPixels(gridSnapSize);

        // Snap position
        let snappedX, snappedY;
        
        if (gridSnapEnabled && gridSnapSize !== 0) {
          // Snap to grid
          snappedX = Math.floor(x / actualGridSize) * actualGridSize;
        } else {
          // No horizontal snapping, but still snap to nearest tick for fine-grained control
          const pixelsPerTickScaled = PIXELS_PER_TICK * zoomLevel;
          snappedX = Math.floor(x / pixelsPerTickScaled) * pixelsPerTickScaled;
        }
        
        // Always snap vertically to key rows regardless of grid size
        snappedY = Math.floor(y / keyHeight) * keyHeight;
        
        // Check if there's already a note at this cell position using the appropriate check
        // For pen tool: check if there's a note at the position (can't place notes on top of existing ones)
        // For highlighter tool: check if there's a note starting at this exact cell (allows notes adjacent to others)
        const existingNote = findNoteAtCell(snappedX, snappedY);
        
        // Only create a note if there isn't already one at this position
        if (!existingNote) {
          // Create a new note using the helper function
          const newNote = createNewNote(snappedX, snappedY);

          // Add the note immediately if not debounced
          if (newNote) {
            setNotes(prevNotes => [...prevNotes, newNote]);
          }
        }
      } else if (selectedTool === 'eraser') {
        // Check if we're clicking on a note to erase it
        const noteUnderCursor = findNoteAtPosition(x, y);
        if (noteUnderCursor) {
          // Remove the note that was clicked
          setNotes(prevNotes => prevNotes.filter(n => n.id !== noteUnderCursor.id));
        }
      }
    }
  };

  // Handle mouse move during selection
  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    
    // Convert pointer position to absolute position with scroll
    const x = pointerPos.x + scrollX;
    const y = pointerPos.y + scrollY;
    
    // Skip all actions if we're currently dragging a note
    if (draggedNoteId !== null) {
      return;
    }
    
    // Handle eraser tool functionality when mouse button is down
    if (selectedTool === 'eraser' && e.evt.buttons === 1) {
      const noteUnderCursor = findNoteAtPosition(x, y);
      if (noteUnderCursor) {
        // Remove the note under the cursor
        setNotes(prevNotes => prevNotes.filter(n => n.id !== noteUnderCursor.id));
      }
      return;
    }
    
    // Handle highlighter tool functionality when mouse button is down
    if (selectedTool === 'highlighter' && e.evt.buttons === 1) {
      // Skip if the mouse is over a note (not the stage)
      if (e.target !== stage) return;
      
      // Get current snap size in pixels (already accounts for zoom)
      const actualGridSize = getSnapSizeInPixels(gridSnapSize);

      // Snap position
      let snappedX, snappedY;
      
      if (gridSnapEnabled && gridSnapSize !== 0) {
        // Snap to grid
        snappedX = Math.floor(x / actualGridSize) * actualGridSize;
      } else {
        // No horizontal snapping, but still snap to nearest tick for fine-grained control
        const pixelsPerTickScaled = PIXELS_PER_TICK * zoomLevel;
        snappedX = Math.floor(x / pixelsPerTickScaled) * pixelsPerTickScaled;
      }
      
      // Always snap vertically to key rows regardless of grid size
      snappedY = Math.floor(y / keyHeight) * keyHeight;
      
      // Check if there's already a note at this cell position using the cell-based check
      const existingNote = findNoteAtCell(snappedX, snappedY);
      
      // Only create a note if there isn't already one at this position
      if (!existingNote) {
        // Create a new note using the helper function
        const newNote = createNewNote(snappedX, snappedY);

        // Add the note immediately if not debounced
        if (newNote) {
          setNotes(prevNotes => [...prevNotes, newNote]);
        }
      }
      
      // Update hover position for preview
      setHoveredNote(getNoteNameFromY(pointerPos.y));
      setHoverPosition({ x: snappedX, y: snappedY });
      
      return;
    }
    
    if (isSelecting && selectionRect) {
      // Update selection rectangle dimensions
      setSelectionRect({
        ...selectionRect,
        width: x - selectionRect.startX,
        height: y - selectionRect.startY
      });
    }
    
    // Track hover position for note preview when using the pen tool or highlighter tool
    if (selectedTool === 'pen' || selectedTool === 'highlighter') {
      setHoveredNote(getNoteNameFromY(pointerPos.y));
      
      // Get current snap size in pixels (already accounts for zoom)
      const actualGridSize = getSnapSizeInPixels(gridSnapSize);

      // Snap position
      let snappedX, snappedY;
      
      if (gridSnapEnabled && gridSnapSize !== 0) {
        // Snap to grid
        snappedX = Math.floor(x / actualGridSize) * actualGridSize;
      } else {
        // No horizontal snapping, but still snap to nearest tick for fine-grained control
        const pixelsPerTickScaled = PIXELS_PER_TICK * zoomLevel;
        snappedX = Math.floor(x / pixelsPerTickScaled) * pixelsPerTickScaled;
      }
      
      // Always snap vertically to key rows regardless of grid size
      snappedY = Math.floor(y / keyHeight) * keyHeight;
      
      setHoverPosition({ x: snappedX, y: snappedY });
    }
  };

  // Modify mouse up to reset highlighting state
  const handleStageMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isSelecting && selectionRect) {
      // Finalize selection
      setIsSelecting(false);
      
      // Ensure width and height are positive for calculations
      const x = selectionRect.width < 0 ? selectionRect.startX + selectionRect.width : selectionRect.startX;
      const y = selectionRect.height < 0 ? selectionRect.startY + selectionRect.height : selectionRect.startY;
      const width = Math.abs(selectionRect.width);
      const height = Math.abs(selectionRect.height);
      
      // Find notes that start within the selection rectangle
      const selectedIds = notes
        .filter(note => 
          note.start >= x && 
          note.start <= x + width && 
          note.top >= y && 
          note.top <= y + height
        )
        .map(note => note.id);
      
      // Update selected notes
      if (e.evt.shiftKey) {
        // Add to existing selection with shift key
        setSelectedNoteIds(prevSelected => {
          const mergedSelection = [...prevSelected];
          selectedIds.forEach(id => {
            if (!prevSelected.includes(id)) {
              mergedSelection.push(id);
            }
          });
          return mergedSelection;
        });
      } else {
        // Replace selection
        setSelectedNoteIds(selectedIds);
      }
      
      // Clear selection rectangle
      setSelectionRect(null);
    }
  };

  // Handler for clicking on an existing note
  const handleNoteClick = (noteId: number) => {
    // If we just finished a resize operation, ignore the click
    if (justFinishedResize) {
      console.log("Ignoring click after resize operation");
      return;
    }
    
    // If we're dragging, don't process clicks
    if (draggedNoteId !== null) return;
    
    // If eraser tool is selected, delete the note
    if (selectedTool === 'eraser') {
      console.log(`Erasing note: ${noteId}`);
      setNotes(prevNotes => prevNotes.filter(n => n.id !== noteId));
      return;
    }
    
    // Only allow selection when in select mode
    if (selectedTool === 'select') {
      setSelectedNoteIds(prevSelected => {
        if (prevSelected.includes(noteId)) {
          return prevSelected.filter(id => id !== noteId);
        } else {
          return [...prevSelected, noteId];
        }
      });
    } else {
      // For other tools, just log the click but don't change selection
      console.log(`Clicked on note: ${noteId} with ${selectedTool} tool`);
    }
  };

  // State for tracking dragged note
  const [draggedNoteId, setDraggedNoteId] = useState<number | null>(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [noteStartPos, setNoteStartPos] = useState({ x: 0, y: 0 });
  
  // Track initial positions of all selected notes during drag operations
  const [selectedNotesStartPos, setSelectedNotesStartPos] = useState<{[id: number]: {x: number, y: number}}>({});

  // Helper function to find a note at a specific position
  const findNoteAtPosition = (x: number, y: number): Note | undefined => {
    return notes.find(note => 
      x >= note.start && 
      x <= note.start + note.width && 
      y >= note.top && 
      y <= note.top + keyHeight
    );
  };

  // Helper function to check if a note exists at a specific grid cell
  const findNoteAtCell = (cellX: number, cellY: number): Note | undefined => {
    // Get the exact start of the cell
    return notes.find(note => 
      Math.abs(note.start - cellX) == 0 && // Compare with a small epsilon for floating point comparison
      Math.abs(note.top - cellY) == 0      // Compare with a small epsilon for floating point comparison
    );
  };

  // Handler for note dragging start
  const handleNoteDragStart = (noteId: number, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true; // Prevent event bubbling

    // Find the note
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    // Store the starting positions
    setDraggedNoteId(noteId);
    setDragStartPos({ 
      x: e.evt.clientX, 
      y: e.evt.clientY 
    });
    setNoteStartPos({ 
      x: note.start, 
      y: note.top 
    });
    
    // Only handle selection if the select tool is active
    if (selectedTool === 'select') {
      // If this note is part of a selection, store the starting position of all selected notes
      if (selectedNoteIds.includes(noteId)) {
        const startPositions: {[id: number]: {x: number, y: number}} = {};
        
        // Record initial positions for all selected notes
        notes.forEach(n => {
          if (selectedNoteIds.includes(n.id)) {
            startPositions[n.id] = { x: n.start, y: n.top };
          }
        });
        
        setSelectedNotesStartPos(startPositions);
      } else {
        // If the dragged note is not part of the selection, clear the selection and select just this note
        setSelectedNoteIds([noteId]);
        setSelectedNotesStartPos({ [noteId]: { x: note.start, y: note.top } });
      }
    } else {
      // For other tools, don't modify selection state
      // Just store the start position for the dragged note
      setSelectedNotesStartPos({ [noteId]: { x: note.start, y: note.top } });
    }

    // Log to verify drag start
    console.log(`Started dragging note ${noteId}`);
  };

  // Handler for note dragging
  const handleNoteDragMove = (noteId: number, e: Konva.KonvaEventObject<MouseEvent>) => {
    if (draggedNoteId !== noteId) return;
    
    // Get stage and mouse position
    const stage = e.target.getStage();
    if (!stage) return;
    
    const mousePos = stage.getPointerPosition();
    if (!mousePos) return;
    
    // Get the node being dragged
    const node = e.target;
    
    // Only store the position for update on drag end
    // Visual updates are handled by Konva's drag mechanism
    // This significantly reduces state updates during dragging
    
    // Store the current position for use when drag ends
    mouseOffsetRef.current = {
      x: node.x() + scrollX,
      y: node.y() + scrollY
    };
  };

  // Handler for note drag end - optimized for performance
  const handleNoteDragEnd = (noteId: number) => {
    if (draggedNoteId !== noteId) return;

    // Find the dragged note
    const draggedNote = notes.find(n => n.id === noteId);
    if (!draggedNote) {
      // Reset drag state
      setDraggedNoteId(null);
      setSelectedNotesStartPos({});
      return;
    }
    
    // Get the calculated position from mouseOffsetRef
    const newX = mouseOffsetRef.current.x;
    const newY = mouseOffsetRef.current.y;
    
    // Calculate the delta from the original position
    const deltaX = newX - noteStartPos.x;
    const deltaY = newY - noteStartPos.y;
    
    // Update notes with a single state update for better performance
    requestAnimationFrame(() => {
      setNotes(prevNotes => {
        // Create a new array
        return prevNotes.map(note => {
          // If using select tool and this is a selected note
          if (selectedTool === 'select' && selectedNoteIds.includes(note.id)) {
            // Get this note's initial position
            const startPos = selectedNotesStartPos[note.id];
            if (startPos) {
              // Apply the same delta to each note
              return { 
                ...note, 
                start: startPos.x + deltaX,
                top: startPos.y + deltaY 
              };
            }
          } 
          // If this is the dragged note but not part of a selection
          else if (note.id === noteId) {
            return { 
              ...note, 
              start: newX,
              top: newY
            };
          }
          // Otherwise leave the note unchanged
          return note;
        });
      });
      
      // Reset drag state after animation frame
      setDraggedNoteId(null);
      setSelectedNotesStartPos({});
    });

    // Log to verify drag end
    console.log(`Finished dragging note ${noteId}`);
  };

  // Calculate the playhead position
  const playheadPosition = scrollX + 100; // Offset from current scroll

  // Reference for the header element to use as drag handle
  const headerRef = useRef<HTMLDivElement>(null);

  // State for tracking note resizing
  const [isResizingNote, setIsResizingNote] = useState(false);
  const [resizingNoteId, setResizingNoteId] = useState<number | null>(null);
  const [resizeDirection, setResizeDirection] = useState<'left' | 'right' | null>(null);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0 });
  const [noteInitialState, setNoteInitialState] = useState({ start: 0, width: 0 });
  
  // Track initial states of all selected notes during resize operations
  const [selectedNotesInitialState, setSelectedNotesInitialState] = useState<{[id: number]: {start: number, width: number}}>({});
  
  // Add global event listeners for resize
  useEffect(() => {
    if (isResizingNote) {
      document.addEventListener('mousemove', handleNoteResizeMove);
      document.addEventListener('mouseup', handleNoteResizeEnd);
      
      // Disable text selection while resizing
      document.body.style.userSelect = 'none';
    }
    
    return () => {
      document.removeEventListener('mousemove', handleNoteResizeMove);
      document.removeEventListener('mouseup', handleNoteResizeEnd);
      
      // Re-enable text selection
      if (isResizingNote) {
        document.body.style.userSelect = '';
      }
    };
  }, [isResizingNote, resizingNoteId, resizeDirection, resizeStartPos, noteInitialState, selectedNotesInitialState, selectedNoteIds, notes]);

  // Update notes when zoom level changes
  useEffect(() => {
    if (notes.length > 0) {
      // Scale all note positions and widths according to the new zoom level
      setNotes(prevNotes => 
        prevNotes.map(note => {
          // Calculate base values (without zoom)
          const baseStart = note.start / prevZoomLevel;
          const baseWidth = note.width / prevZoomLevel;
          
          // Apply new zoom level
          return {
            ...note,
            start: baseStart * zoomLevel,
            width: baseWidth * zoomLevel
          };
        })
      );
    }
    // Store current zoom level for next comparison
    setPrevZoomLevel(zoomLevel);
  }, [zoomLevel, notes.length, prevZoomLevel]);

  // Handler for starting note resize
  const handleNoteResizeStart = (noteId: number, direction: 'left' | 'right', e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true; // Prevent event bubbling
    
    // Find the note
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    
    // Store the starting position and note's initial state
    setIsResizingNote(true);
    setResizingNoteId(noteId);
    setResizeDirection(direction);
    setResizeStartPos({ x: e.evt.clientX });
    setNoteInitialState({ start: note.start, width: note.width });
    
    // If this note is part of a selection, store the initial state of all selected notes
    if (selectedNoteIds.includes(noteId) && selectedNoteIds.length > 1) {
      const initialStates: {[id: number]: {start: number, width: number}} = {};
      
      // Record initial states for all selected notes
      notes.forEach(n => {
        if (selectedNoteIds.includes(n.id)) {
          initialStates[n.id] = { start: n.start, width: n.width };
        }
      });
      
      setSelectedNotesInitialState(initialStates);
    } else {
      // If the resized note is not part of a multi-selection, just store its state
      setSelectedNotesInitialState({ [noteId]: { start: note.start, width: note.width } });
    }
    
    // Log for debugging
    console.log(`Started resizing note ${noteId} from ${direction} side`);
  };

  // Handler for note resize move
  const handleNoteResizeMove = (e: MouseEvent) => {
    if (!isResizingNote || resizingNoteId === null || resizeDirection === null) return;
    
    // Find the note
    const note = notes.find(n => n.id === resizingNoteId);
    if (!note) return;
    
    // Calculate how far the mouse has moved
    const deltaX = e.clientX - resizeStartPos.x;
    
    // Get current snap size in pixels (already accounts for zoom)
    const actualGridSize = getSnapSizeInPixels(gridSnapSize);
    // Get the pixel size of one tick at current zoom level
    const pixelsPerTickScaled = PIXELS_PER_TICK * zoomLevel;
    
    // Check if we're resizing multiple notes
    const isMultiResize = selectedNoteIds.includes(resizingNoteId) && 
                          selectedNoteIds.length > 1 && 
                          Object.keys(selectedNotesInitialState).length > 1;
    
    // Apply changes based on resize direction
    if (resizeDirection === 'right') {
      // Resizing from right - just update width
      
      // Calculate new width for the primary note
      let newWidth;
      if (gridSnapEnabled && gridSnapSize !== 0) {
        // Snap to grid
        newWidth = Math.max(actualGridSize, Math.round((noteInitialState.width + deltaX) / actualGridSize) * actualGridSize);
      } else {
        // No grid snapping, but still snap to nearest tick
        newWidth = Math.max(
          pixelsPerTickScaled, // Minimum width is one tick
          Math.round((noteInitialState.width + deltaX) / pixelsPerTickScaled) * pixelsPerTickScaled
        );
      }
      
      // Calculate absolute change in width (not ratio)
      const widthDelta = newWidth - noteInitialState.width;
      
      setNotes(prevNotes => 
        prevNotes.map(n => {
          if (isMultiResize && selectedNoteIds.includes(n.id)) {
            // Get this note's initial state
            const initialState = selectedNotesInitialState[n.id];
            if (!initialState) return n;
            
            // Calculate new width by adding the same absolute delta
            // Ensure minimum width
            const thisNoteNewWidth = Math.max(
              pixelsPerTickScaled, // Ensure minimum width
              initialState.width + widthDelta
            );
            
            return { ...n, width: thisNoteNewWidth };
          } else if (n.id === resizingNoteId) {
            // Just update the resizing note
            return { ...n, width: newWidth };
          }
          return n;
        })
      );
      
    } else if (resizeDirection === 'left') {
      // Resizing from left - update both start position and width
      
      // Calculate values for the primary note
      const minSize = gridSnapEnabled && gridSnapSize !== 0 
        ? actualGridSize 
        : pixelsPerTickScaled; // Minimum size is one tick if not grid snapping
        
      const maxLeftDelta = noteInitialState.width - minSize;
      const boundedDeltaX = Math.min(maxLeftDelta, Math.max(-noteInitialState.start, deltaX));
      
      let snappedDeltaX, newStart, newWidth;
      
      if (gridSnapEnabled && gridSnapSize !== 0) {
        // Snap to grid
        snappedDeltaX = Math.round(boundedDeltaX / actualGridSize) * actualGridSize;
        newStart = noteInitialState.start + snappedDeltaX;
        newWidth = noteInitialState.width - snappedDeltaX;
      } else {
        // No grid snapping, but still snap to nearest tick
        snappedDeltaX = Math.round(boundedDeltaX / pixelsPerTickScaled) * pixelsPerTickScaled;
        newStart = noteInitialState.start + snappedDeltaX;
        newWidth = noteInitialState.width - snappedDeltaX;
      }
      
      // Use absolute movement amount rather than a ratio
      const startDelta = snappedDeltaX;
      const widthDelta = -snappedDeltaX; // Width changes in opposite direction to start
      
      setNotes(prevNotes => 
        prevNotes.map(n => {
          if (isMultiResize && selectedNoteIds.includes(n.id)) {
            // Get this note's initial state
            const initialState = selectedNotesInitialState[n.id];
            if (!initialState) return n;
            
            // Calculate new values using absolute delta values
            const thisNoteNewStart = initialState.start + startDelta;
            const thisNoteNewWidth = Math.max(minSize, initialState.width + widthDelta);
            
            // If the new width would be less than minimum, limit the movement
            if (initialState.width + widthDelta < minSize) {
              return {
                ...n,
                start: initialState.start + (initialState.width - minSize),
                width: minSize
              };
            }
            
            return { 
              ...n, 
              start: thisNoteNewStart,
              width: thisNoteNewWidth
            };
          } else if (n.id === resizingNoteId) {
            // Just update the resizing note
            return { ...n, start: newStart, width: newWidth };
          }
          return n;
        })
      );
    }
  };

  // Add a flag to track if we just finished resizing
  const [justFinishedResize, setJustFinishedResize] = useState(false);

  // Handler for note resize end
  const handleNoteResizeEnd = () => {
    if (isResizingNote && resizingNoteId !== null) {
      // Find the resized note to get its final width
      const resizedNote = notes.find(n => n.id === resizingNoteId);
      if (resizedNote) {
        // Update the last note width for future notes (normalize by zoom level)
        setLastNoteWidth(resizedNote.width / zoomLevel);
        console.log(`Remembered new width: ${resizedNote.width / zoomLevel}px (unzoomed) for future notes`);
      }
      
      // Set the flag to indicate we just finished resizing
      setJustFinishedResize(true);
      
      // Reset the flag after a short delay - long enough to prevent the click event
      setTimeout(() => {
        setJustFinishedResize(false);
      }, 10); // 10ms is enough to prevent the click that follows a mouseup
      
      // Reset resize state
      setIsResizingNote(false);
      setResizingNoteId(null);
      setResizeDirection(null);
      setSelectedNotesInitialState({});
      
      // Log for debugging
      console.log(`Finished resizing note`);
    }
  };

  // Helper function to check if initialNotes have changed
  const haveInitialNotesChanged = (currentNotes: NoteState[], prevNotes: Note[]): boolean => {
    // Convert previous visual notes back to NoteState format for comparison
    const prevNoteStates = convertNotesToState(prevNotes);
    
    // Check if the arrays are different lengths
    if (currentNotes.length !== prevNoteStates.length) return true;
    
    // Deep compare the notes
    return currentNotes.some((note, index) => {
      const prevNote = prevNoteStates[index];
      return !prevNote || 
        prevNote.id !== note.id ||
        prevNote.length !== note.length ||
        prevNote.row !== note.row ||
        prevNote.column !== note.column;
    });
  };

  // Initialize notes from props when component mounts or when initialNotes changes
  useEffect(() => {
    // Skip if no initialNotes are provided

    // Check if there's a meaningful change to initialNotes that requires updating
    // or if this is the first load (notes array is empty)
    const shouldUpdateNotes = 
      notes.length === 0 || // First render
      (lastProcessedNotesRef.current.length > 0 && 
       haveInitialNotesChanged(initialNotes, lastProcessedNotesRef.current));
    
    if (shouldUpdateNotes) {
      console.log('Updating notes from initialNotes due to external change');
      
      // Convert the normalized note states to visual notes
      const visualNotes: Note[] = initialNotes.map((noteState, index) => ({
        id: noteState.id || index + 1, // Use provided id or generate one
        start: noteState.column * PIXELS_PER_TICK * zoomLevel, // Convert ticks to pixels
        // Invert the row calculation for flipped keyboard
        top: (totalKeys - 1 - noteState.row) * keyHeight, // Convert row to pixels
        width: noteState.length * PIXELS_PER_TICK * zoomLevel, // Convert ticks to pixels
        color: noteColor, // Assign color based on index
      }));
      
      // Set the notes
      setNotes(visualNotes);
      
      // Set the next note ID to be higher than any existing note ID
      const maxId = Math.max(...visualNotes.map(note => note.id), 0);
      setNextNoteId(maxId + 1);

      // Store the current notes reference for deep comparison
      lastProcessedNotesRef.current = [...visualNotes];
    }
  }, [initialNotes, zoomLevel, keyHeight, totalKeys, notes]);

  // Import necessary hooks
  const [hoveredNote, setHoveredNote] = useState<string | null>(null);

  // Add state for tracking hover position for note preview
  const [hoverPosition, setHoverPosition] = useState<{ x: number, y: number } | null>(null);

  // Function to get note name from Y position
  const getNoteNameFromY = (y: number): string => {
    // Convert y position to row index (0-based from top)
    const rowIndex = Math.floor((y + scrollY) / keyHeight);
    
    // Convert to note index (reverses the index since lower notes have higher Y values)
    const noteIndex = totalKeys - 1 - rowIndex;
    
    // Get the note name using the same function used in PianoKeyboard
    const noteNames = [
      "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
    ];
    const noteName = noteNames[noteIndex % 12];
    const octave = Math.floor(noteIndex / 12);
    
    return `${noteName}${octave}`;
  };

  // Handle mouse move on stage to track current note
  const handleStageMouseHover = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    
    // If using eraser tool, always keep default cursor
    if (selectedTool === 'eraser') {
      stage.container().style.cursor = 'default';
    }
    
    // Get note at current position
    const noteName = getNoteNameFromY(pointerPos.y);
    setHoveredNote(noteName);
    
    // Check if the mouse is over a note by checking if the target is the stage itself
    // If it's not the stage, the mouse is over a child element (likely a note)
    const isTargetStage = e.target === stage;
    
    // Only show preview if we're not dragging, resizing, selecting, or using the eraser
    if (draggedNoteId !== null || 
        resizingNoteId !== null || 
        !isTargetStage || 
        isSelecting || 
        selectedTool === 'eraser') {
      setHoverPosition(null);
      return;
    }
    
    // Only show hover position for pen and highlighter tools
    if (selectedTool !== 'pen' && selectedTool !== 'highlighter') {
      setHoverPosition(null);
      return;
    }
    
    // Calculate and set hover position for note preview
    const x = pointerPos.x + scrollX;
    const y = pointerPos.y + scrollY;
    
    // Get current snap size in pixels (already accounts for zoom)
    const actualGridSize = getSnapSizeInPixels(gridSnapSize);

    // Snap position
    let snappedX, snappedY;
    
    if (gridSnapEnabled && gridSnapSize !== 0) {
      // Snap to grid
      snappedX = Math.floor(x / actualGridSize) * actualGridSize;
    } else {
      // No horizontal snapping, but still snap to nearest tick for fine-grained control
      const pixelsPerTickScaled = PIXELS_PER_TICK * zoomLevel;
      snappedX = Math.floor(x / pixelsPerTickScaled) * pixelsPerTickScaled;
    }
    
    // Always snap vertically to key rows regardless of grid size
    snappedY = Math.floor(y / keyHeight) * keyHeight;
    
    setHoverPosition({ x: snappedX, y: snappedY });
  };

  // Handle mouse leave to clear hover state
  const handleStageMouseLeave = () => {
    setHoveredNote(null);
    setHoverPosition(null);
    
    // Clear selection rectangle if we're in the middle of selecting
    if (isSelecting) {
      setIsSelecting(false);
      setSelectionRect(null);
    }
  };

  // Add a resize handler that updates dimensions during resize
  const handleResize = (e: MouseEvent | TouchEvent, dir: any, ref: HTMLElement, delta: any, position: any) => {
    // Update dimensions in real-time during resize
    const newWidth = parseInt(ref.style.width);
    const newHeight = parseInt(ref.style.height);
    
    // Update only width and height during resize (not position)
    setDimensions({
      ...dimensions,
      width: newWidth,
      height: newHeight,
    });
  };

  // Custom styles for tool icons
  const iconHoverStyle = (e: React.MouseEvent<HTMLSpanElement>) => {
    e.currentTarget.style.opacity = "1";
    e.currentTarget.style.transform = "scale(1.1)";
  };

  const iconLeaveStyle = (e: React.MouseEvent<HTMLSpanElement>) => {
    e.currentTarget.style.opacity = "0.8";
    e.currentTarget.style.transform = "scale(1)";
  };

  return (
    <>
      <style>{customStyles}</style>
      <Rnd
        size={{ width: dimensions.width, height: dimensions.height }}
        position={{ x: dimensions.x, y: dimensions.y }}
        onDragStop={(e, d) => {
          setDimensions({ ...dimensions, x: d.x, y: d.y });
        }}
        onResize={handleResize}
        onResizeStop={(e, direction, ref, delta, position) => {
          setDimensions({
            width: parseInt(ref.style.width),
            height: parseInt(ref.style.height),
            x: position.x,
            y: position.y,
          });
        }}
        // Use the header element as the drag handle
        dragHandleClassName="piano-roll-drag-handle"
        enableUserSelectHack={false}
        style={{
          border: `1px solid ${DARK_THEME.border}`,
          borderRadius: "4px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
          overflow: "hidden",
          background: DARK_THEME.background,
          pointerEvents: "auto" 
        }}
        minWidth={500}
      >
        {/* Header - now serves as the drag handle */}
        <div
          ref={headerRef}
          className="piano-roll-drag-handle"
          style={{
            height: "28px",
            background: DARK_THEME.headerBackground,
            borderBottom: `1px solid ${DARK_THEME.border}`,
            display: "flex",
            alignItems: "center",
            padding: "0 8px",
            userSelect: "none",
            cursor: "move", // Visual cue that this is draggable
            color: DARK_THEME.headerText,
            position: "relative", // Add position relative for close button positioning
            justifyContent: "space-between" // Add space-between for better distribution
          }}
        >
          {/* Left section with title and note info */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ fontWeight: "250", marginRight: "12px" }}>{title}</span>
            
            {/* Display hovered note */}
            {hoveredNote && (
              <div style={{ 
                fontSize: "13px", 
                color: DARK_THEME.headerText,
                fontWeight: "normal",
                display: "flex",
                alignItems: "center",
              }}>
                <span style={{ color: "#aaa", marginRight: "4px" }}>Note:</span>
                <span style={{ 
                  background: "rgba(58, 123, 213, 0.2)", 
                  padding: "2px 8px", 
                  borderRadius: "3px",
                  fontFamily: "monospace",
                  color: "#a0c8ff"
                }}>
                  {hoveredNote}
                </span>
              </div>
            )}
          </div>

          {/* Right section with controls */}
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* Tool Icons */}
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              marginRight: "12px",
              paddingRight: "12px",
              position: "relative",
              height: "100%"
            }}>
              {/* Divider on the right */}
              <div style={{ 
                position: "absolute", 
                right: 0, 
                top: "50%", 
                transform: "translateY(-50%)",
                height: "16px", 
                width: "1px", 
                backgroundColor: "rgba(255,255,255,0.1)" 
              }} />
              
              {/* Select tool */}
              <span 
                className="material-symbols-outlined" 
                style={{ 
                  cursor: "pointer",
                  marginRight: "8px",
                  opacity: selectedTool === 'select' ? 1 : 0.8,
                  fontVariationSettings: "'FILL' 0", // No fill
                  background: selectedTool === 'select' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  padding: '2px',
                  borderRadius: '2px',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onClick={() => handleToolSelect('select')}
                onMouseEnter={selectedTool !== 'select' ? iconHoverStyle : undefined}
                onMouseLeave={selectedTool !== 'select' ? iconLeaveStyle : undefined}
              >
                select
              </span>
              
              {/* Pen tool */}
              <span 
                className="material-symbols-outlined" 
                style={{ 
                  cursor: "pointer",
                  marginRight: "8px",
                  opacity: selectedTool === 'pen' ? 1 : 0.8,
                  fontVariationSettings: "'FILL' 1", // Filled
                  background: selectedTool === 'pen' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  padding: '2px',
                  borderRadius: '2px',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onClick={() => handleToolSelect('pen')}
                onMouseEnter={selectedTool !== 'pen' ? iconHoverStyle : undefined}
                onMouseLeave={selectedTool !== 'pen' ? iconLeaveStyle : undefined}
              >
                ink_pen
              </span>
              
              {/* Highlighter tool */}
              <span 
                className="material-symbols-outlined" 
                style={{ 
                  cursor: "pointer",
                  marginRight: "8px",
                  opacity: selectedTool === 'highlighter' ? 1 : 0.8,
                  fontVariationSettings: "'FILL' 1", // Filled
                  background: selectedTool === 'highlighter' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  padding: '2px',
                  borderRadius: '2px',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onClick={() => handleToolSelect('highlighter')}
                onMouseEnter={selectedTool !== 'highlighter' ? iconHoverStyle : undefined}
                onMouseLeave={selectedTool !== 'highlighter' ? iconLeaveStyle : undefined}
              >
                format_ink_highlighter
              </span>
              
              {/* Eraser tool */}
              <span 
                className="material-symbols-outlined" 
                style={{ 
                  cursor: "pointer",
                  marginRight: "0px",
                  opacity: selectedTool === 'eraser' ? 1 : 0.8,
                  fontVariationSettings: "'FILL' 1", // Filled
                  background: selectedTool === 'eraser' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  padding: '2px',
                  borderRadius: '2px',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onClick={() => handleToolSelect('eraser')}
                onMouseEnter={selectedTool !== 'eraser' ? iconHoverStyle : undefined}
                onMouseLeave={selectedTool !== 'eraser' ? iconLeaveStyle : undefined}
              >
                ink_eraser
              </span>
            </div>
            
            {/* Grid Snap Controls */}
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              marginRight: "12px",
              paddingRight: "12px",
              position: "relative",
              height: "100%"
            }}>
              {/* Divider on the right */}
              <div style={{ 
                position: "absolute", 
                right: 0, 
                top: "50%", 
                transform: "translateY(-50%)",
                height: "16px", 
                width: "1px", 
                backgroundColor: "rgba(255,255,255,0.1)" 
              }} />
              
              <span 
                className="material-symbols-outlined" 
                onClick={handleGridSnapClick}
                style={{ 
                  opacity: gridSnapEnabled ? 1 : 0.5,
                  cursor: "pointer"
                }}
                onMouseEnter={(e) => {
                  if (!gridSnapEnabled) e.currentTarget.style.opacity = "0.8";
                  e.currentTarget.style.transform = "scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  if (!gridSnapEnabled) e.currentTarget.style.opacity = "0.5";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                grid_on
              </span>
            </div>
            
            {/* Zoom Controls in fixed-width container */}
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              width: "80px", 
              justifyContent: "space-between",
              marginRight: "8px" 
            }}>
              <span 
                className="material-symbols-outlined" 
                onClick={handleZoomOut}
                style={{ cursor: "pointer" }}
                onMouseEnter={iconHoverStyle}
                onMouseLeave={iconLeaveStyle}
              >
                zoom_out
              </span>
              
              <span style={{ 
                fontSize: "12px", 
                width: "36px", 
                textAlign: "center" 
              }}>
                {Math.round(zoomLevel * 100)}%
              </span>
              
              <span 
                className="material-symbols-outlined" 
                onClick={handleZoomIn}
                style={{ cursor: "pointer" }}
                onMouseEnter={iconHoverStyle}
                onMouseLeave={iconLeaveStyle}
              >
                zoom_in
              </span>
            </div>
            
            {/* Close button */}
            <div
              style={{
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "22px",
                height: "22px",
                marginRight: "-4px",
                borderRadius: "3px",
                transition: "background-color 0.2s ease",
              }}
              onClick={() => {
                // Call the onClose callback if provided
                if (onClose) {
                  onClose();
                }
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                close
              </span>
            </div>
          </div>
        </div>

        {/* Menu for grid snap options */}
        <Menu
          anchorEl={gridSnapAnchorEl}
          open={gridSnapMenuOpen}
          onClose={handleGridSnapClose}
          slotProps={{
            paper: {
              style: {
                backgroundColor: DARK_THEME.headerBackground,
                color: "white",
                borderRadius: "4px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                padding: "2px 0",
                minWidth: "100px"
              }
            }
          }}
          MenuListProps={{
            style: {
              padding: "2px 0"
            }
          }}
        >
          <MenuItem 
            onClick={() => handleGridSnapSizeChange(0)}
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              display: "flex",
              justifyContent: "space-between",
              backgroundColor: gridSnapSize === 0 ? "#3a3a3a" : "transparent"
            }}
            sx={{ 
              '&:hover': { 
                backgroundColor: '#525252 !important'
              }
            }}
          >
            <span>None</span>
            {gridSnapSize === 0 && <span className="material-symbols-outlined" style={{ fontSize: "11px", marginLeft: "4px" }}>check</span>}
          </MenuItem>
          
          {/* Divider for Step section */}
          <div style={{ 
            height: "1px", 
            backgroundColor: "rgba(255,255,255,0.1)", 
            margin: "2px 4px",
            position: "relative" 
          }}>
            <span style={{ 
              position: "absolute", 
              right: "4px", 
              top: "-5px", 
              fontSize: "8px", 
              backgroundColor: DARK_THEME.headerBackground,
              padding: "0 2px", 
              color: "rgba(255,255,255,0.5)" 
            }}>
              STEP
            </span>
          </div>
          
          <MenuItem 
            onClick={() => handleGridSnapSizeChange(1)}
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              display: "flex",
              justifyContent: "space-between",
              backgroundColor: gridSnapSize === 1 ? "#3a3a3a" : "transparent"
            }}
            sx={{ 
              '&:hover': { 
                backgroundColor: '#525252 !important'
              }
            }}
          >
            <span>1/6 step</span>
            {gridSnapSize === 1 && <span className="material-symbols-outlined" style={{ fontSize: "11px", marginLeft: "4px" }}>check</span>}
          </MenuItem>
          
          <MenuItem 
            onClick={() => handleGridSnapSizeChange(2)}
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              display: "flex",
              justifyContent: "space-between",
              backgroundColor: gridSnapSize === 2 ? "#3a3a3a" : "transparent"
            }}
            sx={{ 
              '&:hover': { 
                backgroundColor: '#525252 !important'
              }
            }}
          >
            <span>1/4 step</span>
            {gridSnapSize === 2 && <span className="material-symbols-outlined" style={{ fontSize: "11px", marginLeft: "4px" }}>check</span>}
          </MenuItem>
          
          <MenuItem 
            onClick={() => handleGridSnapSizeChange(3)}
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              display: "flex",
              justifyContent: "space-between",
              backgroundColor: gridSnapSize === 3 ? "#3a3a3a" : "transparent"
            }}
            sx={{ 
              '&:hover': { 
                backgroundColor: '#525252 !important'
              }
            }}
          >
            <span>1/3 step</span>
            {gridSnapSize === 3 && <span className="material-symbols-outlined" style={{ fontSize: "11px", marginLeft: "4px" }}>check</span>}
          </MenuItem>
          
          <MenuItem 
            onClick={() => handleGridSnapSizeChange(4)}
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              display: "flex",
              justifyContent: "space-between",
              backgroundColor: gridSnapSize === 4 ? "#3a3a3a" : "transparent"
            }}
            sx={{ 
              '&:hover': { 
                backgroundColor: '#525252 !important'
              }
            }}
          >
            <span>1/2 step</span>
            {gridSnapSize === 4 && <span className="material-symbols-outlined" style={{ fontSize: "11px", marginLeft: "4px" }}>check</span>}
          </MenuItem>
          
          <MenuItem 
            onClick={() => handleGridSnapSizeChange(5)}
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              display: "flex",
              justifyContent: "space-between",
              backgroundColor: gridSnapSize === 5 ? "#3a3a3a" : "transparent"
            }}
            sx={{ 
              '&:hover': { 
                backgroundColor: '#525252 !important'
              }
            }}
          >
            <span>Step</span>
            {gridSnapSize === 5 && <span className="material-symbols-outlined" style={{ fontSize: "11px", marginLeft: "4px" }}>check</span>}
          </MenuItem>
          
          {/* Divider for Beat section */}
          <div style={{ 
            height: "1px", 
            backgroundColor: "rgba(255,255,255,0.1)", 
            margin: "2px 4px",
            position: "relative" 
          }}>
            <span style={{ 
              position: "absolute", 
              right: "4px", 
              top: "-5px", 
              fontSize: "8px", 
              backgroundColor: DARK_THEME.headerBackground,
              padding: "0 2px", 
              color: "rgba(255,255,255,0.5)" 
            }}>
              BEAT
            </span>
          </div>
          
          <MenuItem 
            onClick={() => handleGridSnapSizeChange(6)}
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              display: "flex",
              justifyContent: "space-between",
              backgroundColor: gridSnapSize === 6 ? "#3a3a3a" : "transparent"
            }}
            sx={{ 
              '&:hover': { 
                backgroundColor: '#525252 !important'
              }
            }}
          >
            <span>1/6 beat</span>
            {gridSnapSize === 6 && <span className="material-symbols-outlined" style={{ fontSize: "11px", marginLeft: "4px" }}>check</span>}
          </MenuItem>
          
          <MenuItem 
            onClick={() => handleGridSnapSizeChange(7)}
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              display: "flex",
              justifyContent: "space-between",
              backgroundColor: gridSnapSize === 7 ? "#3a3a3a" : "transparent"
            }}
            sx={{ 
              '&:hover': { 
                backgroundColor: '#525252 !important'
              }
            }}
          >
            <span>1/4 beat</span>
            {gridSnapSize === 7 && <span className="material-symbols-outlined" style={{ fontSize: "11px", marginLeft: "4px" }}>check</span>}
          </MenuItem>
          
          <MenuItem 
            onClick={() => handleGridSnapSizeChange(8)}
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              display: "flex",
              justifyContent: "space-between",
              backgroundColor: gridSnapSize === 8 ? "#3a3a3a" : "transparent"
            }}
            sx={{ 
              '&:hover': { 
                backgroundColor: '#525252 !important'
              }
            }}
          >
            <span>1/3 beat</span>
            {gridSnapSize === 8 && <span className="material-symbols-outlined" style={{ fontSize: "11px", marginLeft: "4px" }}>check</span>}
          </MenuItem>
          
          <MenuItem 
            onClick={() => handleGridSnapSizeChange(9)}
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              display: "flex",
              justifyContent: "space-between",
              backgroundColor: gridSnapSize === 9 ? "#3a3a3a" : "transparent"
            }}
            sx={{ 
              '&:hover': { 
                backgroundColor: '#525252 !important'
              }
            }}
          >
            <span>1/2 beat</span>
            {gridSnapSize === 9 && <span className="material-symbols-outlined" style={{ fontSize: "11px", marginLeft: "4px" }}>check</span>}
          </MenuItem>
          
          <MenuItem 
            onClick={() => handleGridSnapSizeChange(10)}
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              display: "flex",
              justifyContent: "space-between",
              backgroundColor: gridSnapSize === 10 ? "#3a3a3a" : "transparent"
            }}
            sx={{ 
              '&:hover': { 
                backgroundColor: '#525252 !important'
              }
            }}
          >
            <span>Beat</span>
            {gridSnapSize === 10 && <span className="material-symbols-outlined" style={{ fontSize: "11px", marginLeft: "4px" }}>check</span>}
          </MenuItem>
          
          {/* Divider for Bar section */}
          <div style={{ 
            height: "1px", 
            backgroundColor: "rgba(255,255,255,0.1)", 
            margin: "2px 4px",
            position: "relative" 
          }}>
            <span style={{ 
              position: "absolute", 
              right: "4px", 
              top: "-5px", 
              fontSize: "8px", 
              backgroundColor: DARK_THEME.headerBackground,
              padding: "0 2px", 
              color: "rgba(255,255,255,0.5)" 
            }}>
              BAR
            </span>
          </div>
          
          <MenuItem 
            onClick={() => handleGridSnapSizeChange(11)}
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              display: "flex",
              justifyContent: "space-between",
              backgroundColor: gridSnapSize === 11 ? "#3a3a3a" : "transparent"
            }}
            sx={{ 
              '&:hover': { 
                backgroundColor: '#525252 !important'
              }
            }}
          >
            <span>Bar</span>
            {gridSnapSize === 11 && <span className="material-symbols-outlined" style={{ fontSize: "11px", marginLeft: "4px" }}>check</span>}
          </MenuItem>
        </Menu>

        {/* Main content container */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "calc(100% - 28px)",
          }}
        >
          {/* Content area */}
          <div
            style={{
              display: "flex",
              flex: 1,
              overflow: "hidden",
              position: "relative",
              height: "calc(100%)",
            }}
          >
            {/* Keyboard area on the left with vertical scrolling */}
            <PianoKeyboard
              totalKeys={totalKeys}
              keyHeight={keyHeight}
              contentHeight={contentHeight}
              onScroll={handleKeyboardScroll}
              scrollY={scrollY}
              keyboardWidth={keyboardWidth}
              ref={keyboardRef}
            />

            {/* Scrollable viewport with Konva canvas */}
            <div
              className="piano-scroll-container"
              style={{
                flex: 1,
                overflow: "auto", // Native scrolling for position tracking
                position: "relative",
              }}
              onScroll={handleScroll}
              ref={viewportRef}
            >
              {/* Scrollable content div for correct scrolling dimensions */}
              <div
                style={{
                  width: `${contentWidth}px`,
                  height: `${contentHeight}px`,
                  position: "relative",
                  background: DARK_THEME.gridBackground,
                }}
              >
                {/* Konva canvas container that stays fixed in viewport but shows portion of canvas */}
                <div
                  ref={canvasContainerRef}
                  style={{
                    position: "fixed",
                    width: `${contentAreaWidth}px`,
                    height: `${contentAreaHeight}px`,
                    overflow: "hidden",
                    pointerEvents: "none", // Let scroll events pass through to underlying scrollable div
                  }}
                >
                  <Stage 
                    width={dimensions.width - keyboardWidth} 
                    height={dimensions.height - 28 - 16} 
                    onMouseDown={handleStageMouseDown}
                    onMouseMove={(e) => {
                      // For eraser tool, always keep default cursor
                      if (selectedTool === 'eraser') {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                      }
                      
                      // Handle move events (for selection and eraser)
                      handleStageMouseMove(e);
                      
                      // Also handle hover events (for showing note name, preview, etc.)
                      // But skip cursor changes for eraser
                      if (selectedTool !== 'eraser' || e.evt.buttons !== 1) {
                        handleStageMouseHover(e);
                      }
                    }}
                    onMouseUp={handleStageMouseUp}
                    onMouseLeave={handleStageMouseLeave}
                    onMouseEnter={(e) => {
                      // For eraser tool, set cursor to default on enter
                      if (selectedTool === 'eraser') {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                      }
                    }}
                    style={{ pointerEvents: "auto" }}
                    onWheel={(e) => {
                      // Prevent default to avoid browser handling
                      e.evt.preventDefault();
                      
                      // Get the original wheel event
                      const wheelEvent = e.evt;
                      
                      // Get scrollable container
                      const scrollContainer = viewportRef.current;
                      
                      if (scrollContainer) {
                        // Calculate scroll delta - adjust multiplier for sensitivity
                        const deltaX = wheelEvent.deltaX;
                        const deltaY = wheelEvent.deltaY;
                        
                        // Apply scrolling to the container
                        simulateScroll(scrollContainer, deltaX, deltaY);
                      }
                    }}
                  >
                    {/* Grid layer - optimized for rendering only */}
                    <GridLayer
                      width={dimensions.width - keyboardWidth}
                      height={dimensions.height - 28 - 16}
                      gridSize={effectiveGridSize}
                      measureSize={measureSize}
                      scrollX={scrollX}
                      scrollY={scrollY}
                      snapOption={gridSnapSize}
                      keyHeight={keyHeight}
                      totalKeys={totalKeys}
                      scaleNotes={scaleNotes}
                    />

                    {/* Notes layer */}
                    <NotesLayer
                      notes={notes}
                      scrollX={scrollX}
                      scrollY={scrollY}
                      onNoteClick={handleNoteClick}
                      onNoteDragStart={handleNoteDragStart}
                      onNoteDragMove={handleNoteDragMove}
                      onNoteDragEnd={handleNoteDragEnd}
                      onNoteResizeStart={handleNoteResizeStart}
                      draggedNoteId={draggedNoteId}
                      resizingNoteId={resizingNoteId}
                      selectedNoteIds={selectedNoteIds}
                      keyHeight={keyHeight}
                      viewportWidth={dimensions.width - keyboardWidth}
                      viewportHeight={dimensions.height - 28 - 16}
                      gridSize={getSnapSizeInPixels(gridSnapSize)}
                      snapEnabled={gridSnapEnabled && gridSnapSize !== 0}
                      zoomLevel={zoomLevel}
                      selectedTool={selectedTool}
                    />

                    {/* Selection rectangle */}
                    {selectedTool === 'select' && (
                      <SelectionRectangle 
                        rect={selectionRect}
                        scrollX={scrollX}
                        scrollY={scrollY}
                      />
                    )}

                    {/* Note Preview */}
                    {hoverPosition && draggedNoteId === null && resizingNoteId === null && (
                      <NotePreview
                        position={hoverPosition}
                        scrollX={scrollX}
                        scrollY={scrollY}
                        keyHeight={keyHeight}
                        noteWidth={lastNoteWidth * zoomLevel}
                      />
                    )}

                    {/* Playhead layer */}
                    {/* <PlayheadLayer
                      position={playheadPosition}
                      height={dimensions.height - 36 - 16}
                      scrollX={scrollX}
                    /> */}
                  </Stage>
                </div>
              </div>
            </div>
            {/* Vertical scrollbar on the right */}
            <div
              className="scrollbar-track"
              ref={vScrollbarTrackRef}
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                width: "16px",
                height: `calc(100%)`,
                background: DARK_THEME.background,
                borderLeft: `1px solid ${DARK_THEME.border}`,
                cursor: "pointer",
              }}
              onClick={handleVScrollbarTrackClick}
            >
              <div
                style={{
                  position: "absolute",
                  left: "4px",
                  top: vScrollbarPosition,
                  width: "8px",
                  height: Math.min(
                    vScrollbarHeight,
                    contentAreaHeight - vScrollbarPosition
                  ),
                  background: "rgba(255,255,255,0.2)",
                  borderRadius: "4px",
                  cursor: "grab",
                  userSelect: "none",
                }}
                onMouseDown={handleVScrollbarThumbMouseDown}
              />
            </div>
          </div>

          {/* Integrated custom horizontal scrollbar */}
          <div
            className="scrollbar-track"
            ref={hScrollbarTrackRef}
            style={{
              position: "relative",
              marginLeft: keyboardWidth,
              width: `calc(100% - ${keyboardWidth}px - 16px)`, // Subtract vertical scrollbar width
              height: "16px",
              background: DARK_THEME.background,
              borderTop: `1px solid ${DARK_THEME.border}`,
              cursor: "pointer",
            }}
            onClick={handleHScrollbarTrackClick}
          >
            <div
              style={{
                position: "absolute",
                left: hScrollbarPosition,
                top: "4px",
                width: Math.min(
                  hScrollbarWidth,
                  contentAreaWidth - hScrollbarPosition
                ), // Ensure it doesn't extend past visible area
                height: "8px",
                background: "rgba(255,255,255,0.2)",
                borderRadius: "4px",
                cursor: "grab",
                userSelect: "none",
              }}
              onMouseDown={handleHScrollbarThumbMouseDown}
            />
          </div>
        </div>
      </Rnd>
    </>
  );
};

export default PianoRoll;


