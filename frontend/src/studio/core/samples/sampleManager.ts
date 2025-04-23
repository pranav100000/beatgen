import { downloadFile } from '../../../platform/api/sounds';
import { AudioFile, BeatGenDB } from '../db/dexie-client';

/**
 * SampleManager handles loading, caching, and retrieving generic audio samples
 * using IndexedDB for persistent storage.
 */
class SampleManager {
  private static instance: SampleManager | null = null;
  private inMemoryBlobCache: Map<string, Blob>;
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

  /**
   * Retrieves the Blob data for a sample, using cache if available,
   * otherwise fetching and caching it.
   * @param storageKey The unique storage key identifying the sample.
   * @param getDownloadUrlFn An async function that resolves a storageKey to a download URL.
   * @returns Promise resolving to the sample Blob, or null if retrieval fails.
   */
  public async getSampleBlob(
    id: string,
    storageKey: string, 
    name?: string
  ): Promise<Blob | null> {
    // 1. Check in-memory cache
    if (this.inMemoryBlobCache.has(storageKey)) {
      console.log(`Sample blob ${storageKey} found in memory cache`);
      return this.inMemoryBlobCache.get(storageKey)!;
    }

    // 2. Check IndexedDB
    try {
      // Ensure the sampleFiles store exists before accessing it
      if (!this.db.table('audioFiles')) {
          console.error("IndexedDB 'audioFiles' store does not exist. DB schema might be outdated.");
          // Fall through to download attempt? Or throw? Let's try downloading.
      } else {
          const storedSampleFile = await this.db.audioFiles.get(id);
          if (storedSampleFile) {
            console.log(`Sample blob ${storageKey} found in IndexedDB`);
            this.inMemoryBlobCache.set(storageKey, storedSampleFile.data); // Add to memory cache
            return storedSampleFile.data;
          }
      }
    } catch (error) {
      console.error(`Error retrieving sample blob ${storageKey} from IndexedDB:`, error);
      // Fall through to download attempt
    }

    // 3. Download if not in caches
    console.log(`Sample blob ${storageKey} not found in cache, attempting download.`);
    return this.downloadAndCacheSample(id, storageKey, name);
  }

  /**
   * Downloads a sample using the provided URL function, caches it, and returns the Blob.
   * @param storageKey The unique storage key identifying the sample.
   * @param getDownloadUrlFn An async function that resolves a storageKey to a download URL.
   * @returns Promise resolving to the sample Blob, or null if download/caching fails.
   */
  private async downloadAndCacheSample(
    id: string,
    storageKey: string,
    name?: string
  ): Promise<Blob | null> {
    try {
      const blob = await downloadFile(storageKey);
      if (!blob) {
        throw new Error(`Failed to download sample ${storageKey}`);
      }

      console.log(`Downloaded sample ${storageKey}: ${blob.size} bytes, type: ${blob.type}`);

      // Store in IndexedDB
      const sampleFile: AudioFile = {
        id: id,
        name: name || storageKey,
        data: blob,
        type: blob.type,
        size: blob.size,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Ensure the sampleFiles store exists before putting data
      if (this.db.table('audioFiles')) {
          await this.db.audioFiles.put(sampleFile);
          console.log(`Sample blob ${storageKey} stored in IndexedDB`);
      } else {
          console.warn("IndexedDB 'audioFiles' store not found. Sample not persisted.");
      }


      // Add to memory cache
      this.inMemoryBlobCache.set(storageKey, blob);

      return blob;
    } catch (error) {
      console.error(`Error downloading or caching sample ${storageKey}:`, error);
      return null; // Return null on failure
    }
  }

  /**
   * Checks if a sample blob is available in either cache (memory or IndexedDB).
   * @param storageKey The unique storage key identifying the sample.
   * @returns Promise resolving to true if cached, false otherwise.
   */
  public async isSampleCached(storageKey: string): Promise<boolean> {
    if (this.inMemoryBlobCache.has(storageKey)) {
      return true;
    }
    try {
       if (!this.db.table('audioFiles')) return false; // Store doesn't exist
       const storedSample = await this.db.audioFiles.get(storageKey);
       return !!storedSample;
    } catch (error) {
      console.error(`Error checking if sample ${storageKey} is cached:`, error);
      return false;
    }
  }

  /**
   * Removes a specific sample from both caches.
   * @param storageKey The unique storage key identifying the sample.
   */
  public async clearSample(storageKey: string): Promise<void> {
    try {
      this.inMemoryBlobCache.delete(storageKey);
      if (this.db.table('audioFiles')) {
          await this.db.audioFiles.delete(storageKey);
      }
      console.log(`Sample ${storageKey} removed from cache`);
    } catch (error) {
      console.error(`Error removing sample ${storageKey} from cache:`, error);
      // Decide if re-throwing is appropriate depending on expected usage
      // throw error; 
    }
  }

  /**
   * Clears all samples from both the in-memory cache and the IndexedDB store.
   */
  public async clearAllSamples(): Promise<void> {
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
