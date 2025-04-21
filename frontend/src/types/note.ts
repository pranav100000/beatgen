export interface Note {
    id: number;
    row: number;  // Pitch, MIDI note number (0-127)
    column: number;  // Time position in grid
    length: number;  // Duration in grid units
    velocity?: number;  // MIDI velocity (0-127), defaults to 100
    trackId?: string;  // ID of the track this note belongs to
}

export function convertJsonToNotes(trackId: string, json_data: { [k: string]: unknown }): Note[] {
    console.log(`convertJsonToNotes:`, json_data);
    // Check if json_data has a 'notes' property and if it's an array
    if (json_data && Array.isArray(json_data.notes)) {
        // Assuming the elements in the notes array are compatible with the Note interface structure
        const notesArray = json_data.notes as any[];
        return notesArray.map((note: any) => ({
            id: note.id,
            row: note.row,
            column: note.column,
            length: note.length,
            velocity: note.velocity, // Keep handling optional velocity
            trackId: trackId // Assign the trackId passed to the function
        }));
    } else {
        console.error("Invalid JSON data format: 'notes' array not found.", json_data);
        return []; // Return an empty array or throw an error, depending on desired behavior
    }
}