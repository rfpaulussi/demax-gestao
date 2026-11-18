/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === 'production'

// NEXT_PUBLIC_SUPABASE_URL é pública por definição (prefixo NEXT_PUBLIC_) — seguro expor em CSP.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

// Mapa do Google (editor de locais). Só libera os domínios do Google quando a chave de navegador está configurada
// no build (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY); sem ela o CSP continua exatamente como era.
// Lista conforme a documentação de CSP da Maps JavaScript API.
const GMAPS = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
const gHosts = 'https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.ggpht.com https://*.googleusercontent.com'

const cspDirectives = [
  `default-src 'self'`,
  // Next injeta scripts inline de hydration/RSC payload sem nonce hoje;
  // sem infraestrutura de nonce (via middleware), 'unsafe-inline' é necessário aqui.
  // 'unsafe-eval' só em dev (HMR do webpack usa eval).
  // 'wasm-unsafe-eval' sempre: @react-pdf/renderer (fontkit) usa wasm p/ decodificar fontes.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isProd ? '' : " 'unsafe-eval'"}${GMAPS ? ` ${gHosts} blob:` : ''}`,
  // Tailwind/shadcn usam atributo style inline em alguns componentes —
  // sem isso, esses estilos inline seriam bloqueados.
  `style-src 'self' 'unsafe-inline'${GMAPS ? ' https://fonts.googleapis.com' : ''}`,
  // OpenStreetMap: tiles do mapa da agenda (Leaflet). Supabase: fotos de check-in via URL assinada.
  `img-src 'self' data: blob: https://tile.openstreetmap.org ${SUPABASE_URL}${GMAPS ? ` ${gHosts}` : ''}`,
  `font-src 'self' data:${GMAPS ? ' https://fonts.gstatic.com' : ''}`,
  // 'data:' necessário: fontkit (usado por @react-pdf/renderer) busca módulo wasm via data: URI.
  `connect-src 'self' data: ${SUPABASE_URL}${GMAPS ? ` ${gHosts} blob:` : ''}`,
  GMAPS ? `worker-src 'self' blob:` : '',
  GMAPS ? `frame-src https://*.google.com` : `frame-src 'none'`,
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
  // geolocation=(self): o check-in da agenda lê o GPS. Com geolocation=() o navegador bloqueia o GPS do site
  // inteiro e o cadeado não permite liberar.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()' },
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
