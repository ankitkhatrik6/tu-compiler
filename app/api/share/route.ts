import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SHARES_FILE = path.join(DATA_DIR, 'shares.json');

async function ensureDataFile() {
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

    await ensureDataFile();

    const fileContent = await fs.readFile(SHARES_FILE, 'utf-8');
    const shares = JSON.parse(fileContent);

    // Clean up expired codes
    const now = Date.now();
    for (const key in shares) {
      if (shares[key].expiresAt < now) {
        delete shares[key];
      }
    }

    // Generate unique 4-digit code
    let code: string;
    do {
      code = Math.floor(1000 + Math.random() * 9000).toString();
    } while (shares[code]);

    // Save with 48 hours expiration
    shares[code] = {
      items,
      expiresAt: now + 48 * 60 * 60 * 1000,
    };

    await fs.writeFile(SHARES_FILE, JSON.stringify(shares, null, 2), 'utf-8');

    return NextResponse.json({ code, expiresAt: shares[code].expiresAt });
  } catch (error) {
    console.error('Error creating share:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
