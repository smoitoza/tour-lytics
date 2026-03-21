-- Add route_optimization to the token_pricing table
-- Tour Day: multi-stop route optimization via Google Directions API
INSERT INTO token_pricing (action_type, display_name, token_cost, category, is_active, description)
VALUES (
  'route_optimization',
  'Tour Day Route',
  5,
  'data',
  true,
  'Optimize a multi-stop tour route with turn-by-turn directions'
)
ON CONFLICT (action_type) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  token_cost = EXCLUDED.token_cost,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Update chat_message to reference Scout (renamed from Tour Book AI)
UPDATE token_pricing
SET display_name = 'Scout Message',
    description = 'Single message to Scout, your AI market intelligence assistant',
    updated_at = now()
WHERE action_type = 'chat_message';
