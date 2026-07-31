-- Supabase Database Schema for TU Compiler Folder Sharing
-- Run this SQL in your Supabase SQL Editor to initialize all tables, RLS policies, indexes, and functions.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Folders Table
CREATE TABLE IF NOT EXISTS public.folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Files Table
CREATE TABLE IF NOT EXISTS public.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    content TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Folder Shares Table
CREATE TABLE IF NOT EXISTS public.folder_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id TEXT NOT NULL, -- Matches local or DB folder ID
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    folder_name TEXT NOT NULL,
    share_code CHAR(6) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    folder_data JSONB NOT NULL, -- Full folder snapshot (tree of files/subfolders)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Ensure the column exists if the table was created previously without it
ALTER TABLE public.folder_shares ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours');

-- 4. Indexes for rapid lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_folder_shares_share_code ON public.folder_shares(share_code);
CREATE INDEX IF NOT EXISTS idx_folder_shares_folder_id ON public.folder_shares(folder_id);
CREATE INDEX IF NOT EXISTS idx_folder_shares_owner_id ON public.folder_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders(user_id);
CREATE INDEX IF NOT EXISTS idx_files_user_id ON public.files(user_id);

-- 5. Function to generate guaranteed unique 6-character uppercase alphanumeric code
CREATE OR REPLACE FUNCTION generate_unique_share_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Excludes confusing chars (0, O, 1, I)
    result TEXT := '';
    i INTEGER := 0;
    code_exists BOOLEAN := TRUE;
BEGIN
    WHILE code_exists LOOP
        result := '';
        FOR i IN 1..6 LOOP
            result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
        END LOOP;
        SELECT EXISTS(SELECT 1 FROM public.folder_shares WHERE share_code = result) INTO code_exists;
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folder_shares ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
-- Folders Policies
DROP POLICY IF EXISTS "Users can manage their own folders" ON public.folders;
CREATE POLICY "Users can manage their own folders" 
ON public.folders FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Files Policies
DROP POLICY IF EXISTS "Users can manage their own files" ON public.files;
CREATE POLICY "Users can manage their own files" 
ON public.files FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Folder Shares Policies
-- Owners can manage (insert/update/delete) their folder shares
DROP POLICY IF EXISTS "Owners can manage their folder shares" ON public.folder_shares;
CREATE POLICY "Owners can manage their folder shares"
ON public.folder_shares FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Public / Authenticated users can read active shared folders using a share code
DROP POLICY IF EXISTS "Anyone can read active shared folders" ON public.folder_shares;
CREATE POLICY "Anyone can read active shared folders"
ON public.folder_shares FOR SELECT
USING (is_active = TRUE);

-- 8. Storage bucket setup for exported archives or QR assets if needed
INSERT INTO storage.buckets (id, name, public) 
VALUES ('folder-shares', 'folder-shares', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access to Folder Shares Bucket" ON storage.objects;
CREATE POLICY "Public Access to Folder Shares Bucket" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'folder-shares');
