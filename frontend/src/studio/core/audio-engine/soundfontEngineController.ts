import { MidiSoundfontPlayer } from './midiSoundfontPlayer/midiSoundfontPlayer';
import { MidiManager } from '../midi/MidiManager';
import { Store } from '../state/store';
import { Note } from '../types/note';
import { db } from '../db/dexie-client';

/**
 * Controller for the MidiSoundfontPlayer that integrates with the app's architecture
 * This controller coordinates between MidiManager, Transport, and the SoundfontPlayer
 */
export class SoundfontEngineController {
    private midiPlayer: MidiSoundfontPlayer;
    private trackSubscriptions: Map<string, () => void> = new Map();
    
    constructor(private store?: Store) {
        this.midiPlayer = new MidiSoundfontPlayer();
    }
    
    /**
     * Initialize the SoundfontPlayer with an AudioContext
     */
    async initialize(audioContext: AudioContext): Promise<void> {
        try {
            console.log('Initializing SoundfontEngineController with AudioContext');
            await this.midiPlayer.initSynthesizer(audioContext);
            console.log('SoundfontEngineController initialized successfully');
        } catch (error) {
            console.error('Failed to initialize SoundfontEngineController:', error);
            throw error;
        }
    }
    
    /**
     * Subscribe to a specific track for MIDI updates
     * @param trackId The track ID to subscribe to
     * @param midiManager The MidiManager instance
     */
    registerTrackSubscription(trackId: string, midiManager: MidiManager): void {
        console.log(`Subscribing to updates for track ${trackId}`);
        
        // Unsubscribe from previous subscription if it exists
        if (this.trackSubscriptions.has(trackId)) {
            console.log(`Removing previous subscription for track ${trackId}`);
            const unsubscribe = this.trackSubscriptions.get(trackId);
            if (unsubscribe) unsubscribe();
            this.trackSubscriptions.delete(trackId);
        }
        
        // Subscribe to track updates
        const unsubscribe = midiManager.subscribeToTrack(trackId, async (trackId, notes) => {
            try {
                console.log(`SoundfontEngineController: Notes updated for track ${trackId}, updating playback`);
                
                // Get the updated MIDI blob from MidiManager
                const midiBlob = await midiManager.exportMidiFileFromDB(trackId);
                if (!midiBlob) {
                    console.warn(`No MIDI data found for track ${trackId}`);
                    return;
                }
                
                // Get track data and associated soundfont data
                if (!this.store) return;
                const trackData = this.store.getTrackById(trackId);
                if (!trackData || trackData.type !== 'midi' && trackData.type !== 'drum' || !trackData.instrumentId) {
                    console.warn(`Track ${trackId} is not a MIDI/drum track or has no instrumentId, skipping update`);
                    return;
                }
                
                const soundfontResult = await this.getSoundfontData(trackData.instrumentId);
                if (!soundfontResult) {
                    console.warn(`No soundfont data found for instrument ${trackData.instrumentId}`);
                    return;
                }
                
                // Update the track with the storage key if available
                if (soundfontResult.storage_key && trackData.instrumentStorageKey !== soundfontResult.storage_key) {
                    trackData.instrumentStorageKey = soundfontResult.storage_key;
                    console.log(`Updated instrumentStorageKey for track ${trackId} to ${soundfontResult.storage_key}`);
                }
                
                // Check if track exists in player
                const existingTrack = this.midiPlayer.getTrack(trackId);
                if (existingTrack) {
                    // Remove and re-add to update
                    this.midiPlayer.removeTrack(trackId);
                    console.log(`Removed existing track ${trackId} from player to update`);
                }
                
                // Add updated track
                await this.midiPlayer.addTrack(
                    trackId,
                    await midiBlob.arrayBuffer(),
                    soundfontResult.data
                );
                
                console.log(`Updated MIDI playback for track ${trackId} with ${notes.length} notes`);
            } catch (error) {
                console.error(`Failed to update MIDI playback for track ${trackId}:`, error);
            }
        });
        
        // Store the unsubscribe function
        this.trackSubscriptions.set(trackId, unsubscribe);
        console.log(`Subscription for track ${trackId} registered successfully`);
    }
    
