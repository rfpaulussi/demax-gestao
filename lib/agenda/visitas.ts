import { distanciaM, formatarDistancia } from '@/lib/agenda/geo'
import type { Periodo } from '@/lib/agenda/tema'

/** Permanência mínima esperada entre chegada e saída (abaixo disso vira sinal de atenção). */
export const MIN_PERMANENCIA_MIN = 10
/** Velocidade acima da qual dois check-ins consecutivos são considerados fisicamente improváveis. */
export const VELOCIDADE_MAX_KMH = 120

export type CheckinRaw = {
  id: string
  supervisor_id: string
  posto_id: string
  tipo: 'entrada' | 'saida'
  latitude: number
  longitude: number
  precisao_m: number | null
  distancia_m: number | null
  dentro_raio: boolean
  baixa_precisao: boolean
  justificativa: string | null
  created_at: string
  foto_path?: string | null
}

export type BlocoPlan = {
  data: string
  periodo: Periodo
  foco: string
  posto_id: string
  exige_foto?: boolean
}

export type PostoGeo = {
  id: string
  nome: string
  latitude: number | null
  longitude: number | null
  raio_m: number
}

export type StatusVisita = 'ok' | 'alerta' | 'sem_foto' | 'falta' | 'agendado' | 'extra'

export type VisitaView = {
  key: string
  data: string
  posto_id: string
  posto_nome: string
  status: StatusVisita
  periodos: Periodo[]
  focos: string[]
  entrada_em: string | null
  saida_em: string | null
  tempo_min: number | null
  distancia_m: number | null
  justificativa: string | null
  baixa_precisao: boolean
  alertas: string[] // sinais de atenção (fora do raio, permanência curta, deslocamento improvável…)
  lat_posto: number | null
  lng_posto: number | null
  raio_m: number
  lat_real: number | null
  lng_real: number | null
  ordem: number | null
  fotos: string[]
}

export type MapaStats = {
  planejadas: number
  cumpridas: number
  faltas: number
  extras: number
  atencao: number // visitas cumpridas, mas com algum sinal de atenção
  semFoto: number // foco exige foto e a visita não tem
  pct: number | null
  tempoMedioMin: number | null
  oficial: boolean // false = agenda em rascunho: nada conta no cumprimento
}

