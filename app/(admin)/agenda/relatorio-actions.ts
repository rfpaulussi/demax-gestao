'use server'

import { getUser } from '@/lib/auth/get-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { addDias, hojeBR, mesValido, segundaDe } from '@/lib/agenda/datas'
import { buscarSedeId } from '@/lib/agenda/sede'
import {
  dataBR, META_VISITAS_POSTO_MES, montarVisitas,
  type BlocoPlan, type CheckinRaw, type PostoGeo, type VisitaView,
} from '@/lib/agenda/visitas'
import type { Periodo } from '@/lib/agenda/tema'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }
const db = () => createAdminClient() as unknown as AnyClient

export type LinhaSupervisor = {
  id: string
  nome: string
  semanasPublicadas: number
  semanasRascunho: number
  semanasSemAgenda: number
  planejadas: number
  cumpridas: number
  repostas: number
  faltas: number
  extras: number
  atencao: number
  semFoto: number
  foraRaio: number
  pct: number | null
  tempoMedioMin: number | null
  replanejamentos: number
  postosSemVisita: number
}

export type LinhaPosto = {
  postoId: string
  nome: string
  supervisor: string
  planejadas: number
  cumpridas: number
  faltas: number
  extras: number
  ultimaVisita: string | null
}

export type LinhaFoco = {
  foco: string
  planejadas: number
  cumpridas: number
  faltas: number
  semFoto: number
  pct: number | null
}

export type LinhaReplanejamento = {
  supervisor: string
  data: string
  periodo: string
  foco: string
  motivo: string
}

export type LinhaDia = {
  data: string
  cumpridas: number
  faltas: number
  extras: number
  atencao: number
}

export type LinhaAlerta = {
  supervisor: string
  data: string
  posto: string
  chave: string // status bruto da visita (falta, alerta, sem_foto, reposta, extra)
  status: string
  alertas: string
  justificativa: string
}

export type RelatorioMensal = {
  mes: string // YYYY-MM
  parcial: boolean // mês em andamento: só conta o que já venceu até hoje
  ateData: string // último dia considerado (hoje, se parcial; senão o fim do mês)
  porDia: LinhaDia[]
  supervisores: LinhaSupervisor[]
  postos: LinhaPosto[]
  postosNaoVisitados: { postoId: string; nome: string; supervisor: string }[]
  postosBaixaFrequencia: { postoId: string; nome: string; supervisor: string; visitas: number }[]
  metaVisitasPosto: number
  porFoco: LinhaFoco[]
  replanejamentos: LinhaReplanejamento[]
  ocorrencias: LinhaAlerta[]
  totais: { planejadas: number; cumpridas: number; faltas: number; extras: number; atencao: number; semFoto: number; pct: number | null }
}

const STATUS_ROTULO: Record<string, string> = {
  ok: 'Cumprida', alerta: 'Atenção', sem_foto: 'Sem foto', falta: 'Falta', reposta: 'Reposta', extra: 'Extra', agendado: 'Agendada',
}

