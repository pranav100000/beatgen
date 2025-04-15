// // If this file doesn't exist, we'll create a modified version of the NoteWithDrag component
// // that includes the data-note-id attribute on the note rectangles.

// import React, { useState, useRef, useCallback, useMemo } from "react";
// import { Rect } from "react-konva";
// import Konva from "konva";

// // Define the props for the NoteWithDrag component
// interface NoteWithDragProps {
//   note: {
//     id: number;
//     start: number;
//     top: number;
//     width: number;
//     color: string;
//   };
//   scrollX: number;
//   scrollY: number;
//   keyHeight: number;
//   onDragStart: (id: number, e: Konva.KonvaEventObject<MouseEvent>) => void;
//   onDragMove: (id: number, e: Konva.KonvaEventObject<MouseEvent>) => void;
//   onDragEnd: (id: number) => void;
//   onClick: (id: number) => void;
//   onResizeStart: (id: number, direction: 'left' | 'right', e: Konva.KonvaEventObject<MouseEvent>) => void;
//   isDragged: boolean;
//   isResizing: boolean;
//   isSelected: boolean;
//   gridSize: number;
//   snapEnabled: boolean;
//   zoomLevel: number;
//   selectedTool: 'select' | 'pen' | 'highlighter' | 'eraser';
//   isGhost?: boolean;
//   draggedNoteId?: number | null;
//   dragOffset?: {x: number, y: number} | null;
//   noteColor?: string;
// }

// // The NoteWithDrag component
// const NoteWithDrag: React.FC<NoteWithDragProps> = ({ 
//   note, 
//   scrollX, 
//   scrollY, 
//   keyHeight, 
//   onDragStart, 
//   onDragMove, 
//   onDragEnd, 
//   onClick,
//   onResizeStart,
//   isDragged,
//   isResizing,
//   isSelected,
//   gridSize,
//   snapEnabled,
//   zoomLevel,
//   selectedTool,
//   isGhost = false,
//   draggedNoteId = null,
//   dragOffset = null,
//   noteColor
// }) => {
//   // Reference to the Konva rectangle
//   const rectRef = useRef<Konva.Rect>(null);
  
//   // Store the mouse offset from the note's top-left corner
//   const mouseOffsetRef = useRef({ x: 0, y: 0 });
  
//   // State for tracking edge hover
//   const [hoveredEdge, setHoveredEdge] = useState<'left' | 'right' | null>(null);
  
//   // Edge detection threshold
//   const EDGE_THRESHOLD = 10; // pixels
  
//   // Calculate the visual position for the note with memoization
//   const calcPosition = useMemo(() => {
//     // If this is a ghost note, return base position
//     if (isGhost) {
//       return {
//         x: note.start - scrollX + 1,
//         y: note.top - scrollY + 1
//       };
//     }
    
//     // If the note is selected and another note is being dragged
//     if (isSelected && draggedNoteId !== null && draggedNoteId !== note.id && dragOffset) {
//       // Apply the same drag offset to this note for real-time updates
//       return {
//         x: note.start - scrollX + dragOffset.x + 1,
//         y: note.top - scrollY + dragOffset.y + 1
//       };
//     }
    
//     // Default position
//     return {
//       x: note.start - scrollX + 1,
//       y: note.top - scrollY + 1
//     };
//   }, [note.start, note.top, scrollX, scrollY, isGhost, isSelected, draggedNoteId, dragOffset]);
  
//   // Check if mouse is near an edge
//   const checkEdgeHover = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
//     // If eraser tool is selected, don't show edge hover effects
//     if (selectedTool === 'eraser' || isGhost) {
//       setHoveredEdge(null);
//       return;
//     }
    
//     const stage = e.target.getStage();
//     if (!stage) return;
    
//     const mousePos = stage.getPointerPosition();
//     if (!mousePos) return;
    
//     const noteX = note.start - scrollX;
//     const noteRight = noteX + note.width;
    
//     // Check if near left edge
//     if (Math.abs(mousePos.x - noteX) < EDGE_THRESHOLD) {
//       setHoveredEdge('left');
//       stage.container().style.cursor = 'ew-resize';
//       return;
//     }
    
//     // Check if near right edge
//     if (Math.abs(mousePos.x - noteRight) < EDGE_THRESHOLD) {
//       setHoveredEdge('right');
//       stage.container().style.cursor = 'ew-resize';
//       return;
//     }
    
//     // Not near any edge
//     setHoveredEdge(null);
//     // Only set cursor to move if not using eraser
//     stage.container().style.cursor = 'move';
//   }, [note.start, scrollX, note.width, selectedTool, isGhost, EDGE_THRESHOLD, setHoveredEdge]);
  
//   // Determine the fill color based on selection state
//   const getFillColor = useMemo(() => {
//     // Use provided noteColor if available, otherwise fallback to note's color property
//     const baseColor = noteColor || note.color;
    
//     if (isSelected) {
//       // For selected notes, just use the base color
//       // The selection state is shown by stroke instead
//       return baseColor;
//     }
    
//     return baseColor;
//   }, [noteColor, note.color, isSelected]);
  
//   // Position is now directly from the memo
  
//   // Set opacity based on state with memoization
//   const opacity = useMemo(() => isGhost ? 0.6 : (isDragged || isResizing) ? 0.7 : 1, [isGhost, isDragged, isResizing]);
  
