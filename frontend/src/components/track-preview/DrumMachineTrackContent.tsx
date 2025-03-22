import React, { useCallback, useState, useEffect } from 'react';
import { GRID_CONSTANTS } from '../../constants/gridConstants';
import { DrumMachineTrackHandler } from './DrumMachineTrackHandler';
import styled from 'styled-components';

// Define the drum sounds (for internal reference)
const DRUM_SOUNDS = [
  'Kick',
  'Snare',
  'Hi-Hat Closed',
  'Hi-Hat Open'
];

// Number of columns per beat - 16th note resolution
const COLUMNS_PER_BEAT = 4;
const BEATS_PER_MEASURE = 4;
const COLUMNS_PER_MEASURE = COLUMNS_PER_BEAT * BEATS_PER_MEASURE;

// Props for the drum machine track content component
interface DrumMachineTrackContentProps {
  handler: DrumMachineTrackHandler;
  width: number;
  height: number;
  playheadPosition: number;
}

// Style components for the grid
const GridContainer = styled.div<{ $width: number; $height: number }>`
  width: ${props => props.$width}px;
  height: ${props => props.$height}px;
  display: grid;
  grid-template-rows: repeat(${DRUM_SOUNDS.length}, 1fr);
  position: relative;
  background-color: #1a1a1a;
  overflow: hidden;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  border-left: none; /* Ensure no left border */
`;

interface GridRowProps {
  $gridBlockWidth: number;
}

const GridRow = styled.div<GridRowProps>`
  display: flex; /* Change to flex for better control */
  height: 100%;
  position: relative;
  border-bottom: 1px solid #555;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
`;

interface CellProps {
  $active: boolean;
  $hover: boolean;
  $row: number;
  $gridBlockWidth: number;
  $rowHeight: number;
  $isBeatDivider: boolean;
  $isMeasureDivider: boolean;
}

const Cell = styled.div<CellProps>`
  width: ${props => props.$gridBlockWidth}px;
  height: ${props => props.$rowHeight}px;
  border-right: ${props => 
    props.$isMeasureDivider 
      ? '2px solid #777' 
      : props.$isBeatDivider 
        ? '1.5px solid #555' 
        : '1px solid #333'
  };
  position: relative;
  transition: background-color 0.1s ease;
  cursor: pointer;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  flex: 0 0 auto; /* Don't grow or shrink */
  background-color: ${props => 
    props.$active
      ? props.$row === 0 ? 'rgba(255, 82, 82, 0.3)' // Kick - red background
      : props.$row === 1 ? 'rgba(255, 183, 77, 0.3)' // Snare - orange background
      : props.$row === 2 ? 'rgba(76, 175, 80, 0.3)'  // Hi-hat closed - green background
      : props.$row === 3 ? 'rgba(33, 150, 243, 0.3)' // Hi-hat open - blue background
      : 'rgba(74, 144, 226, 0.3)'                    // Default - blue background
      : props.$isMeasureDivider 
        ? '#202020' 
        : props.$isBeatDivider 
          ? '#1d1d1d' 
          : '#1a1a1a'
  };
  
  &::after {
    content: '';
    position: absolute;
    top: ${props => props.$active ? '10%' : '15%'};
    left: ${props => props.$active ? '10%' : '15%'};
    width: ${props => props.$active ? '80%' : '70%'};
    height: ${props => props.$active ? '80%' : '70%'};
    border-radius: 4px;
    background-color: ${props => {
      if (props.$active) {
        // Color based on row (instrument type) - brighter for active
          return '#4caf50'; // Default blue
      }
      
      if (props.$hover && !props.$active) {
        return 'rgba(100, 149, 237, 0.3)'; // More visible hover effect
      }
      
      return 'transparent';
    }};
    box-shadow: ${props => props.$active ? '0 0 10px 2px ' + 
      ('#4caf50')
    : 'none'};
    border: ${props => !props.$active && !props.$hover ? '1px solid #444' : 'none'};
    display: ${props => !props.$active ? (props.$hover ? 'block' : 'none') : 'block'};
  }
  
  &:hover {
    background-color: ${props => !props.$active ? 'rgba(60, 60, 60, 0.5)' : ''};
    
    &::after {
      display: block;
      background-color: ${props => !props.$active ? 'rgba(100, 149, 237, 0.4)' : ''};
    }
  }
`;

