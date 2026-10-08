'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Camera, CheckCircle2, Clock, LogIn, LogOut, MapPinOff, Navigation, ShieldCheck } from 'lucide-react'
import { formatarDistancia } from '@/lib/agenda/geo'
import { diaMes } from '@/lib/agenda/datas'
import { PERIODOS } from '@/lib/agenda/tema'
import { anexarFotoCheckin, registrarCheckin } from '@/app/(admin)/agenda/geo-actions'
import { comprimirImagem } from '@/lib/agenda/imagem'
import type { BlocoView, CheckinHoje, PostoOpt, TipoFoco } from '@/app/(admin)/agenda/actions'

type Coords = { lat: number; lng: number; precisao: number | null }
type Pendente = { postoId: string; tipo: 'entrada' | 'saida'; coords: Coords; distancia: number; raio: number }

const ROTULO_PERIODO = Object.fromEntries(PERIODOS.map(p => [p.id, p.label])) as Record<string, string>

function hora(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

function lerPosicao(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Seu aparelho não oferece localização.'))
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy ?? null }),
      e => reject(new Error(
        e.code === 1 ? 'Permissão de localização negada. Libere o acesso à localização no navegador.'
        : e.code === 3 ? 'Demorou demais para obter o GPS. Vá para um local aberto e tente de novo.'
        : 'Não foi possível obter sua localização.',
      )),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
  })
}

