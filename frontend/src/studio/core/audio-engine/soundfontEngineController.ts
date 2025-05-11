import { MidiSoundfontPlayer } from './midiSoundfontPlayer/midiSoundfontPlayer';
import { MidiManager } from '../midi/MidiManagerNew';
import { db } from '../db/dexie-client';
import { Midi } from '@tonejs/midi';
import { Note } from '../../../types/note';
import { TrackPlayer } from './trackPlayer';

/**
 * Controller for the MidiSoundfontPlayer that integrates with the app's architecture
 * This controller coordinates between MidiManager, Transport, and the SoundfontPlayer
 */
export class SoundfontEngineController implements TrackPlayer{
    private midiPlayer: MidiSoundfontPlayer;
    private trackSubscriptions: Map<string, () => void> = new Map();
    
    constructor() {
        this.midiPlayer = new MidiSoundfontPlayer();
    }
    setTrackPan(id: string, pan: number): Promise<void> {
        throw new Error('Method not implemented.');
    }
    setTrackMute(id: string, mute: boolean): Promise<void> {
        console.log(`SoundfontEngineController: Setting mute for track ${id} to ${mute}`);
        this.midiPlayer.muteTrack(id, mute);
        return Promise.resolve();
    }
    setTrackPositionTicks(id: string, position: number): Promise<void> {
        console.log(`SoundfontEngineController: Setting position for track ${id} to ${position}`);
        //this.midiPlayer.setTrackPositionTicks(id, position);
        return Promise.resolve();
    }
    setTrackTrimStartTicks(id: string, start: number): Promise<void> {
        console.log(`SoundfontEngineController: Setting trim start for track ${id} to ${start}`);
        //this.midiPlayer.setTrackTrimStartTicks(id, start);
        return Promise.resolve();
    }
    setTrackTrimEndTicks(id: string, end: number): Promise<void> {
        throw new Error('Method not implemented.');
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
        
        // // Ensure the track exists in MidiManager
        // if (!midiManager.hasTrack(trackId)) {
        //     console.log(`Creating track ${trackId} in MidiManager for subscription`);
        //     midiManager.createTrack(trackId, instrumentId);
        // }
        
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
                console.log(`SoundfontEngineController: Notes updated for track ${trackId}, updating playback directly`);
                
                // OPTIMIZATION: Get the sequencer directly and update it with notes
                const existingTrack = this.midiPlayer.getTrack(trackId);
                if (existingTrack) {
                    // Add debugging to check the channel
                    console.log(`Found existing track for ${trackId}, channel: ${existingTrack.getChannel}, updating with ${notes.length} notes`);
                    
                    // Update directly with notes - no MIDI file conversion needed!
                    existingTrack.updateWithNotes(notes);
                    console.log(`Directly updated sequencer for track ${trackId} with ${notes.length} notes`);
                    return;
                }
                
                // Track doesn't exist in sequencer yet - we need to warn about this and let the caller reconnect
                console.warn(`No existing sequencer for track ${trackId}, client needs to reconnect track to soundfont`);
                
                console.log(`MIDI playback update completed for track ${trackId} with ${notes.length} notes`);
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
    async play(): Promise<void> {
        console.log('SoundfontEngineController: Starting playback');
        await this.midiPlayer.play();
    }
    
    /**
     * Pause playback
     */
    pause(): Promise<void> {
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
        return Promise.resolve();
    }
    
    /**
     * Stop playback and reset position
     */
    async stop(): Promise<void> {
        console.log('SoundfontEngineController: Stopping playback');
        await this.midiPlayer.stop();
    }
    
    /**
     * Seek to a specific position
     * @param position Position in milliseconds or seconds
     */
    async seek(position: number): Promise<void> {
        console.log(`SoundfontEngineController: Seeking to ${position}`);
        await this.midiPlayer.seek(position);
    }
    
    // Track operations
    
    /**
     * Add a track to the player
     * @param trackId Track ID
     * @param midiData MIDI file data as ArrayBuffer
     * @param soundfontData Soundfont file data as ArrayBuffer
     */
    async addTrack(trackId: string, notes: Note[], soundfontData: ArrayBuffer): Promise<void> {
        console.log(`SoundfontEngineController: Adding track ${trackId}`);
        
        try {
            await this.midiPlayer.addTrack(trackId, notes, soundfontData);
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
    setTrackVolume(trackId: string, volume: number): Promise<void> {
        // Convert from app's volume scale (0-100) to MIDI volume scale (0-127) if needed
        const midiVolume = volume > 100 ? volume : Math.round((volume / 100) * 127);
        console.log(`SoundfontEngineController: Setting track ${trackId} volume to ${volume} (${midiVolume} in MIDI)`);
        this.midiPlayer.setTrackVolume(trackId, midiVolume);
        return Promise.resolve();
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
    async setGlobalBPM(bpm: number): Promise<void> {
        console.log(`SoundfontEngineController: Setting global BPM to ${bpm}`);
        await this.midiPlayer.setGlobalBPM(bpm);
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
            
            // Ensure the midiPlayer is fully initialized before proceeding
            try {
                // This will wait for initialization to complete or throw if not started
                await this.midiPlayer.waitForInitialization();
                console.log('SoundfontEngineController confirmed midiPlayer is fully initialized');
            } catch (initError) {
                console.error('MidiPlayer not initialized, cannot connect track to soundfont:', initError);
                throw new Error(`Cannot connect track ${trackId} to soundfont: MidiPlayer not initialized. Error: ${initError.message}`);
            }
            
            // Ensure the track exists in MidiManager
            if (!midiManager.hasTrack(trackId)) {
                console.log(`Track ${trackId} not found in MidiManager, creating it now`);
                midiManager.createTrack(trackId, instrumentId);
            }
            
            // Get soundfont data
            const soundfontResult = await this.getSoundfontData(instrumentId);
            if (!soundfontResult) {
                throw new Error(`No soundfont data found for instrument ${instrumentId}`);
            }
            
            // Add to SoundfontPlayer with detailed logging
            console.log(`About to add track ${trackId} to player, current tracks:`, this.midiPlayer.getTrackIds());
            try {
                // Get notes using the getTrackNotes method for better error handling
                const notes = midiManager.getTrackNotes(trackId) || [];

                // Add the track to the player
                await this.addTrack(
                    trackId, 
                    notes,
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