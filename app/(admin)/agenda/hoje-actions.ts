'use server'

import { getUser } from '@/lib/auth/get-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { addDias, hojeBR, segundaDe } from '@/lib/agenda/datas'
import { ehFeriadoDeLei, feriadosDaSemana } from '@/lib/agenda/feriados'
import { dataBR } from '@/lib/agenda/visitas'
import { HORA_INICIO_ESPERADA, MIN_SEM_SAIDA_ALERTA } from '@/lib/agenda/hoje'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }
const db = () => createAdminClient() as unknown as AnyClient

export type SituacaoHoje =
  | 'sem_saida' | 'nao_comecou' | 'em_visita' | 'em_campo' | 'concluiu'
  | 'aguardando' | 'livre' | 'sem_agenda' | 'feriado' | 'apoio_sem_registro'

export type LinhaHoje = {
  id: string
  nome: string
  apoio: boolean
  situacao: SituacaoHoje
  planejadas: number
  visitadas: number // postos planejados com check-in de entrada hoje
  entradas: number // check-ins de entrada hoje (inclui extras)
  primeira: string | null // ISO da primeira chegada
  ultima: { em: string; tipo: 'entrada' | 'saida'; posto: string } | null
  aberta: { posto: string; desde: string; minutos: number } | null
}

export type DadosHoje = {
  hoje: string
  agora: string // ISO
  linhas: LinhaHoje[]
  feriado: string | null
}

/** Quadro do dia para a gestão: quem já começou, quem não, quem está há horas sem registrar a saída. */
export async function carregarHoje(): Promise<{ ok: true; dados: DadosHoje } | { ok: false; erro: string }> {
  const auth = await getUser()
  if (!auth || (auth.perfil.role !== 'admin' && auth.perfil.role !== 'coordenador')) return { ok: false, erro: 'Sem permissão' }

  const hoje = hojeBR()
  const segunda = segundaDe(hoje)
  const agoraMs = Date.now()
  const horaAgora = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date(agoraMs)))
  const admin = db()

  const [{ data: supsRaw }, { data: apoioRows }, { data: semanasRaw }] = await Promise.all([
    admin.from('perfis').select('id, nome').eq('role', 'supervisor').eq('ativo', true).order('nome'),
    admin.from('perfis').select('id').eq('role', 'supervisor').eq('apoio', true), // coluna da migração 20261031
    admin.from('agenda_semanas').select('id, supervisor_id, status').eq('semana_inicio', segunda),
  ])
  const sups = (supsRaw ?? []) as { id: string; nome: string | null }[]
  const idsApoio = new Set(((apoioRows ?? []) as { id: string }[]).map(r => r.id))
  const semanas = (semanasRaw ?? []) as { id: string; supervisor_id: string; status: 'rascunho' | 'publicada' }[]
  const semPorSup = new Map(semanas.map(s => [s.supervisor_id, s]))

  // Visitas planejadas para hoje (agenda publicada, focos com posto).
  const idsSemanaPublicada = semanas.filter(s => s.status === 'publicada').map(s => s.id)
  const planejadasPorSup = new Map<string, Set<string>>()
  if (idsSemanaPublicada.length > 0) {
    const { data: blocos } = await admin
      .from('agenda_blocos')
      .select('semana_id, agenda_tipos_foco(sem_posto), agenda_blocos_postos(posto_id)')
      .in('semana_id', idsSemanaPublicada)
      .eq('data', hoje)
    const supPorSemana = new Map(semanas.map(s => [s.id, s.supervisor_id]))
    for (const b of (blocos ?? []) as { semana_id: string; agenda_tipos_foco: { sem_posto: boolean | null } | null; agenda_blocos_postos: { posto_id: string }[] }[]) {
      if (b.agenda_tipos_foco?.sem_posto) continue
      const sup = supPorSemana.get(b.semana_id)
      if (!sup) continue
      const set = planejadasPorSup.get(sup) ?? new Set<string>()
      for (const p of b.agenda_blocos_postos) set.add(p.posto_id)
      planejadasPorSup.set(sup, set)
    }
  }

  // Check-ins de hoje.
  const { data: cksRaw } = await admin
    .from('agenda_checkins')
    .select('supervisor_id, posto_id, tipo, created_at')
    .gte('created_at', `${addDias(hoje, -1)}T00:00:00Z`)
    .order('created_at', { ascending: true })
  type Ck = { supervisor_id: string; posto_id: string; tipo: 'entrada' | 'saida'; created_at: string }
  const cks = ((cksRaw ?? []) as Ck[]).filter(c => dataBR(c.created_at) === hoje)

  const idsPosto = Array.from(new Set(cks.map(c => c.posto_id)))
  const nomePosto = new Map<string, string>()
  if (idsPosto.length > 0) {
    const { data: ps } = await admin.from('postos').select('id, nome').in('id', idsPosto)
    for (const p of (ps ?? []) as { id: string; nome: string }[]) nomePosto.set(p.id, p.nome)
  }

  const feriadoHoje = (await feriadosDaSemana(segunda))[hoje]
  const feriado = ehFeriadoDeLei(feriadoHoje) ? feriadoHoje.nome : null

  const linhas: LinhaHoje[] = sups.map(s => {
    const meus = cks.filter(c => c.supervisor_id === s.id)
    const entradas = meus.filter(c => c.tipo === 'entrada')
    const planejadasSet = planejadasPorSup.get(s.id) ?? new Set<string>()
    const visitadas = Array.from(planejadasSet).filter(p => entradas.some(e => e.posto_id === p)).length

    // Visita aberta: entrada sem saída posterior no mesmo posto (a mais antiga).
    const abertas = entradas.filter(e => !meus.some(c => c.tipo === 'saida' && c.posto_id === e.posto_id && c.created_at > e.created_at))
    const aberta = abertas[0]
      ? {
          posto: nomePosto.get(abertas[0].posto_id) ?? 'Posto',
          desde: abertas[0].created_at,
          minutos: Math.max(0, Math.floor((agoraMs - Date.parse(abertas[0].created_at)) / 60000)),
        }
      : null
    const ult = meus[meus.length - 1]
    const apoio = idsApoio.has(s.id)
    const sem = semPorSup.get(s.id)

    let situacao: SituacaoHoje
    if (aberta && aberta.minutos >= MIN_SEM_SAIDA_ALERTA) situacao = 'sem_saida'
    else if (aberta) situacao = 'em_visita'
    else if (feriado && entradas.length === 0) situacao = 'feriado'
    else if (apoio) situacao = entradas.length > 0 ? 'em_campo' : 'apoio_sem_registro'
    else if (!sem || sem.status !== 'publicada') situacao = entradas.length > 0 ? 'em_campo' : 'sem_agenda'
    else if (planejadasSet.size === 0) situacao = entradas.length > 0 ? 'em_campo' : 'livre'
    else if (entradas.length === 0) situacao = horaAgora >= HORA_INICIO_ESPERADA ? 'nao_comecou' : 'aguardando'
    else situacao = visitadas >= planejadasSet.size ? 'concluiu' : 'em_campo'

    return {
      id: s.id,
      nome: s.nome ?? 'Supervisor',
      apoio,
      situacao,
      planejadas: planejadasSet.size,
      visitadas,
      entradas: entradas.length,
      primeira: entradas[0]?.created_at ?? null,
      ultima: ult ? { em: ult.created_at, tipo: ult.tipo, posto: nomePosto.get(ult.posto_id) ?? 'Posto' } : null,
      aberta,
    }
  })

  return { ok: true, dados: { hoje, agora: new Date(agoraMs).toISOString(), linhas, feriado } }
}
