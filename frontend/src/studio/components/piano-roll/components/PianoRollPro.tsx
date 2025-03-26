import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Line, Group, Text } from 'react-konva';
import { Box } from '@mui/material';
import { Note } from '../../../core/types/note';
import { usePianoRoll } from '../context/PianoRollContext';

interface PianoRollProProps {
  trackId: string;
}

// Constants for music representation
const TICKS_PER_BEAT = 480; // Standard MIDI resolution
const BEATS_PER_BAR = 4; // 4/4 time signature
const TICKS_PER_BAR = TICKS_PER_BEAT * BEATS_PER_BAR;
const INITIAL_BARS = 24; // Start with 24 bars
const PIXELS_PER_BEAT = 96; // 24px per 16th note at standard zoom
const BAR_EXPANSION_INCREMENT = 4; // Add 4 bars at a time when scrolling to edge

const PianoRollPro: React.FC<PianoRollProProps> = ({ trackId }) => {
  // Get notes and actions from context
  const { notesByTrack, createNote, moveNote, resizeNote, playPreview, stopPreview } = usePianoRoll();
  const notes = notesByTrack[trackId] || [];

  // References
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  
  // Fixed dimensions
  const keyWidth = 64; // Piano keys width
  const cellHeight = 20; // Note row height
  const headerHeight = 32; // Timeline header height
  
  // Piano roll range (C0 to B10 = 11 octaves = 132 notes)
  const totalNotes = 132;
  const totalHeight = totalNotes * cellHeight;
  const lowestNote = 0; // C0 (MIDI note 0)
  const highestNote = 131; // B10 (MIDI note 131)
  
  // Dynamic grid state
  const [bars, setBars] = useState(INITIAL_BARS);
  const [pixelsPerTick, setPixelsPerTick] = useState(PIXELS_PER_BEAT / TICKS_PER_BEAT);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  
  // Interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNote, setDraggedNote] = useState<number | null>(null);
  const [dragStartPosition, setDragStartPosition] = useState<{ ticks: number; row: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizingNote, setResizingNote] = useState<number | null>(null);
  const [resizeStartLength, setResizeStartLength] = useState<number | null>(null);
  const [resizeStartPosition, setResizeStartPosition] = useState<number | null>(null);
  const [resizeSide, setResizeSide] = useState<'left' | 'right' | null>(null);
  
  // Local notes state for immediate visual feedback
  const [localNotes, setLocalNotes] = useState<Note[]>([]);
  
  // Update local notes when context notes change
  useEffect(() => {
    setLocalNotes(notes);
  }, [notes]);
  
  // Calculate important grid dimensions
  const gridWidthTicks = bars * TICKS_PER_BAR;
  const gridWidthPx = gridWidthTicks * pixelsPerTick;
  const totalWidth = keyWidth + gridWidthPx;
  
  // Visible area calculations
  const visibleStartTicks = Math.floor(scrollPosition.x / pixelsPerTick);
  const visibleEndTicks = Math.floor((scrollPosition.x + dimensions.width - keyWidth) / pixelsPerTick);
  const visibleStartRow = Math.floor(scrollPosition.y / cellHeight);
  const visibleEndRow = Math.min(totalNotes - 1, Math.ceil((scrollPosition.y + dimensions.height - headerHeight) / cellHeight));
  
  // Pre-render buffer (render notes slightly outside visible area to prevent pop-in)
  const renderBufferTicks = TICKS_PER_BAR * 2; // 2 bars buffer on each side
  const renderBufferRows = 10; // 10 rows buffer on top and bottom
  
  // Calculate which notes to render (including buffer)
  const notesToRender = useMemo(() => {
    return localNotes.filter(note => {
      const noteTicks = note.column * (TICKS_PER_BEAT / 4); // Convert columns to ticks assuming 16th notes
      const noteEndTicks = noteTicks + (note.length * (TICKS_PER_BEAT / 4));
      
      return (
        noteEndTicks >= visibleStartTicks - renderBufferTicks &&
        noteTicks <= visibleEndTicks + renderBufferTicks &&
        note.row >= visibleStartRow - renderBufferRows &&
        note.row <= visibleEndRow + renderBufferRows
      );
    });
  }, [localNotes, visibleStartTicks, visibleEndTicks, visibleStartRow, visibleEndRow, renderBufferTicks, renderBufferRows]);
  
  // Convert between note formats
  const columnToTicks = (column: number) => column * (TICKS_PER_BEAT / 4); // Assuming 16th notes
  const ticksToColumn = (ticks: number) => Math.round(ticks / (TICKS_PER_BEAT / 4));
  
  // Helper for MIDI note display
  const getMidiNoteName = (midiNumber: number) => {
    // MIDI notes start at C-1 (MIDI 0), but we'll start our piano roll at C0 (MIDI 12)
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNumber / 12);  // MIDI octaves start at 0 for C0
    const noteIndex = midiNumber % 12;
    return noteNames[noteIndex] + octave;
  };
  
  // Check if a note is on a black key
  const isBlackKey = (midiNumber: number) => {
    const noteIndex = midiNumber % 12;
    return [1, 3, 6, 8, 10].includes(noteIndex);
  };
  
  // Calculate visible note row (0 = highest, totalNotes - 1 = lowest)
  const midiNoteToRow = (midiNumber: number) => totalNotes - 1 - midiNumber;
  const rowToMidiNote = (row: number) => totalNotes - 1 - row;
  
  // Handle container resize
  useEffect(() => {
    if (!containerRef.current) return;
    
    let resizeTimeoutId: number | null = null;
    
    const updateDimensions = () => {
      if (!containerRef.current) return;
      
      const { clientWidth, clientHeight } = containerRef.current;
      setDimensions({
        width: clientWidth,
        height: clientHeight
      });
    };
    
    // Initial setup
    updateDimensions();
    
    // Debounced resize handler
    const handleResize = () => {
      if (resizeTimeoutId !== null) {
        window.clearTimeout(resizeTimeoutId);
      }
      resizeTimeoutId = window.setTimeout(updateDimensions, 150);
    };
    
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);
    
    return () => {
      if (resizeTimeoutId !== null) {
        window.clearTimeout(resizeTimeoutId);
      }
      resizeObserver.disconnect();
    };
  }, []);
  
  // Handle scroll with controlled grid expansion
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollPosition({
      x: target.scrollLeft,
      y: target.scrollTop
    });
    
    // Don't expand grid during drag operations
    if (isDragging) return;
    
    // Check if we're near the right edge - expand if needed
    const { scrollLeft, scrollWidth, clientWidth } = target;
    const scrollRatio = (scrollLeft + clientWidth) / scrollWidth;
    
    // Simple fix: Only expand if we're in a reasonable range
    // This prevents expansion loops when scrollWidth gets very large
    if (scrollRatio > 0.85 && scrollLeft > 0 && bars < 100) {
      // Set a fixed number of bars rather than incrementing
      // This prevents potential loops from continuous scrolling
      const newBars = bars + BAR_EXPANSION_INCREMENT;
      setBars(newBars);
    }
  }, [isDragging, bars]);
  
  // Grid click to create new notes
  const handleGridClick = useCallback((e: any) => {
    if (isDragging || stageRef.current === null) return;
    
    const stage = stageRef.current;
    const pointerPosition = stage.getPointerPosition();
    
    // Ignore clicks on piano keys
    if (pointerPosition.x <= keyWidth) return;
    
    // Convert screen position to musical position
    const ticks = Math.floor((pointerPosition.x - keyWidth + scrollPosition.x) / pixelsPerTick);
    const row = Math.floor((pointerPosition.y - headerHeight + scrollPosition.y) / cellHeight);
    
    // Skip if outside valid range
    if (row < 0 || row >= totalNotes) return;
    
    // Convert to musical values
    const column = ticksToColumn(ticks);
    const midiNote = rowToMidiNote(row);
    
    // Check if there's already a note at this position
    const noteExists = localNotes.some(note => 
      note.row === midiNote && 
      Math.abs(columnToTicks(note.column) - ticks) < (TICKS_PER_BEAT / 4)
    );
    
    if (!noteExists) {
      // Create a new note (1 16th note long)
      const newNote: Note = {
        id: Date.now(),
        row: midiNote,
        column,
        length: 1, // 1 16th note
        velocity: 100,
        trackId
      };
      
      // Update local state for immediate feedback
      setLocalNotes(prev => [...prev, newNote]);
      
      // Create note through context
      createNote(trackId, newNote);
      
      // Play preview sound
      playPreview(midiNote);
      setTimeout(() => stopPreview(midiNote), 300);
    }
  }, [isDragging, scrollPosition, pixelsPerTick, localNotes, trackId, createNote, playPreview, stopPreview, ticksToColumn, rowToMidiNote, columnToTicks]);
  
  // Start note dragging
  const handleNoteDragStart = useCallback((e: any, noteId: number) => {
    e.evt.stopPropagation();
    const note = localNotes.find(n => n.id === noteId);
    if (!note) return;
    
    setIsDragging(true);
    setDraggedNote(noteId);
    setDragStartPosition({ 
      ticks: columnToTicks(note.column), 
      row: midiNoteToRow(note.row) 
    });
    
    // Calculate drag offset (where on the note we clicked)
    const rect = e.target.getClientRect();
    const pointerPos = stageRef.current.getPointerPosition();
    setDragOffset({
      x: pointerPos.x - rect.x,
      y: pointerPos.y - rect.y
    });
    
    // Play note for feedback
    playPreview(note.row);
  }, [localNotes, playPreview, columnToTicks, midiNoteToRow]);
  
  // Start note resizing
  const handleResizeStart = useCallback((e: any, noteId: number, side: 'left' | 'right') => {
    e.evt.stopPropagation();
    const note = localNotes.find(n => n.id === noteId);
    if (!note) return;
    
    setResizingNote(noteId);
    setResizeSide(side);
    setResizeStartLength(note.length);
    setResizeStartPosition(note.column);
    setIsDragging(true);
  }, [localNotes]);
  
  // Handle mouse movement for dragging and resizing with performance optimizations
  const handleMouseMove = useCallback((e: any) => {
    if (!stageRef.current) return;
    
    // Use requestAnimationFrame for smoother rendering
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(() => {
        updateNotePosition(e);
      });
    } else {
      updateNotePosition(e);
    }
  }, [resizingNote, draggedNote]);
  
  // Separated the update logic for better performance
  const updateNotePosition = (e: any) => {
    if (!stageRef.current) return;
    
    const stage = stageRef.current;
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    
    if (resizingNote !== null) {
      // Handle note resizing
      const note = localNotes.find(n => n.id === resizingNote);
      if (!note) return;
      
      // Calculate position in ticks
      const mouseTicks = Math.floor((pointerPos.x - keyWidth - stage.x()) / pixelsPerTick) + scrollPosition.x / pixelsPerTick;
      const noteStartTicks = columnToTicks(note.column);
      const noteEndTicks = noteStartTicks + columnToTicks(note.length);
      
      // Snap to nearest 16th note grid
      const snapTicks = TICKS_PER_BEAT / 4;
      const snappedMouseTicks = Math.round(mouseTicks / snapTicks) * snapTicks;
      
      if (resizeSide === 'right') {
        // Resize from right (change length)
        const newLengthTicks = Math.max(snapTicks, snappedMouseTicks - noteStartTicks);
        const newLength = ticksToColumn(newLengthTicks);
        
        // Only update if changed
        const currentNote = localNotes.find(n => n.id === resizingNote);
        if (currentNote && currentNote.length !== newLength) {
          // Update local notes state for immediate feedback
          setLocalNotes(prev => prev.map(n => 
            n.id === resizingNote 
              ? { ...n, length: newLength }
              : n
          ));
        }
      } else {
        // Resize from left (change start position and length)
        const newStartTicks = Math.min(snappedMouseTicks, noteEndTicks - snapTicks);
        const newStart = ticksToColumn(newStartTicks);
        const newLength = ticksToColumn(noteEndTicks - newStartTicks);
        
        // Only update if changed
        const currentNote = localNotes.find(n => n.id === resizingNote);
        if (currentNote && (currentNote.column !== newStart || currentNote.length !== newLength)) {
          // Update local notes state for immediate feedback
          setLocalNotes(prev => prev.map(n => 
            n.id === resizingNote 
              ? { ...n, column: newStart, length: newLength }
              : n
          ));
        }
      }
    } else if (draggedNote !== null) {
      // Handle note dragging
      const note = localNotes.find(n => n.id === draggedNote);
      if (!note) return;
      
      // Calculate mouse position (accounting for scroll and offset)
      const mouseTicks = Math.floor((pointerPos.x - keyWidth - dragOffset.x) / pixelsPerTick) + scrollPosition.x / pixelsPerTick;
      const mouseRow = Math.floor((pointerPos.y - headerHeight - dragOffset.y + scrollPosition.y) / cellHeight);
      
      // Snap to grid
      const snapTicks = TICKS_PER_BEAT / 4; // 16th note grid
      const snappedTicks = Math.round(mouseTicks / snapTicks) * snapTicks;
      
      // Clamp to valid range
      const clampedTicks = Math.max(0, Math.min(snappedTicks, gridWidthTicks - columnToTicks(note.length)));
      const clampedRow = Math.max(0, Math.min(mouseRow, totalNotes - 1));
      
      // Convert to note properties
      const newColumn = ticksToColumn(clampedTicks);
      const newMidiNote = rowToMidiNote(clampedRow);
      
      // Update notes if position changed
      if (newColumn !== note.column || newMidiNote !== note.row) {
        // Update audio preview if row changed
        if (newMidiNote !== note.row) {
          stopPreview(note.row);
          playPreview(newMidiNote);
        }
        
        // Update note position
        setLocalNotes(prev => prev.map(n =>
          n.id === draggedNote
            ? { ...n, column: newColumn, row: newMidiNote }
            : n
        ));
      }
    }
  };
  
  // Handle mouse up - finalize drag or resize operation
  const handleMouseUp = useCallback(async () => {
    if (draggedNote !== null && dragStartPosition) {
      // Finalize note drag
      const note = localNotes.find(n => n.id === draggedNote);
      if (note) {
        // Stop the preview sound
        stopPreview(note.row);
        
        // Only add to history if position actually changed
        const originalTicks = dragStartPosition.ticks;
        const originalRow = rowToMidiNote(dragStartPosition.row);
        const currentTicks = columnToTicks(note.column);
        
        if (currentTicks !== originalTicks || note.row !== originalRow) {
          await moveNote(
            trackId,
            draggedNote,
            { x: ticksToColumn(originalTicks), y: originalRow },
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
        const positionChanged = resizeSide === 'left' && resizeStartPosition !== null && note.column !== resizeStartPosition;
        
        if (lengthChanged || positionChanged) {
          await resizeNote(
            trackId,
            resizingNote,
            resizeStartLength,
            note.length,
            resizeSide === 'left' ? resizeStartPosition : undefined,
            resizeSide === 'left' ? note.column : undefined
          );
        }
      }
    }
    
    // Reset interaction state
    setDraggedNote(null);
    setDragStartPosition(null);
    setResizingNote(null);
    setResizeStartLength(null);
    setResizeStartPosition(null);
    setResizeSide(null);
    setTimeout(() => {
      setIsDragging(false);
    }, 10);
  }, [draggedNote, dragStartPosition, resizingNote, resizeStartLength, resizeStartPosition, resizeSide, localNotes, trackId, moveNote, resizeNote, stopPreview, columnToTicks, ticksToColumn, rowToMidiNote]);
  
  // Draw the timeline header with bar/beat markers
  const renderTimelineHeader = useCallback(() => {
    const barMarkers = [];
    const beatMarkers = [];
    
    // Draw bar markers (strong lines with numbers)
    for (let bar = 0; bar <= bars; bar++) {
      const xPos = bar * TICKS_PER_BAR * pixelsPerTick;
      
      barMarkers.push(
        <Group key={`bar-${bar}`}>
          <Line
            points={[keyWidth + xPos, 0, keyWidth + xPos, headerHeight]}
            stroke="rgba(200, 200, 200, 0.8)"
            strokeWidth={2}
          />
          <Text
            x={keyWidth + xPos + 5}
            y={5}
            text={`${bar + 1}`}
            fontSize={12}
            fill="#ddd"
          />
        </Group>
      );
      
      // Draw beat markers (lighter lines)
      if (bar < bars) {
        for (let beat = 1; beat < BEATS_PER_BAR; beat++) {
          const beatX = (bar * TICKS_PER_BAR + beat * TICKS_PER_BEAT) * pixelsPerTick;
          
          beatMarkers.push(
            <Line
              key={`beat-${bar}-${beat}`}
              points={[keyWidth + beatX, headerHeight / 2, keyWidth + beatX, headerHeight]}
              stroke="rgba(150, 150, 150, 0.6)"
              strokeWidth={1}
            />
          );
        }
      }
    }
    
    return (
      <Layer>
        {/* Header background */}
        <Rect
          x={0}
          y={0}
          width={totalWidth}
          height={headerHeight}
          fill="#222"
          stroke="#444"
          strokeWidth={1}
        />
        
        {/* Corner block */}
        <Rect
          x={0}
          y={0}
          width={keyWidth}
          height={headerHeight}
          fill="#1a1a1a"
        />
        
        {/* Bar and beat markers */}
        {barMarkers}
        {beatMarkers}
      </Layer>
    );
  }, [bars, pixelsPerTick, totalWidth]);
  
  // Render the piano keys
  const renderPianoKeys = useCallback(() => {
    const keys = [];
    
    for (let i = 0; i < totalNotes; i++) {
      const midiNote = rowToMidiNote(i);
      const isBlack = isBlackKey(midiNote);
      const noteName = getMidiNoteName(midiNote);
      const showLabel = noteName.endsWith('4') || noteName.includes('C'); // Show C notes and middle octave
      
      keys.push(
        <Group key={`key-${i}`}>
          <Rect
            x={0}
            y={headerHeight + i * cellHeight}
            width={keyWidth}
            height={cellHeight}
            fill={isBlack ? '#222' : '#333'}
            stroke="#444"
            strokeWidth={1}
            onClick={() => playPreview(midiNote)}
            onMouseDown={() => playPreview(midiNote)}
            onMouseUp={() => stopPreview(midiNote)}
          />
          {showLabel && (
            <Text
              x={5}
              y={headerHeight + i * cellHeight + 5}
              text={noteName}
              fontSize={10}
              fill="#aaa"
            />
          )}
        </Group>
      );
    }
    
    return (
      <Layer>
        {keys}
      </Layer>
    );
  }, [totalNotes, cellHeight, headerHeight, rowToMidiNote, playPreview, stopPreview]);
  
  // Render the grid background with optimizations
  const renderGridBackground = useCallback(() => {
    // Calculate visible range for optimization
    const visibleStartBar = Math.floor(scrollPosition.x / (TICKS_PER_BAR * pixelsPerTick));
    const visibleEndBar = visibleStartBar + Math.ceil(dimensions.width / (TICKS_PER_BAR * pixelsPerTick)) + 1;
    
    const visibleStartRow = Math.floor(scrollPosition.y / cellHeight);
    const visibleEndRow = visibleStartRow + Math.ceil(dimensions.height / cellHeight) + 1;
    
    // Buffer for smoother scrolling
    const barBuffer = 2;
    const rowBuffer = 10;
    
    // Calculate range with buffer
    const renderStartBar = Math.max(0, visibleStartBar - barBuffer);
    const renderEndBar = Math.min(bars, visibleEndBar + barBuffer);
    
    const renderStartRow = Math.max(0, visibleStartRow - rowBuffer);
    const renderEndRow = Math.min(totalNotes, visibleEndRow + rowBuffer);
    
    // Prepare arrays for rendering
    const barLines = [];
    const beatLines = [];
    const rowElements = [];
    
    // Generate vertical bar lines (only visible ones)
    for (let bar = renderStartBar; bar <= renderEndBar; bar++) {
      const xPos = keyWidth + (bar * TICKS_PER_BAR * pixelsPerTick);
      
      barLines.push(
        <Line
          key={`bar-line-${bar}`}
          points={[xPos, headerHeight, xPos, headerHeight + totalHeight]}
          stroke="rgba(100, 100, 100, 0.8)"
          strokeWidth={1}
          perfectDrawEnabled={true}
          listening={false}
        />
      );
      
      // Add beat lines for this bar (1/4 notes)
      if (bar < bars) {
        for (let beat = 1; beat < BEATS_PER_BAR; beat++) {
          const beatX = keyWidth + ((bar * TICKS_PER_BAR) + (beat * TICKS_PER_BEAT)) * pixelsPerTick;
          
          beatLines.push(
            <Line
              key={`beat-line-${bar}-${beat}`}
              points={[beatX, headerHeight, beatX, headerHeight + totalHeight]}
              stroke="rgba(70, 70, 70, 0.6)"
              strokeWidth={1}
              perfectDrawEnabled={true}
              listening={false}
            />
          );
        }
      }
    }
    
    // Generate horizontal row elements (only visible ones)
    for (let i = renderStartRow; i <= renderEndRow; i++) {
      if (i >= totalNotes) continue;
      
      const midiNote = rowToMidiNote(i);
      const isBlack = isBlackKey(midiNote);
      const noteName = getMidiNoteName(midiNote);
      const isC = noteName.charAt(0) === 'C';
      const yPos = headerHeight + i * cellHeight;
      
      rowElements.push(
        <Group key={`row-${i}`} listening={false}>
          {/* Background for black keys */}
          {isBlack && (
            <Rect
              x={keyWidth}
              y={yPos}
              width={gridWidthPx}
              height={cellHeight}
              fill="rgba(0, 0, 0, 0.2)"
              listening={false}
              perfectDrawEnabled={true}
            />
          )}
          
          {/* Horizontal grid line */}
          <Line
            points={[keyWidth, yPos, keyWidth + gridWidthPx, yPos]}
            stroke={isC ? "rgba(100, 100, 100, 0.8)" : "rgba(50, 50, 50, 0.5)"}
            strokeWidth={isC ? 1 : 0.5}
            listening={false}
            perfectDrawEnabled={true}
          />
        </Group>
      );
    }
    
    return (
      <Layer>
        {/* Grid background */}
        <Rect
          x={keyWidth}
          y={headerHeight}
          width={gridWidthPx}
          height={totalHeight}
          fill="#181818"
          perfectDrawEnabled={true}
        />
        
        {/* Render only visible elements */}
        {barLines}
        {beatLines}
        {rowElements}
      </Layer>
    );
  }, [bars, gridWidthPx, totalHeight, pixelsPerTick, headerHeight, cellHeight, rowToMidiNote, scrollPosition, dimensions, isBlackKey]);
  
  // Optimized note rendering for better performance
  const renderNotes = useCallback(() => {
    // Memoize frequently needed values
    const draggedId = draggedNote;
    const resizingId = resizingNote;
    
    return (
      <Layer>
        {notesToRender.map(note => {
          const row = midiNoteToRow(note.row);
          const x = columnToTicks(note.column) * pixelsPerTick;
          const width = columnToTicks(note.length) * pixelsPerTick;
          
          // Check if this note is being manipulated
          const isCurrentlyDragged = draggedId === note.id;
          const isCurrentlyResized = resizingId === note.id;
          const isManipulated = isCurrentlyDragged || isCurrentlyResized;
          
          return (
            <Group 
              key={`note-${note.id}`}
              x={keyWidth + x}
              y={headerHeight + row * cellHeight}
              opacity={isManipulated ? 0.7 : 1}
              onMouseDown={(e) => handleNoteDragStart(e, note.id)}
              perfectDrawEnabled={true}
            >
              {/* Main note rectangle - optimized for performance */}
              <Rect
                width={Math.max(1, width - 1)}
                height={cellHeight - 1}
                fill="#2196f3"
                cornerRadius={3}
                shadowColor={isManipulated ? "rgba(0,0,0,0.3)" : undefined}
                shadowBlur={isManipulated ? 5 : 0}
                perfectDrawEnabled={true}
                onClick={(e) => {
                  e.evt.stopPropagation();
                  playPreview(note.row);
                  setTimeout(() => stopPreview(note.row), 300);
                }}
              />
              
              {/* Left resize handle - only show if not dragging */}
              <Rect
                x={0}
                y={0}
                width={7}
                height={cellHeight - 1}
                fill="rgba(0,0,0,0.3)"
                opacity={0.5}
                perfectDrawEnabled={false} // Less important visual element
                onMouseDown={(e) => handleResizeStart(e, note.id, 'left')}
                onMouseEnter={(e) => {
                  document.body.style.cursor = 'ew-resize';
                  e.target.opacity(1);
                }}
                onMouseLeave={(e) => {
                  document.body.style.cursor = 'default';
                  e.target.opacity(0.5);
                }}
              />
              
              {/* Right resize handle - only show if not dragging */}
              <Rect
                x={Math.max(1, width - 8)}
                y={0}
                width={7}
                height={cellHeight - 1}
                fill="rgba(0,0,0,0.3)"
                opacity={0.5}
                perfectDrawEnabled={false} // Less important visual element
                onMouseDown={(e) => handleResizeStart(e, note.id, 'right')}
                onMouseEnter={(e) => {
                  document.body.style.cursor = 'ew-resize';
                  e.target.opacity(1);
                }}
                onMouseLeave={(e) => {
                  document.body.style.cursor = 'default';
                  e.target.opacity(0.5);
                }}
              />
            </Group>
          );
        })}
      </Layer>
    );
  }, [
    notesToRender, 
    keyWidth,
    pixelsPerTick, 
    draggedNote, 
    resizingNote, 
    headerHeight, 
    cellHeight, 
    columnToTicks, 
    midiNoteToRow, 
    playPreview, 
    stopPreview, 
    handleNoteDragStart, 
    handleResizeStart
  ]);
  
  // Main container with scrolling
  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: '#111',
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
      <Stage
        ref={stageRef}
        width={totalWidth}
        height={headerHeight + totalHeight}
        onClick={handleGridClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Timeline header */}
        {renderTimelineHeader()}
        
        {/* Grid background */}
        {renderGridBackground()}
        
        {/* Piano keys */}
        {renderPianoKeys()}
        
        {/* Vertical divider between piano keys and grid */}
        <Layer>
          <Line
            points={[keyWidth, 0, keyWidth, headerHeight + totalHeight]}
            stroke="rgba(150, 150, 150, 0.8)"
            strokeWidth={2}
          />
        </Layer>
        
        {/* Notes */}
        {renderNotes()}
      </Stage>
    </Box>
  );
};

export default PianoRollPro;