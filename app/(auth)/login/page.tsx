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
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ backgroundColor: '#0f172a' }}>

      {/* Decoração: vassoura — canto superior esquerdo */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 80 220"
        width="80" height="220"
        style={{ position: 'absolute', top: -20, left: -10, opacity: 0.07, transform: 'rotate(-20deg)', transformOrigin: 'center' }}
        aria-hidden="true"
      >
        {/* cabo */}
        <rect x="36" y="0" width="8" height="150" rx="4" fill="white"/>
        {/* cabeça da vassoura */}
        <rect x="10" y="148" width="60" height="14" rx="3" fill="white"/>
        {/* cerdas */}
        {[14,22,30,38,46,54,62].map((x, i) => (
          <line key={i} x1={x} y1="162" x2={x - 4 + i * 1.2} y2="200" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        ))}
      </svg>

      {/* Decoração: rodo — canto superior direito */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 80 200"
        width="80" height="200"
        style={{ position: 'absolute', top: -10, right: 10, opacity: 0.07, transform: 'rotate(25deg)', transformOrigin: 'center' }}
        aria-hidden="true"
      >
        {/* cabo */}
        <rect x="36" y="0" width="8" height="145" rx="4" fill="white"/>
        {/* cabeça do rodo */}
        <rect x="8" y="143" width="64" height="12" rx="6" fill="white"/>
        {/* borracha */}
        <rect x="12" y="155" width="56" height="6" rx="3" fill="white" opacity="0.6"/>
      </svg>

      {/* Decoração: balde — canto inferior esquerdo */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 120"
        width="100" height="120"
        style={{ position: 'absolute', bottom: 20, left: 20, opacity: 0.07, transform: 'rotate(10deg)', transformOrigin: 'center' }}
        aria-hidden="true"
      >
        {/* alça */}
        <path d="M28 20 Q50 5 72 20" stroke="white" strokeWidth="5" fill="none" strokeLinecap="round"/>
        {/* corpo */}
        <path d="M18 30 L26 100 Q50 110 74 100 L82 30 Z" fill="white"/>
        {/* borda */}
        <rect x="14" y="25" width="72" height="10" rx="4" fill="white"/>
        {/* linha de água */}
        <path d="M30 68 Q50 60 70 68" stroke="#0f172a" strokeWidth="3" fill="none" opacity="0.4"/>
      </svg>

      {/* Decoração: mop — canto inferior direito */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 80 230"
        width="80" height="230"
        style={{ position: 'absolute', bottom: -20, right: 20, opacity: 0.07, transform: 'rotate(-15deg)', transformOrigin: 'center' }}
        aria-hidden="true"
      >
        {/* cabo */}
        <rect x="36" y="0" width="8" height="130" rx="4" fill="white"/>
        {/* cabeça do mop */}
        <rect x="20" y="128" width="40" height="10" rx="3" fill="white"/>
        {/* franjas */}
        {[22,28,34,40,46,52,58].map((x, i) => (
          <path key={i} d={`M${x} 138 Q${x + (i % 2 === 0 ? -4 : 4)} ${168} ${x + (i % 2 === 0 ? -2 : 2)} 195`} stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        ))}
      </svg>

      {/* Decoração: vassoura pequena — centro direita */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 50 140"
        width="50" height="140"
        style={{ position: 'absolute', top: '40%', right: 40, opacity: 0.04, transform: 'rotate(5deg)', transformOrigin: 'center' }}
        aria-hidden="true"
      >
        <rect x="22" y="0" width="6" height="95" rx="3" fill="white"/>
        <rect x="6" y="93" width="38" height="10" rx="2" fill="white"/>
        {[10,16,22,28,34,40].map((x, i) => (
          <line key={i} x1={x} y1="103" x2={x - 2 + i} y2="130" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        ))}
      </svg>

      {/* Decoração: spray — centro esquerda */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 60 110"
        width="60" height="110"
        style={{ position: 'absolute', top: '35%', left: 50, opacity: 0.05, transform: 'rotate(-8deg)', transformOrigin: 'center' }}
        aria-hidden="true"
      >
        {/* corpo do spray */}
        <rect x="18" y="30" width="30" height="55" rx="6" fill="white"/>
        {/* gatilho */}
        <path d="M18 55 L6 68 L14 72 L18 65" fill="white"/>
        {/* bico */}
        <rect x="32" y="22" width="16" height="10" rx="3" fill="white"/>
        <rect x="46" y="24" width="12" height="4" rx="2" fill="white"/>
        {/* gotas */}
        <circle cx="62" cy="22" r="2.5" fill="white" opacity="0.7"/>
        <circle cx="56" cy="14" r="2" fill="white" opacity="0.5"/>
        <circle cx="54" cy="8" r="1.5" fill="white" opacity="0.3"/>
        {/* cabeça */}
        <rect x="20" y="18" width="26" height="14" rx="6" fill="white"/>
      </svg>

      {/* Card de login */}
      <div className="w-full max-w-sm relative z-10">
        <div
          className="rounded-2xl p-8 space-y-8"
          style={{
            background: 'rgba(255,255,255,0.97)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
          }}
        >
          {/* Identidade */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold select-none text-white"
              style={{ backgroundColor: '#0f172a' }}
            >
              D
            </div>
            <div className="space-y-1 text-center">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                Demax Gestão
              </h1>
              <p className="text-sm text-slate-400">
                Acesse sua conta para continuar
              </p>
            </div>
          </div>

          {/* Formulário */}
          <form action={login} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium leading-none text-slate-700">
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
                className="flex h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:border-transparent aria-[invalid=true]:border-red-400 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium leading-none text-slate-700">
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
                className="flex h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:border-transparent aria-[invalid=true]:border-red-400 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {hasError && (
              <p role="alert" className="text-sm text-red-500">
                E-mail ou senha inválidos. Verifique as credenciais e tente novamente.
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full mt-2 text-white"
              style={{ backgroundColor: '#0f172a' }}
            >
              Entrar
            </Button>
          </form>
        </div>

        {/* Rodapé */}
        <p className="text-center text-xs text-slate-500 mt-6">
          Demax Serviços Ambientais
        </p>
      </div>
    </main>
  )
}
