-- ===== Tour List Centralization Migration =====
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Centralized tour list managed by admin
CREATE TABLE IF NOT EXISTS tour_list_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id text NOT NULL DEFAULT 'sf-office-search',
  building_type text NOT NULL CHECK (building_type IN ('shortlist', 'survey')),
  building_id integer NOT NULL,
  building_name text NOT NULL,
  building_address text DEFAULT '',
  building_color text DEFAULT '#9ca3af',
  building_meta text DEFAULT '',
  building_tags jsonb DEFAULT '[]',
  lat double precision,
  lng double precision,
  pdf_page integer,
  tour_date text DEFAULT '',
  tour_time text DEFAULT '',
  sort_order integer DEFAULT 0,
  added_by text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, building_type, building_id)
);

-- Enable RLS
ALTER TABLE tour_list_items ENABLE ROW LEVEL SECURITY;

-- Policies (read for everyone, write for authenticated)
CREATE POLICY "Anyone can read tour list" ON tour_list_items FOR SELECT USING (true);
CREATE POLICY "Anyone can insert tour list items" ON tour_list_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tour list items" ON tour_list_items FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete tour list items" ON tour_list_items FOR DELETE USING (true);
