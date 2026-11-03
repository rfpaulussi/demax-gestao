'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useRef } from 'react'
import type { DadosHoje, LinhaHoje, SituacaoHoje } from '@/app/(admin)/agenda/hoje-actions'

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

const COR: Record<SituacaoHoje, string> = {
  sem_saida: '#e11d48',
  nao_comecou: '#e11d48',
  em_visita: '#0284c7',
  em_campo: '#10b981',
  concluiu: '#10b981',
  apoio_sem_registro: '#f59e0b',
  sem_agenda: '#f59e0b',
  aguardando: '#94a3b8',
  livre: '#94a3b8',
  feriado: '#94a3b8',
}
const ROTULO: Record<SituacaoHoje, string> = {
  sem_saida: 'Sem saída há muito tempo',
  nao_comecou: 'Ainda não começou',
  em_visita: 'Em visita agora',
  em_campo: 'Em campo',
  concluiu: 'Visitas concluídas',
  apoio_sem_registro: 'Apoio: sem registro hoje',
  sem_agenda: 'Sem agenda publicada',
  aguardando: 'Dia ainda não começou',
  livre: 'Sem visita planejada hoje',
  feriado: 'Feriado',
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function hora(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

function iniciais(nome: string) {
  return nome.trim().slice(0, 2).toUpperCase()
}

function pino(cor: string, texto: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:32px;height:32px;border-radius:9999px;background:${cor};color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">${texto}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

/** Posição atual de cada supervisor, estimada pelo último check-in de hoje (não é GPS ao vivo). */
export function MapaHoje({ dados }: { dados: DadosHoje }) {
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  const comPonto = dados.linhas.filter((l): l is LinhaHoje & { ponto: NonNullable<LinhaHoje['ponto']> } => l.ponto != null)

  useEffect(() => {
    if (!divRef.current || mapRef.current) return
    const map = L.map(divRef.current).setView([-14.2, -51.9], 4)
    L.tileLayer(TILES, { attribution: ATTR, maxZoom: 19 }).addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const g = L.layerGroup().addTo(map)
    const pontos: [number, number][] = []

    for (const l of comPonto) {
      const cor = COR[l.situacao]
      const marker = L.marker([l.ponto.lat, l.ponto.lng], { icon: pino(cor, iniciais(l.nome)) }).addTo(g)
      const detalhes = [
        `<b>${esc(l.nome)}</b>${l.apoio ? ' · Apoio' : ''}`,
        `<span style="color:${cor};font-weight:600">${ROTULO[l.situacao]}</span>`,
        l.aberta ? `Em ${esc(l.aberta.posto)} desde ${hora(l.aberta.desde)}` : l.ultima ? `${l.ultima.tipo === 'entrada' ? 'Chegou em' : 'Saiu de'} ${esc(l.ultima.posto)} às ${hora(l.ultima.em)}` : '',
        l.ponto.doPosto ? '<i style="color:#94a3b8">Posição aproximada (centro do posto)</i>' : '',
      ].filter(Boolean).join('<br/>')
      marker.bindPopup(detalhes)
      pontos.push([l.ponto.lat, l.ponto.lng])
    }

    // O container pode ainda não ter o tamanho final no primeiro paint (layout do grid/tabs assentando);
    // sem isso o Leaflet calcula o zoom do fitBounds com base num tamanho errado e abre bem mais longe.
    map.invalidateSize()
    if (pontos.length > 0) map.fitBounds(L.latLngBounds(pontos), { padding: [40, 40], maxZoom: 15 })
    return () => { g.remove() }
  }, [comPonto])

  const semPonto = dados.linhas.filter(l => l.ponto == null)

  return (
    <div className="space-y-3">
      <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-900">
        🛰️ Posição estimada pelo último check-in de hoje — não é rastreamento GPS ao vivo. Atualiza ao recarregar a página.
      </p>
      <div ref={divRef} className="relative z-0 h-[560px] w-full overflow-hidden rounded-2xl shadow-sm ring-1 ring-slate-200" />
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {(Object.keys(ROTULO) as SituacaoHoje[]).map(s => (
          <span key={s} className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COR[s] }} /> {ROTULO[s]}
          </span>
        ))}
      </div>
      {semPonto.length > 0 && (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-500">
          Sem check-in hoje (não aparecem no mapa): {semPonto.map(l => l.nome).join(', ')}
        </p>
      )}
    </div>
  )
}
