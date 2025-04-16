export enum GridSnapOption {
  NONE = 0,
  STEP_1_6 = 1,
  STEP_1_4 = 2,
  STEP_1_3 = 3,
  STEP_1_2 = 4,
  STEP = 5,
  BEAT_1_6 = 6,
  BEAT_1_4 = 7, // Equivalent to STEP
  BEAT_1_3 = 8,
  BEAT_1_2 = 9,
  BEAT = 10,
  BAR = 11,
}

// Helper to get the display name for a snap option
export const getGridSnapOptionName = (option: GridSnapOption): string => {
  switch (option) {
    case GridSnapOption.NONE: return "None";
    case GridSnapOption.STEP_1_6: return "1/6 step";
    case GridSnapOption.STEP_1_4: return "1/4 step";
    case GridSnapOption.STEP_1_3: return "1/3 step";
    case GridSnapOption.STEP_1_2: return "1/2 step";
    case GridSnapOption.STEP: return "Step";
    case GridSnapOption.BEAT_1_6: return "1/6 beat";
    case GridSnapOption.BEAT_1_4: return "1/4 beat";
    case GridSnapOption.BEAT_1_3: return "1/3 beat";
    case GridSnapOption.BEAT_1_2: return "1/2 beat";
    case GridSnapOption.BEAT: return "Beat";
    case GridSnapOption.BAR: return "Bar";
    default: {
      // Exhaustive check - this should not happen if all enum values are handled
      const _exhaustiveCheck: never = option;
      return "Step"; // Fallback
    }
  }
};

// Helper to get all enum values for iterating in the menu
export const getAllGridSnapOptions = (): GridSnapOption[] => {
  // Get all numeric enum keys and convert them back to numbers
  return Object.keys(GridSnapOption)
    .filter(key => !isNaN(Number(key))) // Filter out the reverse mapping keys (like "STEP")
    .map(key => Number(key) as GridSnapOption); // Cast to GridSnapOption
};


// Helper to calculate snap size in pixels based on effective grid size (pixels per step at current zoom)
// Needs effectiveGridSize as input because it depends on zoom
export const getSnapSizeInPixels = (option: GridSnapOption, effectiveGridSize: number): number => {
  const beatSize = effectiveGridSize * 4; // Assuming a beat is 4 steps
  switch (option) {
    case GridSnapOption.NONE: return 1; // No snapping, minimum value 1 pixel
    case GridSnapOption.STEP_1_6: return Math.max(1, Math.round(effectiveGridSize / 6));
    case GridSnapOption.STEP_1_4: return Math.max(1, Math.round(effectiveGridSize / 4));
    case GridSnapOption.STEP_1_3: return Math.max(1, Math.round(effectiveGridSize / 3));
    case GridSnapOption.STEP_1_2: return Math.max(1, Math.round(effectiveGridSize / 2));
    case GridSnapOption.STEP: return Math.max(1, effectiveGridSize);
    case GridSnapOption.BEAT_1_6: return Math.max(1, Math.round(beatSize / 6));
    case GridSnapOption.BEAT_1_4: return Math.max(1, Math.round(beatSize / 4)); // Same as STEP
    case GridSnapOption.BEAT_1_3: return Math.max(1, Math.round(beatSize / 3));
    case GridSnapOption.BEAT_1_2: return Math.max(1, Math.round(beatSize / 2));
    case GridSnapOption.BEAT: return Math.max(1, beatSize);
    case GridSnapOption.BAR: return Math.max(1, beatSize * 4); // Bar is 4 beats
    default: {
       // Exhaustive check
      const _exhaustiveCheck: never = option;
      return Math.max(1, effectiveGridSize); // Fallback to Step size
    }
  }
}; 