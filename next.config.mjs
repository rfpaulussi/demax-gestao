/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === 'production'

// NEXT_PUBLIC_SUPABASE_URL é pública por definição (prefixo NEXT_PUBLIC_) — seguro expor em CSP.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

const cspDirectives = [
  `default-src 'self'`,
  // Next injeta scripts inline de hydration/RSC payload sem nonce hoje;
  // sem infraestrutura de nonce (via middleware), 'unsafe-inline' é necessário aqui.
  // 'unsafe-eval' só em dev (HMR do webpack usa eval).
  // 'wasm-unsafe-eval' sempre: @react-pdf/renderer (fontkit) usa wasm p/ decodificar fontes.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isProd ? '' : " 'unsafe-eval'"}`,
  // Tailwind/shadcn usam atributo style inline em alguns componentes —
  // sem isso, esses estilos inline seriam bloqueados.
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob:`,
  `font-src 'self' data:`,
  // 'data:' necessário: fontkit (usado por @react-pdf/renderer) busca módulo wasm via data: URI.
  `connect-src 'self' data: ${SUPABASE_URL}`,
  `frame-src 'none'`,
  `frame-ancestors 'none'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  // Só força upgrade http->https em produção (Vercel já serve tudo em https;
  // em dev local isso quebraria o http://localhost).
  isProd ? 'upgrade-insecure-requests' : '',
]
  .filter(Boolean)
  .join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: cspDirectives },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
]

const nextConfig = {
  transpilePackages: ['@react-pdf/renderer'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
};

export default nextConfig;
