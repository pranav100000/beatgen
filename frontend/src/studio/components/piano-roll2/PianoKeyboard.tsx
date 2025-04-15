import React, { forwardRef } from "react";

// Define props interface
interface PianoKeyboardProps {
  totalKeys: number;
  keyHeight: number;
  contentHeight: number;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  scrollY: number;
  keyboardWidth: number;
}

// Helper functions
const isBlackKey = (index: number): boolean => {
  const noteIndex = index % 12;
  return [1, 3, 6, 8, 10].includes(noteIndex);
};

// Check if note is C or F (which should have bottom shadows)
const isBottomShadowNote = (index: number): boolean => {
  const noteIndex = index % 12;
  return noteIndex === 0 || noteIndex === 5; // C or F
};

// Check if note is B or E (which should have top shadows)
const isTopShadowNote = (index: number): boolean => {
  const noteIndex = index % 12;
  return noteIndex === 4 || noteIndex === 11; // E or B
};

// Calculate note name and octave
const getNoteLabel = (index: number): string => {
  const noteNames = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
  ];
  const noteName = noteNames[index % 12];
  // Start from C-1 (MIDI note 0) for 132 keys (C-1 to C10)
  const octave = Math.floor(index / 12);
  return `${noteName}${octave}`;
};

// Check if note is middle C (C4, MIDI note 60)
const isMiddleC = (index: number): boolean => {
  return index === 60; // MIDI note 60 is middle C
};

// Get the note index within the octave (0-11)
const getNoteIndexInOctave = (index: number): number => {
  return index % 12;
};

// Custom styles for realistic piano keys
const styles = {
  keyContainer: {
    position: 'relative' as const,
    height: '100%',
    width: '100%',
  },
  whiteKey: {
    background: "#d3d3d3", // Light gray background
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: "8px",
    fontSize: "11px",
    color: "#555",
    position: "absolute" as const,
    zIndex: 1,
    left: 0,
    width: '100%',
  },
  blackKey: {
    background: "#333", // Dark gray/black keys
    color: "#999",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: "8px",
    fontSize: "10px",
    fontWeight: "bold" as const,
    position: "absolute" as const,
    zIndex: 3, // Increased z-index to be higher than white keys
    left: 0,
    width: '60%', // Shorter black keys
    borderRadius: "0 4px 4px 0",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.6), 2px 0 4px rgba(0, 0, 0, 0.3)" // Separate shadows for bottom and right
  },
  octaveDivider: {
    // Remove or make very subtle
  },
  cLabel: {
    position: "absolute" as const,
    left: "3px",
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: "10px",
    color: "#666",
    fontWeight: "normal" as const
  },
  middleCLabel: {
    position: "absolute" as const,
    right: "35px",
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: "10px",
    color: "#666",
    fontWeight: "normal" as const
  },
  middleCKey: {
    // Make middle C more subtle
  },
  noteLabel: {
    fontSize: "11px",
    color: "#666",
    marginRight: "3px"
  }
};

