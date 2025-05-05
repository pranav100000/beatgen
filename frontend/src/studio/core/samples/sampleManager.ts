import { downloadAudioTrackFile, downloadDrumSampleFile } from '../../../platform/api/sounds';
import { AudioFile, BeatGenDB } from '../db/dexie-client';

/**
 * SampleManager handles loading, caching, and retrieving generic audio samples
 * using IndexedDB for persistent storage, keyed by ID.
 */
class SampleManager {
  private static instance: SampleManager | null = null;
  private inMemoryBlobCache: Map<string, AudioFile>;
  private db: BeatGenDB;
  
  /**
   * Private constructor for Singleton pattern.
   * @param db The Dexie database instance.
   */
  private constructor(db: BeatGenDB) {
    this.db = db;
    this.inMemoryBlobCache = new Map();
    console.log('SampleManager initialized');
  }

  /**
   * Get the singleton instance of SampleManager.
   * @param db Dexie database instance.
   */
  public static getInstance(db: BeatGenDB): SampleManager {
    if (!SampleManager.instance) {
      // Ensure the db instance provided is valid
      if (!db) {
         throw new Error("SampleManager requires a valid BeatGenDB instance.");
      }
      SampleManager.instance = new SampleManager(db);
    }
    // Optionally update the db instance if a new one is provided, 
    // though typically singletons use the first instance they get.
    // SampleManager.instance.db = db; 
    return SampleManager.instance;
  }

  public async putSampleBlob(id: string, file: File, type: 'audio_track' | 'sample', name?: string): Promise<void> {
    await this.db.audioFiles.put({
      id: id,
      name: name || id,
      data: file,
      type: type,
      size: file.size,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Retrieves the Blob data for a sample, using cache if available,
   * otherwise fetching and caching it.
   * Uses ID as the primary cache key.
   * @param id The unique ID for the sample/track.
   * @param storageKey The storage key needed ONLY for fetching if not cached.
   * @param name Optional name for storing in DB if fetched.
   * @returns Promise resolving to the sample Blob, or null if retrieval fails.
   */
  public async getSampleBlob(
    id: string,
    storageKey: string,
    type: 'audio_track' | 'sample',
    name?: string
  ): Promise<AudioFile | null> {
    // 1. Check in-memory cache using ID
    if (this.inMemoryBlobCache.has(id)) {
      console.log(`Sample blob ${id} found in memory cache`);
      return this.inMemoryBlobCache.get(id)!;
    }

    // 2. Check IndexedDB using ID
    try {
      if (!this.db.table('audioFiles')) {
          console.error("IndexedDB 'audioFiles' store does not exist.");
      } else {
          const storedSampleFile = await this.db.audioFiles.get(id); // Use ID for lookup
          if (storedSampleFile) {
            console.log(`Sample blob ${id} found in IndexedDB`);
            this.inMemoryBlobCache.set(id, storedSampleFile); // Cache in memory using ID
            return storedSampleFile;
          }
      }
    } catch (error) {
      console.error(`Error retrieving sample blob ${id} from IndexedDB:`, error);
    }

    // 3. Download if not in caches, passing all necessary info
    console.log(`Sample blob ${id} (storageKey: ${storageKey}) not found in cache, attempting download.`);
    return this.downloadAndCacheSample(id, storageKey, type, name); // Pass ID, storageKey, name
  }

  /**
   * Downloads a sample using the storageKey, caches it using the ID, and returns the Blob.
   * @param id The unique ID to use for caching.
   * @param storageKey The storage key needed for fetching.
   * @param name Optional name for storing in DB.
   * @returns Promise resolving to the sample Blob, or null if download/caching fails.
   */
  private async downloadAndCacheSample(
    id: string,         // ID for caching
    storageKey: string, // Key for fetching
    type: 'audio_track' | 'sample',
    name?: string
  ): Promise<AudioFile | null> {
    try {
      console.log(`Downloading sample (storageKey ${storageKey}): ${type}`);
      // Fetch using storageKey
      const blob = await (type === 'audio_track' ? downloadAudioTrackFile(storageKey) : downloadDrumSampleFile(storageKey)); 
      if (!blob) {
        throw new Error(`Failed to download sample using storageKey ${storageKey}`);
      }

      console.log(`Downloaded sample (storageKey ${storageKey}): ${blob.size} bytes, type: ${blob.type}`);

      // Store in IndexedDB using ID
      const sampleFile: AudioFile = {
        id: id, // Use the provided ID
        name: name || id, // Use name or fall back to ID
        data: blob,
        type: blob.type,
        size: blob.size,
        createdAt: new Date(),
        updatedAt: new Date(),
        // storageKey: storageKey, // Optionally add storageKey to AudioFile schema if needed
      };
      
      if (this.db.table('audioFiles')) {
          await this.db.audioFiles.put(sampleFile); // Uses ID as primary key from schema
          console.log(`Sample blob for ID ${id} stored in IndexedDB`);
      } else {
          console.warn("IndexedDB 'audioFiles' store not found. Sample not persisted.");
      }

      // Add to memory cache using ID
      this.inMemoryBlobCache.set(id, sampleFile);

      return sampleFile;
    } catch (error) {
      console.error(`Error downloading (storageKey ${storageKey}) or caching (ID ${id}) sample:`, error);
      return null; 
    }
  }

  /**
   * Checks if a sample blob is available in either cache (memory or IndexedDB).
   * @param id The unique ID identifying the sample.
   * @returns Promise resolving to true if cached, false otherwise.
   */
  public async isSampleCached(id: string): Promise<boolean> { // Check by ID
    if (this.inMemoryBlobCache.has(id)) {
      return true;
    }
    try {
       if (!this.db.table('audioFiles')) return false; 
       const storedSample = await this.db.audioFiles.get(id); // Lookup by ID
       return !!storedSample;
    } catch (error) {
      console.error(`Error checking if sample ${id} is cached:`, error);
      return false;
    }
  }

  /**
   * Removes a specific sample from both caches.
   * @param id The unique ID identifying the sample.
   */
  public async clearSample(id: string): Promise<void> { // Clear by ID
    try {
      this.inMemoryBlobCache.delete(id);
      if (this.db.table('audioFiles')) {
          await this.db.audioFiles.delete(id); // Delete by ID
      }
      console.log(`Sample ${id} removed from cache`);
    } catch (error) {
      console.error(`Error removing sample ${id} from cache:`, error);
    }
  }

  /**
   * Clears all samples from both the in-memory cache and the IndexedDB store.
   */
  public async clearAllSamples(): Promise<void> { // No ID needed here
    try {
      this.inMemoryBlobCache.clear();
      if (this.db.table('audioFiles')) {
          await this.db.audioFiles.clear();
      }
      console.log('All samples cleared from cache');
    } catch (error) {
      console.error('Error clearing all samples from cache:', error);
      // throw error;
    }
  }
}

export default SampleManager;
