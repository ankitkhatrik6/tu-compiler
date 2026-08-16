import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

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

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    if (redis) {
      try {
        const shareData = await redis.get<{ items: any[], expiresAt: number }>(`share:${code}`);
        
        if (!shareData) {
          return NextResponse.json({ error: 'Code not found' }, { status: 404 });
        }

        if (shareData.expiresAt < Date.now()) {
          await redis.del(`share:${code}`);
          return NextResponse.json({ error: 'Code expired' }, { status: 410 });
        }

        return NextResponse.json({ items: shareData.items, debug: { redis_active: true } });
      } catch (err) {
        console.error('Redis error:', err);
        return NextResponse.json({ error: 'Redis fetch error. Please check your Upstash DB connection.' }, { status: 500 });
      }
    } else {
      try {
        await fs.access(SHARES_FILE);
      } catch {
        return NextResponse.json({ error: 'Code not found' }, { status: 404 });
      }

      const fileContent = await fs.readFile(SHARES_FILE, 'utf-8');
      const shares = JSON.parse(fileContent);

      const shareData = shares[code];

      if (!shareData) {
        return NextResponse.json({ error: 'Code not found' }, { status: 404 });
      }

      if (shareData.expiresAt < Date.now()) {
        delete shares[code];
        await fs.writeFile(SHARES_FILE, JSON.stringify(shares, null, 2), 'utf-8');
        return NextResponse.json({ error: 'Code expired' }, { status: 410 });
      }

      return NextResponse.json({ items: shareData.items });
    }
  } catch (error) {
    console.error('Error fetching share:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
