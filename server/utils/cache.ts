/**
 * In-memory cache utility with TTL (Time To Live) support
 * Used to improve response times for frequently accessed data that doesn't change often
 */

type CacheEntry<T> = {
  value: T;
  expiry: number;
};

class MemoryCache {
  private cache: Map<string, CacheEntry<any>>;
  private defaultTtl: number;

  /**
   * Create a new memory cache
   * @param defaultTtl Default time-to-live in seconds
   */
  constructor(defaultTtl = 30) {
    this.cache = new Map();
    this.defaultTtl = defaultTtl;
  }

  /**
   * Store a value in the cache
   * @param key Cache key
   * @param value Value to store
   * @param ttl Time-to-live in seconds
   */
  set<T>(key: string, value: T, ttl = this.defaultTtl): void {
    const expiry = Date.now() + ttl * 1000;
    this.cache.set(key, { value, expiry });
  }

  /**
   * Get a value from the cache if it exists and hasn't expired
   * @param key Cache key
   * @returns The cached value or undefined if not found or expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    // If entry doesn't exist or has expired
    if (!entry || entry.expiry < Date.now()) {
      if (entry) {
        // Clean up expired entry
        this.delete(key);
      }
      return undefined;
    }
    
    return entry.value as T;
  }

  /**
   * Delete a value from the cache
   * @param key Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all values from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of items in the cache
   */
  size(): number {
    // Clean up expired entries before counting
    this.cleanExpired();
    return this.cache.size;
  }

  /**
   * Clean up expired entries
   */
  cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry < now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get or set value (compute if not in cache)
   * @param key Cache key
   * @param computeFn Function to compute the value if not in cache
   * @param ttl Time-to-live in seconds
   */
  async getOrSet<T>(key: string, computeFn: () => Promise<T>, ttl = this.defaultTtl): Promise<T> {
    // Check for cached value
    const cachedValue = this.get<T>(key);
    if (cachedValue !== undefined) {
      return cachedValue;
    }
    
    console.log(`Cache miss for key: ${key}, computing value...`);
    
    // Compute new value
    const value = await computeFn();
    
    // Cache the result
    this.set(key, value, ttl);
    
    return value;
  }
}

// Create a cache instance with a 30-second TTL
export const cache = new MemoryCache(30);