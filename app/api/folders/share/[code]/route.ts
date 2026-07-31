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

async function getLocalShareByCode(code: string): Promise<SharedFolderRecord | null> {
  try {
    const data = await fs.readFile(SHARES_FILE, 'utf-8');
    const shares: Record<string, SharedFolderRecord> = JSON.parse(data);
    return shares[code] || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const formattedCode = code?.trim().toUpperCase();

    if (!formattedCode || formattedCode.length !== 6) {
      return NextResponse.json({ error: 'Share code must be a 6-character code' }, { status: 400 });
    }

    let shareRecord: SharedFolderRecord | null = null;
    const supabaseAdmin = getSupabaseAdmin();

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('folder_shares')
        .select('*')
        .eq('share_code', formattedCode)
        .maybeSingle();

      if (data && !error) {
        shareRecord = data as SharedFolderRecord;
      }
    }

    if (!shareRecord) {
      shareRecord = await getLocalShareByCode(formattedCode);
    }

    if (!shareRecord) {
      return NextResponse.json({ error: 'Share code not found or invalid' }, { status: 404 });
    }

    if (!shareRecord.is_active) {
      return NextResponse.json({ error: 'Sharing for this folder has been disabled by the owner' }, { status: 403 });
    }

    if (shareRecord.expires_at && new Date(shareRecord.expires_at) < new Date()) {
      // Record is expired, delete it
      if (supabaseAdmin) {
        await supabaseAdmin.from('folder_shares').delete().eq('share_code', formattedCode);
      }
      try {
        const data = await fs.readFile(SHARES_FILE, 'utf-8');
        const shares = JSON.parse(data);
        if (shares[formattedCode]) {
          delete shares[formattedCode];
          await fs.writeFile(SHARES_FILE, JSON.stringify(shares, null, 2), 'utf-8');
        }
      } catch (e) {
        // Ignore local read/write error on cleanup
      }
      return NextResponse.json({ error: 'Share code has expired' }, { status: 410 });
    }

    return NextResponse.json({
      success: true,
      shareCode: shareRecord.share_code,
      folderName: shareRecord.folder_name,
      folderId: shareRecord.folder_id,
      items: shareRecord.folder_data?.items || [],
      createdAt: shareRecord.created_at,
      expiresAt: shareRecord.expires_at,
    });
  } catch (error) {
    console.error('Error fetching share code details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Verify and generate fresh copy for import
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const formattedCode = code?.trim().toUpperCase();

    if (!formattedCode || formattedCode.length !== 6) {
      return NextResponse.json({ error: 'Invalid share code format' }, { status: 400 });
    }

    let shareRecord: SharedFolderRecord | null = null;
    const supabaseAdmin = getSupabaseAdmin();

    if (supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from('folder_shares')
        .select('*')
        .eq('share_code', formattedCode)
        .maybeSingle();

      if (data) {
        shareRecord = data as SharedFolderRecord;
      }
    }

    if (!shareRecord) {
      shareRecord = await getLocalShareByCode(formattedCode);
    }

    if (!shareRecord) {
      return NextResponse.json({ error: 'Folder share code not found' }, { status: 404 });
    }

    if (!shareRecord.is_active) {
      return NextResponse.json({ error: 'Sharing for this folder has been disabled' }, { status: 403 });
    }

    if (shareRecord.expires_at && new Date(shareRecord.expires_at) < new Date()) {
      // Record is expired, delete it
      if (supabaseAdmin) {
        await supabaseAdmin.from('folder_shares').delete().eq('share_code', formattedCode);
      }
      try {
        const data = await fs.readFile(SHARES_FILE, 'utf-8');
        const shares = JSON.parse(data);
        if (shares[formattedCode]) {
          delete shares[formattedCode];
          await fs.writeFile(SHARES_FILE, JSON.stringify(shares, null, 2), 'utf-8');
        }
      } catch (e) {
        // Ignore local cleanup error
      }
      return NextResponse.json({ error: 'Share code has expired' }, { status: 410 });
    }

    const originalItems = shareRecord.folder_data?.items || [];
    const rootFolderName = shareRecord.folder_name || 'Imported Folder';

    // Map old IDs to newly generated unique IDs to guarantee complete independence
    const idMap = new Map<string, string>();
    const timestamp = Date.now();

    // Find the original root folder item
    const rootItem = originalItems.find(
      (item) => item.type === 'folder' && (item.id === shareRecord?.folder_id || item.parentId === null)
    );

    const newRootFolderId = `folder-imported-${timestamp}-${Math.floor(Math.random() * 10000)}`;
    
    if (rootItem) {
      idMap.set(rootItem.id, newRootFolderId);
    }

    // Generate new IDs for all child items
    originalItems.forEach((item) => {
      if (!idMap.has(item.id)) {
        const prefix = item.type === 'folder' ? 'folder' : 'file';
        idMap.set(item.id, `${prefix}-imp-${timestamp}-${Math.floor(Math.random() * 10000)}`);
      }
    });

    // Build the brand new copied array with mapped IDs
    const clonedItems = originalItems.map((item) => {
      const isRoot = item.id === (rootItem ? rootItem.id : shareRecord?.folder_id);
      const newId = idMap.get(item.id)!;
      let newParentId: string | null = null;

      if (!isRoot && item.parentId) {
        newParentId = idMap.get(item.parentId) || newRootFolderId;
      }

      return {
        id: newId,
        name: isRoot ? `${rootFolderName} (Imported)` : item.name,
        type: item.type,
        parentId: isRoot ? null : newParentId,
        content: item.content !== undefined ? item.content : '',
      };
    });

    return NextResponse.json({
      success: true,
      importedFolderName: `${rootFolderName} (Imported)`,
      importedFolderId: newRootFolderId,
      items: clonedItems,
    });
  } catch (error) {
    console.error('Error importing shared folder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
