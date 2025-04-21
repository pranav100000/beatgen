import Dexie, { Table } from 'dexie';

// Interface for audio file entries
export interface AudioFile {
    id?: number;
    name: string;
    data: Blob;
    type: string;
    size: number;
    duration?: number;
    createdAt: Date;
    updatedAt: Date;
    tags?: string[];
}

// Interface for MIDI file entries
export interface MidiFile {
    id?: number;
    name: string;
    data: Blob;
    type: string;
    size: number;
    trackId?: string;        // App track ID (UUID) to link with application tracks
    instrumentId?: string;   // Instrument ID for this track
    tempo?: number;          // BPM value 
    timeSignature?: string;  // Format: "4/4"
    createdAt: Date;
    updatedAt: Date;
    tags?: string[];
}

// Interface for Drum Machine entries
export interface DrumMachineFile {
    id?: number;
    name: string;
    trackId: string;
    beatsPerMeasure: number;
    stepsPerBeat: number;
    createdAt: Date;
    updatedAt: Date;
    tags?: string[];
}

// Interface for Soundfont entries
export interface SoundfontFile {
    id: string;           // Use the ID from the API
    name: string;         // Internal name
    displayName: string;  // User-friendly name to display
    category: string;     // Instrument category
    data: ArrayBuffer;    // The actual soundfont data
    dateAdded: Date;      // When it was added to the DB
    size: number;         // Size in bytes
    storage_key?: string; // Storage key for the soundfont (for persistent references)
}

// Database class
export class BeatGenDB extends Dexie {
    audioFiles!: Table<AudioFile, number>;
    midiFiles!: Table<MidiFile, number>;
    drumMachineFiles!: Table<DrumMachineFile, number>;
    soundfonts!: Table<SoundfontFile, string>; // Primary key is the string ID

    constructor() {
        super('BeatGenDB');

        this.version(1).stores({
            audioFiles: '++id, name, type, createdAt, updatedAt, *tags',
            midiFiles: '++id, name, type, trackId, createdAt, updatedAt, *tags',
            drumMachineFiles: '++id, name, trackId, createdAt, updatedAt, *tags',
            soundfonts: 'id, name, category, dateAdded'
        });

        // Log database open
        console.log('🗄️ Database initialized:', this.name);
    }

    private logOperation(operation: string, details: any) {
        const timestamp = new Date().toISOString();
        console.log(`🗄️ [${timestamp}] ${operation}:`, details);
    }

    private async logDbState() {
        const audioFiles = await this.audioFiles.toArray();
        const midiFiles = await this.midiFiles.toArray();
        const drumMachineFiles = await this.drumMachineFiles.toArray();
        const soundfonts = await this.soundfonts.toArray();
        console.log('📊 Current DB State:', {
            audioFiles: audioFiles,
            midiFiles: midiFiles,
            drumMachineFiles: drumMachineFiles,
            soundfonts: soundfonts
        });
    }

    // Utility function to create file metadata
    private createFileMetadata(file: File, additionalData: Partial<AudioFile | MidiFile> = {}) {
        const metadata = {
            name: file.name,
            type: file.type,
            size: file.size,
            data: file,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...additionalData
        };
        this.logOperation('Creating file metadata', {
            name: metadata.name,
            type: metadata.type,
            size: metadata.size,
            additionalData
        });
        return metadata;
    }

    // Audio File Operations
    async addAudioFile(file: File, duration?: number): Promise<number> {
        this.logOperation('Adding audio file', {
            name: file.name,
            type: file.type,
            size: file.size,
            duration
        });
        const metadata = this.createFileMetadata(file, { duration });
        const id = await this.audioFiles.add(metadata as AudioFile);
        await this.logDbState();
        return id;
    }

    async getAudioFile(id: number): Promise<AudioFile | undefined> {
        this.logOperation('Getting audio file', { id });
        const file = await this.audioFiles.get(id);
        this.logOperation('Retrieved audio file', {
            id,
            found: !!file,
            name: file?.name
        });
        return file;
    }

    async getAllAudioFiles(): Promise<AudioFile[]> {
        this.logOperation('Getting all audio files', {});
        const files = await this.audioFiles.toArray();
        this.logOperation('Retrieved all audio files', {
            count: files.length,
            names: files.map(f => f.name)
        });
        return files;
    }

    async updateAudioFile(id: number, updates: Partial<AudioFile>): Promise<number> {
        this.logOperation('Updating audio file', { id, updates });
        updates.updatedAt = new Date();
        const count = await this.audioFiles.update(id, updates);
        this.logOperation('Updated audio file', { id, success: count > 0 });
        await this.logDbState();
        return count;
    }

