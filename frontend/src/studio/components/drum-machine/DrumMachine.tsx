import React, { useState, useEffect, useRef, useCallback, JSX, useMemo } from 'react';
import { Rnd } from 'react-rnd';
import CloseIcon from '@mui/icons-material/Close';
import { IconButton, Tooltip, Box, CircularProgress } from '@mui/material';
import { usePianoRollStore } from '../../stores/usePianoRollStore';
import { MUSIC_CONSTANTS } from '../../constants/musicConstants';
import { CombinedTrack, DrumTrackRead, SamplerTrackRead, RootState } from '../../stores/types';
import { DrumMachineModal, DrumMachineModalProps } from '../modals/drum-machine/DrumMachineModal';
import { DrumSamplePublicRead } from 'src/platform/types/public_models/drum_samples';

export interface DrumTrackState extends CombinedTrack {
  type: 'drum';
  drumPattern?: boolean[][];
  samplerTrackIds?: string[];
}
// Define theme colors to match PianoRoll
const DARK_THEME = {
  background: "#252525",
  headerBackground: "#222222",
  headerText: "#ffffff",
  border: "#444444",
  gridBackground: "#2a2a2a",
  cellInactive: "#4A5568",
  accentBlue: "#63B3ED",
  accentYellow: "#F6E05E",
  textGray: "#A0AEC0",
};

// Define our note state interface (normalized values independent of zoom) - aligned with PianoRoll's NoteState
export interface NoteState {
  id: number;
  length: number;  // Length in ticks (1/960th of a beat)
  row: number;     // Row index (0-131 for our 132 keys)
  column: number;  // Column position in ticks (1/960th of a beat)
  velocity?: number;
}

// DrumLabel component for displaying drum names
interface DrumLabelProps {
  name: string;
  isSelected: boolean;
  cellSize: number;
  onClick: () => void;
  onDelete: () => void;
  onOpenPianoRoll: () => void;
}

const DrumLabel: React.FC<DrumLabelProps> = ({ 
  name, 
  isSelected, 
  cellSize, 
  onClick,
  onDelete,
  onOpenPianoRoll
}) => {
  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: '10px',
    paddingLeft: '5px',
    color: isSelected ? DARK_THEME.accentYellow : DARK_THEME.textGray,
    fontSize: '12px',
    fontWeight: isSelected ? 'bold' : 'normal',
    cursor: 'pointer',
    height: `${cellSize}px`,
    backgroundColor: DARK_THEME.background,
    border: `1px solid ${DARK_THEME.border}`,
    borderRadius: '4px',
    marginRight: '2px',
    width: 150,
    boxSizing: 'border-box',
  };

  const deleteButtonStyle: React.CSSProperties = {
    color: '#FC8181',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginRight: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    transition: 'all 0.2s ease'
  };

  const pianoIconStyle: React.CSSProperties = {
    color: DARK_THEME.accentBlue,
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    borderRadius: '3px',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    transition: 'all 0.2s ease',
    marginRight: '8px'
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  const handlePianoRollClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenPianoRoll();
  };

  return (
    <div
      style={labelStyle}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div 
          style={deleteButtonStyle}
          onClick={handleDeleteClick}
        >
          ×
        </div>
        <div 
          style={pianoIconStyle}
          onClick={handlePianoRollClick}
          title="Open Piano Roll"
        >
          ♫
        </div>
      </div>
      <span>{name}</span>
    </div>
  );
};

// Individual cell component
interface CellProps {
  active: boolean;
  rowIndex: number;
  colIndex: number;
  cellSize: number;
  onClick: () => void;
}