export function CheckinPainel({
  hoje,
  blocos,
  tipos,
  postos,
  checkins,
  geoDisponivel,
}: {
  hoje: string
  blocos: BlocoView[]
  tipos: TipoFoco[]
  postos: PostoOpt[]
  checkins: CheckinHoje[]
  geoDisponivel: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [erro, setErro] = useState<{ postoId: string; texto: string } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [pend, setPend] = useState<Pendente | null>(null)
  const [just, setJust] = useState('')
  const [fotoBusy, setFotoBusy] = useState<string | null>(null)

  const nomeTipo = new Map(tipos.map(t => [t.id, `${t.icone} ${t.nome}`]))
  const plan = new Map<string, { periodos: string[]; focos: string[] }>()
  for (const b of blocos.filter(x => x.data === hoje)) {
    for (const p of b.postos) {
      const g = plan.get(p.id) ?? { periodos: [], focos: [] }
      g.periodos.push(ROTULO_PERIODO[b.periodo])
      const f = nomeTipo.get(b.tipo_foco_id)
      if (f && !g.focos.includes(f)) g.focos.push(f)
      plan.set(p.id, g)
    }
  }
  const planejados = postos.filter(p => plan.has(p.id))
  const extras = postos.filter(p => !plan.has(p.id))

  function situacao(postoId: string) {
    const doPosto = checkins.filter(c => c.posto_id === postoId)
    const entrada = doPosto.find(c => c.tipo === 'entrada') ?? null
    const saida = entrada ? doPosto.find(c => c.tipo === 'saida' && c.created_at > entrada.created_at) ?? null : null
    return { entrada, saida }
  }
  const concluidos = planejados.filter(p => situacao(p.id).entrada).length

  async function enviarFoto(postoId: string, checkinId: string, file: File | undefined) {
    if (!file) return
    setErro(null)
    setFotoBusy(checkinId)
    try {
      const blob = await comprimirImagem(file)
      const fd = new FormData()
      fd.append('checkinId', checkinId)
      fd.append('foto', new File([blob], 'foto.jpg', { type: 'image/jpeg' }))
      const r = await anexarFotoCheckin(fd)
      if (!r.ok) setErro({ postoId, texto: r.erro })
      else {
        setAviso('📷 Foto anexada (fica guardada por 90 dias).')
        router.refresh()
      }
    } catch (e) {
      setErro({ postoId, texto: e instanceof Error ? e.message : 'Falha ao enviar a foto.' })
    } finally {
      setFotoBusy(null)
    }
  }

  function botaoFoto(postoId: string, ck: CheckinHoje, rotulo: string) {
    if (ck.tem_foto) {
      return <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><Camera className="h-3 w-3" /> foto da {rotulo} anexada</span>
    }
    return (
      <label className="flex w-fit cursor-pointer items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
        <Camera className="h-3 w-3" /> {fotoBusy === ck.id ? 'Enviando…' : `Foto da ${rotulo} (opcional)`}
        <input
          type="file" accept="image/*" capture="environment" className="hidden" disabled={!!fotoBusy}
          onChange={e => { void enviarFoto(postoId, ck.id, e.target.files?.[0]); e.target.value = '' }}
        />
      </label>
    )
  }

  async function acionar(postoId: string, tipo: 'entrada' | 'saida', coordsPrev?: Coords, justificativa?: string) {
    setErro(null)
    setAviso(null)
    setBusy(postoId)
    try {
      const coords = coordsPrev ?? (await lerPosicao())
      const r = await registrarCheckin({
        postoId, tipo, latitude: coords.lat, longitude: coords.lng, precisaoM: coords.precisao, justificativa,
      })
      if (r.ok) {
        setPend(null)
        setJust('')
        setAviso(
          r.dentro
            ? `✅ ${tipo === 'entrada' ? 'Chegada' : 'Saída'} registrada — ${formatarDistancia(r.distancia)} do posto${r.baixaPrecisao ? ' (GPS com baixa precisão)' : ''}.`
            : `⚠️ ${tipo === 'entrada' ? 'Chegada' : 'Saída'} registrada fora do raio (${formatarDistancia(r.distancia)}), com justificativa.`,
        )
        router.refresh()
      } else if (r.precisaJustificar) {
        setPend({ postoId, tipo, coords, distancia: r.distancia ?? 0, raio: r.raio ?? 0 })
      } else {
        setErro({ postoId, texto: r.erro })
      }
    } catch (e) {
      setErro({ postoId, texto: e instanceof Error ? e.message : 'Falha ao registrar.' })
    } finally {
      setBusy(null)
    }
  }

  function linha(posto: PostoOpt, extra = false) {
    const { entrada, saida } = situacao(posto.id)
    const g = plan.get(posto.id)
    const carregando = busy === posto.id
    const precisaJust = pend?.postoId === posto.id ? pend : null

    return (
      <li key={posto.id} className={`rounded-xl p-3 ring-1 ${saida ? 'bg-emerald-50 ring-emerald-200' : entrada ? 'bg-sky-50 ring-sky-200' : 'bg-white ring-slate-200'}`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${saida ? 'bg-emerald-500' : entrada ? 'bg-sky-500' : 'bg-slate-200'} text-white`}>
            {saida ? <CheckCircle2 className="h-5 w-5" /> : entrada ? <Clock className="h-5 w-5" /> : <Navigation className="h-4 w-4 text-slate-500" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-800">{posto.nome}</p>
            <p className="truncate text-[11px] text-slate-500">
              {extra ? 'Visita extra' : `${g?.periodos.join(' + ')} · ${g?.focos.join(' · ')}`}
            </p>
            {entrada && (
              <p className={`text-[11px] font-semibold ${entrada.dentro_raio ? 'text-emerald-700' : 'text-amber-700'}`}>
                Chegou às {hora(entrada.created_at)}
                {entrada.distancia_m != null && ` · ${formatarDistancia(entrada.distancia_m)} do posto`}
                {!entrada.dentro_raio && ' · fora do raio'}
                {entrada.baixa_precisao && ' · GPS impreciso'}
                {saida && ` · saiu às ${hora(saida.created_at)}`}
              </p>
            )}
            {entrada && (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {botaoFoto(posto.id, entrada, 'chegada')}
                {saida && botaoFoto(posto.id, saida, 'saída')}
              </div>
            )}
          </div>

          {!posto.tem_local ? (
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
              <MapPinOff className="h-3 w-3" /> sem localização
            </span>
          ) : !entrada ? (
            <button type="button" disabled={!!busy} onClick={() => acionar(posto.id, 'entrada')}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50">
              <LogIn className="h-4 w-4" /> {carregando ? 'Localizando…' : 'Cheguei'}
            </button>
          ) : !saida ? (
            <button type="button" disabled={!!busy} onClick={() => acionar(posto.id, 'saida')}
              className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50">
              <LogOut className="h-4 w-4" /> {carregando ? 'Localizando…' : 'Saí'}
            </button>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700">concluído</span>
          )}
        </div>

        {precisaJust && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" />
              Você está a {formatarDistancia(precisaJust.distancia)} do posto (raio de {precisaJust.raio} m). Justifique para registrar.
            </p>
            <textarea value={just} onChange={e => setJust(e.target.value)} rows={2} placeholder="Ex.: acesso fechado, atendimento na rua ao lado…"
              className="w-full resize-none rounded-lg border border-amber-200 bg-white p-2 text-sm outline-none focus:border-amber-400" />
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={!!busy || just.trim().length < 5}
                onClick={() => acionar(precisaJust.postoId, precisaJust.tipo, precisaJust.coords, just)}
                className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-40">
                Registrar mesmo assim
              </button>
              <button type="button" onClick={() => { setPend(null); setJust('') }} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-white">Cancelar</button>
            </div>
          </div>
        )}

        {erro?.postoId === posto.id && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{erro.texto}</p>}
      </li>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white">
        <Navigation className="h-5 w-5" />
        <div className="mr-auto">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-100">Seu dia em campo · {diaMes(hoje)}</p>
          <p className="text-lg font-black leading-tight">
            {planejados.length === 0 ? 'Nenhuma visita planejada hoje' : `${concluidos}/${planejados.length} visitas iniciadas`}
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium">
          <ShieldCheck className="h-3.5 w-3.5" /> GPS lido só ao tocar no botão · fotos apagadas após 90 dias
        </span>
      </div>

      <div className="space-y-2 p-3">
        {!geoDisponivel && (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-500">Check-in será habilitado após a atualização do banco de dados.</p>
        )}
        {aviso && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{aviso}</p>}

        {geoDisponivel && (
          <>
            {planejados.length > 0 && <ul className="space-y-2">{planejados.map(p => linha(p))}</ul>}
            {extras.length > 0 && (
              <details className="group rounded-xl bg-slate-50 p-2">
                <summary className="cursor-pointer px-2 py-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  + Visita extra (não planejada)
                </summary>
                <ul className="mt-2 space-y-2">{extras.map(p => linha(p, true))}</ul>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  )
}
