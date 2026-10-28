// Service worker do DEMAX Gestão: deixa a agenda do supervisor abrir sem sinal para o check-in offline.
// Intercepta só (1) arquivos estáticos do Next e (2) a página /agenda. Todo o resto (Server Actions,
// outras telas, APIs) passa direto pela rede, sem cache.

const VERSAO = 'v1'
const CACHE_ESTATICO = `demax-estatico-${VERSAO}`
const CACHE_PAGINAS = `demax-paginas-${VERSAO}`
const MAX_PAGINAS = 8
const ESPERA_REDE_MS = 4000

const PAGINA_OFFLINE = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem conexão</title>
<style>body{font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;margin:0;display:grid;place-items:center;min-height:100vh;padding:24px;text-align:center}
.c{max-width:360px}h1{font-size:20px}p{color:#475569;font-size:14px;line-height:1.5}
button{margin-top:12px;background:#0f172a;color:#fff;border:0;border-radius:10px;padding:10px 18px;font-weight:600}</style></head>
<body><div class="c"><h1>Sem conexão</h1>
<p>A agenda ainda não foi guardada neste aparelho. Abra o sistema uma vez com sinal e, depois disso, o check-in passa a funcionar mesmo sem internet.</p>
<button onclick="location.reload()">Tentar de novo</button></div></body></html>`

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const nomes = await caches.keys()
    await Promise.all(nomes.filter(n => n !== CACHE_ESTATICO && n !== CACHE_PAGINAS).map(n => caches.delete(n)))
    await self.clients.claim()
  })())
})

async function cacheEstatico(req) {
  const cache = await caches.open(CACHE_ESTATICO)
  const salvo = await cache.match(req)
  if (salvo) return salvo
  const res = await fetch(req)
  if (res.ok) cache.put(req, res.clone())
  return res
}

function comEspera(promessa, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('ESPERA')), ms)
    promessa.then(v => { clearTimeout(t); resolve(v) }, e => { clearTimeout(t); reject(e) })
  })
}

async function limitar(cache) {
  const chaves = await cache.keys()
  for (let i = 0; i < chaves.length - MAX_PAGINAS; i++) await cache.delete(chaves[i])
}

// Rede primeiro. Com página guardada, sinal ruim (4 s) ou ausente cai nela; sem página guardada, espera a rede.
async function paginaAgenda(req) {
  const cache = await caches.open(CACHE_PAGINAS)
  const url = new URL(req.url)
  const chave = url.pathname + url.search
  const salvo = (await cache.match(chave)) || (await cache.match('/agenda'))
  try {
    const res = await (salvo ? comEspera(fetch(req), ESPERA_REDE_MS) : fetch(req))
    // Só guarda resposta direta de /agenda: redirecionamento (ex.: login) não é a agenda.
    if (res.ok && !res.redirected && new URL(res.url).pathname === '/agenda') {
      await cache.put(chave, res.clone())
      await limitar(cache)
    }
    return res
  } catch {
    return salvo || new Response(PAGINA_OFFLINE, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } })
  }
}

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Tela de login = sessão encerrada: apaga as páginas guardadas (aparelho pode ser compartilhado).
  if (url.pathname === '/login') {
    event.waitUntil(caches.delete(CACHE_PAGINAS))
    return
  }
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheEstatico(req))
    return
  }
  if (req.mode === 'navigate' && url.pathname === '/agenda') {
    event.respondWith(paginaAgenda(req))
  }
})
