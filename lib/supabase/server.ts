import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              // ReadonlyRequestCookies omite `set` no tipo mas é mutável em
              // Server Actions e Route Handlers; em Server Components lança e
              // o catch suprime — o middleware é responsável por atualizar a sessão.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (cookieStore as any).set(name, value, options)
            )
          } catch {
            // Server Component — sem efeito colateral necessário aqui
          }
        },
      },
    }
  )
}
