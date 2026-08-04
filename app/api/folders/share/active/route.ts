import { NextResponse } from 'next/server';
import { getSupabaseAdmin, SharedFolderRecord } from '@/lib/utils';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

const DATA_DIR = process.env.NODE_ENV === 'production'
  ? path.join(os.tmpdir(), 'tucompiler_shares')
  : path.join(process.cwd(), 'data');
const SHARES_FILE = path.join(DATA_DIR, 'folder_shares.json');

async function getLocalShares(): Promise<Record<string, SharedFolderRecord>> {
  try {
    const data = await fs.readFile(SHARES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    if (!bodyText) {
      return NextResponse.json({ error: 'Empty request body' }, { status: 400 });
    }
    
    const { folderIds } = JSON.parse(bodyText);
    if (!Array.isArray(folderIds)) {
      return NextResponse.json({ error: 'Invalid folderIds payload' }, { status: 400 });
    }

    if (folderIds.length === 0) {
      return NextResponse.json({ shares: [] });
    }

    const supabaseAdmin = getSupabaseAdmin();

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('folder_shares')
        .select('share_code, folder_id, folder_name, is_active, expires_at')
        .in('folder_id', folderIds)
        .eq('is_active', true);

      if (!error && data) {
        // Filter out expired shares
        const activeShares = data.filter((d: any) => {
          if (!d.expires_at) return false;
          return new Date(d.expires_at).getTime() > Date.now();
        });
        
        return NextResponse.json({ shares: activeShares });
      }
    }

    // Fallback local persistence
    const shares = await getLocalShares();
    const localActiveShares = Object.values(shares).filter(s => 
      folderIds.includes(s.folder_id) && 
      s.is_active && 
      s.expires_at && 
      new Date(s.expires_at).getTime() > Date.now()
    );

    return NextResponse.json({ 
      shares: localActiveShares.map(s => ({
        share_code: s.share_code,
        folder_id: s.folder_id,
        folder_name: s.folder_name,
        is_active: s.is_active,
        expires_at: s.expires_at
      }))
    });
  } catch (error) {
    console.error('Error fetching active shares:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