//   return (
//     <Rect
//       ref={rectRef}
//       key={`note-${note.id}${isGhost ? '-ghost' : ''}`}
//       x={calcPosition.x}
//       y={calcPosition.y}
//       width={note.width - 2}
//       height={keyHeight - 2} // Leave a small gap between rows
//       fill={getFillColor}
//       cornerRadius={3}
//       opacity={opacity}
//       stroke={(isDragged || isResizing || isSelected) ? "#fff" : undefined}
//       strokeWidth={(isDragged || isResizing) ? 1 : (isSelected ? 2 : 0)}
//       shadowEnabled={isSelected}
//       shadowColor="rgba(255, 255, 255, 0.3)"
//       shadowBlur={4}
//       shadowOffset={{ x: 0, y: 0 }}
//       shadowOpacity={0.5}
//       draggable={!isGhost && selectedTool !== 'eraser' && hoveredEdge === null} // Ghost notes aren't draggable
//       listening={!isGhost} // Ghost notes shouldn't listen for events
//       // Add data attribute for DOM manipulation
//       data-note-id={note.id}
//       onDragStart={(e) => {
//         if (hoveredEdge !== null || selectedTool === 'eraser') return; // Don't start drag if on resize edge or using eraser
        
//         e.cancelBubble = true; // Prevent event bubbling
        
//         // Get stage and mouse position
//         const stage = e.target.getStage();
//         if (!stage) return;
        
//         const mousePos = stage.getPointerPosition();
//         if (!mousePos) return;
        
//         // Calculate the offset between mouse position and note's top-left corner on screen
//         // This records exactly where on the note the user clicked
//         const noteScreenX = note.start - scrollX;
//         const noteScreenY = note.top - scrollY;
        
//         mouseOffsetRef.current = {
//           x: mousePos.x - noteScreenX,
//           y: mousePos.y - noteScreenY
//         };
        
//         onDragStart(note.id, e);
//       }}
//       onDragMove={(e) => {
//         e.cancelBubble = true; // Prevent event bubbling
//         onDragMove(note.id, e);
//       }}
//       onDragEnd={() => {
//         onDragEnd(note.id);
//       }}
//       onClick={(e) => {
//         if (isGhost) return; // Ghost notes don't respond to clicks
        
//         e.cancelBubble = true; // Prevent event bubbling
        
//         // Removed debugging console.log
        
//         // Don't trigger clicks during or right after resizing
//         if (isResizing) {
//           // Ignoring click during resize
//           return;
//         }
        
//         if (selectedTool === 'eraser') {
//           // If eraser tool is active, delete the note
//           onClick(note.id);
//           return;
//         }
        
//         // Don't trigger click if resizing
//         if (hoveredEdge !== null) {
//           onResizeStart(note.id, hoveredEdge, e);
//           return;
//         }
        
//         onClick(note.id);
//       }}
//       onMouseDown={(e) => {
//         if (isGhost) return; // Ghost notes don't respond to mouse events
        
//         e.cancelBubble = true; // Prevent event bubbling to background
        
//         // For eraser tool, trigger onClick immediately on mousedown
//         if (selectedTool === 'eraser') {
//           onClick(note.id);
//           return;
//         }
        
//         // Handle resize start if on edge
//         if (hoveredEdge !== null) {
//           onResizeStart(note.id, hoveredEdge, e);
//           return;
//         }
//       }}
//       onMouseMove={(e) => {
//         if (isGhost) return; // Ghost notes don't respond to mouse events
        
//         // If using eraser tool with mouse button pressed, delete the note
//         if (selectedTool === 'eraser' && e.evt.buttons === 1) {
//           onClick(note.id);
//           return;
//         }
        
//         checkEdgeHover(e);
//       }}
//       onMouseEnter={(e) => {
//         if (isGhost) return; // Ghost notes don't respond to mouse events
        
//         // If using eraser tool with mouse button pressed, delete the note
//         if (selectedTool === 'eraser') {
//           if (e.evt.buttons === 1) {
//             onClick(note.id);
//           }
          
//           const stage = e.target.getStage();
//           if (stage) stage.container().style.cursor = 'default';
//           return;
//         }
        
//         checkEdgeHover(e);
//       }}
//       onMouseLeave={(e) => {
//         if (isGhost) return; // Ghost notes don't respond to mouse events
        
//         setHoveredEdge(null);
//         const stage = e.target.getStage();
//         if (stage) {
//           // If using eraser, keep default cursor
//           if (selectedTool === 'eraser') {
//             stage.container().style.cursor = 'default';
//           } else {
//             stage.container().style.cursor = 'default';
//           }
//         }
//       }}
//     />
//   );
// };

// export default React.memo(NoteWithDrag, (prevProps, nextProps) => {
//   // Only re-render if these properties change
//   return (
//     prevProps.note.id === nextProps.note.id &&
//     prevProps.note.start === nextProps.note.start &&
//     prevProps.note.top === nextProps.note.top &&
//     prevProps.note.width === nextProps.note.width &&
//     prevProps.note.color === nextProps.note.color &&
//     prevProps.scrollX === nextProps.scrollX &&
//     prevProps.scrollY === nextProps.scrollY &&
//     prevProps.keyHeight === nextProps.keyHeight &&
//     prevProps.isDragged === nextProps.isDragged &&
//     prevProps.isResizing === nextProps.isResizing &&
//     prevProps.isSelected === nextProps.isSelected &&
//     prevProps.isGhost === nextProps.isGhost &&
//     prevProps.draggedNoteId === nextProps.draggedNoteId &&
//     prevProps.selectedTool === nextProps.selectedTool &&
//     JSON.stringify(prevProps.dragOffset) === JSON.stringify(nextProps.dragOffset)
//   );
// }); 