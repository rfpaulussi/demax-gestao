import type { EventosMapa, MapaEditor, PontoOutro, Pos } from './tipos'

// Mapa do Google (Maps JavaScript API) para o editor de locais. Chave de NAVEGADOR (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
// diferente da chave de Geocoding: protegida por restrição de HTTP referrer no Google Cloud, não por segredo.

let carregando: Promise<void> | null = null

function carregarScript(chave: string): Promise<void> {
  if (typeof window !== 'undefined' && window.google?.maps?.Map) return Promise.resolve()
  if (carregando) return carregando
  carregando = new Promise<void>((resolve, reject) => {
    const w = window as unknown as Record<string, unknown>
    w.__demaxGmapsPronto = () => resolve()
    const s = document.createElement('script')
    const q = new URLSearchParams({ key: chave, callback: '__demaxGmapsPronto', v: 'weekly', language: 'pt-BR', region: 'BR' })
    s.src = `https://maps.googleapis.com/maps/api/js?${q.toString()}`
    s.async = true
    s.onerror = () => {
      carregando = null
      reject(new Error('Não foi possível carregar o mapa do Google.'))
    }
    document.head.appendChild(s)
  })
  return carregando
}

export async function criarMapaGoogle(div: HTMLElement, chave: string, ev: EventosMapa): Promise<MapaEditor> {
  // Chave recusada (referrer não autorizado, API desativada, cobrança): o Google chama esta função global.
  ;(window as unknown as Record<string, unknown>).gm_authFailure = () => ev.onFalha?.()
  await carregarScript(chave)

  // Elemento próprio dentro do contêiner: recriar o mapa (ex.: modo estrito do React) nunca disputa o mesmo nó.
  const el = document.createElement('div')
  el.style.width = '100%'
  el.style.height = '100%'
  div.appendChild(el)

  const map = new google.maps.Map(el, {
    center: { lat: -14.2, lng: -51.9 },
    zoom: 4,
    mapTypeControl: true, // mapa / satélite
    streetViewControl: true,
    fullscreenControl: false,
    clickableIcons: false,
    gestureHandling: 'greedy',
  })
  map.addListener('click', (e: google.maps.MapMouseEvent) => {
    if (e.latLng) ev.onClick({ lat: e.latLng.lat(), lng: e.latLng.lng() })
  })

  let marker: google.maps.Marker | null = null
  let circle: google.maps.Circle | null = null
  let outros: google.maps.Marker[] = []

  return {
    motor: 'google',
    irPara(p: Pos, zoom = 17) {
      map.setCenter({ lat: p.lat, lng: p.lng })
      map.setZoom(zoom)
    },
    setPino(p: Pos | null, raioM: number) {
      if (!p) {
        marker?.setMap(null)
        circle?.setMap(null)
        marker = null
        circle = null
        return
      }
      const centro = { lat: p.lat, lng: p.lng }
      if (!marker) {
        marker = new google.maps.Marker({ map, position: centro, draggable: true, title: 'Arraste para a entrada do posto' })
        marker.addListener('dragend', () => {
          const ll = marker?.getPosition()
          if (ll) ev.onArrastar({ lat: ll.lat(), lng: ll.lng() })
        })
      } else {
        marker.setPosition(centro)
      }
      if (!circle) {
        circle = new google.maps.Circle({
          map, center: centro, radius: raioM, clickable: false,
          strokeColor: '#10b981', strokeWeight: 2, fillColor: '#10b981', fillOpacity: 0.14,
        })
      } else {
        circle.setCenter(centro)
        circle.setRadius(raioM)
      }
    },
    setRaio(raioM: number) {
      circle?.setRadius(raioM)
    },
    setOutros(pontos: PontoOutro[]) {
      for (const m of outros) m.setMap(null)
      outros = pontos.map(p => new google.maps.Marker({
        map,
        position: { lat: p.lat, lng: p.lng },
        title: p.nome, // texto puro: o Google não interpreta HTML no title
        clickable: false,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#34d399', fillOpacity: 0.9, strokeColor: '#047857', strokeWeight: 2 },
      }))
    },
    destruir() {
      for (const m of outros) m.setMap(null)
      marker?.setMap(null)
      circle?.setMap(null)
      outros = []
      marker = null
      circle = null
      google.maps.event.clearInstanceListeners(map)
      el.remove()
    },
  }
}
