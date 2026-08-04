import { NextResponse } from 'next/server';
import { getSupabaseAdmin, generateShareCode, SharedFolderRecord } from '@/lib/utils';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

// Local storage fallback path for environments before Supabase keys are configured
const DATA_DIR = process.env.NODE_ENV === 'production'
  ? path.join(os.tmpdir(), 'tucompiler_shares')
  : path.join(process.cwd(), 'data');
const SHARES_FILE = path.join(DATA_DIR, 'folder_shares.json');

async function getLocalShares(): Promise<Record<string, SharedFolderRecord>> {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
  try {
    const data = await fs.readFile(SHARES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveLocalShares(shares: Record<string, SharedFolderRecord>) {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
  await fs.writeFile(SHARES_FILE, JSON.stringify(shares, null, 2), 'utf-8');
}

// POST: Get existing share code or create a new one for folder
export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    if (!bodyText) {
      return NextResponse.json({ error: 'Empty request body' }, { status: 400 });
    }
    
    const { folderId, folderName, items } = JSON.parse(bodyText);

    if (!folderId || !folderName || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid folder or items payload' }, { status: 400 });
    }

    const folderData = {
      folder: { id: folderId, name: folderName },
      items,
    };

    const supabaseAdmin = getSupabaseAdmin();

    if (supabaseAdmin) {
      // 1. Check if a share code already exists for this folder_id
      const { data: existingRecords, error: checkError } = await supabaseAdmin
        .from('folder_shares')
        .select('share_code, is_active, expires_at')
        .eq('folder_id', folderId)
        .order('created_at', { ascending: false })
        .limit(1);

      const existing = existingRecords?.[0];

      if (!checkError && existing && existing.share_code) {
        const isExpired = existing.expires_at && new Date(existing.expires_at).getTime() < Date.now();

        if (isExpired) {
          // Delete expired code so a new one is generated
          await supabaseAdmin.from('folder_shares').delete().eq('folder_id', folderId);
        } else {
          // Existing active code, don't generate a new one, maintain expires_at
          await supabaseAdmin
            .from('folder_shares')
            .update({
              folder_name: folderName,
              folder_data: folderData,
              updated_at: new Date().toISOString(),
            })
            .eq('folder_id', folderId);

          return NextResponse.json({
            success: true,
            shareCode: existing.share_code,
            folderId,
            folderName,
            is_active: existing.is_active ?? true,
            expiresAt: existing.expires_at,
          });
        }
      }

      // If table doesn't exist (PGRST205), skip Supabase and use local fallback directly
      if (!checkError) {
        // 2. Generate a new unique code if no share record exists
        let shareCode = generateShareCode();
        let attempts = 0;
        let isUnique = false;
        while (!isUnique && attempts < 10) {
          attempts++;
          const { data } = await supabaseAdmin
            .from('folder_shares')
            .select('share_code')
            .eq('share_code', shareCode)
            .limit(1);

          if (!data) {
            isUnique = true;
          } else {
            shareCode = generateShareCode();
          }
        }

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        
        // Insert share record into Supabase (instead of upsert to avoid onConflict unique constraint issues if user hasn't run schema update)
        const { error } = await supabaseAdmin
          .from('folder_shares')
          .insert(
            {
              folder_id: folderId,
              folder_name: folderName,
              share_code: shareCode,
              is_active: true,
              folder_data: folderData,
              updated_at: new Date().toISOString(),
              expires_at: expiresAt,
            }
          );

        if (!error) {
          return NextResponse.json({
            success: true,
            shareCode,
            folderId,
            folderName,
            is_active: true,
            expiresAt,
          });
        }

        console.error("Supabase insert error:", error);
        console.log('Supabase table folder_shares unavailable, using local storage fallback.');
      } else {
        console.error("Supabase check error:", checkError);
        console.log('Supabase table folder_shares unavailable, using local storage fallback.');
      }
    }

    // Fallback local persistence
    const shares = await getLocalShares();

      const existingEntry = Object.values(shares).find((s) => s.folder_id === folderId);
      if (existingEntry) {
        const isExpired = existingEntry.expires_at && new Date(existingEntry.expires_at).getTime() < Date.now();
        if (isExpired) {
          delete shares[existingEntry.share_code];
        } else {
          existingEntry.folder_name = folderName;
          existingEntry.folder_data = folderData;
          await saveLocalShares(shares);

          return NextResponse.json({
            success: true,
            shareCode: existingEntry.share_code,
            folderId,
            folderName,
            is_active: existingEntry.is_active ?? true,
            expiresAt: existingEntry.expires_at,
          });
        }
      }

      let shareCode = generateShareCode();
      let attempts = 0;
      while (shares[shareCode] && attempts < 10) {
        attempts++;
        shareCode = generateShareCode();
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      shares[shareCode] = {
        folder_id: folderId,
        folder_name: folderName,
        share_code: shareCode,
        is_active: true,
        folder_data: folderData,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      };
      await saveLocalShares(shares);

      return NextResponse.json({
        success: true,
        shareCode,
        folderId,
        folderName,
        is_active: true,
        expiresAt,
      });
  } catch (error) {
    console.error('Error creating folder share:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Regenerate Share Code for a folder
export async function PUT(request: Request) {
  try {
    const { folderId, folderName, items, oldCode } = await request.json();

    if (!folderId) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    let newCode = generateShareCode();

    if (supabaseAdmin) {
      // Ensure unique code
      let attempts = 0;
      let isUnique = false;
      while (!isUnique && attempts < 10) {
        attempts++;
        const { data } = await supabaseAdmin
          .from('folder_shares')
          .select('share_code')
          .eq('share_code', newCode)
          .maybeSingle();

        if (!data) {
          isUnique = true;
        } else {
          newCode = generateShareCode();
        }
      }

      // Update Supabase record with new share code
      const folderData = {
        folder: { id: folderId, name: folderName },
        items: items || [],
      };
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabaseAdmin
        .from('folder_shares')
        .update({
          share_code: newCode,
          is_active: true,
          folder_data: folderData,
          updated_at: new Date().toISOString(),
          expires_at: expiresAt,
        })
        .eq('folder_id', folderId);

      if (error) {
        console.error('Supabase regenerate share error:', error);
      }
    }

    // Also update local shares fallback
    const shares = await getLocalShares();
    if (oldCode && shares[oldCode]) {
      delete shares[oldCode];
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    shares[newCode] = {
      folder_id: folderId,
      folder_name: folderName,
      share_code: newCode,
      is_active: true,
      folder_data: {
        folder: { id: folderId, name: folderName },
        items: items || [],
      },
      updated_at: new Date().toISOString(),
      expires_at: expiresAt,
    };
    await saveLocalShares(shares);

    return NextResponse.json({
      success: true,
      shareCode: newCode,
      folderId,
      is_active: true,
      expiresAt,
    });
  } catch (error) {
    console.error('Error regenerating share code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Toggle Disable or Enable Sharing
export async function PATCH(request: Request) {
  try {
    const { folderId, shareCode, isActive } = await request.json();

    if (!shareCode && !folderId) {
      return NextResponse.json({ error: 'Share code or folder ID required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      const query = supabaseAdmin.from('folder_shares').update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      });

      if (folderId) {
        await query.eq('folder_id', folderId);
      } else if (shareCode) {
        await query.eq('share_code', shareCode);
      }
    }

    // Local fallback update
    const shares = await getLocalShares();
    for (const code in shares) {
      if (code === shareCode || shares[code].folder_id === folderId) {
        shares[code].is_active = isActive;
      }
    }
    await saveLocalShares(shares);

    return NextResponse.json({
      success: true,
      is_active: isActive,
    });
  } catch (error) {
    console.error('Error toggling share status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
