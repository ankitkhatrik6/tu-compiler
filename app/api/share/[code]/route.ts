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
const redis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  ? new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
  : null;

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;

    if (!code || code.length !== 4) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    if (redis) {
      const shareData = await redis.get<{ items: any[], expiresAt: number }>(`share:${code}`);
      
      if (!shareData) {
        return NextResponse.json({ error: 'Code not found' }, { status: 404 });
      }

      if (shareData.expiresAt < Date.now()) {
        await redis.del(`share:${code}`);
        return NextResponse.json({ error: 'Code expired' }, { status: 410 });
      }

      return NextResponse.json({ items: shareData.items });
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
