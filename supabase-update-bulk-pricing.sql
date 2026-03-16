-- Update bulk photo analysis description to reflect batch pricing
UPDATE token_pricing
SET description = 'Batch AI analysis of up to 15 tour photos (8 tokens per batch of 15)',
    updated_at = now()
WHERE action_type = 'photo_bulk_analysis';
