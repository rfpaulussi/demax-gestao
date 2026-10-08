import type { Periodo } from '@/lib/agenda/tema'

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
}

export type BlocoPlan = {
  data: string
  periodo: Periodo
  foco: string
  posto_id: string
}

export type PostoGeo = {
  id: string
  nome: string
  latitude: number | null
  longitude: number | null
  raio_m: number
}

export type StatusVisita = 'ok' | 'alerta' | 'falta' | 'agendado' | 'extra'

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
  lat_posto: number | null
  lng_posto: number | null
  raio_m: number
  lat_real: number | null
  lng_real: number | null
  ordem: number | null
}

export type MapaStats = {
  planejadas: number
  cumpridas: number
  faltas: number
  extras: number
  foraRaio: number
  pct: number | null
  tempoMedioMin: number | null
}

export function dataBR(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

/**
 * Cruza o planejado (blocos × postos) com o realizado (check-ins) por dia+posto.
 * Planejado sem check-in vira `falta` se o dia já passou, `agendado` caso contrário;
 * check-in sem planejamento vira `extra`.
 */
export function montarVisitas(args: {
  planos: BlocoPlan[]
  checkins: CheckinRaw[]
  postos: Map<string, PostoGeo>
  hoje: string
}): { visitas: VisitaView[]; stats: MapaStats } {
  const { planos, checkins, postos, hoje } = args

  const plan = new Map<string, { data: string; posto_id: string; periodos: Set<Periodo>; focos: Set<string> }>()
  for (const p of planos) {
    const k = `${p.data}|${p.posto_id}`
    const g = plan.get(k) ?? { data: p.data, posto_id: p.posto_id, periodos: new Set<Periodo>(), focos: new Set<string>() }
    g.periodos.add(p.periodo)
    g.focos.add(p.foco)
    plan.set(k, g)
  }

  const cks = new Map<string, CheckinRaw[]>()
  for (const c of [...checkins].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const k = `${dataBR(c.created_at)}|${c.posto_id}`
    cks.set(k, [...(cks.get(k) ?? []), c])
  }

  const montar = (k: string, data: string, postoId: string, periodos: Periodo[], focos: string[], planejado: boolean): VisitaView | null => {
    const lista = cks.get(k) ?? []
    const entrada = lista.find(c => c.tipo === 'entrada') ?? null
    const saida = entrada ? lista.find(c => c.tipo === 'saida' && c.created_at > entrada.created_at) ?? null : null
    if (!planejado && !entrada) return null
    const posto = postos.get(postoId)

    let status: StatusVisita
    if (entrada) {
      if (!planejado) status = 'extra'
      else status = entrada.dentro_raio && !entrada.baixa_precisao ? 'ok' : 'alerta'
    } else {
      status = data < hoje ? 'falta' : 'agendado'
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
      tempo_min: entrada && saida ? Math.max(1, Math.round((Date.parse(saida.created_at) - Date.parse(entrada.created_at)) / 60000)) : null,
      distancia_m: entrada?.distancia_m ?? null,
      justificativa: entrada?.justificativa ?? null,
      baixa_precisao: entrada?.baixa_precisao ?? false,
      lat_posto: posto?.latitude ?? null,
      lng_posto: posto?.longitude ?? null,
      raio_m: posto?.raio_m ?? 150,
      lat_real: entrada?.latitude ?? null,
      lng_real: entrada?.longitude ?? null,
      ordem: null,
    }
  }

  const visitas: VisitaView[] = []
  plan.forEach((g, k) => {
    const v = montar(k, g.data, g.posto_id, Array.from(g.periodos), Array.from(g.focos), true)
    if (v) visitas.push(v)
  })
  cks.forEach((_, k) => {
    if (plan.has(k)) return
    const [data, postoId] = k.split('|')
    const v = montar(k, data, postoId, [], [], false)
    if (v) visitas.push(v)
  })

  visitas.sort((a, b) => a.data.localeCompare(b.data) || (a.entrada_em ?? 'z').localeCompare(b.entrada_em ?? 'z'))
  visitas
    .filter(v => v.entrada_em)
    .sort((a, b) => a.entrada_em!.localeCompare(b.entrada_em!))
    .forEach((v, i) => { v.ordem = i + 1 })

  // Visitas "devidas": planejadas cujo prazo já chegou (cumpridas ou faltas); futuras não entram na %.
  const devidas = visitas.filter(v => v.status === 'ok' || v.status === 'alerta' || v.status === 'falta')
  const cumpridas = devidas.filter(v => v.status !== 'falta').length
  const planejadasHoje = devidas.length
  const tempos = visitas.map(v => v.tempo_min).filter((t): t is number => t !== null)

  return {
    visitas,
    stats: {
      planejadas: planejadasHoje,
      cumpridas,
      faltas: visitas.filter(v => v.status === 'falta').length,
      extras: visitas.filter(v => v.status === 'extra').length,
      foraRaio: visitas.filter(v => v.status === 'alerta').length,
      pct: planejadasHoje > 0 ? Math.round((cumpridas / planejadasHoje) * 100) : null,
      tempoMedioMin: tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null,
    },
  }
}
