import React from 'react';
import { Box } from '@mui/material';
import { Note } from '../../../core/types/note';

interface NoteRendererProps {
  notes: Note[];
  cellWidth: number;
  cellHeight: number;
  actualRowToDisplayRow: (actualRow: number) => number;
  onNoteDragStart: (e: React.MouseEvent, noteId: number) => void;
  onResizeStart: (e: React.MouseEvent, noteId: number, side: 'left' | 'right') => void;
  draggedNote: number | null;
  resizingNote: number | null;
}

const NoteRenderer: React.FC<NoteRendererProps> = ({
  notes,
  cellWidth,
  cellHeight,
  actualRowToDisplayRow,
  onNoteDragStart,
  onResizeStart,
  draggedNote,
  resizingNote
}) => {
  // Handle note drag start and stop events from bubbling
  const handleNoteDragStart = (e: React.MouseEvent, noteId: number) => {
    e.stopPropagation();
    e.preventDefault();
    console.log(`NoteRenderer: Starting drag on note ${noteId}`);
    onNoteDragStart(e, noteId);
  };

  // Handle resize start and stop events from bubbling
  const handleResizeStart = (e: React.MouseEvent, noteId: number, side: 'left' | 'right') => {
    e.stopPropagation();
    e.preventDefault();
    console.log(`NoteRenderer: Starting resize on note ${noteId}, side: ${side}`);
    onResizeStart(e, noteId, side);
  };

  return (
    <Box 
      sx={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2,
        pointerEvents: 'none' // This allows clicks to pass through if not on a note
      }}
    >
      {notes.map((note) => (
        <Box
          key={note.id}
          className="note-element"
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
            zIndex: 2,
            pointerEvents: 'auto' // Enable pointer events for notes
          }}
          onMouseDown={(e) => handleNoteDragStart(e, note.id)}
        >
          <Box 
            className="resize-handle note-element"
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
            className="resize-handle note-element"
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
  );
};

export default NoteRenderer;