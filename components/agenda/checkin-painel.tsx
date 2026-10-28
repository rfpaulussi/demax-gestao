'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Camera, CheckCircle2, Clock, LogIn, LogOut, MapPinOff, Navigation, RefreshCw, ShieldCheck } from 'lucide-react'
import { formatarDistancia, PRECISAO_RUIM_M } from '@/lib/agenda/geo'
import { diaMes } from '@/lib/agenda/datas'
import { PERIODOS } from '@/lib/agenda/tema'
import { anexarFotoCheckin, marcarLocalPosto, registrarCheckin } from '@/app/(admin)/agenda/geo-actions'
import { comprimirImagem } from '@/lib/agenda/imagem'
import { listarFotosPendentes, removerFotoPendente, salvarFotoPendente } from '@/lib/agenda/fila-fotos'
import {
  listarCheckinsPendentes, removerCheckinPendente, salvarCheckinPendente, type CheckinPendente,
} from '@/lib/agenda/fila-checkins'
import { comTempoLimite, semConexao } from '@/lib/agenda/rede'
import type { BlocoView, CheckinHoje, PostoOpt, TipoFoco } from '@/app/(admin)/agenda/actions'

type Coords = { lat: number; lng: number; precisao: number | null }
type Pendente = { postoId: string; tipo: 'entrada' | 'saida'; coords: Coords; distancia: number; raio: number }
type CheckinExibido = CheckinHoje & { pendente?: boolean } // pendente = guardado no aparelho, ainda não enviado

const ROTULO_PERIODO = Object.fromEntries(PERIODOS.map(p => [p.id, p.label])) as Record<string, string>
const MSG_SEM_SINAL_ACAO = 'Sem sinal: nada foi registrado. Tente de novo quando houver conexão.'

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

/** Navegador embutido de WhatsApp/Instagram/Facebook etc.: não oferece localização ao site. */
function emNavegadorEmbutido(): boolean {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|; wv\)|WhatsApp|Snapchat|TikTok/i.test(ua)
}

/**
 * Explica por que o GPS foi negado. O erro "negado" do navegador serve tanto para site bloqueado quanto para
 * GPS/permissão desligados no aparelho — a Permissions API diferencia os dois.
 */
async function explicarLocalizacaoNegada(): Promise<string> {
  if (emNavegadorEmbutido()) {
    return 'Este navegador embutido (WhatsApp, Instagram…) não libera a localização. Abra o sistema direto no Chrome (menu ⋮ → "Abrir no Chrome") e tente de novo.'
  }
  let estado: PermissionState | null = null
  try {
    estado = (await navigator.permissions.query({ name: 'geolocation' })).state
  } catch {
    // Permissions API indisponível (Safari antigo): cai na instrução genérica
  }
  if (estado === 'denied') return mensagemLocalizacaoBloqueada()
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (/iPhone|iPad|iPod/i.test(ua)) return mensagemLocalizacaoBloqueada()
  // Site não está bloqueado, mas o aparelho negou: GPS desligado ou Chrome sem permissão no Android.
  return 'O celular não entregou a localização. Ligue o GPS (puxe a barra superior e ative "Localização"). Se continuar: Configurações do Android → Apps → Chrome → Permissões → Localização → "Permitir" e ative "Usar localização precisa". Depois tente de novo.'
}

const ALVO_PRECISAO_M = 40 // para de esperar quando o GPS chega nessa precisão
const JANELA_BOA_MS = 12000 // aos 12 s aceita a leitura se já estiver razoável (até PRECISAO_RUIM_M)
const JANELA_MAX_MS = 25000 // limite: o satélite pode levar até ~25 s para fixar a 1ª vez
const PRECISAO_APROXIMADA_M = 1000 // acima disso é localização aproximada (rede/torre), inútil para provar presença

function msgLocalizacaoAproximada(precisaoM: number): string {
  return `GPS com erro de cerca de ${formatarDistancia(precisaoM)}: o Android entregou só a localização aproximada. Ative a precisa: Configurações do celular → Apps → Chrome → Permissões → Localização → ligue "Usar localização precisa". Depois volte aqui e tente de novo (em local fechado, vá para uma área aberta).`
}

/** Erro de leitura imprecisa que carrega a leitura, para o supervisor poder registrar mesmo assim. */
type ErroAproximada = Error & { coords: Coords }
function ehErroAproximada(e: unknown): e is ErroAproximada {
  return e instanceof Error && 'coords' in e
}

