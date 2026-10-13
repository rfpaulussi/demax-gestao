'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Camera, CheckCircle2, Clock, LogIn, LogOut, MapPinOff, Navigation, RefreshCw, ShieldCheck } from 'lucide-react'
import { formatarDistancia } from '@/lib/agenda/geo'
import { diaMes } from '@/lib/agenda/datas'
import { PERIODOS } from '@/lib/agenda/tema'
import { anexarFotoCheckin, marcarLocalPosto, registrarCheckin } from '@/app/(admin)/agenda/geo-actions'
import { comprimirImagem } from '@/lib/agenda/imagem'
import { listarFotosPendentes, removerFotoPendente, salvarFotoPendente } from '@/lib/agenda/fila-fotos'
import type { BlocoView, CheckinHoje, PostoOpt, TipoFoco } from '@/app/(admin)/agenda/actions'

type Coords = { lat: number; lng: number; precisao: number | null }
type Pendente = { postoId: string; tipo: 'entrada' | 'saida'; coords: Coords; distancia: number; raio: number }

const ROTULO_PERIODO = Object.fromEntries(PERIODOS.map(p => [p.id, p.label])) as Record<string, string>

function hora(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

/** Instrução de como liberar a localização, conforme o aparelho de quem está usando. */
function mensagemLocalizacaoBloqueada(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const ios = /iPhone|iPad|iPod/i.test(ua)
  if (ios && /CriOS/i.test(ua)) {
    return 'Localização bloqueada. No iPhone: Ajustes → Privacidade e Segurança → Serviços de Localização → Chrome → "Ao Usar o App". Depois volte e tente de novo.'
  }
  if (ios) {
    return 'Localização bloqueada. No iPhone: toque em "aA" ao lado do endereço → Ajustes do Site → Localização → Permitir. Confira também Ajustes → Privacidade e Segurança → Serviços de Localização (ligado).'
  }
  return 'Localização bloqueada. No Android: toque no cadeado ao lado do endereço → Permissões → Localização → Permitir. Confira também se o GPS do celular está ligado. Depois tente de novo.'
}

function lerPosicao(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Seu aparelho não oferece localização.'))
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy ?? null }),
      e => reject(new Error(
        e.code === 1 ? mensagemLocalizacaoBloqueada()
        : e.code === 3 ? 'Demorou demais para obter o GPS. Vá para um local aberto e tente de novo.'
        : 'Não foi possível obter sua localização.',
      )),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
  })
}

/** Envia a foto de um check-in. Lança erro se não houver conexão (a chamada não chegou ao servidor). */
async function enviarFotoCheckin(checkinId: string, blob: Blob): Promise<{ ok: true } | { ok: false; erro: string }> {
  const fd = new FormData()
  fd.append('checkinId', checkinId)
  fd.append('foto', new File([blob], 'foto.jpg', { type: 'image/jpeg' }))
  return anexarFotoCheckin(fd)
}