    async deleteAudioFile(id: number): Promise<void> {
        this.logOperation('Deleting audio file', { id });
        await this.audioFiles.delete(id);
        await this.logDbState();
    }

    // // MIDI File Operations
    // async addMidiFile(file: File, tempo?: number, timeSignature?: string): Promise<number> {
    //     this.logOperation('Adding MIDI file', {
    //         name: file.name,
    //         type: file.type,
    //         size: file.size,
    //         tempo,
    //         timeSignature
    //     });
    //     const metadata = this.createFileMetadata(file, { tempo, timeSignature });
    //     const id = await this.midiFiles.add(metadata as MidiFile);
    //     await this.logDbState();
    //     return id;
    // }

    // async getMidiFile(id: number): Promise<MidiFile | undefined> {
    //     this.logOperation('Getting MIDI file', { id });
    //     const file = await this.midiFiles.get(id);
    //     this.logOperation('Retrieved MIDI file', {
    //         id,
    //         found: !!file,
    //         name: file?.name
    //     });
    //     return file;
    // }

    // async getAllMidiFiles(): Promise<MidiFile[]> {
    //     this.logOperation('Getting all MIDI files', {});
    //     const files = await this.midiFiles.toArray();
    //     this.logOperation('Retrieved all MIDI files', {
    //         count: files.length,
    //         names: files.map(f => f.name)
    //     });
    //     return files;
    // }

    // async updateMidiFile(id: number, updates: Partial<MidiFile>): Promise<number> {
    //     this.logOperation('Updating MIDI file', { id, updates });
    //     updates.updatedAt = new Date();
    //     const count = await this.midiFiles.update(id, updates);
    //     this.logOperation('Updated MIDI file', { id, success: count > 0 });
    //     await this.logDbState();
    //     return count;
    // }

    // async deleteMidiFile(id: number): Promise<void> {
    //     this.logOperation('Deleting MIDI file', { id });
    //     await this.midiFiles.delete(id);
    //     await this.logDbState();
    // }
    
    // // Track-specific MIDI operations
    
    // // Store a MIDI blob for a specific track
    // async storeMidiTrackBlob(trackId: string, name: string, midiBlob: Blob, 
    //     bpm: number, timeSignature: [number, number], 
    //     instrumentId?: string): Promise<number> {
    //     this.logOperation('Storing MIDI track blob', {
    //         trackId,
    //         name,
    //         size: midiBlob.size,
    //         bpm,
    //         timeSignature
    //     });
        
    //     // Check if this track already has a MIDI file
    //     const existingFile = await this.midiFiles
    //         .where('trackId')
    //         .equals(trackId)
    //         .first();
            
    //     const timeSignatureStr = `${timeSignature[0]}/${timeSignature[1]}`;
        
    //     if (existingFile) {
    //         // Update existing record
    //         await this.midiFiles.update(existingFile.id!, {
    //             data: midiBlob,
    //             type: 'audio/midi',
    //             size: midiBlob.size,
    //             tempo: bpm,
    //             timeSignature: timeSignatureStr,
    //             updatedAt: new Date(),
    //             instrumentId
    //         });
            
    //         this.logOperation('Updated existing MIDI track', {
    //             trackId,
    //             fileId: existingFile.id
    //         });
            
    //         await this.logDbState();
    //         return existingFile.id!;
    //     } else {
    //         // Create new record
    //         const metadata = {
    //             name,
    //             trackId,
    //             data: midiBlob,
    //             type: 'audio/midi',
    //             size: midiBlob.size,
    //             tempo: bpm,
    //             timeSignature: timeSignatureStr,
    //             instrumentId,
    //             createdAt: new Date(),
    //             updatedAt: new Date()
    //         };
            
    //         const id = await this.midiFiles.add(metadata);
            
    //         this.logOperation('Created new MIDI track record', {
    //             trackId,
    //             fileId: id
    //         });
            
    //         await this.logDbState();
    //         return id;
    //     }
    // }
    
    // // Get MIDI blob for a specific track
    // async getMidiTrackBlob(trackId: string): Promise<Blob | null> {
    //     this.logOperation('Getting MIDI track blob', { trackId });
        
    //     const file = await this.midiFiles
    //         .where('trackId')
    //         .equals(trackId)
    //         .first();
            
    //     if (file) {
    //         this.logOperation('Found MIDI track blob', {
    //             trackId,
    //             fileId: file.id,
    //             size: file.size
    //         });
    //         return file.data;
    //     } else {
    //         this.logOperation('MIDI track blob not found', { trackId });
    //         return null;
    //     }
    // }
    
    // // Check if a track has a MIDI file
    // async hasMidiTrack(trackId: string): Promise<boolean> {
    //     const count = await this.midiFiles
    //         .where('trackId')
    //         .equals(trackId)
    //         .count();
            