    /**
     * Get soundfont data using SoundfontManager
     * @returns Object containing the soundfont data and storage key
     */
    private async getSoundfontData(instrumentId: string): Promise<{ data: ArrayBuffer, storage_key?: string } | null> {
        try {
            console.log(`Fetching soundfont data for instrument ${instrumentId}`);
            
            // Import SoundfontManager dynamically to avoid circular dependencies
            const { default: SoundfontManager } = await import('../soundfont/soundfontManager');
            const soundfontManager = SoundfontManager.getInstance(db);
            
            // This will try from DB first, then download if needed
            const result = await soundfontManager.getSoundfont(instrumentId);
            
            console.log(`Loaded soundfont data (${result.data.byteLength} bytes) for instrument ${instrumentId}${result.storage_key ? ' with storage key: ' + result.storage_key : ''}`);
            
            return result;
        } catch (error) {
            console.error(`Failed to get soundfont data for instrument ${instrumentId}:`, error);
            return null;
        }
    }
    
    // Transport methods
    
    /**
     * Start or resume playback
     */
    play(): void {
        console.log('SoundfontEngineController: Starting playback');
        this.midiPlayer.play();
    }
    
    /**
     * Pause playback
     */
    pause(): void {
        console.log('SoundfontEngineController: Pausing playback');
        const trackIds = this.midiPlayer.getTrackIds();
        
        // More extensive debugging information
        console.log('MidiPlayer detailed state:', {
            isPlaying: this.midiPlayer.isPlayerPlaying(),
            currentTick: this.midiPlayer.getCurrentTick(),
            trackIds: trackIds,
            trackCount: trackIds.length
        });
        
        this.midiPlayer.pause();
    }
    
    /**
     * Stop playback and reset position
     */
    stop(): void {
        console.log('SoundfontEngineController: Stopping playback');
        this.midiPlayer.stop();
    }
    
    /**
     * Seek to a specific position
     * @param position Position in milliseconds or seconds
     */
    seek(position: number): void {
        console.log(`SoundfontEngineController: Seeking to ${position}`);
        this.midiPlayer.seek(position);
    }
    
    // Track operations
    
    /**
     * Add a track to the player
     * @param trackId Track ID
     * @param midiData MIDI file data as ArrayBuffer
     * @param soundfontData Soundfont file data as ArrayBuffer
     */
    async addTrack(trackId: string, midiData: ArrayBuffer, soundfontData: ArrayBuffer): Promise<void> {
        console.log(`SoundfontEngineController: Adding track ${trackId}`);
        
        try {
            await this.midiPlayer.addTrack(trackId, midiData, soundfontData);
            console.log(`Track ${trackId} added to player`);
        } catch (error) {
            console.error(`Failed to add track ${trackId} to player:`, error);
            throw error;
        }
    }
    
    /**
     * Remove a track from the player
     * @param trackId Track ID to remove
     */
    removeTrack(trackId: string): void {
        console.log(`SoundfontEngineController: Removing track ${trackId}`);
        this.midiPlayer.removeTrack(trackId);
    }
    
    /**
     * Mute or unmute a track
     * @param trackId Track ID
     * @param muted Whether to mute the track
     */
    muteTrack(trackId: string, muted: boolean): void {
        console.log(`SoundfontEngineController: ${muted ? 'Muting' : 'Unmuting'} track ${trackId}`);
        this.midiPlayer.muteTrack(trackId, muted);
    }
    
    /**
     * Set the volume of a track
     * @param trackId Track ID
     * @param volume Volume level (0-100)
     */
    setTrackVolume(trackId: string, volume: number): void {
        // Convert from app's volume scale (0-100) to MIDI volume scale (0-127) if needed
        const midiVolume = volume > 100 ? volume : Math.round((volume / 100) * 127);
        console.log(`SoundfontEngineController: Setting track ${trackId} volume to ${volume} (${midiVolume} in MIDI)`);
        this.midiPlayer.setTrackVolume(trackId, midiVolume);
    }
    
    /**
     * Set the offset for a track
     * @param trackId Track ID
     * @param offset Offset in milliseconds
     */
    setTrackOffset(trackId: string, offset: number): void {
        console.log(`SoundfontEngineController: Setting track ${trackId} offset to ${offset}ms`);
        this.midiPlayer.setTrackOffset(trackId, offset);
    }
    
