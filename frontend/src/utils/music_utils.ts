export function getMidiNotesForKey(keyName: string): number[] {
    // Parse the key name into root note and scale type
    const parts = keyName.split(' ');
    if (parts.length !== 2) {
      throw new Error('Invalid key format. Expected "Note Scale" (e.g., "C Major")');
    }
    
    const rootNote = parts[0];
    const scaleType = parts[1].toLowerCase();
    
    // Define root note MIDI values (for C = 60, which is Middle C)
    const rootNotes: Record<string, number> = {
      'C': 60, 'C#': 61, 'Db': 61,
      'D': 62, 'D#': 63, 'Eb': 63,
      'E': 64,
      'F': 65, 'F#': 66, 'Gb': 66,
      'G': 67, 'G#': 68, 'Ab': 68,
      'A': 69, 'A#': 70, 'Bb': 70,
      'B': 71
    };
    
    // Define scale patterns (sequence of semitones)
    const scalePatterns: Record<string, number[]> = {
      'major': [0, 2, 4, 5, 7, 9, 11],
      'minor': [0, 2, 3, 5, 7, 8, 10],
      'harmonicminor': [0, 2, 3, 5, 7, 8, 11],
      'melodicminor': [0, 2, 3, 5, 7, 9, 11],
      // Add other scales as needed
    };
    
    // Get the base MIDI value for the root note
    const rootMidi = rootNotes[rootNote];
    if (rootMidi === undefined) {
      throw new Error(`Unknown root note: ${rootNote}`);
    }
    
    // Get the scale pattern
    const patternKey = scaleType.replace(/\s+/g, '');
    const pattern = scalePatterns[patternKey];
    if (pattern === undefined) {
      throw new Error(`Unknown scale type: ${scaleType}`);
    }
    
    // Generate the MIDI notes for the scale
    const midiNotes: number[] = [];
    for (let i = 0; i < 12; i++) {
      // Calculate the actual note value within the scale
      const octave = Math.floor(i / pattern.length);
      const index = i % pattern.length;
      const note = rootMidi + pattern[index] + (octave * 12);
      
      // Stop when we reach 12 notes
      if (midiNotes.length === 12) break;
      
      midiNotes.push(note);
    }
    
    return midiNotes;
  }