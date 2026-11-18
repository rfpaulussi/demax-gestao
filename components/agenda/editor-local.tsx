'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ExternalLink, History, LocateFixed, MapPin, Search, Trash2 } from 'lucide-react'
import { buscarEndereco, salvarLocalPosto } from '@/app/(admin)/agenda/geo-actions'
import type { PostoLocal, ResultadoEndereco } from '@/app/(admin)/agenda/geo-actions'
import { escolherCandidatoGoogle, geocodificarPosto, listarHistoricoGeo } from '@/app/(admin)/agenda/geocodificar-actions'
import type { CandidatoView, EventoHistoricoGeo, SaidaGeocodificacao } from '@/app/(admin)/agenda/geocodificar-actions'
import { criarMapaGoogle } from './mapa-editor/google'
import { criarMapaLeaflet } from './mapa-editor/leaflet'
import type { EventosMapa, MapaEditor, Pos } from './mapa-editor/tipos'

// Chave de NAVEGADOR do Maps JavaScript API (protegida por restrição de referrer). Sem ela, o editor usa o OpenStreetMap.
const CHAVE_MAPS = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

const ORIGEM_ROTULO: Record<string, string> = {
  nominatim: 'importada automaticamente (Nominatim)',
  gps_supervisor: 'GPS de um supervisor no local',
  manual_mapa: 'marcada no mapa pela coordenação',
}
const TIPO_ROTULO: Record<string, string> = {
  ROOFTOP: 'endereço exato',
  RANGE_INTERPOLATED: 'número estimado na rua',
  GEOMETRIC_CENTER: 'centro da região',
  APPROXIMATE: 'aproximado',
}
const EVENTO_ROTULO: Record<string, string> = {
  geocodificado: 'Consulta ao Google',
  geocodificacao_falhou: 'Consulta ao Google sem resultado',
  confirmado_mapa: 'Ponto confirmado no mapa',
  marcado_gps: 'Ponto marcado pelo GPS',
  proposta_aprovada: 'Proposta de supervisor aprovada',
  removido: 'Ponto removido',
}

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