    /**
     * Set the global BPM for all tracks
     * @param bpm Tempo in BPM
     */
    setGlobalBPM(bpm: number): void {
        console.log(`SoundfontEngineController: Setting global BPM to ${bpm}`);
        this.midiPlayer.setGlobalBPM(bpm);
    }
    
    /**
     * Connect a track to a soundfont
     * This adds the track to the player and subscribes to updates
     * @param trackId The track ID to connect
     * @param instrumentId The instrument ID for the soundfont
     * @param midiManager The MidiManager instance
     */
    async connectTrackToSoundfont(trackId: string, instrumentId: string, midiManager: MidiManager): Promise<void> {
        try {
            console.log(`Connecting track ${trackId} to soundfont ${instrumentId}`);
            
            // Validate track type first
            if (this.store) {
                const trackData = this.store.getTrackById(trackId);
                if (!trackData || (trackData.type !== 'midi' && trackData.type !== 'drum')) {
                    throw new Error(`Cannot connect track ${trackId} to soundfont: track not found or not a MIDI/drum track`);
                }
            }
            
            // Get the MIDI data for the track
            const midiBlob = await midiManager.exportMidiFileFromDB(trackId);
            if (!midiBlob) {
                console.warn(`No MIDI data found for track ${trackId}, creating default MIDI data`);
                // Create default MIDI file if none exists
                const emptyNotes: Note[] = [];
                midiManager.updateTrack(trackId, emptyNotes);
                
                // Try again
                const newMidiBlob = await midiManager.exportMidiFileFromDB(trackId);
                if (!newMidiBlob) {
                    throw new Error(`Failed to create MIDI data for track ${trackId}`);
                }
            }
            
            // Get soundfont data
            const soundfontResult = await this.getSoundfontData(instrumentId);
            if (!soundfontResult) {
                throw new Error(`No soundfont data found for instrument ${instrumentId}`);
            }
            
            // Update the track with the storage key if available
            if (this.store && soundfontResult.storage_key) {
                const trackData = this.store.getTrackById(trackId);
                if (trackData && (trackData.type === 'midi' || trackData.type === 'drum')) {
                    // Set the storage key on the track
                    trackData.instrumentStorageKey = soundfontResult.storage_key;
                    console.log(`Set instrumentStorageKey for track ${trackId} to ${soundfontResult.storage_key}`);
                }
            }
            
            // Add to SoundfontPlayer with detailed logging
            console.log(`About to add track ${trackId} to player, current tracks:`, this.midiPlayer.getTrackIds());
            try {
                // Convert to ArrayBuffer for consistency
                const midiArrayBuffer = await midiBlob!.arrayBuffer();
                console.log(`MIDI data size: ${midiArrayBuffer.byteLength} bytes`);
                
                // Add the track
                await this.addTrack(
                    trackId, 
                    midiArrayBuffer,
                    soundfontResult.data
                );
                
                console.log(`Track added, new track list:`, this.midiPlayer.getTrackIds());
                
                // Verify the track was added
                if (!this.midiPlayer.getTrackIds().includes(trackId)) {
                    console.error(`*** CRITICAL ERROR: Track ${trackId} was not added successfully! ***`);
                }
            } catch (addError) {
                console.error(`Error adding track: ${addError}`);
                throw addError;
            }
            
            // Subscribe to future updates
            this.registerTrackSubscription(trackId, midiManager);
            
            console.log(`Successfully connected track ${trackId} to soundfont ${instrumentId}`);
        } catch (error) {
            console.error(`Failed to connect track ${trackId} to soundfont ${instrumentId}:`, error);
            throw error;
        }
    }
    
    /**
     * Clean up resources
     */
    dispose(): void {
        console.log('Disposing SoundfontEngineController');
        
        // Unsubscribe from all track subscriptions
        for (const [trackId, unsubscribe] of this.trackSubscriptions.entries()) {
            unsubscribe();
            console.log(`Unsubscribed from track ${trackId}`);
        }
        this.trackSubscriptions.clear();
        
        this.midiPlayer.dispose();
        console.log('Disposed MidiSoundfontPlayer');
    }
}