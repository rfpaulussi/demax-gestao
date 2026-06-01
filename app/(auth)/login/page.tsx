import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

async function login(formData: FormData) {
  'use server'

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/login?error=credentials')
  }

  redirect('/dashboard')
}

type Props = {
  searchParams: { error?: string }
}

export default async function LoginPage({ searchParams }: Props) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  const hasError = searchParams.error === 'credentials'

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border bg-background p-8 shadow-sm space-y-8">

          {/* Identidade */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold select-none">
              D
            </div>
            <div className="space-y-1 text-center">
              <h1 className="text-xl font-semibold tracking-tight">
                Demax Gestão
              </h1>
              <p className="text-sm text-muted-foreground">
                Acesse sua conta para continuar
              </p>
            </div>
          </div>

          {/* Formulário */}
          <form action={login} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-sm font-medium leading-none"
              >
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="voce@empresa.com"
                aria-invalid={hasError}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium leading-none"
              >
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={hasError}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {hasError && (
              <p role="alert" className="text-sm text-destructive">
                E-mail ou senha inválidos. Verifique as credenciais e tente
                novamente.
              </p>
            )}

            <Button type="submit" size="lg" className="w-full mt-2">
              Entrar
            </Button>
          </form>

        </div>
      </div>
    </main>
  )
}