const Playhead = styled.div<{ $position: number }>`
  position: absolute;
  top: 0;
  left: ${props => props.$position}px;
  width: 2px;
  height: 100%;
  background-color: #ff0000;
  z-index: 10;
  pointer-events: none;
`;

/**
 * Component that renders a drum machine grid using React components
 * Each measure contains 16 columns (4 beats × 4 subdivisions)
 */
const DrumMachineTrackContent: React.FC<DrumMachineTrackContentProps> = ({ 
  handler, 
  width, 
  height,
  playheadPosition 
}) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [hoverCell, setHoverCell] = useState<{row: number, column: number} | null>(null);
  
  // Get drum pads from the handler
  const drumPads = handler.useDrumPads();
  const handlePadToggle = handler.useHandleClick();
  
  // Calculate grid dimensions
  const gridBlockWidth = GRID_CONSTANTS.measureWidth / COLUMNS_PER_MEASURE; 
  const rowHeight = height / DRUM_SOUNDS.length - 1;
  
  // Helper function: check if a pad exists at a specific position
  const isPadActive = useCallback((row: number, column: number): boolean => {
    return drumPads.some(pad => pad.row === row && pad.column === column);
  }, [drumPads]);
  
  // Handle cell click
  const handleCellClick = useCallback((row: number, column: number) => {
    setIsDrawing(true);
    handlePadToggle(row, column);
  }, [handlePadToggle]);
  
  // Handle mouse up to stop drawing
  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);
  
  // Handle mouse leave to reset hover state
  const handleMouseLeave = useCallback(() => {
    setIsDrawing(false);
    setHoverCell(null);
  }, []);
  
  // Handle mouse enter for a cell
  const handleCellMouseEnter = useCallback((row: number, column: number) => {
    setHoverCell({ row, column });
    
    // If in drawing mode, toggle the pad
    if (isDrawing) {
      handlePadToggle(row, column);
    }
  }, [isDrawing, handlePadToggle]);
  
  // Set up mouse event listeners
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDrawing(false);
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);
  
  // Calculate number of columns to display - ensure integer number of measures
  const measuresToDisplay = Math.ceil(width / GRID_CONSTANTS.measureWidth);
  const columnsToDisplay = measuresToDisplay * COLUMNS_PER_MEASURE;
  
  return (
    <GridContainer 
      $width={width} 
      $height={height} 
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
    >
      {playheadPosition >= 0 && (
        <Playhead $position={playheadPosition} />
      )}
      
      {/* Generate rows for each drum sound */}
      {DRUM_SOUNDS.map((sound, rowIndex) => (
        <GridRow key={rowIndex} $gridBlockWidth={gridBlockWidth}>
          {/* Generate columns for each grid division */}
          {Array.from({ length: columnsToDisplay }).map((_, columnIndex) => {
            const isMeasureDivider = (columnIndex + 1) % COLUMNS_PER_MEASURE === 0;
            const isBeatDivider = (columnIndex + 1) % COLUMNS_PER_BEAT === 0;
            const isActive = isPadActive(rowIndex, columnIndex);
            const isHovered = hoverCell?.row === rowIndex && hoverCell?.column === columnIndex;
            
            return (
              <Cell
                key={columnIndex}
                $active={isActive}
                $hover={isHovered}
                $row={rowIndex}
                $gridBlockWidth={gridBlockWidth}
                $rowHeight={rowHeight}
                $isBeatDivider={isBeatDivider}
                $isMeasureDivider={isMeasureDivider}
                onMouseDown={() => handleCellClick(rowIndex, columnIndex)}
                onMouseEnter={() => handleCellMouseEnter(rowIndex, columnIndex)}
              />
            );
          })}
        </GridRow>
      ))}
    </GridContainer>
  );
};

export default DrumMachineTrackContent; 