export function CheckinPainel({
  hoje,
  blocos,
  tipos,
  postos,
  sede,
  checkins,
  geoDisponivel,
}: {
  hoje: string
  blocos: BlocoView[]
  tipos: TipoFoco[]
  postos: PostoOpt[]
  sede: PostoOpt | null
  checkins: CheckinHoje[]
  geoDisponivel: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [erro, setErro] = useState<{ postoId: string; texto: string } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [pend, setPend] = useState<Pendente | null>(null)
  const [just, setJust] = useState('')
  const [pendLocal, setPendLocal] = useState<{ postoId: string; coords: Coords; distancia: number } | null>(null)
  const [justLocal, setJustLocal] = useState('')
  const [fotoBusy, setFotoBusy] = useState<string | null>(null)
  const [pendentesFoto, setPendentesFoto] = useState<Set<string>>(new Set())
  const [erroFila, setErroFila] = useState<string | null>(null)
  const processandoFila = useRef(false)

  async function atualizarPendentesFoto() {
    const itens = await listarFotosPendentes()
    setPendentesFoto(new Set(itens.map(i => i.checkinId)))
  }

  // Envia as fotos guardadas sem sinal. Para no primeiro erro de rede e tenta de novo depois.
  async function processarFilaFotos() {
    if (processandoFila.current) return
    processandoFila.current = true
    try {
      const itens = await listarFotosPendentes()
      const falhas: string[] = []
      let enviou = false
      for (const item of itens) {
        let r: { ok: true } | { ok: false; erro: string }
        try {
          r = await enviarFotoCheckin(item.checkinId, item.blob)
        } catch {
          break // ainda sem sinal: a foto continua guardada
        }
        if (r.ok) enviou = true
        else if (!/já tem foto/i.test(r.erro)) falhas.push(r.erro)
        await removerFotoPendente(item.checkinId) // enviada, ou recusada pelo servidor (não adianta insistir)
      }
      setErroFila(falhas.length > 0 ? `Foto guardada não pôde ser anexada: ${falhas[0]}` : null)
      await atualizarPendentesFoto()
      if (enviou) router.refresh()
    } catch {
      // IndexedDB indisponível: nada a reenviar
    } finally {
      processandoFila.current = false
    }
  }

  useEffect(() => {
    void processarFilaFotos()
    const timer = window.setInterval(() => void processarFilaFotos(), 15000)
    const aoVoltarSinal = () => void processarFilaFotos()
    const aoVoltarTela = () => { if (document.visibilityState === 'visible') void processarFilaFotos() }
    window.addEventListener('online', aoVoltarSinal)
    document.addEventListener('visibilitychange', aoVoltarTela)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('online', aoVoltarSinal)
      document.removeEventListener('visibilitychange', aoVoltarTela)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nomeTipo = new Map(tipos.map(t => [t.id, `${t.icone} ${t.nome}`]))
  const exigeFotoTipo = new Map(tipos.map(t => [t.id, !!t.exige_foto]))
  const plan = new Map<string, { periodos: string[]; focos: string[]; exigeFoto: boolean }>()
  for (const b of blocos.filter(x => x.data === hoje)) {
    for (const p of b.postos) {
      const g = plan.get(p.id) ?? { periodos: [], focos: [], exigeFoto: false }
      if (exigeFotoTipo.get(b.tipo_foco_id)) g.exigeFoto = true
      g.periodos.push(ROTULO_PERIODO[b.periodo])
      const f = nomeTipo.get(b.tipo_foco_id)
      if (f && !g.focos.includes(f)) g.focos.push(f)
      plan.set(p.id, g)
    }
  }
  // A sede não é posto do supervisor: entra só quando há bloco de foco "sem posto" planejado hoje.
  const planejados = [...postos, ...(sede ? [sede] : [])].filter(p => plan.has(p.id))
  const extras = postos.filter(p => !plan.has(p.id))

  function situacao(postoId: string) {
    const doPosto = checkins.filter(c => c.posto_id === postoId)
    const entrada = doPosto.find(c => c.tipo === 'entrada') ?? null
    const saida = entrada ? doPosto.find(c => c.tipo === 'saida' && c.created_at > entrada.created_at) ?? null : null
    return { entrada, saida }
  }
  const concluidos = planejados.filter(p => situacao(p.id).entrada).length

  async function marcarLocal(postoId: string, coordsPrev?: Coords, justificativa?: string) {
    setErro(null)
    setAviso(null)
    setBusy(postoId)
    try {
      const coords = coordsPrev ?? (await lerPosicao())
      const r = await marcarLocalPosto({
        postoId, latitude: coords.lat, longitude: coords.lng, precisaoM: coords.precisao, justificativa,
      })
      if (!r.ok) {
        if (r.precisaJustificar) setPendLocal({ postoId, coords, distancia: r.distancia ?? 0 })
        else setErro({ postoId, texto: r.erro })
        return
      }
      setPendLocal(null)
      setJustLocal('')
      setAviso(r.proposta
        ? '📨 Local enviado para a coordenação conferir. O ponto oficial do posto continua o mesmo até a aprovação.'
        : '📍 Local do posto registrado pelo seu GPS (a coordenação vai conferir). Agora você já pode fazer o check-in.')
      router.refresh()
    } catch (e) {
      setErro({ postoId, texto: e instanceof Error ? e.message : 'Falha ao obter a localização.' })
    } finally {
      setBusy(null)
    }
  }

  async function enviarFoto(postoId: string, checkinId: string, file: File | undefined) {
    if (!file) return
    setErro(null)
    setFotoBusy(checkinId)
    try {
      const blob = await comprimirImagem(file)
      let r: { ok: true } | { ok: false; erro: string }
      try {
        r = await enviarFotoCheckin(checkinId, blob)
      } catch {
        // Sem sinal: guarda no aparelho e envia quando a conexão voltar.
        await salvarFotoPendente(checkinId, blob)
        await atualizarPendentesFoto()
        setAviso('📡 Sem sinal: a foto ficou guardada no aparelho e será enviada assim que houver conexão. Mantenha a agenda aberta.')
        return
      }
      if (!r.ok) return setErro({ postoId, texto: r.erro })
      setAviso('📷 Foto anexada (fica guardada por 90 dias).')
      router.refresh()
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
    if (pendentesFoto.has(ck.id)) {
      return (
        <button
          type="button"
          onClick={() => void processarFilaFotos()}
          className="flex w-fit items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-200"
        >
          <RefreshCw className="h-3 w-3" /> Foto da {rotulo} aguardando sinal · tentar agora
        </button>
      )
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
            {g?.exigeFoto && (
              <p className={`mt-0.5 text-[11px] font-bold ${entrada && !entrada.tem_foto && !saida?.tem_foto ? 'text-orange-600' : 'text-slate-400'}`}>
                📷 Foto obrigatória neste foco{entrada && !entrada.tem_foto && !saida?.tem_foto ? ' — anexe para a visita contar' : ''}
              </p>
            )}
            {entrada && (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {botaoFoto(posto.id, entrada, 'chegada')}
                {saida && botaoFoto(posto.id, saida, 'saída')}
              </div>
            )}
          </div>

          {!posto.tem_local && posto.id !== sede?.id ? (
            <button type="button" disabled={!!busy} onClick={() => marcarLocal(posto.id)}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-400 disabled:opacity-50">
              <MapPinOff className="h-4 w-4" /> {carregando ? 'Localizando…' : 'Marcar local aqui'}
            </button>
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

        {!posto.tem_local && posto.id !== sede?.id && (
          <p className="mt-2 text-[11px] text-slate-500">
            Este posto ainda não tem localização. Estando no posto, toque em <b>Marcar local aqui</b>: o GPS registra o ponto e a coordenação confere depois.
          </p>
        )}

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
            {posto.a_conferir && (
              <button type="button" disabled={!!busy}
                onClick={async () => { await marcarLocal(posto.id); setPend(null); setJust('') }}
                className="mt-3 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-left text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50">
                📍 O ponto cadastrado deste posto está errado? Estou no posto — marcar o local exato aqui
              </button>
            )}
          </div>
        )}

        {pendLocal?.postoId === posto.id && (
          <div className="mt-3 rounded-lg border border-sky-300 bg-sky-50 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-sky-900">
              <MapPinOff className="h-3.5 w-3.5" />
              Você está a {formatarDistancia(pendLocal.distancia)} do endereço cadastrado deste posto. Explique onde está para enviar este local à coordenação conferir.
            </p>
            <textarea value={justLocal} onChange={e => setJustLocal(e.target.value)} rows={2} placeholder="Ex.: o posto mudou de endereço, o cadastro está errado…"
              className="w-full resize-none rounded-lg border border-sky-200 bg-white p-2 text-sm outline-none focus:border-sky-400" />
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={!!busy || justLocal.trim().length < 5}
                onClick={() => marcarLocal(posto.id, pendLocal.coords, justLocal)}
                className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40">
                Enviar para conferência
              </button>
              <button type="button" onClick={() => { setPendLocal(null); setJustLocal('') }} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-white">Cancelar</button>
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
        {erroFila && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{erroFila}</p>}

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
