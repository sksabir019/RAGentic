import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

export async function setupRedis(): Promise<RedisClientType> {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  redisClient = createClient({ url: redisUrl });

  redisClient.on('error', (err) => console.error('Redis Client Error', err));
  redisClient.on('connect', () => console.log('Redis connected'));

  await redisClient.connect();
  return redisClient;
}

export function getRedis(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
  }
}

// Helper functions
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  const value = await redis.get(key);
  return value ? JSON.parse(value) : null;
}

export async function cacheSet<T>(
  key: string,
  value: T,
  expirySeconds?: number
): Promise<void> {
  const redis = getRedis();
  const options = expirySeconds ? { EX: expirySeconds } : {};
  await redis.set(key, JSON.stringify(value), options);
}

export async function cacheDelete(key: string): Promise<void> {
  const redis = getRedis();
  await redis.del(key);
}

export async function cacheExists(key: string): Promise<boolean> {
  const redis = getRedis();
  return (await redis.exists(key)) === 1;
}
