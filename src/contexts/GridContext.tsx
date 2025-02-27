import React, { createContext, useContext, useState, ReactNode } from 'react';
import { GRID_CONSTANTS } from '../core/constants/grid-constants';

interface GridContextProps {
  gridColumns: number;
  gridBlockWidth: number;
  beatsPerMeasure: number;
  totalBeats: number;
  setGridColumns: (columns: number) => void;
  setGridBlockWidth: (width: number) => void;
  setBeatsPerMeasure: (beats: number) => void;
  setTotalBeats: (beats: number) => void;
}

const GridContext = createContext<GridContextProps>({
  gridColumns: 16,
  gridBlockWidth: 25,
  beatsPerMeasure: 4,
  totalBeats: 16,
  setGridColumns: () => {},
  setGridBlockWidth: () => {},
  setBeatsPerMeasure: () => {},
  setTotalBeats: () => {},
});

interface GridProviderProps {
  children: ReactNode;
}

export const GridProvider: React.FC<GridProviderProps> = ({ children }) => {
  const [gridColumns, setGridColumns] = useState<number>(16);
  const [gridBlockWidth, setGridBlockWidth] = useState<number>(25);
  const [beatsPerMeasure, setBeatsPerMeasure] = useState<number>(4);
  const [totalBeats, setTotalBeats] = useState<number>(16);

  return (
    <GridContext.Provider
      value={{
        gridColumns,
        gridBlockWidth,
        beatsPerMeasure,
        totalBeats,
        setGridColumns,
        setGridBlockWidth,
        setBeatsPerMeasure,
        setTotalBeats,
      }}
    >
      {children}
    </GridContext.Provider>
  );
};

export const useGridContext = () => useContext(GridContext); 