    //     return count > 0;
    // }
    
    // // Delete MIDI file for a specific track
    // async deleteMidiTrack(trackId: string): Promise<void> {
    //     this.logOperation('Deleting MIDI track', { trackId });
        
    //     await this.midiFiles
    //         .where('trackId')
    //         .equals(trackId)
    //         .delete();
            
    //     this.logOperation('Deleted MIDI track', { trackId });
    //     await this.logDbState();
    // }

    // Search Operations
    async searchAudioFiles(query: string): Promise<AudioFile[]> {
        this.logOperation('Searching audio files', { query });
        const files = await this.audioFiles
            .where('name')
            .startsWithIgnoreCase(query)
            .or('tags')
            .anyOfIgnoreCase(query)
            .toArray();
        this.logOperation('Search results for audio files', {
            query,
            count: files.length,
            names: files.map(f => f.name)
        });
        return files;
    }

    async searchMidiFiles(query: string): Promise<MidiFile[]> {
        this.logOperation('Searching MIDI files', { query });
        const files = await this.midiFiles
            .where('name')
            .startsWithIgnoreCase(query)
            .or('tags')
            .anyOfIgnoreCase(query)
            .toArray();
        this.logOperation('Search results for MIDI files', {
            query,
            count: files.length,
            names: files.map(f => f.name)
        });
        return files;
    }

    // Utility function to get audio duration
    async getAudioDuration(file: File): Promise<number> {
        this.logOperation('Getting audio duration', { name: file.name });
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            const objectUrl = URL.createObjectURL(file);
            
            audio.addEventListener('loadedmetadata', () => {
                URL.revokeObjectURL(objectUrl);
                this.logOperation('Got audio duration', {
                    name: file.name,
                    duration: audio.duration
                });
                resolve(audio.duration);
            });
            
            audio.addEventListener('error', () => {
                URL.revokeObjectURL(objectUrl);
                this.logOperation('Error getting audio duration', {
                    name: file.name,
                    error: audio.error
                });
                reject(new Error('Error loading audio file'));
            });
            
            audio.src = objectUrl;
        });
    }

    // Database cleanup
    async clearAllFiles(): Promise<void> {
        this.logOperation('Clearing all files from database', {});
        
        try {
            await this.transaction('rw', this.audioFiles, this.midiFiles, this.drumMachineFiles, this.soundfonts, async () => {
                await this.audioFiles.clear();
                await this.midiFiles.clear();
                await this.drumMachineFiles.clear();
                await this.soundfonts.clear();
            });
            
            this.logOperation('Successfully cleared all files', {});
            await this.logDbState();
        } catch (error) {
            this.logOperation('Failed to clear files', { error });
            throw error;
        }
    }

    // Drum Machine Operations
    async addDrumMachineTrack(trackId: string, name: string = 'Drum Machine'): Promise<number> {
        this.logOperation('Adding drum machine track', {
            name,
            trackId
        });
        
        const metadata: DrumMachineFile = {
            name,
            trackId,
            beatsPerMeasure: 4,  // Default to 4/4 time
            stepsPerBeat: 4,     // Default to 16th notes
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const id = await this.drumMachineFiles.add(metadata);
        await this.logDbState();
        return id;
    }

    async getDrumMachineTrack(id: number): Promise<DrumMachineFile | undefined> {
        this.logOperation('Getting drum machine track', { id });
        const track = await this.drumMachineFiles.get(id);
        this.logOperation('Retrieved drum machine track', {
            id,
            found: !!track,
            name: track?.name
        });
        return track;
    }

    async getAllDrumMachineTracks(): Promise<DrumMachineFile[]> {
        this.logOperation('Getting all drum machine tracks', {});
        const tracks = await this.drumMachineFiles.toArray();
        this.logOperation('Retrieved all drum machine tracks', {
            count: tracks.length,
            names: tracks.map(t => t.name)
        });
        return tracks;
    }

    async updateDrumMachineTrack(id: number, updates: Partial<DrumMachineFile>): Promise<number> {
        this.logOperation('Updating drum machine track', { id, updates });
        updates.updatedAt = new Date();
        const count = await this.drumMachineFiles.update(id, updates);
        this.logOperation('Updated drum machine track', { id, success: count > 0 });
        await this.logDbState();
        return count;
    }

    async deleteDrumMachineTrack(id: number): Promise<void> {
        this.logOperation('Deleting drum machine track', { id });
        await this.drumMachineFiles.delete(id);
        await this.logDbState();
    }

    async getSoundfontFile(id: string): Promise<SoundfontFile | undefined> {
        return await this.soundfonts.get(id);
    }
}

// Export a singleton instance
export const db = new BeatGenDB();
