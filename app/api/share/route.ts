import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Redis } from '@upstash/redis';

// Use /tmp in production (Vercel) to avoid EROFS read-only filesystem errors
const DATA_DIR = process.env.NODE_ENV === 'production' 
  ? path.join(os.tmpdir(), 'tucompiler_data') 
  : path.join(process.cwd(), 'data');
const SHARES_FILE = path.join(DATA_DIR, 'shares.json');

// Initialize Redis if configured
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const redis = redisUrl && redisToken
  ? new Redis({
      url: redisUrl,
      token: redisToken,
    })
  : null;

async function ensureDataFile() {
  if (redis) return; // Not needed for Redis

  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  try {
    await fs.access(SHARES_FILE);
  } catch {
    await fs.writeFile(SHARES_FILE, JSON.stringify({}), 'utf-8');
  }
}

export async function POST(request: Request) {
  try {
    const { items } = await request.json();

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const now = Date.now();
    const expiresAt = now + 48 * 60 * 60 * 1000;
    
    // Generate unique 4-digit code
    let code: string;
    
    if (redis) {
      // Redis implementation
      let isUnique = false;
      do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
        const exists = await redis.exists(`share:${code}`);
        if (!exists) isUnique = true;
      } while (!isUnique);

      // Save with 48 hours expiration (EX expects seconds)
      await redis.set(`share:${code}`, { items, expiresAt }, { ex: 48 * 60 * 60 });
    } else {
      // Local FileSystem implementation
      await ensureDataFile();

      const fileContent = await fs.readFile(SHARES_FILE, 'utf-8');
      const shares = JSON.parse(fileContent);

      // Clean up expired codes
      for (const key in shares) {
        if (shares[key].expiresAt < now) {
          delete shares[key];
        }
      }

      do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
      } while (shares[code]);

      shares[code] = {
        items,
        expiresAt,
      };

      await fs.writeFile(SHARES_FILE, JSON.stringify(shares, null, 2), 'utf-8');
    }

    return NextResponse.json({ code, expiresAt });
  } catch (error) {
    console.error('Error creating share:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
