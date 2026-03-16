import { createClient } from '@supabase/supabase-js'

// Use service role for token operations to bypass RLS and ensure atomicity
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Anon client for read-only queries (respects RLS)
function getAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ============================================================
// Action types - keep in sync with token_pricing table
// ============================================================
export type TokenAction =
  | 'chat_message'
  | 'rfp_analysis'
  | 'survey_upload'
  | 'photo_analysis'
  | 'photo_bulk_analysis'
  | 'commute_study'
  | 'assumptions_update'

// ============================================================
// Debit tokens for an AI action
// Returns { success, cost, balance_after } or throws on failure
// ============================================================
export async function debitTokens(opts: {
  projectId: string
  action: TokenAction
  userEmail?: string
  referenceId?: string
  metadata?: Record<string, any>
  note?: string
}): Promise<{ success: boolean; cost: number; balance_after: number; transaction_id: string }> {
  const supabase = getAdminClient()

  const { data, error } = await supabase.rpc('debit_tokens', {
    p_project_id: opts.projectId,
    p_action_type: opts.action,
    p_user_email: opts.userEmail || null,
    p_reference_id: opts.referenceId || null,
    p_metadata: opts.metadata || {},
    p_note: opts.note || null,
  })

  if (error) {
    // Check if it's an insufficient balance error
    if (error.message?.includes('Insufficient token balance')) {
      return {
        success: false,
        cost: 0,
        balance_after: 0,
        transaction_id: '',
      }
    }
    throw new Error(`Token debit failed: ${error.message}`)
  }

  return {
    success: data.success,
    cost: data.cost,
    balance_after: data.balance_after,
    transaction_id: data.transaction_id,
  }
}

// ============================================================
// Credit tokens (purchase, bonus, refund)
// ============================================================
export async function creditTokens(opts: {
  projectId: string
  amount: number
  userEmail?: string
  note?: string
}): Promise<{ success: boolean; amount: number; balance_after: number }> {
  const supabase = getAdminClient()

  const { data, error } = await supabase.rpc('credit_tokens', {
    p_project_id: opts.projectId,
    p_amount: opts.amount,
    p_user_email: opts.userEmail || null,
    p_note: opts.note || 'Token purchase',
  })

  if (error) {
    throw new Error(`Token credit failed: ${error.message}`)
  }

  return {
    success: data.success,
    amount: data.amount,
    balance_after: data.balance_after,
  }
}

// ============================================================
// Get current balance for a project
// ============================================================
export async function getTokenBalance(projectId: string): Promise<{
  balance: number
  total_purchased: number
  total_consumed: number
  low_balance_threshold: number
} | null> {
  const supabase = getAnonClient()

  const { data, error } = await supabase
    .from('token_balances')
    .select('balance, total_purchased, total_consumed, low_balance_threshold')
    .eq('project_id', projectId)
    .single()

  if (error) return null
  return data
}

// ============================================================
// Get transaction history for a project (paginated)
// ============================================================
export async function getTokenTransactions(opts: {
  projectId: string
  limit?: number
  offset?: number
  actionType?: string
  userEmail?: string
}): Promise<any[]> {
  const supabase = getAnonClient()

  let query = supabase
    .from('token_transactions')
    .select('*')
    .eq('project_id', opts.projectId)
    .order('created_at', { ascending: false })

  if (opts.actionType) query = query.eq('action_type', opts.actionType)
  if (opts.userEmail) query = query.eq('user_email', opts.userEmail)
  if (opts.limit) query = query.limit(opts.limit)
  if (opts.offset) query = query.range(opts.offset, opts.offset + (opts.limit || 50) - 1)

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch transactions: ${error.message}`)
  return data || []
}

// ============================================================
// Get usage summary (for dashboard charts)
// ============================================================
export async function getUsageSummary(projectId: string): Promise<any[]> {
  const supabase = getAnonClient()

  const { data, error } = await supabase
    .from('token_usage_summary')
    .select('*')
    .eq('project_id', projectId)

  if (error) throw new Error(`Failed to fetch usage summary: ${error.message}`)
  return data || []
}

// ============================================================
// Get pricing table (for display in UI)
// ============================================================
export async function getTokenPricing(): Promise<any[]> {
  const supabase = getAnonClient()

  const { data, error } = await supabase
    .from('token_pricing')
    .select('*')
    .eq('is_active', true)
    .order('token_cost', { ascending: true })

  if (error) throw new Error(`Failed to fetch pricing: ${error.message}`)
  return data || []
}

// ============================================================
// Check if project has enough tokens for an action
// (Read-only check, does NOT debit)
// ============================================================
export async function canAffordAction(projectId: string, action: TokenAction): Promise<{
  canAfford: boolean
  balance: number
  cost: number
}> {
  const supabase = getAnonClient()

  // Get the cost
  const { data: pricing } = await supabase
    .from('token_pricing')
    .select('token_cost')
    .eq('action_type', action)
    .eq('is_active', true)
    .single()

  const cost = pricing?.token_cost ?? 0

  // Get the balance
  const { data: bal } = await supabase
    .from('token_balances')
    .select('balance')
    .eq('project_id', projectId)
    .single()

  const balance = bal?.balance ?? 0

  return {
    canAfford: balance >= cost,
    balance,
    cost,
  }
}