const Cell: React.FC<CellProps> = ({
  active,
  rowIndex,
  colIndex,
  cellSize,
  onClick
}) => {
  const colors = [
    '#F56565', '#ED8936', '#ECC94B', '#48BB78', 
    '#38B2AC', '#4299E1', '#667EEA', '#9F7AEA',
    '#ED64A6', '#F56565', '#ED8936', '#ECC94B', 
    '#48BB78', '#38B2AC', '#4299E1', '#667EEA'
  ];

  // Function to lighten a color by mixing it with white
  const lightenColor = (color: string, amount: number = 0.5): string => {
    // Parse the hex color to RGB
    const r = parseInt(color.substring(1, 3), 16);
    const g = parseInt(color.substring(3, 5), 16);
    const b = parseInt(color.substring(5, 7), 16);
    
    // Mix with white by the amount (0 = original color, 1 = white)
    const newR = Math.round(r + (255 - r) * amount);
    const newG = Math.round(g + (255 - g) * amount);
    const newB = Math.round(b + (255 - b) * amount);
    
    // Convert back to hex
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  };

  // Determine if this column should have lighter colors (every 4th-7th column)
  const shouldLighten = (colIndex % 8) >= 4;
  
  // Get the base color for this row
  const baseColor = colors[rowIndex % colors.length];
  
  // Apply lightening if needed
  const cellColor = active 
    ? (shouldLighten ? lightenColor(baseColor, 0.3) : baseColor)
    : (shouldLighten ? '#5A5A5A' : '#4A4A4A'); // Lighter gray for inactive cells in light columns

  const cellStyle: React.CSSProperties = {
    width: `${cellSize}px`,
    height: `${cellSize}px`,
    backgroundColor: cellColor,
    borderRadius: '3px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.1s ease',
    boxSizing: 'border-box'
  };

  const dotStyle: React.CSSProperties = {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    backgroundColor: 'white'
  };

  return (
    <div style={cellStyle} onClick={onClick}>
      {active && <div style={dotStyle}></div>}
    </div>
  );
};

// Row component
interface RowProps {
  name: string;
  rowIndex: number;
  cellSize: number;
  gapSize: number;
  maxColumns: number;
  isSelected: boolean;
  rowData: boolean[];
  onSelectDrum: () => void;
  onToggleCell: (colIndex: number) => void;
  onDeleteRow: () => void;
  onOpenPianoRoll: () => void;
}

const Row: React.FC<RowProps> = ({
  name,
  rowIndex,
  cellSize,
  gapSize,
  maxColumns,
  isSelected,
  rowData,
  onSelectDrum,
  onToggleCell,
  onDeleteRow,
  onOpenPianoRoll
}) => {
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    position: 'relative',
    alignItems: 'center',
  };
  
  const labelContainerStyle: React.CSSProperties = {
    flexShrink: 0,
    marginRight: `${gapSize}px`,
    display: 'flex',
    alignItems: 'center',
  };
  
  const cellsContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: `${gapSize}px`,
    overflowX: 'visible',
    alignItems: 'center',
  };

  return (
    <div style={rowStyle}>
      <div style={labelContainerStyle}>
        <DrumLabel
          name={name}
          isSelected={isSelected}
          cellSize={cellSize}
          onClick={onSelectDrum}
          onDelete={onDeleteRow}
          onOpenPianoRoll={onOpenPianoRoll}
        />
      </div>
      
      <div style={cellsContainerStyle}>
        {rowData.map((active, colIdx) => (
          <Cell
            key={`cell-${rowIndex}-${colIdx}`}
            active={active}
            rowIndex={rowIndex}
            colIndex={colIdx}
            cellSize={cellSize}
            onClick={() => onToggleCell(colIdx)}
          />
        ))}
      </div>
    </div>
  );
};

// Add at the top of the file after the import statements and interface declarations
interface DrumMachineProps {
  onClose?: () => void;
  trackId: string;
  onPatternChange?: (trackId: string, pattern: boolean[][]) => void;
  // Add MIDI action props
  onAddNote?: (trackId: string, note: NoteState) => void;
  onRemoveNote?: (trackId: string, noteId: number) => void;
  onUpdateNote?: (trackId: string, note: NoteState) => void;
  // Add callback for display notes
  onDisplayNotesChange?: (notes: NoteState[], drumName: string) => void;
  // State passed down from parent
  samplerTracks: SamplerTrackRead[]; // Array of actual sampler track objects
  parentDrumTrackName?: string;
  // Actions passed down from parent
  addSamplerTrackToDrumTrack: (drumTrackId: string, sampleData: DrumSamplePublicRead) => Promise<CombinedTrack | null>;
  removeSamplerTrack: (samplerTrackId: string) => Promise<void>;
  addNote: (trackId: string, note: NoteState) => void;
  removeSamplerNote: (trackId: string, tickPosition: number, midiRow: number) => Promise<void>;
}

