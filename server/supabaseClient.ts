import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export type SupabaseServerConfig = {
  url?: string
  serviceRoleKey?: string
}

export class SupabaseConfigurationError extends Error {
  readonly code = "SUPABASE_NOT_CONFIGURED"

  constructor() {
    super("O catálogo persistente ainda não está configurado neste servidor local.")
    this.name = "SupabaseConfigurationError"
  }
}

export function createServerSupabase(config: SupabaseServerConfig): SupabaseClient {
  const url = config.url?.trim()
  const serviceRoleKey = config.serviceRoleKey?.trim()
  if (!url || !serviceRoleKey) throw new SupabaseConfigurationError()
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ofertalab-local-server/0.1" } },
  })
}
