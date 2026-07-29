import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SHARES_FILE = path.join(DATA_DIR, 'shares.json');

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;

    if (!code || code.length !== 4) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

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
  } catch (error) {
    console.error('Error fetching share:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