// Constants from PianoRoll to maintain consistency
const TICKS_PER_BEAT = MUSIC_CONSTANTS.pulsesPerQuarterNote; // Standard MIDI ticks per beat (quarter note)
const TICKS_PER_STEP = TICKS_PER_BEAT / 16; // 4 steps per beat, 240 ticks per step

// Modify the component definition to remove forwardRef
const DrumMachine: React.FC<DrumMachineProps> = ({
  onClose, 
  trackId,
  onPatternChange,
  // Destructure MIDI actions
  onAddNote,
  onRemoveNote,
  onUpdateNote,
  // Destructure new callback prop
  onDisplayNotesChange,
  // State passed down from parent
  samplerTracks,
  parentDrumTrackName = 'Drum Machine', // Default name if not provided
  // Actions passed down from parent
  addSamplerTrackToDrumTrack,
  removeSamplerTrack,
  addNote,
  removeSamplerNote,
}) => {
  // Log relevant props instead of non-existent 'props' object
  console.log(`>>> DrumMachine rerendered - trackId: ${trackId}, samplerTracks count: ${samplerTracks.length} <<<`);
  const [selectedSound, setSelectedSound] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rndRef = useRef<Rnd>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  
  // Replace single boolean with a Set to track multiple open piano rolls
  const [openPianoRolls, setOpenPianoRolls] = useState<Set<number>>(new Set());
  
  // Maximum number of possible columns (we'll display as many as fit)
  const MAX_COLUMNS = 64;
  
  // State for visible columns count
  const [visibleColumns, setVisibleColumns] = useState<number>(16);
  
  // Fixed cell size
  const CELL_SIZE = 30;
  const GAP_SIZE = 4;
  
  // Container size state
  const [containerSize, setContainerSize] = useState({ width: 800, height: 264 });
  
  // Expanded drum names with state
  const [drumNames, setDrumNames] = useState<string[]>([]);
  
  // Grid setup - MAX_COLUMNS steps by drumNames.length drum sounds
  const [grid, setGrid] = useState<boolean[][]>([]);

  // Store MIDI notes for each drum sound - this will sync with the piano roll
  const [drumNotes, setDrumNotes] = useState<NoteState[][]>([]);

  // Track the next available note ID
  const [nextNoteId, setNextNoteId] = useState<number>(1);
  
  // Calculate row height (cell size + gap)
  const rowHeight = CELL_SIZE + GAP_SIZE;
  
  // Map for default MIDI note values for common drum types
  const defaultMidiNotes: { [key: string]: number } = {
    'Kick': 36,   // Bass Drum 1 (C1)
    'Snare': 38,  // Acoustic Snare (D1)
    'Clap': 39,   // Hand Clap (D#1)
    'Hat': 42,    // Closed Hi-Hat (F#1)
    'Tom': 45,    // Low Tom (A1)
    'Crash': 49,  // Crash Cymbal 1 (C#2)
    'Ride': 51,   // Ride Cymbal 1 (D#2)
    'Perc': 56,   // Cowbell (G#2)
  };

  // Function to get the default MIDI note for a drum type
  const getDefaultMidiNote = (drumName: string): number => {
    // Try to match the exact name
    if (defaultMidiNotes[drumName]) {
      return defaultMidiNotes[drumName];
    }
    
    // Try to find a partial match
    for (const [key, value] of Object.entries(defaultMidiNotes)) {
      if (drumName.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }
    
    // Default to kick drum if no match found
    return 36;
  };
  
  // Get the action to open the piano roll
  const { openPianoRoll: openExternalPianoRoll } = usePianoRollStore();
  
  // Fetch the associated sampler track IDs from the store using useState and useEffect
  
  // ** New Modal State **
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false); 
  
  // Effect to fetch the sampler track IDs when tracks change
  
  // Effect to initialize and synchronize grid/names/notes based on samplerTrackIds
  useEffect(() => {
    const numRows = samplerTracks.length;
    console.log(`>>> DrumMachine (${trackId}): Syncing state with ${numRows} samplerTracks:`, samplerTracks);
    if (numRows > 0) {
      console.log(`DrumMachine (${trackId}): Syncing state with ${numRows} samplerTracks:`, samplerTracks);

      // Fetch names for the sampler tracks
      const newNames = samplerTracks.map((track, i) => {
        return track ? track.name : `Sampler ${i + 1}`; // Use index as fallback
      });

      // Synchronize the grid, notes, and names
      setGrid(prevGrid => {
        const currentLength = prevGrid.length;
        if (numRows > currentLength) {
          // Add new rows
          const rowsToAdd = numRows - currentLength;
          const newRows = Array(rowsToAdd).fill(null).map(() => Array(MAX_COLUMNS).fill(false));
          return [...prevGrid, ...newRows];
        } else if (numRows < currentLength) {
          // Remove extra rows
          return prevGrid.slice(0, numRows);
        } else {
          // Length matches, no change needed
          return prevGrid;
        }
      });

      setDrumNotes(prevNotes => {
        const currentLength = prevNotes.length;
        if (numRows > currentLength) {
          // Add new empty note arrays
          const rowsToAdd = numRows - currentLength;
          const newRows = Array(rowsToAdd).fill(null).map(() => []);
          return [...prevNotes, ...newRows];
        } else if (numRows < currentLength) {
          // Remove extra note arrays
          return prevNotes.slice(0, numRows);
        } else {
          // Length matches, no change needed
          return prevNotes;
        }
      });

      setDrumNames(newNames);

      // Adjust container height based on the number of rows
      const newHeight = Math.max(200, (numRows * rowHeight) + 60); // Base height + rows + header/padding
      setContainerSize(prev => ({ ...prev, height: newHeight }));
      if (rndRef.current) {
          rndRef.current.updateSize({ width: containerSize.width, height: newHeight });
      }

    } else {
      // Handle case where there are no sampler tracks (e.g., initially or after deletion)
      console.log(`DrumMachine (${trackId}): No samplerTrackIds found. Clearing state.`);
      setGrid([]);
      setDrumNotes([]);
      setDrumNames([]);
      setContainerSize(prev => ({ ...prev, height: 200 })); // Reset to min height
       if (rndRef.current) {
         rndRef.current.updateSize({ width: containerSize.width, height: 200 });
      }
    }
  // Depend on samplerTrackIds and allTracks (for names)
  }, [ samplerTracks ]); // Added trackId for logging clarity
  
  // Existing function to close INTERNAL piano roll
  const closeInternalPianoRoll = (drumIndex: number) => {
    const newOpenPianoRolls = new Set(openPianoRolls);
    newOpenPianoRolls.delete(drumIndex);
    setOpenPianoRolls(newOpenPianoRolls);
  };

  // NEW function to handle opening the EXTERNAL piano roll for a specific sampler track
  const handleOpenSamplerPianoRoll = (rowIndex: number) => {
      if (rowIndex < samplerTracks.length) {
          const targetSamplerId = samplerTracks[rowIndex].id;
          console.log(`DrumMachine: Opening Piano Roll for Sampler Track ID: ${targetSamplerId}`);
          openExternalPianoRoll(targetSamplerId);
      } else {
          console.error(`DrumMachine: Invalid row index ${rowIndex} for opening sampler piano roll.`);
      }
  };
  
  // Function to handle note changes from the piano roll
  const handleNotesChange = (drumIndex: number, notes: NoteState[]) => {
    // Update the notes for the specific drum
    const newDrumNotes = [...drumNotes];
    newDrumNotes[drumIndex] = notes;
    setDrumNotes(newDrumNotes);
    
    // Sync the grid with the piano roll notes
    syncGridWithNotes(drumIndex, notes);
  };
  
  // Function to sync the grid with notes from the piano roll
  const syncGridWithNotes = (drumIndex: number, notes: NoteState[]) => {
    // Create a new grid row for this drum
    const newGridRow = Array(MAX_COLUMNS).fill(false);
    
    // For each note in the piano roll, mark the corresponding grid cell as active
    notes.forEach(note => {
      // Convert the note's time position (in ticks) to grid column
      const column = Math.floor(note.column / TICKS_PER_STEP);
      
      // Only mark cells within the grid bounds
      if (column >= 0 && column < MAX_COLUMNS) {
        newGridRow[column] = true;
      }
    });
    
    // Update the grid for this drum
    const newGrid = [...grid];
    newGrid[drumIndex] = newGridRow;
    setGrid(newGrid);
  };
  
  // Function to create a note for a grid cell - Reverted to generate ID
  const createNoteFromCell = (drumIndex: number, columnIndex: number): NoteState => {
    const noteValue = 60; // Fixed MIDI Note 60
    const noteLength = TICKS_PER_STEP; // Fixed 32nd note length

    const currentId = nextNoteId;
    setNextNoteId(prevId => prevId + 1); // Increment ID state

    const newNote: NoteState = {
      id: currentId, // Assign the generated ID
      row: noteValue, 
      column: columnIndex * TICKS_PER_STEP, 
      length: noteLength, 
    };
    
    console.log(`DrumMachine: createNoteFromCell created:`, JSON.stringify(newNote));
    return newNote;
  };
  
  // Renamed from addRow: Opens modal
  const handleAddRow = (): void => {
    console.log(`DrumMachine (${trackId}): Add Row button clicked. Opening modal.`);
    setIsModalOpen(true);
  };
  
  // New Modal Handlers
  const handleModalClose = () => setIsModalOpen(false);
  const handleConfirmSelection = async (selectedSamples: DrumSamplePublicRead[]) => { 
    setIsLoading(true);
    console.log(`DrumMachine (${trackId}): Samples confirmed:`, selectedSamples.map(s=>s.display_name));
    try {
      if (!addSamplerTrackToDrumTrack) {
          console.error("addSamplerTrackToDrumTrack action is not available!");
          return;
      }
      for (const sample of selectedSamples) {
          await addSamplerTrackToDrumTrack(trackId, sample); // Calls store action
      }
      // Let the useEffect syncing from samplerTrackIds update the local state
    } catch (error) { console.error(`DrumMachine (${trackId}): Error adding sampler tracks:`, error); }
    finally { setIsLoading(false); handleModalClose(); }
  };

  // Modified Delete Row: Calls store action, then updates local state
  const deleteRow = async (index: number): Promise<void> => { // Accepts index
    if (index < 0 || index >= samplerTracks.length) return;
    const samplerTrackIdToDelete = samplerTracks[index].id; // Get ID from local state
    console.log(`DrumMachine (${trackId}): Deleting sampler row index ${index}, ID: ${samplerTrackIdToDelete}`);
    
    setIsLoading(true);
    try {
    return
      if (!removeSamplerTrack) {
          console.error("removeSamplerTrack action is not available!");
          return;
      }
      // Call store action first
      await removeSamplerTrack(samplerTrackIdToDelete);
      console.log(`DrumMachine (${trackId}): removeSamplerTrack store action finished.`);
      
      // THEN update local state (keep existing logic from reset file)
      // This part assumes the reset file had this logic based on index
      const newDrumNames = [...drumNames]; newDrumNames.splice(index, 1); setDrumNames(newDrumNames);
      const newGrid = [...grid]; newGrid.splice(index, 1); setGrid(newGrid);
      const newDrumNotes = [...drumNotes]; newDrumNotes.splice(index, 1); setDrumNotes(newDrumNotes);
      if (openPianoRolls.has(index)) closeInternalPianoRoll(index); // Keep if reset had internal rolls
      const newOpenPianoRolls = new Set<number>(); openPianoRolls.forEach(rollIndex => { if (rollIndex < index) newOpenPianoRolls.add(rollIndex); else if (rollIndex > index) newOpenPianoRolls.add(rollIndex - 1); }); setOpenPianoRolls(newOpenPianoRolls);
      if (selectedSound >= newDrumNames.length) setSelectedSound(newDrumNames.length - 1); else if (selectedSound === index) setSelectedSound(Math.min(index, newDrumNames.length - 1));
      // Resizing will be handled by the useEffect watching samplerTrackIds
      
    } catch (error) { 
        console.error(`DrumMachine (${trackId}): Error deleting sampler track ${samplerTrackIdToDelete}:`, error); 
    }
    finally { setIsLoading(false); }
  };
  
  // Update container size when resized
  const handleResize = (e: MouseEvent | TouchEvent, direction: string, ref: HTMLElement, delta: { width: number; height: number }, position: { x: number; y: number }) => {
    setContainerSize({
      width: ref.offsetWidth,
      height: ref.offsetHeight
    });
  };
  
  // Refactored toggleCell
  const toggleCell = (samplerTrackId: string, colIndex: number) => {
    const rowIndex = samplerTracks.findIndex(t => t.id === samplerTrackId);
    // Add safety check for grid row existence
    if (rowIndex === -1 || !grid || !grid[rowIndex]) {
        console.error(`Invalid state for toggleCell: rowIndex=${rowIndex}, grid exists=${!!grid}`);
        return;
    }

    // 1. Determine the CURRENT value and the NEW value BEFORE updating state
    const currentCellValue = grid[rowIndex][colIndex] ?? false; // Read from current grid state
    const newCellValue = !currentCellValue;
    console.log(`Toggling cell: row=${rowIndex}, col=${colIndex}, current=${currentCellValue}, new=${newCellValue}`);

    // 2. Update the local pattern state optimistically using the calculated new value
    setGrid(prevGrid =>
        prevGrid.map((row, rIdx) => {
            if (rIdx === rowIndex) {
                // Create a new row array for immutability
                const newRow = [...row];
                newRow[colIndex] = newCellValue; // Set the determined new value
                return newRow;
            }
            return row;
        })
    );

    const samplerTrack = samplerTracks[rowIndex]; 
    if (!samplerTrack) return; 
    
    const tickPosition = colIndex * TICKS_PER_STEP;
    const noteLength = TICKS_PER_STEP; 
    const midiNoteValue = samplerTrack.base_midi_note || 60; 

    console.log(`>>> DrumMachine (${trackId}): toggleCell - samplerTrackId: ${samplerTrackId}, colIndex: ${colIndex}, newCellValue: ${newCellValue} <<<`);
    if (newCellValue) {
      // Create note object WITH an ID
      const currentId = nextNoteId; 
      setNextNoteId(prev => prev + 1); // Increment for next time
      const newNote: NoteState = { 
          id: currentId, // Assign temporary ID
          row: midiNoteValue, 
          column: tickPosition, 
          length: noteLength, 
      }; 
      if (addNote) { 
          addNote(samplerTrackId, newNote); // Call prop action with full NoteState
      } else { console.warn('addNote action prop not available!'); }
    } else {
      if (removeSamplerNote) { 
         removeSamplerNote(samplerTrackId, tickPosition, midiNoteValue); 
      } else { 
         console.warn('removeSamplerNote action prop not available!'); 
      }
    }
  };
  
  // Calculate visible columns based on container width
  useEffect(() => {
    if (!containerRef.current) return;
    
    const calculateColumns = () => {
      const gridWidth = containerRef.current?.offsetWidth ?? 0;
      const cellWidthWithGap = CELL_SIZE + GAP_SIZE;
      const calculatedColumns = Math.floor(gridWidth / cellWidthWithGap);
      
      // Limit to between 8 and MAX_COLUMNS columns
      const newVisibleColumns = Math.max(8, Math.min(MAX_COLUMNS, calculatedColumns));
      setVisibleColumns(newVisibleColumns);
    };
    
    // Calculate on mount
    calculateColumns();
    
    // Set up resize observer
    const resizeObserver = new ResizeObserver(calculateColumns);
    resizeObserver.observe(containerRef.current);
    
    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, []);
  
  // Add useEffect to call the onDisplayNotesChange callback when relevant state changes
  useEffect(() => {
    if (onDisplayNotesChange) {
      const currentNotes = drumNotes[selectedSound] || [];
      const currentDrumName = drumNames[selectedSound] || "No drum selected";
      onDisplayNotesChange(currentNotes, currentDrumName);
    }
    // Include drumNames and the callback itself in the dependency array
  }, [drumNotes, selectedSound, drumNames, onDisplayNotesChange]);

  // Calculate initial positions for multiple piano rolls
  const calculatePianoRollPosition = (index: number) => {
    // Stagger positioning for multiple piano rolls so they don't all stack
    const baseX = 50;
    const baseY = 50;
    const offsetX = 30;
    const offsetY = 30;
    
    return {
      x: baseX + (index % 5) * offsetX, // Mod 5 to avoid too much horizontal stacking
      y: baseY + (index % 3) * offsetY  // Mod 3 to avoid too much vertical stacking
    };
  };
  
  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: DARK_THEME.background,
    borderRadius: '4px'
  };
  
  const headerStyle: React.CSSProperties = {
    height: '28px',
    backgroundColor: DARK_THEME.headerBackground,
    borderBottom: `1px solid ${DARK_THEME.border}`,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '0 8px',
    userSelect: 'none',
    cursor: 'move',
    color: DARK_THEME.headerText,
  };
  
  const titleStyle: React.CSSProperties = {
    fontSize: '15px',
    fontWeight: '250',
    color: DARK_THEME.headerText,
    margin: 0
  };
  
  const contentStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '8px',
    backgroundColor: DARK_THEME.gridBackground,
    overflow: 'hidden'
  };
  
  const scrollContainerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    overflowX: 'auto',
    overflowY: 'auto',
  };

  const drumGridStyle: React.CSSProperties = {
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: `${GAP_SIZE}px`,
  };

  const addButtonStyle: React.CSSProperties = {
    width: '80%',
    height: '80%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DARK_THEME.headerBackground,
    color: DARK_THEME.accentBlue,
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '20px',
    fontWeight: 'bold',
    border: `1px dashed ${DARK_THEME.border}`,
    transition: 'all 0.2s ease',
  };

  const addButtonContainerStyle: React.CSSProperties = {
    width: 150,
    height: CELL_SIZE,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: GAP_SIZE,
    boxSizing: 'border-box',
  };
  
  return (
    <>
      <Rnd
        ref={rndRef}
        default={{
          x: 0,
          y: 0,
          width: containerSize.width,
          height: containerSize.height
        }}
        size={{
          width: containerSize.width,
          height: containerSize.height
        }}
        minWidth={650}
        minHeight={200}
        bounds="parent"
        dragHandleClassName="drag-handle"
        onResize={handleResize}
        style={{
          border: `1px solid ${DARK_THEME.border}`,
          borderRadius: "4px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
          overflow: "hidden",
          background: DARK_THEME.background,
          position: 'absolute'
        }}
      >
        <div style={containerStyle}>
          <div 
            ref={headerRef}
            className="drag-handle" 
            style={headerStyle}
          >
            <h1 style={titleStyle}>{parentDrumTrackName}</h1>
            {onClose && (
              <Tooltip title="Close Drum Machine" arrow>
                <IconButton 
                  onClick={onClose} 
                  size="small"
                  sx={{ 
                    position: 'absolute', 
                    right: 4, 
                    color: DARK_THEME.headerText,
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </div>
          
          <div style={contentStyle}>
            <div style={scrollContainerStyle}>
              <div ref={containerRef} style={drumGridStyle}>
                {drumNames.map((name, rowIdx) => (
                  <Row
                    key={`row-${rowIdx}-${samplerTracks[rowIdx].id || rowIdx}`}
                    name={name}
                    rowIndex={rowIdx}
                    cellSize={CELL_SIZE}
                    gapSize={GAP_SIZE}
                    maxColumns={MAX_COLUMNS}
                    isSelected={selectedSound === rowIdx}
                    rowData={grid[rowIdx] || []}
                    onSelectDrum={() => setSelectedSound(rowIdx)}
                    onToggleCell={(colIdx) => toggleCell(samplerTracks[rowIdx].id, colIdx)}
                    onDeleteRow={() => deleteRow(rowIdx)}
                    onOpenPianoRoll={() => handleOpenSamplerPianoRoll(rowIdx)}
                  />
                ))}
                
                <div style={addButtonContainerStyle}>
                  <div style={addButtonStyle} onClick={handleAddRow} title="Add Drum Sample">
                    {isLoading ? <CircularProgress size={20} color="inherit"/> : '+'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Rnd>

      <DrumMachineModal
        open={isModalOpen}
        onClose={handleModalClose}
        onConfirmSelection={handleConfirmSelection} 
      />
    </>
  );
};

// Add display name for debugging
// DrumMachine.displayName = 'DrumMachine';

export default DrumMachine;