function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [a, m] = mes.split('-').map(Number)
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate()
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, '0')}` }
}

export async function carregarRelatorioMensal(
  mesParam: string | undefined,
): Promise<{ ok: true; dados: RelatorioMensal } | { ok: false; erro: string }> {
  const auth = await getUser()
  if (!auth || (auth.perfil.role !== 'admin' && auth.perfil.role !== 'coordenador')) {
    return { ok: false, erro: 'Sem permissão' }
  }
  const hoje = hojeBR()
  const mes = mesValido(mesParam) ? mesParam : hoje.slice(0, 7)
  const { inicio, fim } = limitesDoMes(mes)
  const primeiraSegunda = segundaDe(inicio)
  const admin = db()

  try {
    const [{ data: supsRaw }, { data: tiposRaw }, { data: vinculosRaw }, semanasRaw] = await Promise.all([
      admin.from('perfis').select('id, nome').eq('role', 'supervisor').eq('ativo', true).order('nome'),
      admin.from('agenda_tipos_foco').select('id, nome, exige_foto'),
      admin.from('config_supervisores_postos').select('supervisor_id, posto_id, postos(id, nome, ativo)').eq('ativo', true),
      fetchAllRows<{ id: string; supervisor_id: string; semana_inicio: string; status: 'rascunho' | 'publicada' }>((de, ate) =>
        admin
          .from('agenda_semanas')
          .select('id, supervisor_id, semana_inicio, status')
          .gte('semana_inicio', primeiraSegunda)
          .lte('semana_inicio', fim)
          .range(de, ate),
      ),
    ])

    const sedeId = await buscarSedeId(admin)
    const sups = (supsRaw ?? []) as { id: string; nome: string | null }[]
    const nomeSup = new Map(sups.map(s => [s.id, s.nome ?? 'Supervisor']))
    const tipos = (tiposRaw ?? []) as { id: string; nome: string; exige_foto?: boolean }[]
    const nomeTipo = new Map(tipos.map(t => [t.id, t.nome]))
    const exigeFoto = new Map(tipos.map(t => [t.id, !!t.exige_foto]))

    const semIds = semanasRaw.map(s => s.id)
    type BlRaw = {
      semana_id: string; data: string; periodo: string; tipo_foco_id: string
      replanejado: boolean | null; motivo_replanejamento: string | null
      agenda_blocos_postos: { posto_id: string }[]
    }
    const blocos: BlRaw[] = []
    for (let i = 0; i < semIds.length; i += 100) {
      const lote = semIds.slice(i, i + 100)
      const rows = await fetchAllRows<BlRaw>((de, ate) =>
        admin
          .from('agenda_blocos')
          .select('semana_id, data, periodo, tipo_foco_id, replanejado, motivo_replanejamento, agenda_blocos_postos(posto_id)')
          .in('semana_id', lote)
          .range(de, ate),
      )
      blocos.push(...rows)
    }

    // Check-ins do mês (+ 31 dias antes, só para detectar coordenada repetida).
    const colunas = 'id, supervisor_id, posto_id, tipo, latitude, longitude, precisao_m, distancia_m, dentro_raio, baixa_precisao, justificativa, created_at'
    const buscar = (cols: string) =>
      fetchAllRows<CheckinRaw>((de, ate) =>
        admin
          .from('agenda_checkins')
          .select(cols)
          .gte('created_at', `${addDias(primeiraSegunda, -31)}T00:00:00Z`)
          .lte('created_at', `${addDias(fim, 7)}T23:59:59Z`)
          .order('created_at', { ascending: true })
          .range(de, ate),
      )
    // foto_path só existe após a migração 20261013.
    let cks: CheckinRaw[]
    try { cks = await buscar(`${colunas}, foto_path`) } catch { cks = await buscar(colunas) }

    const cksPorSupSemana = new Map<string, CheckinRaw[]>()
    const histPorSup = new Map<string, CheckinRaw[]>()
    const push = (m: Map<string, CheckinRaw[]>, k: string, c: CheckinRaw) => m.set(k, [...(m.get(k) ?? []), c])
    for (const c of cks) {
      const d = dataBR(c.created_at)
      if (d < primeiraSegunda) push(histPorSup, c.supervisor_id, c)
      else push(cksPorSupSemana, `${c.supervisor_id}|${segundaDe(d)}`, c)
    }

    const idsPosto = new Set<string>()
    for (const b of blocos) b.agenda_blocos_postos.forEach(p => idsPosto.add(p.posto_id))
    for (const c of cks) idsPosto.add(c.posto_id)
    const postosGeo = new Map<string, PostoGeo>()
    const nomePosto = new Map<string, string>()
    const ids = Array.from(idsPosto)
    for (let i = 0; i < ids.length; i += 200) {
      const { data: ps } = await admin.from('postos').select('id, nome, latitude, longitude, raio_m').in('id', ids.slice(i, i + 200))
      for (const p of (ps ?? []) as PostoGeo[]) {
        postosGeo.set(p.id, { ...p, raio_m: p.raio_m ?? 150 })
        nomePosto.set(p.id, p.nome)
      }
    }

    // Semanas × supervisor.
    const semPorChave = new Map(semanasRaw.map(s => [`${s.supervisor_id}|${s.semana_inicio}`, s]))
    const segundas: string[] = []
    for (let s = primeiraSegunda; s <= fim; s = addDias(s, 7)) segundas.push(s)

    const linhas: LinhaSupervisor[] = []
    const visitasPorSup = new Map<string, VisitaView[]>()
    const replanejamentos: LinhaReplanejamento[] = []

    for (const sup of sups) {
      const visitasMes: VisitaView[] = []
      let publicadas = 0, rascunhos = 0, semAgenda = 0, replan = 0

      for (const seg of segundas) {
        const sem = semPorChave.get(`${sup.id}|${seg}`)
        const jaComecou = seg <= hoje
        if (!sem) { if (jaComecou) semAgenda++; continue }
        if (sem.status === 'publicada') publicadas++
        else if (jaComecou) rascunhos++

        const meus = blocos.filter(b => b.semana_id === sem.id)
        const planos: BlocoPlan[] = meus.flatMap(b =>
          b.agenda_blocos_postos.map(p => ({
            data: b.data,
            periodo: b.periodo as Periodo,
            foco: nomeTipo.get(b.tipo_foco_id) ?? '',
            posto_id: p.posto_id,
            exige_foto: exigeFoto.get(b.tipo_foco_id) ?? false,
          })),
        )
        for (const b of meus) {
          if (b.replanejado && b.data >= inicio && b.data <= fim) {
            replan++
            replanejamentos.push({
              supervisor: sup.nome ?? 'Supervisor',
              data: b.data,
              periodo: b.periodo,
              foco: nomeTipo.get(b.tipo_foco_id) ?? '',
              motivo: b.motivo_replanejamento ?? '',
            })
          }
        }
        const { visitas } = montarVisitas({
          planos,
          checkins: cksPorSupSemana.get(`${sup.id}|${seg}`) ?? [],
          historico: histPorSup.get(sup.id) ?? [],
          postos: postosGeo,
          hoje,
          publicada: sem.status === 'publicada',
          sedeId,
        })
        visitasMes.push(...visitas.filter(v => v.data >= inicio && v.data <= fim))
      }

      // Visita extra em semana sem agenda: o check-in existe mas a semana não.
      for (const seg of segundas) {
        if (semPorChave.has(`${sup.id}|${seg}`)) continue
        const { visitas } = montarVisitas({
          planos: [],
          checkins: cksPorSupSemana.get(`${sup.id}|${seg}`) ?? [],
          historico: histPorSup.get(sup.id) ?? [],
          postos: postosGeo,
          hoje,
          publicada: false,
          sedeId,
        })
        visitasMes.push(...visitas.filter(v => v.data >= inicio && v.data <= fim))
      }

      visitasPorSup.set(sup.id, visitasMes)
      const conta = (st: string) => visitasMes.filter(v => v.status === st).length
      const devidas = visitasMes.filter(v => ['ok', 'alerta', 'sem_foto', 'falta', 'reposta'].includes(v.status))
      const cumpridas = devidas.filter(v => ['ok', 'alerta', 'reposta'].includes(v.status)).length
      const tempos = visitasMes.map(v => v.tempo_min).filter((t): t is number => t !== null)

      linhas.push({
        id: sup.id,
        nome: sup.nome ?? 'Supervisor',
        semanasPublicadas: publicadas,
        semanasRascunho: rascunhos,
        semanasSemAgenda: semAgenda,
        planejadas: devidas.length,
        cumpridas,
        repostas: conta('reposta'),
        faltas: conta('falta'),
        extras: conta('extra'),
        atencao: conta('alerta'),
        semFoto: conta('sem_foto'),
        foraRaio: visitasMes.filter(v => v.alertas.includes('Fora do raio do posto')).length,
        pct: devidas.length > 0 ? Math.round((cumpridas / devidas.length) * 100) : null,
        tempoMedioMin: tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null,
        replanejamentos: replan,
        postosSemVisita: 0,
      })
    }

    // Postos: planejado × realizado no mês, e postos do supervisor sem nenhuma visita no mês.
    const porPosto = new Map<string, LinhaPosto>()
    for (const sup of sups) {
      for (const v of visitasPorSup.get(sup.id) ?? []) {
        const k = `${sup.id}|${v.posto_id}`
        const l = porPosto.get(k) ?? {
          postoId: v.posto_id, nome: v.posto_nome, supervisor: sup.nome ?? 'Supervisor',
          planejadas: 0, cumpridas: 0, faltas: 0, extras: 0, ultimaVisita: null,
        }
        if (['ok', 'alerta', 'sem_foto', 'falta', 'reposta'].includes(v.status)) l.planejadas++
        if (['ok', 'alerta', 'reposta'].includes(v.status)) l.cumpridas++
        if (v.status === 'falta') l.faltas++
        if (v.status === 'extra') l.extras++
        if (v.entrada_em && (!l.ultimaVisita || v.data > l.ultimaVisita)) l.ultimaVisita = v.data
        porPosto.set(k, l)
      }
    }
    const visitados = new Set(Array.from(porPosto.entries()).filter(([, l]) => l.ultimaVisita).map(([k]) => k))
    // Dias com visita iniciada (check-in de entrada) por supervisor × posto.
    const diasComVisita = new Map<string, number>()
    for (const sup of sups) {
      for (const v of visitasPorSup.get(sup.id) ?? []) {
        if (!v.entrada_em) continue
        const k = `${sup.id}|${v.posto_id}`
        diasComVisita.set(k, (diasComVisita.get(k) ?? 0) + 1)
      }
    }
    const naoVisitados: RelatorioMensal['postosNaoVisitados'] = []
    const baixaFrequencia: RelatorioMensal['postosBaixaFrequencia'] = []
    for (const v of (vinculosRaw ?? []) as { supervisor_id: string; posto_id: string; postos: { id: string; nome: string; ativo: boolean | null } | null }[]) {
      if (!v.postos || v.postos.ativo === false || /^afastado/i.test(v.postos.nome)) continue
      if (!nomeSup.has(v.supervisor_id)) continue
      const chave = `${v.supervisor_id}|${v.posto_id}`
      const feitas = diasComVisita.get(chave) ?? 0
      if (!visitados.has(chave)) {
        naoVisitados.push({ postoId: v.posto_id, nome: v.postos.nome, supervisor: nomeSup.get(v.supervisor_id)! })
      } else if (feitas < META_VISITAS_POSTO_MES) {
        baixaFrequencia.push({ postoId: v.posto_id, nome: v.postos.nome, supervisor: nomeSup.get(v.supervisor_id)!, visitas: feitas })
      }
    }

    // Cumprimento por tipo de foco (um bloco com vários focos conta em cada um).
    const focoAcc = new Map<string, LinhaFoco>()
    for (const sup of sups) {
      for (const v of visitasPorSup.get(sup.id) ?? []) {
        if (!['ok', 'alerta', 'sem_foto', 'falta', 'reposta'].includes(v.status)) continue
        for (const nome of v.focos.length ? v.focos : ['(sem foco)']) {
          const l = focoAcc.get(nome) ?? { foco: nome, planejadas: 0, cumpridas: 0, faltas: 0, semFoto: 0, pct: null }
          l.planejadas++
          if (['ok', 'alerta', 'reposta'].includes(v.status)) l.cumpridas++
          if (v.status === 'falta') l.faltas++
          if (v.status === 'sem_foto') l.semFoto++
          focoAcc.set(nome, l)
        }
      }
    }
    const porFoco = Array.from(focoAcc.values())
      .map(l => ({ ...l, pct: l.planejadas > 0 ? Math.round((l.cumpridas / l.planejadas) * 100) : null }))
      .sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101) || b.planejadas - a.planejadas)
    for (const l of linhas) l.postosSemVisita = naoVisitados.filter(n => n.supervisor === l.nome).length

    const ocorrencias: LinhaAlerta[] = []
    for (const sup of sups) {
      for (const v of visitasPorSup.get(sup.id) ?? []) {
        if (v.status === 'ok' || v.status === 'agendado') continue
        if (v.status === 'extra' && v.alertas.length === 0) continue
        ocorrencias.push({
          supervisor: sup.nome ?? 'Supervisor',
          data: v.data,
          posto: v.posto_nome,
          chave: v.status,
          status: STATUS_ROTULO[v.status] ?? v.status,
          alertas: v.alertas.join('; '),
          justificativa: v.justificativa ?? '',
        })
      }
    }
    ocorrencias.sort((a, b) => a.data.localeCompare(b.data) || a.supervisor.localeCompare(b.supervisor))
    replanejamentos.sort((a, b) => a.data.localeCompare(b.data))

    // Linha do tempo: visitas do mês por dia.
    const diaAcc = new Map<string, LinhaDia>()
    for (const sup of sups) {
      for (const v of visitasPorSup.get(sup.id) ?? []) {
        if (v.status === 'agendado') continue
        const l = diaAcc.get(v.data) ?? { data: v.data, cumpridas: 0, faltas: 0, extras: 0, atencao: 0 }
        if (v.status === 'ok' || v.status === 'reposta') l.cumpridas++
        else if (v.status === 'alerta') { l.cumpridas++; l.atencao++ }
        else if (v.status === 'falta' || v.status === 'sem_foto') l.faltas++
        else if (v.status === 'extra') l.extras++
        diaAcc.set(v.data, l)
      }
    }
    const porDia = Array.from(diaAcc.values()).sort((a, b) => a.data.localeCompare(b.data))
    const parcial = hoje >= inicio && hoje < fim

    const soma = (f: (l: LinhaSupervisor) => number) => linhas.reduce((t, l) => t + f(l), 0)
    const plan = soma(l => l.planejadas)
    const cump = soma(l => l.cumpridas)

    return {
      ok: true,
      dados: {
        mes,
        parcial,
        ateData: parcial ? hoje : fim,
        porDia,
        supervisores: linhas,
        postos: Array.from(porPosto.values()).sort((a, b) => b.faltas - a.faltas || a.nome.localeCompare(b.nome)),
        postosNaoVisitados: naoVisitados.sort((a, b) => a.supervisor.localeCompare(b.supervisor) || a.nome.localeCompare(b.nome)),
        postosBaixaFrequencia: baixaFrequencia.sort((a, b) => a.visitas - b.visitas || a.nome.localeCompare(b.nome)),
        metaVisitasPosto: META_VISITAS_POSTO_MES,
        porFoco,
        replanejamentos,
        ocorrencias,
        totais: {
          planejadas: plan,
          cumpridas: cump,
          faltas: soma(l => l.faltas),
          extras: soma(l => l.extras),
          atencao: soma(l => l.atencao),
          semFoto: soma(l => l.semFoto),
          pct: plan > 0 ? Math.round((cump / plan) * 100) : null,
        },
      },
    }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Erro ao montar o relatório' }
  }
}
