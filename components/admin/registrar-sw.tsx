'use client'

import { useEffect } from 'react'

const CACHE_ESTATICO = 'demax-estatico-v1'
const CACHE_PAGINAS = 'demax-paginas-v1'

/**
 * Registra o service worker (agenda aberta sem sinal) e guarda de imediato o que a página atual já carregou:
 * o service worker só vê pedidos feitos depois de assumir a página, então os arquivos da primeira visita
 * precisam ser guardados aqui.
 */
export function RegistrarSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('caches' in window)) return
    let cancelado = false

    async function iniciar() {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        await navigator.serviceWorker.ready
        if (cancelado) return

        const estaticos = await caches.open(CACHE_ESTATICO)
        const urls = performance
          .getEntriesByType('resource')
          .map(r => r.name)
          .filter(n => new URL(n).origin === location.origin && new URL(n).pathname.startsWith('/_next/static/'))
        await Promise.all(urls.map(async u => {
          if (await estaticos.match(u)) return
          const res = await fetch(u)
          if (res.ok) await estaticos.put(u, res)
        }))

        if (location.pathname === '/agenda') {
          const paginas = await caches.open(CACHE_PAGINAS)
          const chave = location.pathname + location.search
          if (!(await paginas.match(chave))) {
            const res = await fetch(location.href, { credentials: 'same-origin', cache: 'no-store' })
            if (res.ok && !res.redirected) await paginas.put(chave, res)
          }
        }
      } catch {
        // Sem service worker o sistema segue normal; só não abre sem sinal.
      }
    }

    // Espera a página assentar para não competir com o carregamento inicial.
    const t = window.setTimeout(() => void iniciar(), 3000)
    return () => { cancelado = true; window.clearTimeout(t) }
  }, [])

  return null
}
