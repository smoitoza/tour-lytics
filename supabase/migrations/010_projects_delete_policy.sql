-- Allow deletion of projects via anon key (access control enforced at API level)
CREATE POLICY "Allow public delete" ON projects FOR DELETE USING (true);

-- Notify PostgREST to refresh schema cache
NOTIFY pgrst, 'reload schema';
