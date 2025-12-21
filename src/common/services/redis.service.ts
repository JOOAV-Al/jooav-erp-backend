import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';
import IORedis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private upstashClient?: Redis;
  private ioredisClient?: IORedis;
  private clientType: 'upstash' | 'traditional';

  constructor(private configService: ConfigService) {
    this.initializeClient();
  }

  private initializeClient() {
    const redisConfig = this.configService.get('redis');

    if (redisConfig?.type === 'upstash' && redisConfig.upstash) {
      // Initialize Upstash Redis client
      this.upstashClient = new Redis({
        url: redisConfig.upstash.url,
        token: redisConfig.upstash.token,
      });
      this.clientType = 'upstash';
      this.logger.log('Initialized Upstash Redis client');
    } else {
      // Initialize traditional Redis client
      const options = {
        host: redisConfig?.host || 'localhost',
        port: redisConfig?.port || 6379,
        password: redisConfig?.password,
        retryDelayOnFailover: redisConfig?.retryDelay || 1000,
        maxRetriesPerRequest: redisConfig?.retryAttempts || 3,
        lazyConnect: true,
      };

      this.ioredisClient = new IORedis(options);
      this.clientType = 'traditional';
      this.logger.log('Initialized traditional Redis client');

      // Handle connection events
      this.ioredisClient.on('connect', () => {
        this.logger.log('Connected to Redis');
      });

      this.ioredisClient.on('error', (error) => {
        this.logger.error('Redis connection error:', error);
      });
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      if (this.clientType === 'upstash' && this.upstashClient) {
        return await this.upstashClient.get(key);
      } else if (this.ioredisClient) {
        return await this.ioredisClient.get(key);
      }
      return null;
    } catch (error) {
      this.logger.error(`Error getting key ${key}:`, error);
      return null;
    }
  }

  async set(
    key: string,
    value: string,
    options?: { ex?: number; px?: number; nx?: boolean; xx?: boolean },
  ): Promise<boolean> {
    try {
      if (this.clientType === 'upstash' && this.upstashClient) {
        if (options?.ex) {
          const result = await this.upstashClient.setex(key, options.ex, value);
          return result === 'OK';
        } else if (options?.px) {
          const result = await this.upstashClient.psetex(
            key,
            options.px,
            value,
          );
          return result === 'OK';
        } else {
          const result = await this.upstashClient.set(key, value);
          return result === 'OK';
        }
      } else if (this.ioredisClient) {
        if (options?.ex) {
          const result = await this.ioredisClient.setex(key, options.ex, value);
          return result === 'OK';
        } else if (options?.px) {
          const result = await this.ioredisClient.psetex(
            key,
            options.px,
            value,
          );
          return result === 'OK';
        } else if (options?.nx) {
          const result = await this.ioredisClient.setnx(key, value);
          return result === 1;
        } else {
          const result = await this.ioredisClient.set(key, value);
          return result === 'OK';
        }
      }
      return false;
    } catch (error) {
      this.logger.error(`Error setting key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      if (this.clientType === 'upstash' && this.upstashClient) {
        const result = await this.upstashClient.del(key);
        return result > 0;
      } else if (this.ioredisClient) {
        const result = await this.ioredisClient.del(key);
        return result > 0;
      }
      return false;
    } catch (error) {
      this.logger.error(`Error deleting key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (this.clientType === 'upstash' && this.upstashClient) {
        const result = await this.upstashClient.exists(key);
        return result > 0;
      } else if (this.ioredisClient) {
        const result = await this.ioredisClient.exists(key);
        return result > 0;
      }
      return false;
    } catch (error) {
      this.logger.error(`Error checking existence of key ${key}:`, error);
      return false;
    }
  }

  async setex(key: string, seconds: number, value: string): Promise<boolean> {
    return this.set(key, value, { ex: seconds });
  }

  async ttl(key: string): Promise<number> {
    try {
      if (this.clientType === 'upstash' && this.upstashClient) {
        return await this.upstashClient.ttl(key);
      } else if (this.ioredisClient) {
        return await this.ioredisClient.ttl(key);
      }
      return -1;
    } catch (error) {
      this.logger.error(`Error getting TTL for key ${key}:`, error);
      return -1;
    }
  }

  async flushall(): Promise<boolean> {
    try {
      if (this.clientType === 'upstash' && this.upstashClient) {
        await this.upstashClient.flushall();
        return true;
      } else if (this.ioredisClient) {
        await this.ioredisClient.flushall();
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Error flushing Redis:', error);
      return false;
    }
  }

  async ping(): Promise<boolean> {
    try {
      if (this.clientType === 'upstash' && this.upstashClient) {
        const result = await this.upstashClient.ping();
        return result === 'PONG';
      } else if (this.ioredisClient) {
        const result = await this.ioredisClient.ping();
        return result === 'PONG';
      }
      return false;
    } catch (error) {
      this.logger.error('Error pinging Redis:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.ioredisClient) {
        await this.ioredisClient.disconnect();
        this.logger.log('Disconnected from traditional Redis');
      }
      // Upstash doesn't need explicit disconnection
    } catch (error) {
      this.logger.error('Error disconnecting from Redis:', error);
    }
  }
}
