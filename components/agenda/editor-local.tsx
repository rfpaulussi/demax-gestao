'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, LocateFixed, MapPin, Search, Trash2 } from 'lucide-react'
import { buscarEndereco, salvarLocalPosto } from '@/app/(admin)/agenda/geo-actions'
import type { PostoLocal, ResultadoEndereco } from '@/app/(admin)/agenda/geo-actions'

const TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const ATTR = '&copy; OpenStreetMap &copy; CARTO'

const iconePino = () =>
  L.divIcon({
    className: '',
    html: '<div style="font-size:32px;line-height:32px;text-align:center;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))">📍</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 30],
  })

type Pos = { lat: number; lng: number }

export default function EditorLocal({ postos }: { postos: PostoLocal[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [selId, setSelId] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')
  const [soPendentes, setSoPendentes] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const [raio, setRaio] = useState(150)
  const [ref, setRef] = useState('')
  const [consulta, setConsulta] = useState('')
  const [achados, setAchados] = useState<ResultadoEndereco[]>([])
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [buscando, setBuscando] = useState(false)

  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const circleRef = useRef<L.Circle | null>(null)
  const outrosRef = useRef<L.LayerGroup | null>(null)
  const selRef = useRef<string | null>(null)
  selRef.current = selId

  const selecionado = postos.find(p => p.id === selId) ?? null
  const localizados = postos.filter(p => p.latitude != null && p.longitude != null).length
  const pct = postos.length ? localizados / postos.length : 0

  const lista = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    return postos.filter(p => {
      if (soPendentes && p.latitude != null) return false
      return !q || p.nome.toLowerCase().includes(q) || (p.secretaria ?? '').toLowerCase().includes(q)
    })
  }, [postos, filtro, soPendentes])

  // Inicializa o mapa uma vez.
  useEffect(() => {
    if (!divRef.current || mapRef.current) return
    const map = L.map(divRef.current, { zoomControl: true }).setView([-14.2, -51.9], 4)
    L.tileLayer(TILES, { attribution: ATTR, maxZoom: 19, subdomains: 'abcd' }).addTo(map)
    outrosRef.current = L.layerGroup().addTo(map)
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (selRef.current) setPos({ lat: e.latlng.lat, lng: e.latlng.lng })
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Outros postos já localizados (contexto).
  useEffect(() => {
    const g = outrosRef.current
    if (!g) return
    g.clearLayers()
    for (const p of postos) {
      if (p.latitude == null || p.longitude == null || p.id === selId) continue
      L.circleMarker([p.latitude, p.longitude], { radius: 6, color: '#047857', weight: 2, fillColor: '#34d399', fillOpacity: 0.9 })
        .bindTooltip(p.nome)
        .addTo(g)
    }
  }, [postos, selId])

  // Ao trocar de posto, carrega os dados dele.
  useEffect(() => {
    setMsg(null)
    setAchados([])
    if (!selecionado) { setPos(null); return }
    setRaio(selecionado.raio_m ?? 150)
    setRef(selecionado.endereco_ref ?? '')
    setConsulta(selecionado.nome)
    if (selecionado.latitude != null && selecionado.longitude != null) {
      setPos({ lat: selecionado.latitude, lng: selecionado.longitude })
      mapRef.current?.setView([selecionado.latitude, selecionado.longitude], 17)
    } else {
      setPos(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId])

  // Marcador + círculo do posto selecionado.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markerRef.current?.remove()
    circleRef.current?.remove()
    markerRef.current = null
    circleRef.current = null
    if (!pos) return
    const m = L.marker([pos.lat, pos.lng], { draggable: true, icon: iconePino() }).addTo(map)
    m.on('dragend', () => {
      const ll = m.getLatLng()
      setPos({ lat: ll.lat, lng: ll.lng })
    })
    markerRef.current = m
    circleRef.current = L.circle([pos.lat, pos.lng], { radius: raio, color: '#10b981', weight: 2, fillColor: '#10b981', fillOpacity: 0.14 }).addTo(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos])

  useEffect(() => {
    circleRef.current?.setRadius(raio)
  }, [raio])

  function irPara(p: Pos, zoom = 17) {
    setPos(p)
    mapRef.current?.setView([p.lat, p.lng], zoom)
  }

  async function pesquisar() {
    setMsg(null)
    setBuscando(true)
    const r = await buscarEndereco(consulta)
    setBuscando(false)
    if (!r.ok) return setMsg({ tipo: 'erro', texto: r.erro })
    setAchados(r.itens)
    if (r.itens.length === 0) setMsg({ tipo: 'erro', texto: 'Nenhum endereço encontrado. Tente outro termo ou clique no mapa.' })
  }

  function minhaLocalizacao() {
    if (!navigator.geolocation) return setMsg({ tipo: 'erro', texto: 'Seu navegador não permite localização.' })
    navigator.geolocation.getCurrentPosition(
      g => irPara({ lat: g.coords.latitude, lng: g.coords.longitude }, 18),
      () => setMsg({ tipo: 'erro', texto: 'Não foi possível obter sua localização.' }),
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  function salvar(remover = false) {
    if (!selecionado) return
    setMsg(null)
    start(async () => {
      const r = await salvarLocalPosto({
        postoId: selecionado.id,
        latitude: remover || !pos ? null : pos.lat,
        longitude: remover || !pos ? null : pos.lng,
        raioM: raio,
        enderecoRef: ref,
      })
      if (!r.ok) return setMsg({ tipo: 'erro', texto: r.erro })
      setMsg({ tipo: 'ok', texto: remover ? 'Localização removida.' : 'Localização salva!' })
      if (remover) setPos(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-5 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300">Georreferenciamento</p>
            <h1 className="text-2xl font-black">Localização dos postos</h1>
            <p className="text-sm text-white/60">Marque o ponto e o raio de cada posto para validar os check-ins dos supervisores.</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black">{localizados}<span className="text-base text-white/50">/{postos.length}</span></p>
            <p className="text-[10px] uppercase tracking-widest text-white/60">postos localizados</p>
          </div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-emerald-400 transition-all duration-700" style={{ width: `${pct * 100}%` }} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Filtrar postos…"
              className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <label className="mb-2 flex items-center gap-2 px-1 text-xs text-slate-500">
            <input type="checkbox" checked={soPendentes} onChange={e => setSoPendentes(e.target.checked)} /> Só pendentes ({postos.length - localizados})
          </label>
          <ul className="max-h-[520px] space-y-1 overflow-y-auto pr-1">
            {lista.map(p => {
              const ok = p.latitude != null && p.longitude != null
              const ativo = p.id === selId
              return (
                <li key={p.id}>
                  <button
                    type="button" onClick={() => setSelId(p.id)}
                    className={`flex w-full items-center gap-2 rounded-xl border p-2.5 text-left transition ${
                      ativo ? 'border-emerald-500 bg-emerald-50' : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    {ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <MapPin className="h-4 w-4 shrink-0 text-rose-400" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-800">{p.nome}</span>
                      <span className="block truncate text-[11px] text-slate-400">{p.secretaria ?? 'Sem secretaria'}</span>
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {ok ? `${p.raio_m} m` : 'pendente'}
                    </span>
                  </button>
                </li>
              )
            })}
            {lista.length === 0 && <li className="p-4 text-center text-sm text-slate-400">Nenhum posto.</li>}
          </ul>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 border-t-4 border-t-emerald-500 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm font-bold text-slate-800">
              {selecionado ? selecionado.nome : 'Selecione um posto ao lado'}
            </p>
            {selecionado && (
              <button type="button" onClick={minhaLocalizacao} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                <LocateFixed className="h-3.5 w-3.5" /> Usar minha localização
              </button>
            )}
          </div>

          {selecionado && (
            <div className="relative">
              <div className="flex gap-2">
                <input
                  value={consulta} onChange={e => setConsulta(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') pesquisar() }}
                  placeholder="Buscar endereço (rua, número, bairro, cidade)…"
                  className="flex-1 rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-slate-400"
                />
                <button type="button" onClick={pesquisar} disabled={buscando}
                  className="rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                  {buscando ? '…' : 'Buscar'}
                </button>
              </div>
              {achados.length > 0 && (
                <ul className="absolute z-[1000] mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  {achados.map((a, i) => (
                    <li key={i}>
                      <button type="button" className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-emerald-50"
                        onClick={() => { irPara({ lat: a.lat, lng: a.lng }); setRef(a.nome.slice(0, 300)); setAchados([]) }}>
                        {a.nome}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div ref={divRef} className="relative z-0 h-[420px] w-full overflow-hidden rounded-xl ring-1 ring-slate-200" />

          {selecionado && (
            <>
              <p className="text-xs text-slate-400">
                {pos ? `📍 ${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)} — arraste o pino ou clique no mapa para ajustar.` : 'Clique no mapa (ou busque o endereço) para marcar o posto.'}
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex min-w-60 flex-1 items-center gap-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Raio
                  <input type="range" min={30} max={500} step={10} value={raio} onChange={e => setRaio(Number(e.target.value))} className="flex-1 accent-emerald-500" />
                  <span className="w-14 rounded-md bg-emerald-100 px-2 py-1 text-center text-sm font-black normal-case tracking-normal text-emerald-700">{raio} m</span>
                </label>
              </div>
              <input
                value={ref} onChange={e => setRef(e.target.value)} maxLength={300} placeholder="Referência / endereço (opcional)"
                className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-slate-400"
              />
              {msg && (
                <p className={`rounded-lg px-3 py-2 text-sm font-medium ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.texto}</p>
              )}
              <div className="flex items-center justify-between">
                <button type="button" disabled={pending || selecionado.latitude == null} onClick={() => salvar(true)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-30">
                  <Trash2 className="h-4 w-4" /> Remover localização
                </button>
                <button type="button" disabled={pending || !pos} onClick={() => salvar(false)}
                  className="rounded-lg bg-slate-900 px-6 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-40">
                  {pending ? 'Salvando…' : 'Salvar localização'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
