import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const hasError = searchParams.error === 'credentials'

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #0a1f0f 0%, #0f2d18 40%, #0a1f0f 100%)' }}
    >
      {/* Padrão pontilhado de fundo */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04 }}
        aria-hidden="true"
      >
        <defs>
          <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="white"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)"/>
      </svg>

      {/* Círculo de luz suave ao centro */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px', height: '600px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }}/>

      {/* ═══ VASSOURA GRANDE — canto superior esquerdo ═══ */}
      <svg aria-hidden="true" width="160" height="360"
        style={{ position: 'absolute', top: -40, left: -20, opacity: 0.18, transform: 'rotate(-25deg)', transformOrigin: '50% 30%' }}>
        {/* cabo */}
        <rect x="72" y="0" width="16" height="230" rx="8" fill="#86efac"/>
        {/* anel decorativo */}
        <rect x="66" y="210" width="28" height="8" rx="4" fill="#4ade80"/>
        {/* cabeça */}
        <rect x="16" y="218" width="128" height="22" rx="6" fill="#4ade80"/>
        <rect x="20" y="226" width="120" height="8" rx="2" fill="#22c55e"/>
        {/* cerdas */}
        {[24,36,48,60,72,84,96,108,120,132].map((x, i) => (
          <g key={i}>
            <line x1={x} y1="240" x2={x - 6 + i * 1.2} y2="330" stroke="#86efac" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1={x + 4} y1="240" x2={x - 2 + i * 1.2} y2="310" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
          </g>
        ))}
      </svg>

      {/* ═══ RODO GRANDE — canto superior direito ═══ */}
      <svg aria-hidden="true" width="160" height="320"
        style={{ position: 'absolute', top: -30, right: -20, opacity: 0.18, transform: 'rotate(30deg)', transformOrigin: '50% 20%' }}>
        {/* cabo */}
        <rect x="72" y="0" width="16" height="220" rx="8" fill="#86efac"/>
        {/* anel */}
        <rect x="60" y="195" width="40" height="10" rx="5" fill="#4ade80"/>
        {/* braço do rodo */}
        <rect x="20" y="205" width="120" height="18" rx="9" fill="#4ade80"/>
        {/* cabeça do rodo */}
        <rect x="8" y="220" width="144" height="22" rx="8" fill="#22c55e"/>
        {/* borracha */}
        <rect x="16" y="239" width="128" height="9" rx="4" fill="#16a34a"/>
        {/* reflexo */}
        <rect x="20" y="241" width="40" height="3" rx="1.5" fill="#4ade80" opacity="0.5"/>
        <rect x="88" y="241" width="40" height="3" rx="1.5" fill="#4ade80" opacity="0.5"/>
      </svg>

      {/* ═══ BALDE — canto inferior esquerdo ═══ */}
      <svg aria-hidden="true" width="180" height="200"
        style={{ position: 'absolute', bottom: -10, left: 10, opacity: 0.18, transform: 'rotate(8deg)', transformOrigin: 'center bottom' }}>
        {/* alça */}
        <path d="M50 36 Q90 8 130 36" stroke="#86efac" strokeWidth="9" fill="none" strokeLinecap="round"/>
        {/* borda superior */}
        <rect x="22" y="42" width="136" height="18" rx="7" fill="#4ade80"/>
        {/* corpo trapezoidal */}
        <path d="M28 60 L42 168 Q90 182 138 168 L152 60 Z" fill="#22c55e"/>
        {/* reflexo lateral */}
        <path d="M36 70 L46 155" stroke="#4ade80" strokeWidth="4" strokeLinecap="round" opacity="0.5"/>
        {/* nível da água */}
        <path d="M50 110 Q90 100 130 110" stroke="#86efac" strokeWidth="2.5" fill="none" opacity="0.6"/>
        <path d="M46 124 Q90 114 134 124" stroke="#86efac" strokeWidth="1.5" fill="none" opacity="0.3"/>
        {/* espuma */}
        <ellipse cx="90" cy="102" rx="30" ry="8" fill="#4ade80" opacity="0.3"/>
      </svg>

      {/* ═══ MOP — canto inferior direito ═══ */}
      <svg aria-hidden="true" width="140" height="340"
        style={{ position: 'absolute', bottom: -30, right: -10, opacity: 0.18, transform: 'rotate(-18deg)', transformOrigin: '50% 30%' }}>
        {/* cabo */}
        <rect x="62" y="0" width="16" height="185" rx="8" fill="#86efac"/>
        {/* anel */}
        <rect x="50" y="168" width="40" height="10" rx="5" fill="#4ade80"/>
        {/* cabeça do mop */}
        <rect x="28" y="178" width="84" height="16" rx="5" fill="#4ade80"/>
        <rect x="24" y="192" width="92" height="8" rx="3" fill="#22c55e"/>
        {/* franjas longas e variadas */}
        {[30,38,46,54,62,70,78,86,94,102,110].map((x, i) => {
          const swing = (i % 3 === 0 ? -1 : i % 3 === 1 ? 1 : 0) * 10
          return (
            <g key={i}>
              <path d={`M${x} 200 Q${x + swing} ${260} ${x + swing * 0.6} 310`} stroke="#86efac" strokeWidth="3" fill="none" strokeLinecap="round"/>
              <path d={`M${x + 3} 200 Q${x + swing + 4} ${250} ${x + swing * 0.6 + 3} 295`} stroke="#4ade80" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5"/>
            </g>
          )
        })}
      </svg>

      {/* ═══ VASSOURA MÉDIA — centro direita ═══ */}
      <svg aria-hidden="true" width="80" height="220"
        style={{ position: 'absolute', top: '30%', right: 60, opacity: 0.09, transform: 'rotate(12deg)' }}>
        <rect x="36" y="0" width="8" height="140" rx="4" fill="#86efac"/>
        <rect x="8" y="138" width="64" height="12" rx="4" fill="#4ade80"/>
        {[12,20,28,36,44,52,60,68].map((x, i) => (
          <line key={i} x1={x} y1="150" x2={x - 3 + i} y2="200" stroke="#86efac" strokeWidth="2.5" strokeLinecap="round"/>
        ))}
      </svg>

      {/* ═══ BALDE PEQUENO — topo centro ═══ */}
      <svg aria-hidden="true" width="90" height="100"
        style={{ position: 'absolute', top: 30, left: '42%', opacity: 0.07, transform: 'rotate(-5deg)' }}>
        <path d="M24 18 Q45 4 66 18" stroke="#86efac" strokeWidth="5" fill="none" strokeLinecap="round"/>
        <rect x="10" y="20" width="70" height="10" rx="4" fill="#4ade80"/>
        <path d="M14 30 L22 85 Q45 94 68 85 L76 30 Z" fill="#22c55e"/>
        <path d="M20 55 Q45 48 70 55" stroke="#86efac" strokeWidth="2" fill="none" opacity="0.5"/>
      </svg>

      {/* ═══ RODO DEITADO — inferior centro ═══ */}
      <svg aria-hidden="true" width="220" height="60"
        style={{ position: 'absolute', bottom: 40, left: '30%', opacity: 0.06, transform: 'rotate(-3deg)' }}>
        <rect x="0" y="24" width="180" height="8" rx="4" fill="#86efac"/>
        <rect x="160" y="16" width="60" height="24" rx="5" fill="#4ade80"/>
        <rect x="162" y="36" width="56" height="6" rx="3" fill="#22c55e"/>
      </svg>

      {/* ═══ CARD DE LOGIN ═══ */}
      <div className="w-full max-w-sm relative z-10">
        <div
          className="rounded-2xl p-8 space-y-7"
          style={{
            background: '#ffffff',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
          }}
        >
          {/* Identidade */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-white text-2xl font-black select-none"
              style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', boxShadow: '0 4px 14px rgba(22,163,74,0.4)' }}
            >
              D
            </div>
            <div className="space-y-1 text-center">
              <h1 className="text-xl font-bold tracking-tight" style={{ color: '#0f172a' }}>
                Demax Gestão
              </h1>
              <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#16a34a', letterSpacing: '0.12em' }}>
                Serviços e Comércio LTDA
              </p>
            </div>
          </div>

          {/* Divisor */}
          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #d1fae5, transparent)' }}/>

          {/* Formulário */}
          <form action={login} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>
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
                className="flex h-10 w-full rounded-lg px-3 py-1 text-sm transition-all outline-none"
                style={{
                  border: hasError ? '1.5px solid #f87171' : '1.5px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#0f172a',
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>
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
                className="flex h-10 w-full rounded-lg px-3 py-1 text-sm transition-all outline-none"
                style={{
                  border: hasError ? '1.5px solid #f87171' : '1.5px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#0f172a',
                }}
              />
            </div>

            {hasError && (
              <p role="alert" className="text-sm" style={{ color: '#ef4444' }}>
                E-mail ou senha inválidos. Tente novamente.
              </p>
            )}

            <button
              type="submit"
              className="w-full h-11 rounded-lg text-white font-semibold text-sm mt-1 transition-opacity hover:opacity-90 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Entrar
            </button>
          </form>
        </div>

        {/* Rodapé */}
        <p className="text-center text-xs mt-5" style={{ color: 'rgba(134,239,172,0.4)' }}>
          Demax Serviços e Comércio LTDA
        </p>
      </div>
    </main>
  )
}