export default function EditorLocal({ postos }: { postos: PostoLocal[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [selId, setSelId] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')
  const [soPendentes, setSoPendentes] = useState(false)
  const [soConferir, setSoConferir] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const [raio, setRaio] = useState(150)
  const [ref, setRef] = useState('')
  const [consulta, setConsulta] = useState('')
  const [achados, setAchados] = useState<ResultadoEndereco[]>([])
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [enderecoBusca, setEnderecoBusca] = useState('')
  const [geoRes, setGeoRes] = useState<SaidaGeocodificacao | null>(null)
  const [geoBusy, setGeoBusy] = useState(false)
  const [historico, setHistorico] = useState<EventoHistoricoGeo[] | null>(null)
  const [verHistorico, setVerHistorico] = useState(false)

  const [motor, setMotor] = useState<'leaflet' | 'google'>(CHAVE_MAPS ? 'google' : 'leaflet')
  const [mapaPronto, setMapaPronto] = useState(0) // conta quantas vezes um mapa foi criado (força redesenho do pino)
  const [avisoMapa, setAvisoMapa] = useState<string | null>(null)
  // Pino movido automaticamente para a posição do Google (só no mapa do Google): guarda o ponto anterior para desfazer.
  const [pinoGoogle, setPinoGoogle] = useState<{ anterior: Pos | null } | null>(null)

  const divRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<MapaEditor | null>(null)
  const selRef = useRef<string | null>(null)
  selRef.current = selId

  const selecionado = postos.find(p => p.id === selId) ?? null
  const localizados = postos.filter(p => p.latitude != null && p.longitude != null).length
  const aConferir = postos.filter(p => p.latitude != null && !p.geo_confirmado).length
  const conferidos = localizados - aConferir
  const pct = postos.length ? conferidos / postos.length : 0
  const pctAuto = postos.length ? localizados / postos.length : 0

  const lista = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    return postos.filter(p => {
      if (soPendentes && p.latitude != null) return false
      if (soConferir && !(p.latitude != null && !p.geo_confirmado)) return false
      return !q || p.nome.toLowerCase().includes(q) || (p.secretaria ?? '').toLowerCase().includes(q)
    })
  }, [postos, filtro, soPendentes, soConferir])

  // Cria o mapa (Google se houver chave e ele carregar; senão OpenStreetMap). Trocar `motor` recria o mapa.
  useEffect(() => {
    const div = divRef.current
    if (!div) return
    let cancelado = false
    const eventos: EventosMapa = {
      onClick: p => { if (selRef.current) setPos(p) },
      onArrastar: p => setPos(p),
      onFalha: () => {
        setAvisoMapa('O Google recusou a chave do mapa (confira a restrição de referrer e se a Maps JavaScript API está ativada). Usando o mapa OpenStreetMap.')
        setMotor('leaflet')
      },
    }
    void (async () => {
      try {
        const api = motor === 'google' ? await criarMapaGoogle(div, CHAVE_MAPS, eventos) : criarMapaLeaflet(div, eventos)
        if (cancelado) { api.destruir(); return }
        mapaRef.current = api
        setMapaPronto(n => n + 1)
      } catch {
        if (cancelado) return
        if (motor === 'google') {
          setAvisoMapa('Não foi possível carregar o mapa do Google. Usando o mapa OpenStreetMap.')
          setMotor('leaflet')
        }
      }
    })()
    return () => {
      cancelado = true
      mapaRef.current?.destruir()
      mapaRef.current = null
    }
  }, [motor])

  // Outros postos já localizados (contexto).
  useEffect(() => {
    mapaRef.current?.setOutros(
      postos
        .filter(p => p.latitude != null && p.longitude != null && p.id !== selId)
        .map(p => ({ id: p.id, nome: p.nome, lat: p.latitude as number, lng: p.longitude as number })),
    )
  }, [postos, selId, mapaPronto])

  // Ao trocar de posto, carrega os dados dele.
  useEffect(() => {
    setMsg(null)
    setAchados([])
    setGeoRes(null)
    setHistorico(null)
    setVerHistorico(false)
    setPinoGoogle(null)
    if (!selecionado) { setPos(null); return }
    setRaio(selecionado.raio_m ?? 150)
    setRef(selecionado.endereco_ref ?? '')
    setEnderecoBusca(selecionado.endereco_busca ?? selecionado.endereco_ref ?? '')
    setConsulta(selecionado.nome)
    if (selecionado.latitude != null && selecionado.longitude != null) {
      setPos({ lat: selecionado.latitude, lng: selecionado.longitude })
      mapaRef.current?.irPara({ lat: selecionado.latitude, lng: selecionado.longitude }, 17)
    } else {
      setPos(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId])

  // Pino arrastável + círculo do posto selecionado.
  useEffect(() => {
    mapaRef.current?.setPino(pos, raio)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, mapaPronto])

  useEffect(() => {
    mapaRef.current?.setRaio(raio)
  }, [raio])

  // Mapa recriado (troca de motor): volta a enquadrar o pino atual.
  useEffect(() => {
    if (pos) mapaRef.current?.irPara(pos, 17)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapaPronto])

  function irPara(p: Pos, zoom = 17) {
    setPos(p)
    mapaRef.current?.irPara(p, zoom)
  }

  /** Só no mapa do Google (termos 6.2): leva o pino para a posição sugerida; o ponto anterior fica guardado para desfazer. */
  function moverPinoParaGoogle(lat: number, lng: number) {
    if (motor !== 'google') return
    setPinoGoogle(atual => ({ anterior: atual ? atual.anterior : pos }))
    irPara({ lat, lng }, 19)
  }

  function desfazerPinoGoogle() {
    if (!pinoGoogle) return
    if (pinoGoogle.anterior) irPara(pinoGoogle.anterior, 17)
    else setPos(null)
    setPinoGoogle(null)
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

  async function consultarGoogle(forcar: boolean) {
    if (!selecionado) return
    setMsg(null)
    setGeoBusy(true)
    const r = await geocodificarPosto({ postoId: selecionado.id, endereco: enderecoBusca, forcar })
    setGeoBusy(false)
    setGeoRes(r)
    if (r.ok) {
      // Endereço único e preciso: o pino já vai para o lugar certo, só falta conferir/arrastar e salvar.
      if (r.escolhido) moverPinoParaGoogle(r.escolhido.lat, r.escolhido.lng)
      router.refresh()
    }
    if (verHistorico) void carregarHistorico()
  }

  async function usarCandidato(c: CandidatoView) {
    if (!selecionado) return
    setGeoBusy(true)
    const r = await escolherCandidatoGoogle({
      postoId: selecionado.id,
      candidato: { lat: c.lat, lng: c.lng, enderecoFormatado: c.enderecoFormatado, placeId: c.placeId, tipo: String(c.tipo), parcial: c.parcial },
    })
    setGeoBusy(false)
    if (!r.ok) return setMsg({ tipo: 'erro', texto: r.erro })
    setGeoRes(null)
    moverPinoParaGoogle(c.lat, c.lng)
    setMsg({ tipo: 'ok', texto: motor === 'google' ? 'Candidato escolhido: o pino foi para a posição dele. Ajuste e salve.' : 'Endereço do Google registrado como referência (vale 30 dias).' })
    router.refresh()
    if (verHistorico) void carregarHistorico()
  }

  async function carregarHistorico() {
    if (!selecionado) return
    const r = await listarHistoricoGeo(selecionado.id)
    setHistorico(r.ok ? r.eventos : [])
  }

  function alternarHistorico() {
    const abrir = !verHistorico
    setVerHistorico(abrir)
    if (abrir) void carregarHistorico()
  }

  // Sugestão a exibir: a que acabou de vir da consulta, ou a guardada no posto (vale 30 dias).
  const sugestao = geoRes?.ok && geoRes.escolhido
    ? { endereco: geoRes.escolhido.enderecoFormatado, tipo: String(geoRes.escolhido.tipo), parcial: geoRes.escolhido.parcial, distanciaPinoM: geoRes.escolhido.distanciaPinoM, link: geoRes.escolhido.linkGoogle, lat: geoRes.escolhido.lat, lng: geoRes.escolhido.lng }
    : selecionado?.google ?? null

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
      setPinoGoogle(null)
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
            <p className="text-3xl font-black">{conferidos}<span className="text-base text-white/50">/{postos.length}</span></p>
            <p className="text-[10px] uppercase tracking-widest text-white/60">postos conferidos</p>
            {aConferir > 0 && <p className="mt-0.5 text-[11px] font-semibold text-amber-300">+ {aConferir} importados a conferir</p>}
          </div>
        </div>
        <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
          <div className="absolute inset-y-0 left-0 rounded-full bg-amber-400/70 transition-all duration-700" style={{ width: `${pctAuto * 100}%` }} />
          <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-400 transition-all duration-700" style={{ width: `${pct * 100}%` }} />
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
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-slate-500">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={soPendentes} onChange={e => { setSoPendentes(e.target.checked); if (e.target.checked) setSoConferir(false) }} /> Sem localização ({postos.length - localizados})
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={soConferir} onChange={e => { setSoConferir(e.target.checked); if (e.target.checked) setSoPendentes(false) }} /> A conferir ({aConferir})
            </label>
          </div>
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
                    {ok ? <CheckCircle2 className={`h-4 w-4 shrink-0 ${p.geo_confirmado ? 'text-emerald-500' : 'text-amber-400'}`} /> : <MapPin className="h-4 w-4 shrink-0 text-rose-400" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-800">{p.nome}</span>
                      <span className="block truncate text-[11px] text-slate-400">{p.secretaria ?? 'Sem secretaria'}</span>
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${!ok ? 'bg-rose-100 text-rose-700' : p.geo_confirmado ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {!ok ? 'pendente' : p.geo_confirmado ? `${p.raio_m} m` : 'a conferir'}
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

          {selecionado && selecionado.latitude != null && !selecionado.geo_confirmado && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              📍 Coordenada <b>{selecionado.geo_precisao === 'gps' ? 'marcada em campo' : 'importada automaticamente'}</b>
              {selecionado.geo_precisao === 'gps' ? ' (marcada pelo GPS de um supervisor no local — em geral a mais exata)' : selecionado.geo_precisao === 'alta' ? ' (prédio/equipamento)' : selecionado.geo_precisao === 'media' ? ' (meio da rua — pode estar a algumas dezenas de metros)' : ' (rua aproximada)'}.
              Confira o pino no mapa, ajuste se preciso e clique em <b>Confirmar localização</b>.
            </p>
          )}

          {selecionado && (
            <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-800">Endereço do posto · validação Google</p>
              <div className="flex gap-2">
                <input
                  value={enderecoBusca} onChange={e => setEnderecoBusca(e.target.value)} maxLength={300}
                  onKeyDown={e => { if (e.key === 'Enter') void consultarGoogle(false) }}
                  placeholder="Rua, número, bairro (a cidade é Mogi das Cruzes - SP)"
                  className="flex-1 rounded-lg border border-sky-200 bg-white p-2.5 text-sm outline-none focus:border-sky-400"
                />
                <button type="button" onClick={() => consultarGoogle(false)} disabled={geoBusy || enderecoBusca.trim().length < 5}
                  className="rounded-lg bg-sky-700 px-4 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-40">
                  {geoBusy ? '…' : 'Consultar'}
                </button>
                {selecionado.endereco_busca && (
                  <button type="button" onClick={() => consultarGoogle(true)} disabled={geoBusy} title="Consulta o Google de novo, mesmo com o endereço igual"
                    className="rounded-lg bg-white px-3 text-xs font-semibold text-sky-800 ring-1 ring-sky-300 hover:bg-sky-100 disabled:opacity-40">
                    Revalidar
                  </button>
                )}
              </div>

              {geoRes && !geoRes.ok && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">{geoRes.erro}</p>
              )}

              {geoRes?.ok && geoRes.classe === 'ambiguo' && (
                <div className="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
                  <p className="mb-2 text-sm font-semibold text-amber-900">
                    O endereço está ambíguo ({geoRes.candidatos.length} possibilidade{geoRes.candidatos.length > 1 ? 's' : ''}). Escolha a correta ou refine o texto.
                  </p>
                  <ul className="space-y-1.5">
                    {geoRes.candidatos.map(c => (
                      <li key={c.placeId} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 text-xs ring-1 ring-amber-100">
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-slate-800">{c.enderecoFormatado}</span>
                          <span className="block text-slate-500">
                            {TIPO_ROTULO[String(c.tipo)] ?? c.tipo}{c.parcial ? ' · correspondência parcial' : ''}
                            {c.distanciaPinoM != null && ` · a ${c.distanciaPinoM} m do pino`}
                          </span>
                        </span>
                        <a href={c.linkGoogle} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-700 hover:underline">
                          <ExternalLink className="h-3 w-3" /> Ver no Google Maps
                        </a>
                        <button type="button" disabled={geoBusy} onClick={() => usarCandidato(c)}
                          className="rounded-md bg-amber-500 px-2.5 py-1 font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-40">
                          Usar este
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sugestao && (
                <div className="rounded-lg bg-white p-3 text-xs ring-1 ring-sky-100">
                  <p className="font-semibold text-slate-800">{sugestao.endereco || 'Endereço encontrado pelo Google'}</p>
                  <p className="mt-0.5 text-slate-500">
                    {TIPO_ROTULO[sugestao.tipo ?? ''] ?? sugestao.tipo}{sugestao.parcial ? ' · correspondência parcial' : ''}
                    {sugestao.distanciaPinoM != null && ` · a ${sugestao.distanciaPinoM} m do pino atual`}
                    {geoRes?.ok && geoRes.fonte === 'cache' && ' · já consultado antes (sem nova chamada)'}
                  </p>
                  {pinoGoogle && motor === 'google' && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-md bg-emerald-50 px-2 py-1.5 font-semibold text-emerald-800">
                      <span>📍 O pino foi para o endereço do Google. Confira no mapa (satélite/Street View), arraste até a entrada e clique em Salvar localização.</span>
                      <button type="button" onClick={desfazerPinoGoogle} className="rounded-md bg-white px-2 py-0.5 text-emerald-800 ring-1 ring-emerald-300 hover:bg-emerald-100">
                        Desfazer
                      </button>
                    </div>
                  )}
                  {!pinoGoogle && motor === 'google' && 'lat' in sugestao && (
                    <button type="button" onClick={() => moverPinoParaGoogle(sugestao.lat, sugestao.lng)}
                      className="mt-1.5 rounded-md bg-sky-700 px-2.5 py-1 font-semibold text-white hover:bg-sky-600">
                      Mover o pino para o endereço do Google
                    </button>
                  )}
                  {motor === 'leaflet' && sugestao.distanciaPinoM != null && sugestao.distanciaPinoM > 300 && (
                    <p className="mt-1.5 rounded-md bg-red-50 px-2 py-1 font-semibold text-red-700">
                      ⚠️ O pino está a {sugestao.distanciaPinoM} m do endereço que o Google encontrou. Confira qual dos dois está errado.
                    </p>
                  )}
                  {motor === 'leaflet' && sugestao.distanciaPinoM == null && (
                    <p className="mt-1.5 text-slate-600">
                      Este posto ainda não tem ponto. Veja o local no Google Maps e marque o pino abaixo no mapa, ou peça ao supervisor para marcar pelo GPS no posto.
                    </p>
                  )}
                  {motor === 'google' && !pinoGoogle && sugestao.distanciaPinoM != null && sugestao.distanciaPinoM > 300 && (
                    <p className="mt-1.5 rounded-md bg-red-50 px-2 py-1 font-semibold text-red-700">
                      ⚠️ O pino atual está a {sugestao.distanciaPinoM} m do endereço do Google. Use o botão acima para comparar os dois lugares.
                    </p>
                  )}
                  <a href={sugestao.link} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline">
                    <ExternalLink className="h-3 w-3" /> Ver no Google Maps
                  </a>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                {selecionado.latitude != null && (
                  <span>
                    Ponto: <b className="text-slate-700">{ORIGEM_ROTULO[selecionado.geo_origem ?? ''] ?? 'origem não registrada'}</b>
                    {selecionado.geo_confirmado && selecionado.geo_confirmado_em && ` · confirmado${selecionado.geo_confirmado_por_nome ? ` por ${selecionado.geo_confirmado_por_nome}` : ''} em ${dataCurta(selecionado.geo_confirmado_em)}`}
                  </span>
                )}
                {selecionado.latitude == null && selecionado.geo_status === 'nao_encontrado' && <span className="font-semibold text-amber-700">Google não encontrou este endereço</span>}
                {selecionado.latitude == null && selecionado.geo_status === 'ambiguo' && <span className="font-semibold text-amber-700">Endereço ambíguo: falta escolher</span>}
                {selecionado.latitude == null && selecionado.geo_status === 'erro' && <span className="font-semibold text-red-700">Última consulta falhou</span>}
                <button type="button" onClick={alternarHistorico} className="ml-auto flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900">
                  <History className="h-3 w-3" /> {verHistorico ? 'Ocultar histórico' : 'Ver histórico'}
                </button>
              </div>

              {verHistorico && (
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-white p-2 text-[11px] text-slate-600 ring-1 ring-slate-100">
                  {historico === null && <li>Carregando…</li>}
                  {historico?.length === 0 && <li>Nenhum registro ainda.</li>}
                  {historico?.map(h => (
                    <li key={h.id}>
                      <b className="text-slate-800">{EVENTO_ROTULO[h.evento] ?? h.evento}</b>
                      {h.origem && ` · ${ORIGEM_ROTULO[h.origem] ?? h.origem}`}
                      {h.statusGeo && ` · ${h.statusGeo}`}
                      {h.detalhe && ` · ${h.detalhe}`}
                      {` · ${h.usuarioNome ?? 'sistema'} · ${dataCurta(h.criadoEm)}`}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

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

          {avisoMapa && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 ring-1 ring-amber-200">{avisoMapa}</p>}
          <div key={motor} ref={divRef} className="relative z-0 h-[420px] w-full overflow-hidden rounded-xl ring-1 ring-slate-200" />

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
                  {pending ? 'Salvando…' : selecionado.latitude != null && !selecionado.geo_confirmado ? 'Confirmar localização' : 'Salvar localização'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
