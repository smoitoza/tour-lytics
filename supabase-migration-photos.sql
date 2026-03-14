-- ============================================================
-- Tour Photos + AI Vision Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Enable pgvector extension (for AI embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create building_photos table
CREATE TABLE IF NOT EXISTS building_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL DEFAULT 'sf-office-search',
  
  -- Building reference
  building_type TEXT NOT NULL,         -- 'shortlist' or 'survey'
  building_id INTEGER NOT NULL,        -- building num/id
  building_name TEXT NOT NULL,         -- e.g. '250 Brannan'
  building_address TEXT DEFAULT '',
  
  -- Photo metadata
  area_tag TEXT NOT NULL DEFAULT 'general',  -- lobby, kitchen, open_floor, conference_room, restroom, exterior, view, general
  uploaded_by TEXT NOT NULL,            -- user email
  file_name TEXT NOT NULL,             -- original filename
  file_path TEXT NOT NULL,             -- Supabase storage path
  file_url TEXT NOT NULL,              -- public URL
  file_size INTEGER DEFAULT 0,
  mime_type TEXT DEFAULT 'image/jpeg',
  
  -- AI analysis (Gemini Vision)
  ai_description TEXT,                 -- Gemini's description of the photo
  ai_tags TEXT[] DEFAULT '{}',         -- auto-generated tags like ['natural_light', 'open_plan', 'modern']
  ai_area_suggestion TEXT,             -- Gemini's suggested area tag
  ai_analyzed_at TIMESTAMPTZ,
  
  -- Embedding for RAG search
  description_embedding vector(768),   -- text-embedding-004 output (768 dims)
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_photos_project_building 
  ON building_photos(project_id, building_type, building_id);

CREATE INDEX IF NOT EXISTS idx_photos_area 
  ON building_photos(area_tag);

CREATE INDEX IF NOT EXISTS idx_photos_uploaded_by 
  ON building_photos(uploaded_by);

-- Vector similarity search index (for RAG)
CREATE INDEX IF NOT EXISTS idx_photos_embedding 
  ON building_photos 
  USING ivfflat (description_embedding vector_cosine_ops)
  WITH (lists = 10);

-- 4. RLS policies (allow all via anon key for now)
ALTER TABLE building_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on building_photos" 
  ON building_photos FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 5. Create storage bucket (run this separately if needed)
-- NOTE: You may need to create the bucket via the Supabase Dashboard:
--   Storage > New Bucket > Name: "tour-photos" > Public: ON

-- If you have access to storage admin SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('tour-photos', 'tour-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: allow uploads from anon
CREATE POLICY "Allow public uploads to tour-photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'tour-photos');

CREATE POLICY "Allow public reads from tour-photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tour-photos');

CREATE POLICY "Allow deletes from tour-photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'tour-photos');

-- 6. Function for similarity search (used by chatbot RAG)
CREATE OR REPLACE FUNCTION match_photo_descriptions(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  filter_project_id text DEFAULT 'sf-office-search'
)
RETURNS TABLE (
  id UUID,
  building_name TEXT,
  building_address TEXT,
  area_tag TEXT,
  ai_description TEXT,
  ai_tags TEXT[],
  file_url TEXT,
  uploaded_by TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bp.id,
    bp.building_name,
    bp.building_address,
    bp.area_tag,
    bp.ai_description,
    bp.ai_tags,
    bp.file_url,
    bp.uploaded_by,
    1 - (bp.description_embedding <=> query_embedding) AS similarity
  FROM building_photos bp
  WHERE bp.project_id = filter_project_id
    AND bp.ai_description IS NOT NULL
    AND bp.description_embedding IS NOT NULL
    AND 1 - (bp.description_embedding <=> query_embedding) > match_threshold
  ORDER BY bp.description_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
