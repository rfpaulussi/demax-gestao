import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import type { EventosMapa, MapaEditor, PontoOutro, Pos } from './tipos'

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

const iconePino = () =>
  L.divIcon({
    className: '',
    html: '<div style="font-size:32px;line-height:32px;text-align:center;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))">📍</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 30],
  })

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function criarMapaLeaflet(div: HTMLElement, ev: EventosMapa): MapaEditor {
  const map = L.map(div, { zoomControl: true }).setView([-14.2, -51.9], 4)
  L.tileLayer(TILES, { attribution: ATTR, maxZoom: 19 }).addTo(map)
  const outros = L.layerGroup().addTo(map)
  let marker: L.Marker | null = null
  let circle: L.Circle | null = null

  map.on('click', (e: L.LeafletMouseEvent) => ev.onClick({ lat: e.latlng.lat, lng: e.latlng.lng }))

  return {
    motor: 'leaflet',
    irPara(p: Pos, zoom = 17) {
      map.setView([p.lat, p.lng], zoom)
    },
    setPino(p: Pos | null, raioM: number) {
      marker?.remove()
      circle?.remove()
      marker = null
      circle = null
      if (!p) return
      const m = L.marker([p.lat, p.lng], { draggable: true, icon: iconePino() }).addTo(map)
      m.on('dragend', () => {
        const ll = m.getLatLng()
        ev.onArrastar({ lat: ll.lat, lng: ll.lng })
      })
      marker = m
      circle = L.circle([p.lat, p.lng], { radius: raioM, color: '#10b981', weight: 2, fillColor: '#10b981', fillOpacity: 0.14 }).addTo(map)
    },
    setRaio(raioM: number) {
      circle?.setRadius(raioM)
    },
    setOutros(pontos: PontoOutro[]) {
      outros.clearLayers()
      for (const p of pontos) {
        L.circleMarker([p.lat, p.lng], { radius: 6, color: '#047857', weight: 2, fillColor: '#34d399', fillOpacity: 0.9 })
          .bindTooltip(escapar(p.nome))
          .addTo(outros)
      }
    },
    destruir() {
      map.remove()
    },
  }
}
