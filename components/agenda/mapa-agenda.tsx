'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import { diaMes } from '@/lib/agenda/datas'
import { formatarDistancia } from '@/lib/agenda/geo'
import { DIAS_CURTOS, PERIODOS } from '@/lib/agenda/tema'
import type { StatusVisita, VisitaView } from '@/lib/agenda/visitas'
import type { MapaDados } from '@/app/(admin)/agenda/geo-actions'

const TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const ATTR = '&copy; OpenStreetMap &copy; CARTO'

const COR: Record<StatusVisita, string> = {
  ok: '#10b981',
  alerta: '#f59e0b',
  falta: '#f43f5e',
  agendado: '#60a5fa',
  extra: '#6b7280',
}
const ROTULO: Record<StatusVisita, string> = {
  ok: 'No posto',
  alerta: 'Fora do raio / impreciso',
  falta: 'Sem check-in',
  agendado: 'Agendado',
  extra: 'Visita extra',
}
const ROTULO_PERIODO = Object.fromEntries(PERIODOS.map(p => [p.id, p.label])) as Record<string, string>

function hora(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

function duracao(min: number | null) {
  if (min === null) return null
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
}

function pino(cor: string, texto: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;border-radius:9999px;background:${cor};color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">${texto}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

export default function MapaAgenda({ dados, dias }: { dados: MapaDados; dias: string[] }) {
  const [dia, setDia] = useState<string>('todos')
  const [focoKey, setFocoKey] = useState<string | null>(null)
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const camadaRef = useRef<L.LayerGroup | null>(null)
  const posRef = useRef<Map<string, [number, number]>>(new Map())

  const { stats } = dados
  const visitas = useMemo(() => dados.visitas.filter(v => dia === 'todos' || v.data === dia), [dados.visitas, dia])

  useEffect(() => {
    if (!divRef.current || mapRef.current) return
    const map = L.map(divRef.current).setView([-14.2, -51.9], 4)
    L.tileLayer(TILES, { attribution: ATTR, maxZoom: 19, subdomains: 'abcd' }).addTo(map)
    camadaRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const g = camadaRef.current
    if (!map || !g) return
    g.clearLayers()
    posRef.current.clear()
    const pontos: [number, number][] = []

    for (const v of visitas) {
      const cor = COR[v.status]
      if (v.lat_posto != null && v.lng_posto != null) {
        L.circle([v.lat_posto, v.lng_posto], {
          radius: v.raio_m, color: cor, weight: 2, dashArray: '6 6', fillColor: cor, fillOpacity: 0.1,
        }).bindTooltip(v.posto_nome).addTo(g)
        pontos.push([v.lat_posto, v.lng_posto])
        posRef.current.set(v.key, [v.lat_posto, v.lng_posto])
        if (v.status === 'falta' || v.status === 'agendado') {
          L.marker([v.lat_posto, v.lng_posto], { icon: pino(cor, v.status === 'falta' ? '!' : '·') })
            .bindTooltip(`${v.posto_nome} — ${ROTULO[v.status]}`)
            .addTo(g)
        }
      }
      if (v.lat_real != null && v.lng_real != null) {
        const detalhes = [
          `<b>${v.posto_nome}</b>`,
          `${hora(v.entrada_em)}${v.saida_em ? ` – ${hora(v.saida_em)}` : ''}`,
          v.distancia_m != null ? `${formatarDistancia(v.distancia_m)} do posto` : '',
          v.baixa_precisao ? 'GPS impreciso' : '',
          v.justificativa ? `“${v.justificativa}”` : '',
        ].filter(Boolean).join('<br/>')
        L.marker([v.lat_real, v.lng_real], { icon: pino(cor, String(v.ordem ?? '')) }).bindPopup(detalhes).addTo(g)
        pontos.push([v.lat_real, v.lng_real])
        posRef.current.set(v.key, [v.lat_real, v.lng_real])
      }
    }

    // Trilha: liga as chegadas na ordem, separada por dia.
    const porDia = new Map<string, VisitaView[]>()
    for (const v of visitas) {
      if (v.ordem == null || v.lat_real == null) continue
      porDia.set(v.data, [...(porDia.get(v.data) ?? []), v])
    }
    porDia.forEach(lista => {
      lista.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      if (lista.length > 1) {
        L.polyline(lista.map(v => [v.lat_real as number, v.lng_real as number] as [number, number]), {
          color: '#0f172a', weight: 3, opacity: 0.55, dashArray: '2 8', lineCap: 'round',
        }).addTo(g)
      }
    })

    if (pontos.length > 0) map.fitBounds(L.latLngBounds(pontos), { padding: [40, 40], maxZoom: 17 })
  }, [visitas])

  function focar(v: VisitaView) {
    setFocoKey(v.key)
    const p = posRef.current.get(v.key)
    if (p) mapRef.current?.setView(p, 17)
  }

  const tiles = [
    { label: 'Cumprimento', valor: stats.pct === null ? '—' : `${stats.pct}%`, cor: 'border-t-emerald-500' },
    { label: 'Cumpridas', valor: `${stats.cumpridas}/${stats.planejadas}`, cor: 'border-t-blue-500' },
    { label: 'Fora do raio', valor: String(stats.foraRaio), cor: 'border-t-amber-400' },
    { label: 'Sem check-in', valor: String(stats.faltas), cor: 'border-t-rose-500' },
    { label: 'Visitas extras', valor: String(stats.extras), cor: 'border-t-slate-400' },
    { label: 'Tempo médio', valor: stats.tempoMedioMin === null ? '—' : duracao(stats.tempoMedioMin) ?? '—', cor: 'border-t-violet-500' },
  ]

  const dataKeys = Array.from(new Set(visitas.map(v => v.data))).sort()

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map(t => (
          <div key={t.label} className={`rounded-xl border border-slate-200 border-t-4 bg-white p-3 shadow-sm ${t.cor}`}>
            <p className="text-2xl font-black text-slate-900">{t.valor}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-widest text-slate-500">{t.label}</p>
          </div>
        ))}
      </div>

      {dados.semLocal.length > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          📍 Sem localização cadastrada (não aparecem no mapa): <b>{dados.semLocal.join(', ')}</b>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => setDia('todos')}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${dia === 'todos' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
          Semana toda
        </button>
        {dias.map((d, i) => (
          <button key={d} type="button" onClick={() => setDia(d)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${dia === d ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            {DIAS_CURTOS[i]} {diaMes(d).slice(0, 2)}
          </button>
        ))}
        <span className="ml-auto flex flex-wrap gap-x-3 gap-y-1">
          {(Object.keys(COR) as StatusVisita[]).map(s => (
            <span key={s} className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COR[s] }} /> {ROTULO[s]}
            </span>
          ))}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div ref={divRef} className="relative z-0 h-[560px] w-full overflow-hidden rounded-2xl shadow-sm ring-1 ring-slate-200" />

        <div className="max-h-[560px] space-y-4 overflow-y-auto pr-1">
          {visitas.length === 0 && (
            <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-200">
              Nenhuma visita planejada ou registrada neste período.
            </p>
          )}
          {dataKeys.map(d => (
            <div key={d}>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">{diaMes(d)}</p>
              <ul className="space-y-1.5">
                {visitas.filter(v => v.data === d).map(v => (
                  <li key={v.key}>
                    <button type="button" onClick={() => focar(v)}
                      className={`flex w-full items-start gap-2.5 rounded-xl bg-white p-2.5 text-left shadow-sm ring-1 transition hover:shadow-md ${focoKey === v.key ? 'ring-2 ring-slate-900' : 'ring-slate-200'}`}>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white" style={{ background: COR[v.status] }}>
                        {v.ordem ?? (v.status === 'falta' ? '!' : '·')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-800">{v.posto_nome}</span>
                        <span className="block text-[11px] font-semibold" style={{ color: COR[v.status] }}>{ROTULO[v.status]}</span>
                        <span className="block text-[11px] text-slate-500">
                          {v.entrada_em ? `${hora(v.entrada_em)}${v.saida_em ? ` – ${hora(v.saida_em)}` : ''}` : v.periodos.map(p => ROTULO_PERIODO[p]).join(', ')}
                          {v.tempo_min != null && ` · ${duracao(v.tempo_min)}`}
                          {v.distancia_m != null && ` · ${formatarDistancia(v.distancia_m)} do posto`}
                        </span>
                        {v.focos.length > 0 && <span className="block truncate text-[11px] text-slate-400">{v.focos.join(' · ')}</span>}
                        {v.justificativa && <span className="mt-0.5 block text-[11px] italic text-amber-700">“{v.justificativa}”</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
