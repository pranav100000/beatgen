import { BeatGenDB, SoundfontFile } from '../db/dexie-client';
import { getSoundfontDownloadUrl, getPublicSoundfont } from '../../../platform/api/soundfonts';

/**
 * SoundfontManager handles loading, caching, and retrieving soundfonts
 * using IndexedDB for persistent storage
 */
class SoundfontManager {
  private static instance: SoundfontManager | null = null;
  private inMemoryCache: Map<string, ArrayBuffer>;
  private db: BeatGenDB;
  
  /**
   * Create a new SoundfontManager
   * @param db The database instance to use for storage
   */
  constructor(db: BeatGenDB) {
    this.db = db;
    this.inMemoryCache = new Map();
    console.log('SoundfontManager initialized');
  }

  /**
   * Get the singleton instance of SoundfontManager
   * @param db Database instance
   */
  public static getInstance(db: BeatGenDB): SoundfontManager {
    if (!SoundfontManager.instance) {
      SoundfontManager.instance = new SoundfontManager(db);
    }
    return SoundfontManager.instance;
  }

  /**
   * Get a soundfont by ID, either from cache or by downloading
   * @param id Soundfont ID
   * @returns Promise with the soundfont data and storage key
   */
  public async getSoundfont(id: string): Promise<{ data: ArrayBuffer, storage_key?: string }> {
    // First check the in-memory cache
    if (this.inMemoryCache.has(id)) {
      console.log(`Soundfont ${id} found in memory cache`);
      
      // Get storage key from DB even if data is in memory cache
      try {
        const dbInfo = await this.db.soundfonts.get(id);
        const storage_key = dbInfo?.storage_key;
        return { data: this.inMemoryCache.get(id)!, storage_key };
      } catch (error) {
        console.error(`Error retrieving storage key for ${id} from IndexedDB:`, error);
        return { data: this.inMemoryCache.get(id)! };
      }
    }

    // Then check the IndexedDB
    try {
      const storedSoundfont = await this.db.soundfonts.get(id);
      if (storedSoundfont) {
        console.log(`Soundfont ${id} found in IndexedDB`);
        // Add to memory cache
        this.inMemoryCache.set(id, storedSoundfont.data);
        return { 
          data: storedSoundfont.data,
          storage_key: storedSoundfont.storage_key 
        };
      }
    } catch (error) {
      console.error(`Error retrieving soundfont ${id} from IndexedDB:`, error);
    }

    // If not in cache, download it
    return this.downloadSoundfont(id);
  }

  /**
   * Download a soundfont from the server
   * @param id Soundfont ID
   * @returns Promise with the soundfont data
   */
  private async downloadSoundfont(id: string): Promise<{ data: ArrayBuffer, storage_key?: string }> {
    try {
      console.log(`Downloading soundfont ${id} from server`);
      
      // Get soundfont metadata from the server
      const soundfont = await getPublicSoundfont(id);
      
      // Get the download URL
      const downloadUrl = getSoundfontDownloadUrl(soundfont.storage_key);
      
      // Download the soundfont
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download soundfont: ${response.statusText}`);
      }
      
      // Get the binary data
      const data = await response.arrayBuffer();
      console.log(`Downloaded soundfont ${id}: ${data.byteLength} bytes`);
      
      // Store in IndexedDB with storage_key
      const soundfontFile: SoundfontFile = {
        id: soundfont.id,
        name: soundfont.name,
        displayName: soundfont.display_name,
        category: soundfont.category,
        data,
        dateAdded: new Date(),
        size: data.byteLength,
        storage_key: soundfont.storage_key // Store the storage key
      };
      
      await this.db.soundfonts.put(soundfontFile);
      console.log(`Soundfont ${id} stored in IndexedDB`);
      
      // Add to memory cache
      this.inMemoryCache.set(id, data);
      
      return { data, storage_key: soundfont.storage_key };
    } catch (error) {
      console.error(`Error downloading soundfont ${id}:`, error);
      throw error;
    }
  }

  /**
   * Check if a soundfont is available in cache
   * @param id Soundfont ID
   * @returns Promise resolving to boolean
   */
  public async isSoundfontCached(id: string): Promise<boolean> {
    // Check in-memory cache first
    if (this.inMemoryCache.has(id)) {
      return true;
    }
    
    // Check IndexedDB
    try {
      const storedSoundfont = await this.db.soundfonts.get(id);
      return !!storedSoundfont;
    } catch (error) {
      console.error(`Error checking if soundfont ${id} is cached:`, error);
      return false;
    }
  }

  /**
   * Get all cached soundfonts (metadata only)
   * @returns Promise with an array of stored soundfonts (without the data)
   */
  public async getCachedSoundfonts(): Promise<Omit<SoundfontFile, 'data'>[]> {
    try {
      const storedSoundfonts = await this.db.soundfonts.toArray();
      // Return without the binary data to save memory
      return storedSoundfonts.map(({ data, ...rest }) => rest);
    } catch (error) {
      console.error('Error retrieving cached soundfonts:', error);
      return [];
    }
  }

  /**
   * Clear a specific soundfont from the cache
   * @param id Soundfont ID
   */
  public async clearSoundfont(id: string): Promise<void> {
    try {
      // Remove from in-memory cache
      this.inMemoryCache.delete(id);
      
      // Remove from IndexedDB
      await this.db.soundfonts.delete(id);
      
      console.log(`Soundfont ${id} removed from cache`);
    } catch (error) {
      console.error(`Error removing soundfont ${id} from cache:`, error);
      throw error;
    }
  }

  /**
   * Clear all soundfonts from the cache
   */
  public async clearAllSoundfonts(): Promise<void> {
    try {
      // Clear in-memory cache
      this.inMemoryCache.clear();
      
      // Clear IndexedDB
      await this.db.soundfonts.clear();
      
      console.log('All soundfonts cleared from cache');
    } catch (error) {
      console.error('Error clearing all soundfonts from cache:', error);
      throw error;
    }
  }
}

export default SoundfontManager;