/**
 * Lê o GPS acompanhando por até ~25 s e fica com a leitura mais precisa. A primeira leitura do Android
 * costuma vir por rede/torre (centenas de metros de erro); o satélite leva alguns segundos para fixar.
 * Se terminar ainda com erro de quilômetros, a localização liberada é a aproximada: orienta a liberar a precisa.
 */
function lerPosicao(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Seu aparelho não oferece localização.'))
    let melhor: GeolocationPosition | null = null
    let encerrado = false
    let watchId = 0
    let timer = 0
    let timerBoa = 0
    let passouJanela = false
    const encerrar = () => {
      encerrado = true
      navigator.geolocation.clearWatch(watchId)
      window.clearTimeout(timer)
      window.clearTimeout(timerBoa)
    }
    const concluir = () => {
      if (encerrado || !melhor) return
      encerrar()
      const coords: Coords = { lat: melhor.coords.latitude, lng: melhor.coords.longitude, precisao: melhor.coords.accuracy ?? null }
      if (melhor.coords.accuracy > PRECISAO_APROXIMADA_M) {
        return reject(Object.assign(new Error(msgLocalizacaoAproximada(melhor.coords.accuracy)), { coords }))
      }
      resolve(coords)
    }
    watchId = navigator.geolocation.watchPosition(
      p => {
        if (!melhor || p.coords.accuracy < melhor.coords.accuracy) melhor = p
        if (p.coords.accuracy <= ALVO_PRECISAO_M || passouJanela) concluir()
      },
      e => {
        if (encerrado) return
        if (melhor) return concluir() // já tem uma leitura aproveitável
        encerrar()
        if (e.code === 1) {
          void explicarLocalizacaoNegada().then(msg => reject(new Error(msg)))
        } else {
          reject(new Error(
            e.code === 3 ? 'Demorou demais para obter o GPS. Vá para um local aberto, confira se o GPS do celular está ligado e tente de novo.'
            : 'Não foi possível obter sua localização. Confira se o GPS do celular está ligado e tente de novo.',
          ))
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
    timerBoa = window.setTimeout(() => {
      if (melhor && melhor.coords.accuracy <= PRECISAO_RUIM_M) concluir()
    }, JANELA_BOA_MS)
    timer = window.setTimeout(() => { passouJanela = true; concluir() }, JANELA_MAX_MS)
  })
}

/** Identificador do check-in no aparelho (UUID v4). O servidor usa para não duplicar reenvios. */
function gerarIdLocal(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Envia a foto de um check-in. Lança erro se não chegar ao servidor (sem sinal ou tempo limite). */
async function enviarFotoCheckin(checkinId: string, blob: Blob): Promise<{ ok: true } | { ok: false; erro: string }> {
  const fd = new FormData()
  fd.append('checkinId', checkinId)
  fd.append('foto', new File([blob], 'foto.jpg', { type: 'image/jpeg' }))
  return comTempoLimite(anexarFotoCheckin(fd))
}

function comoExibido(p: CheckinPendente): CheckinExibido {
  return {
    id: p.localId,
    posto_id: p.postoId,
    tipo: p.tipo,
    created_at: p.capturadoEm,
    dentro_raio: false,
    baixa_precisao: false,
    distancia_m: p.distancia ?? null,
    tem_foto: false,
    pendente: true,
  }
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
  const [aprox, setAprox] = useState<{ postoId: string; tipo: 'entrada' | 'saida'; coords: Coords; texto: string } | null>(null)
  const [just, setJust] = useState('')
  const [pendLocal, setPendLocal] = useState<{ postoId: string; coords: Coords; distancia: number } | null>(null)
  const [justLocal, setJustLocal] = useState('')
  const [justPendente, setJustPendente] = useState('')
  const [fotoBusy, setFotoBusy] = useState<string | null>(null)
  const [pendentesFoto, setPendentesFoto] = useState<Set<string>>(new Set())
  const [pendentesCheckin, setPendentesCheckin] = useState<CheckinPendente[]>([])
  const [erroFila, setErroFila] = useState<string | null>(null)
  const sincronizando = useRef(false)
  // Lembrete de check-in pendente a partir das 16h (só no cliente: depende do relógio do aparelho).
  const [fimDeTarde, setFimDeTarde] = useState(false)
  useEffect(() => {
    const avaliar = () => setFimDeTarde(new Date().getHours() >= 16)
    avaliar()
    const t = window.setInterval(avaliar, 5 * 60_000)
    return () => window.clearInterval(t)
  }, [])

  async function atualizarPendentesFoto() {
    const itens = await listarFotosPendentes()
    setPendentesFoto(new Set(itens.map(i => i.checkinId)))
  }

  async function atualizarPendentesCheckin() {
    setPendentesCheckin(await listarCheckinsPendentes())
  }

  // Envia os check-ins guardados sem sinal, na ordem em que foram feitos. Para no primeiro erro de rede.
  async function processarFilaCheckins() {
    const itens = await listarCheckinsPendentes()
    const falhas: string[] = []
    let enviou = false
    for (const item of itens) {
      if (item.precisaJustificar && !item.justificativa) continue // aguarda o supervisor justificar
      let r: Awaited<ReturnType<typeof registrarCheckin>>
      try {
        r = await comTempoLimite(registrarCheckin({
          postoId: item.postoId, tipo: item.tipo, latitude: item.latitude, longitude: item.longitude,
          precisaoM: item.precisaoM, justificativa: item.justificativa, localId: item.localId, capturadoEm: item.capturadoEm,
        }))
      } catch {
        break // ainda sem sinal: o check-in continua guardado
      }
      if (r.ok) {
        enviou = true
        await removerCheckinPendente(item.localId)
        if (item.foto) {
          try {
            const rf = await enviarFotoCheckin(r.checkinId, item.foto)
            if (!rf.ok && !/já tem foto/i.test(rf.erro)) falhas.push(rf.erro)
          } catch {
            await salvarFotoPendente(r.checkinId, item.foto) // foto segue na fila de fotos
          }
        }
      } else if (r.precisaJustificar) {
        await salvarCheckinPendente({ ...item, precisaJustificar: true, distancia: r.distancia, justificativa: undefined })
      } else {
        await removerCheckinPendente(item.localId) // recusado pelo servidor: não adianta insistir
        falhas.push(r.erro)
      }
    }
    if (enviou) setAviso('✅ Check-ins guardados no aparelho foram enviados.')
    await atualizarPendentesCheckin()
    if (enviou) router.refresh()
    return falhas
  }

  // Envia as fotos guardadas sem sinal. Para no primeiro erro de rede e tenta de novo depois.
  async function processarFilaFotos() {
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
    await atualizarPendentesFoto()
    if (enviou) router.refresh()
    return falhas
  }

  async function sincronizar() {
    if (sincronizando.current) return
    sincronizando.current = true
    try {
      const falhas = [...(await processarFilaCheckins()), ...(await processarFilaFotos())]
      setErroFila(falhas.length > 0 ? `Item guardado não pôde ser enviado: ${falhas[0]}` : null)
    } catch {
      // IndexedDB indisponível: nada a reenviar
    } finally {
      sincronizando.current = false
    }
  }

  useEffect(() => {
    void atualizarPendentesCheckin()
    void sincronizar()
    const timer = window.setInterval(() => void sincronizar(), 15000)
    const aoVoltarSinal = () => void sincronizar()
    const aoVoltarTela = () => { if (document.visibilityState === 'visible') void sincronizar() }
    window.addEventListener('online', aoVoltarSinal)
    document.addEventListener('visibilitychange', aoVoltarTela)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('online', aoVoltarSinal)
      document.removeEventListener('visibilitychange', aoVoltarTela)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Check-ins do servidor + os que estão guardados no aparelho (aparecem como "aguardando envio").
  const exibidos: CheckinExibido[] = [...checkins, ...pendentesCheckin.map(comoExibido)]

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
  // A sede não é posto do supervisor: com bloco "Check-in Sede / Base" planejado hoje conta como planejada;
  // sem bloco, aparece como visita extra.
  const todos = [...postos, ...(sede ? [sede] : [])]
  const planejados = todos.filter(p => plan.has(p.id))
  const extras = todos.filter(p => !plan.has(p.id))
  const semCheckin = planejados.filter(p => !exibidos.some(c => c.posto_id === p.id && c.tipo === 'entrada'))

  function situacao(postoId: string) {
    const doPosto = exibidos.filter(c => c.posto_id === postoId)
    const entrada = doPosto.find(c => c.tipo === 'entrada') ?? null
    const saida = entrada ? doPosto.find(c => c.tipo === 'saida' && c.created_at > entrada.created_at) ?? null : null
    return { entrada, saida }
  }
  const concluidos = planejados.filter(p => situacao(p.id).entrada).length

  async function atualizarPendentesApos() {
    await atualizarPendentesCheckin()
  }

  function falhaDeRede(e: unknown): string {
    return e instanceof Error && e.message === 'TEMPO_LIMITE'
      ? MSG_SEM_SINAL_ACAO
      : e instanceof Error ? e.message : 'Falha ao registrar.'
  }

  async function marcarLocal(postoId: string, coordsPrev?: Coords, justificativa?: string) {
    setErro(null)
    setAviso(null)
    if (semConexao()) return setErro({ postoId, texto: MSG_SEM_SINAL_ACAO })
    setBusy(postoId)
    try {
      const coords = coordsPrev ?? (await lerPosicao())
      const r = await comTempoLimite(marcarLocalPosto({
        postoId, latitude: coords.lat, longitude: coords.lng, precisaoM: coords.precisao, justificativa,
      }))
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
      setErro({ postoId, texto: falhaDeRede(e) })
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

  /** Foto de um check-in ainda guardado no aparelho: fica junto com ele e segue no envio. */
  async function anexarFotoPendente(item: CheckinPendente, file: File | undefined) {
    if (!file) return
    setErro(null)
    setFotoBusy(item.localId)
    try {
      const blob = await comprimirImagem(file)
      await salvarCheckinPendente({ ...item, foto: blob })
      await atualizarPendentesApos()
      setAviso('📷 Foto guardada: será enviada junto com o check-in.')
    } catch (e) {
      setErro({ postoId: item.postoId, texto: e instanceof Error ? e.message : 'Falha ao guardar a foto.' })
    } finally {
      setFotoBusy(null)
    }
  }

  async function justificarPendente(item: CheckinPendente) {
    await salvarCheckinPendente({ ...item, justificativa: justPendente.trim(), precisaJustificar: false })
    setJustPendente('')
    await atualizarPendentesApos()
    void sincronizar()
  }

  function botaoFoto(postoId: string, ck: CheckinExibido, rotulo: string) {
    if (ck.pendente) {
      const item = pendentesCheckin.find(p => p.localId === ck.id)
      if (!item) return null
      if (item.foto) {
        return <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-800"><Camera className="h-3 w-3" /> foto da {rotulo} guardada · vai com o check-in</span>
      }
      return (
        <label className="flex w-fit cursor-pointer items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
          <Camera className="h-3 w-3" /> {fotoBusy === item.localId ? 'Guardando…' : `Foto da ${rotulo} (opcional)`}
          <input
            type="file" accept="image/*" capture="environment" className="hidden" disabled={!!fotoBusy}
            onChange={e => { void anexarFotoPendente(item, e.target.files?.[0]); e.target.value = '' }}
          />
        </label>
      )
    }
    if (ck.tem_foto) {
      return <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><Camera className="h-3 w-3" /> foto da {rotulo} anexada</span>
    }
    if (pendentesFoto.has(ck.id)) {
      return (
        <button
          type="button"
          onClick={() => void sincronizar()}
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

  /** Guarda o check-in no aparelho quando não há sinal (ou o servidor não respondeu a tempo). */
  async function guardarCheckin(item: CheckinPendente, tipo: 'entrada' | 'saida') {
    await salvarCheckinPendente(item)
    await atualizarPendentesApos()
    setPend(null)
    setJust('')
    setAviso(`📡 Sem sinal: ${tipo === 'entrada' ? 'chegada' : 'saída'} guardada no aparelho. Será enviada assim que houver conexão. Mantenha a agenda aberta.`)
  }

  async function acionar(postoId: string, tipo: 'entrada' | 'saida', coordsPrev?: Coords, justificativa?: string) {
    setErro(null)
    setAviso(null)
    setAprox(null)
    setBusy(postoId)
    try {
      const coords = coordsPrev ?? (await lerPosicao())
      const item: CheckinPendente = {
        localId: gerarIdLocal(),
        postoId,
        tipo,
        latitude: coords.lat,
        longitude: coords.lng,
        precisaoM: coords.precisao,
        capturadoEm: new Date().toISOString(),
        justificativa,
      }
      if (semConexao()) return await guardarCheckin(item, tipo)

      let r: Awaited<ReturnType<typeof registrarCheckin>>
      try {
        r = await comTempoLimite(registrarCheckin({
          postoId, tipo, latitude: coords.lat, longitude: coords.lng, precisaoM: coords.precisao, justificativa,
          localId: item.localId, capturadoEm: item.capturadoEm,
        }))
      } catch {
        // Sem sinal ou servidor sem resposta: guarda e tenta depois (o servidor não duplica).
        return await guardarCheckin(item, tipo)
      }
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
      if (ehErroAproximada(e)) setAprox({ postoId, tipo, coords: e.coords, texto: e.message })
      else setErro({ postoId, texto: falhaDeRede(e) })
    } finally {
      setBusy(null)
    }
  }

  function linha(posto: PostoOpt, extra = false) {
    const { entrada, saida } = situacao(posto.id)
    const g = plan.get(posto.id)
    const carregando = busy === posto.id
    const precisaJust = pend?.postoId === posto.id ? pend : null
    // Check-in guardado no aparelho que pediu justificativa (fora do raio).
    const itemAJustificar = [entrada, saida]
      .map(c => (c?.pendente ? pendentesCheckin.find(p => p.localId === c.id) : undefined))
      .find(p => p?.precisaJustificar && !p.justificativa)
    const pendenteAlgum = !!(entrada?.pendente || saida?.pendente)

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
              entrada.pendente ? (
                <p className="text-[11px] font-semibold text-sky-800">
                  Chegou às {hora(entrada.created_at)} · aguardando envio{itemAJustificar?.localId === entrada.id ? ' · precisa de justificativa' : ''}
                  {saida && ` · saiu às ${hora(saida.created_at)}${saida.pendente ? ' (aguardando envio)' : ''}`}
                </p>
              ) : (
                <p className={`text-[11px] font-semibold ${entrada.dentro_raio ? 'text-emerald-700' : 'text-amber-700'}`}>
                  Chegou às {hora(entrada.created_at)}
                  {entrada.distancia_m != null && ` · ${formatarDistancia(entrada.distancia_m)} do posto`}
                  {!entrada.dentro_raio && ' · fora do raio'}
                  {entrada.baixa_precisao && ' · GPS impreciso'}
                  {saida && ` · saiu às ${hora(saida.created_at)}`}
                </p>
              )
            )}
            {(g?.exigeFoto || posto.id === sede?.id) && (
              <p className={`mt-0.5 text-[11px] font-bold ${entrada && !entrada.tem_foto && !saida?.tem_foto ? 'text-orange-600' : 'text-slate-400'}`}>
                📷 {posto.id === sede?.id ? 'Foto sempre obrigatória na sede' : 'Foto obrigatória neste foco'}{entrada && !entrada.tem_foto && !saida?.tem_foto ? ' — anexe para a visita contar' : ''}
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
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              {pendenteAlgum ? 'aguardando envio' : 'concluído'}
            </span>
          )}
        </div>

        {!posto.tem_local && (
          <p className="mt-2 text-[11px] text-slate-500">
            Este posto ainda não tem localização. Estando no posto, toque em <b>Marcar local aqui</b>: o GPS registra o ponto e a coordenação confere depois.
          </p>
        )}

        {itemAJustificar && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" />
              Este check-in foi guardado a {formatarDistancia(itemAJustificar.distancia ?? 0)} do posto. Justifique para enviar.
            </p>
            <textarea value={justPendente} onChange={e => setJustPendente(e.target.value)} rows={2} placeholder="Ex.: acesso fechado, atendimento na rua ao lado…"
              className="w-full resize-none rounded-lg border border-amber-200 bg-white p-2 text-sm outline-none focus:border-amber-400" />
            <button type="button" disabled={justPendente.trim().length < 5}
              onClick={() => justificarPendente(itemAJustificar)}
              className="mt-2 rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-40">
              Enviar com justificativa
            </button>
          </div>
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

        {aprox?.postoId === posto.id && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="mb-2 flex items-start gap-1.5 text-xs font-medium text-red-700">
              <MapPinOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {aprox.texto}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!!busy} onClick={() => acionar(posto.id, aprox.tipo)}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                Tentar de novo
              </button>
              <button type="button" disabled={!!busy} onClick={() => acionar(posto.id, aprox.tipo, aprox.coords)}
                className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50">
                Registrar mesmo assim
              </button>
              <button type="button" onClick={() => setAprox(null)} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-white">Cancelar</button>
            </div>
            <p className="mt-2 text-[11px] text-red-600">Registrar assim marca a visita como &quot;GPS impreciso&quot; e a coordenação confere.</p>
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
        {fimDeTarde && semCheckin.length > 0 && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            ⏰ Falta check-in em {semCheckin.length === 1 ? '1 visita planejada' : `${semCheckin.length} visitas planejadas`} de hoje ({semCheckin.map(p => p.nome).join(', ')}).
            Visita sem check-in não conta no cumprimento. Visitou algum posto fora do plano? Faça o check-in em &quot;+ Visita extra&quot;.
          </p>
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