export function dataBR(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

type Modo = 'oficial' | 'rascunho' | 'extra'

/**
 * Cruza o planejado (blocos × postos) com o realizado (check-ins) por dia+posto.
 *
 * - Só agenda **publicada** conta no cumprimento. Em rascunho, as visitas ficam `agendado`
 *   (nunca `falta`) e um check-in nesses postos é tratado como `extra`.
 * - Foco que exige foto: visita sem foto (chegada ou saída) vira `sem_foto` e não conta como cumprida.
 * - Sinais de atenção (viram `alerta`): fora do raio / GPS impreciso, permanência curta,
 *   deslocamento improvável entre check-ins e coordenada idêntica à de outro dia.
 * - `historico`: check-ins anteriores do mesmo supervisor, só para detectar coordenada repetida.
 */
export function montarVisitas(args: {
  planos: BlocoPlan[]
  checkins: CheckinRaw[]
  historico?: CheckinRaw[]
  postos: Map<string, PostoGeo>
  hoje: string
  publicada: boolean
}): { visitas: VisitaView[]; stats: MapaStats } {
  const { planos, checkins, postos, hoje, publicada } = args
  const historico = args.historico ?? []

  const plan = new Map<string, { data: string; posto_id: string; periodos: Set<Periodo>; focos: Set<string>; exigeFoto: boolean }>()
  for (const p of planos) {
    const k = `${p.data}|${p.posto_id}`
    const g = plan.get(k) ?? { data: p.data, posto_id: p.posto_id, periodos: new Set<Periodo>(), focos: new Set<string>(), exigeFoto: false }
    g.periodos.add(p.periodo)
    g.focos.add(p.foco)
    if (p.exige_foto) g.exigeFoto = true
    plan.set(k, g)
  }

  const ordenados = [...checkins].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const cks = new Map<string, CheckinRaw[]>()
  for (const c of ordenados) {
    const k = `${dataBR(c.created_at)}|${c.posto_id}`
    cks.set(k, [...(cks.get(k) ?? []), c])
  }

  // Deslocamento improvável: velocidade implícita entre dois check-ins consecutivos.
  const alertaPorKey = new Map<string, string[]>()
  const addAlerta = (k: string, texto: string) => alertaPorKey.set(k, [...(alertaPorKey.get(k) ?? []), texto])
  for (let i = 1; i < ordenados.length; i++) {
    const a = ordenados[i - 1]
    const b = ordenados[i]
    const dist = distanciaM(a.latitude, a.longitude, b.latitude, b.longitude)
    const horas = (Date.parse(b.created_at) - Date.parse(a.created_at)) / 3_600_000
    if (dist >= 1000 && horas > 0 && dist / 1000 / horas > VELOCIDADE_MAX_KMH) {
      const min = Math.max(1, Math.round(horas * 60))
      addAlerta(`${dataBR(b.created_at)}|${b.posto_id}`, `Deslocamento improvável: ${formatarDistancia(dist)} em ${min} min desde o check-in anterior`)
    }
  }

  // Coordenada idêntica (5 casas ≈ 1 m) em dias diferentes: GPS real sempre varia.
  const coordDias = new Map<string, Set<string>>()
  const chaveCoord = (c: CheckinRaw) => `${c.posto_id}|${c.latitude.toFixed(5)}|${c.longitude.toFixed(5)}`
  for (const c of [...historico, ...checkins]) {
    if (c.tipo !== 'entrada') continue
    const k = chaveCoord(c)
    const s = coordDias.get(k) ?? new Set<string>()
    s.add(dataBR(c.created_at))
    coordDias.set(k, s)
  }

  const montar = (k: string, data: string, postoId: string, periodos: Periodo[], focos: string[], modo: Modo, exigeFoto: boolean): VisitaView | null => {
    const lista = cks.get(k) ?? []
    const entrada = lista.find(c => c.tipo === 'entrada') ?? null
    const saida = entrada ? lista.find(c => c.tipo === 'saida' && c.created_at > entrada.created_at) ?? null : null
    if (modo === 'extra' && !entrada) return null
    const posto = postos.get(postoId)

    const alertas: string[] = [...(alertaPorKey.get(k) ?? [])]
    const tempo = entrada && saida ? Math.max(1, Math.round((Date.parse(saida.created_at) - Date.parse(entrada.created_at)) / 60000)) : null

    let status: StatusVisita
    if (entrada) {
      if (!entrada.dentro_raio) alertas.push('Fora do raio do posto')
      if (entrada.baixa_precisao) alertas.push('GPS com baixa precisão')
      if (tempo !== null && tempo < MIN_PERMANENCIA_MIN) alertas.push(`Permanência curta: ${tempo} min (mínimo ${MIN_PERMANENCIA_MIN})`)
      if ((coordDias.get(chaveCoord(entrada))?.size ?? 0) > 1) alertas.push('Coordenada idêntica à de outro dia (o GPS real sempre varia um pouco)')

      if (modo === 'extra' || modo === 'rascunho') status = 'extra'
      else if (exigeFoto && !entrada.foto_path && !saida?.foto_path) {
        status = 'sem_foto'
        alertas.push('Foco exige foto e nenhuma foi anexada')
      } else status = alertas.length > 0 ? 'alerta' : 'ok'
    } else if (modo === 'oficial') {
      status = data < hoje ? 'falta' : 'agendado'
    } else {
      status = 'agendado'
    }

    return {
      key: k,
      data,
      posto_id: postoId,
      posto_nome: posto?.nome ?? 'Posto',
      status,
      periodos,
      focos,
      entrada_em: entrada?.created_at ?? null,
      saida_em: saida?.created_at ?? null,
      tempo_min: tempo,
      distancia_m: entrada?.distancia_m ?? null,
      justificativa: entrada?.justificativa ?? null,
      baixa_precisao: entrada?.baixa_precisao ?? false,
      alertas,
      lat_posto: posto?.latitude ?? null,
      lng_posto: posto?.longitude ?? null,
      raio_m: posto?.raio_m ?? 150,
      lat_real: entrada?.latitude ?? null,
      lng_real: entrada?.longitude ?? null,
      ordem: null,
      fotos: [entrada?.foto_path, saida?.foto_path].filter((f): f is string => !!f),
    }
  }

  const visitas: VisitaView[] = []
  plan.forEach((g, k) => {
    const v = montar(k, g.data, g.posto_id, Array.from(g.periodos), Array.from(g.focos), publicada ? 'oficial' : 'rascunho', g.exigeFoto)
    if (v) visitas.push(v)
  })
  cks.forEach((_, k) => {
    if (plan.has(k)) return
    const [data, postoId] = k.split('|')
    const v = montar(k, data, postoId, [], [], 'extra', false)
    if (v) visitas.push(v)
  })

  visitas.sort((a, b) => a.data.localeCompare(b.data) || (a.entrada_em ?? 'z').localeCompare(b.entrada_em ?? 'z'))
  visitas
    .filter(v => v.entrada_em)
    .sort((a, b) => a.entrada_em!.localeCompare(b.entrada_em!))
    .forEach((v, i) => { v.ordem = i + 1 })

  // Visitas "devidas": planejadas (agenda publicada) cujo prazo já chegou; futuras não entram na %.
  const devidas = visitas.filter(v => v.status === 'ok' || v.status === 'alerta' || v.status === 'sem_foto' || v.status === 'falta')
  const cumpridas = devidas.filter(v => v.status === 'ok' || v.status === 'alerta').length
  const tempos = visitas.map(v => v.tempo_min).filter((t): t is number => t !== null)

  return {
    visitas,
    stats: {
      planejadas: devidas.length,
      cumpridas,
      faltas: visitas.filter(v => v.status === 'falta').length,
      extras: visitas.filter(v => v.status === 'extra').length,
      atencao: visitas.filter(v => v.status === 'alerta').length,
      semFoto: visitas.filter(v => v.status === 'sem_foto').length,
      pct: devidas.length > 0 ? Math.round((cumpridas / devidas.length) * 100) : null,
      tempoMedioMin: tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null,
      oficial: publicada,
    },
  }
}