// Use forwardRef to handle the ref properly
const PianoKeyboard = forwardRef<HTMLDivElement, PianoKeyboardProps>(
  (
    {
      totalKeys,
      keyHeight,
      contentHeight,
      onScroll,
      scrollY,
      keyboardWidth,
    },
    ref
  ) => {
    // Function to determine if a key is at the start of an octave (C note)
    const isStartOfOctave = (index: number): boolean => {
      return index % 12 === 0;
    };

    return (
      <div
        className="vertical-scroll-container"
        ref={ref}
        style={{
          width: `${keyboardWidth}px`,
          height: "100%",
          background: "#d3d3d3", // Match white key color for seamless appearance
          overflow: "auto",
          boxShadow: "none"
        }}
        onScroll={onScroll}
      >
        <div style={{ height: `${contentHeight}px`, position: "relative" }}>
          {/* Add a single right-edge gradient for all keys */}
          <div 
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: "5px",
              height: "100%",
              background: "linear-gradient(to left, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.05) 100%)",
              filter: "blur(1px)",
              zIndex: 4,
              pointerEvents: "none" // Ensure this doesn't interfere with clicking
            }}
          />

          {/* First render all white keys */}
          {Array.from({ length: totalKeys }).reverse().map((_, i) => {
            const keyIndex = totalKeys - 1 - i;
            const isBlack = isBlackKey(keyIndex);
            
            // Always render white keys, even if a black key is on top
            // This ensures white keys appear as background for black keys
            const isC = isStartOfOctave(keyIndex);
            const isMidC = isMiddleC(keyIndex);
            const top = i * keyHeight;
            
            // Only skip rendering if it's a black key and we're rendering white keys first
            if (isBlack) {
              return (
                <div
                  key={`white-background-${keyIndex}`}
                  style={{
                    position: "absolute",
                    background: "#d3d3d3", // Same color as white keys
                    height: `${keyHeight}px`,
                    width: "100%",
                    top: `${top}px`,
                    left: 0,
                    zIndex: 0 // Below everything
                  }}
                />
              );
            }
            
            return (
              <div
                key={`white-key-${keyIndex}`}
                className="piano-key piano-key-white"
                style={{
                  ...styles.whiteKey,
                  height: `${keyHeight}px`,
                  top: `${top}px`,
                }}
              >
                {/* Show octave number only on C notes and at the right edge */}
                {isC && (
                  <span 
                    style={{
                      position: "absolute",
                      top: "66.7%", // Position at 66.7% of the key height
                      right: "14px",
                      fontSize: "11px",
                      color: "#666",
                      transform: "translateY(-110%)" // Center the text vertically at that position
                    }}
                  >
                    C{Math.floor(keyIndex / 12)}
                  </span>
                )}
                
                {/* Shadow overlay for bottom - only for C and F notes */}
                {isBottomShadowNote(keyIndex) && (
                  <div 
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      width: "100%",
                      height: "4px",
                      background: "linear-gradient(to bottom, rgba(0,0,0,0.01) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.3) 100%)",
                      filter: "blur(0.7px)",
                      zIndex: 2
                    }}
                  />
                )}
                
                {/* Shadow overlay for top - only for B and E notes */}
                {isTopShadowNote(keyIndex) && (
                  <div 
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "4px",
                      background: "linear-gradient(to top, rgba(0,0,0,0.01) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.3) 100%)",
                      filter: "blur(0.7px)",
                      zIndex: 2
                    }}
                  />
                )}
                
                {/* Top border line - only for B and E notes */}
                {isTopShadowNote(keyIndex) && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%", 
                      height: "0.5px",
                      background: "rgba(0,0,0,0.4)", // More subtle, semi-transparent line
                      boxShadow: "0 0.5px 1px rgba(0,0,0,0.2)", // Subtle shadow for depth
                      zIndex: 3
                    }}
                  />
                )}
                
                {/* Bottom border line - only for C and F notes */}
                {isBottomShadowNote(keyIndex) && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      width: "100%",
                      height: "0.5px",
                      background: "rgba(0,0,0,0.4)", // More subtle, semi-transparent line
                      boxShadow: "0 -0.5px 1px rgba(0,0,0,0.2)", // Subtle shadow for depth
                      zIndex: 3
                    }}
                  />
                )}
              </div>
            );
          })}
          
          {/* Then render all black keys on top */}
          {Array.from({ length: totalKeys }).reverse().map((_, i) => {
            const keyIndex = totalKeys - 1 - i;
            const isBlack = isBlackKey(keyIndex);
            
            if (!isBlack) return null; // Skip white keys
            
            const top = i * keyHeight;
            
            return (
              <div
                key={`black-key-${keyIndex}`}
                className="piano-key piano-key-black"
                style={{
                  ...styles.blackKey,
                  height: `${keyHeight}px`,
                  top: `${top}px`,
                }}
              >
                {/* Add dividers in the middle of black keys to show white key separations */}
                {/* These dividers will only appear at positions where white keys would meet */}
                
                {/* We're looking at the note below this black key to see if it needs a top border */}
                { (
                  <>
                    {/* Shadow gradient for visual effect */}
                    <div 
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "100%",
                        width: "66.7%", // 100% / 60% = 166.7% (to match full white key width)
                        height: "4px",
                        background: "linear-gradient(to top, rgba(0,0,0,0.01) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.3) 100%)",
                        filter: "blur(0.7px)",
                        zIndex: 0,
                        transform: "translateY(-50%)"
                      }}
                    />
                    {/* Actual divider line */}
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "100%",
                        width: "66.7%", // 100% / 60% = 166.7% (to match full white key width)
                        height: "0.5px",
                        background: "rgba(0,0,0,0.4)", // Match the white key dividers
                        boxShadow: "0 0.5px 1px rgba(0,0,0,0.2)", // Subtle shadow for depth
                        zIndex: 0,
                        transform: "translateY(-50%)"
                      }}
                    />
                  </>
                )}
                
                {/* We're looking at the note above this black key to see if it needs a bottom border */}
                {(
                  <>
                    {/* Shadow gradient for visual effect */}
                    <div 
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "100%",
                        width: "66.7%", // 100% / 60% = 166.7% (to match full white key width)
                        height: "4px",
                        background: "linear-gradient(to bottom, rgba(0,0,0,0.01) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.3) 100%)",
                        filter: "blur(0.7px)",
                        zIndex: 0,
                        transform: "translateY(-50%)"
                      }}
                    />
                    {/* Actual divider line */}
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(50%)",
                        left: "100%",
                        width: "66.7%", // 100% / 60% = 166.7% (to match full white key width)
                        height: "0.5px",
                        background: "rgba(0,0,0,0.3)", // Match the white key dividers
                        boxShadow: "0 -0.5px 1px rgba(0,0,0,0.2)", // Subtle shadow for depth
                        zIndex: 0,
                        transform: "translateY(-50%)"
                      }}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

export default PianoKeyboard; 