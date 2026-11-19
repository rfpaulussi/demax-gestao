// lib/absenteismo/calculo.ts
import { addDias, diffDias, listarDias, maxData, minData } from './datas'
import {
  LIMITE_DIAS_ATESTADO_EMPRESA,
  classificarAfastamento,
  classificarFalta,
  type ClasseDisponibilidade,
  type ClasseTaxa,
} from './classificar'
import { agruparAtestadosContiguos } from './episodios'
import { diasProgramados, feriadosDoPeriodo } from './jornadas'
import { janelaDoFuncionario, quadroMedio } from './quadro'
import type { EntradaCalculo, Episodio, PorFuncionario, ResultadoCalculo } from './tipos'

type EstadoDia =
  | { tipo: 'taxa'; classe: ClasseTaxa; dono: string }
  | { tipo: 'disp'; classe: ClasseDisponibilidade }
  | { tipo: 'susp' }

const zeroTaxa = (): Record<ClasseTaxa, number> => ({
  falta_injustificada: 0, falta_justificada: 0, atestado: 0, outras: 0,
})
const zeroDisp = (): Record<ClasseDisponibilidade, number> => ({
  afastamento_inss: 0, licenca_legal: 0, afastamento_outros: 0, atestado_prolongado: 0, ferias: 0,
})

/** Faltas são pintadas nesta ordem; a última pintada vence no mesmo dia. */
const ORDEM_FALTAS: ClasseTaxa[] = ['outras', 'falta_injustificada', 'falta_justificada']

function agruparPorFuncionario<T extends { funcionario_id: string }>(lista: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of lista) {
    const atual = m.get(x.funcionario_id)
    if (atual) atual.push(x)
    else m.set(x.funcionario_id, [x])
  }
  return m
}

const fimDaFalta = (f: { data_falta: string; data_fim: string | null; dias: number }): string =>
  f.data_fim !== null && f.data_fim >= f.data_falta
    ? f.data_fim
    : addDias(f.data_falta, Math.max(f.dias, 1) - 1)

/**
 * Calcula o período [inicio, fim] para o conjunto de funcionários recebido.
 *
 * Precedência por dia (último pintado vence): falta outras < falta injustificada < falta justificada
 * < suspensão < atestado (até o 15º dia) < atestado prolongado < férias < afastamento.
 * Cada dia pertence a UMA classe. Classes de disponibilidade e suspensão saem da base
 * (jornadas programadas); classes da taxa contam como perdidas quando o dia é programado.
 */
export function calcularPeriodo(entrada: EntradaCalculo): ResultadoCalculo {
  const { inicio, fim } = entrada
  // ids duplicados dobrariam todos os totais: a primeira ocorrência vence, preservando a ordem
  const vistos = new Set<string>()
  const funcionarios = entrada.funcionarios.filter(f => {
    if (vistos.has(f.id)) return false
    vistos.add(f.id)
    return true
  })
  // folga de 45 dias nos dois lados: suspensões que começam antes do período e terminam dentro dele
  const feriados = feriadosDoPeriodo(addDias(inicio, -45), addDias(fim, 45))

  const faltasPor = agruparPorFuncionario(entrada.faltas)
  const atestadosPor = agruparPorFuncionario(entrada.atestados)
  const afastPor = agruparPorFuncionario(entrada.afastamentos)
  const feriasPor = agruparPorFuncionario(entrada.ferias)
  const suspPor = agruparPorFuncionario(entrada.suspensoes)

  let programadas = 0
  let perdidas = 0
  let suspensaoJornadas = 0
  let afetados = 0
  let reincidentes = 0
  const perdidasPorClasse = zeroTaxa()
  const dispDias = zeroDisp()
  const episodios: Episodio[] = []
  const porFuncionario: Record<string, PorFuncionario> = {}

  for (const f of funcionarios) {
    const janela = janelaDoFuncionario(f, inicio, fim)
    if (!janela) continue

    const prog = diasProgramados(f.regime, janela.inicio, janela.fim, feriados)
    const progSet = new Set(prog)
    const estado = new Map<string, EstadoDia>()
    const origem = new Map<string, { classe: ClasseTaxa; ids: string[]; confirmada: boolean | null; inicio_origem: string }>()

    const pintar = (de: string, ate: string, e: EstadoDia) => {
      const a = maxData(de, janela.inicio)
      const b = minData(ate, janela.fim)
      if (a > b) return
      for (const d of listarDias(a, b)) estado.set(d, e)
    }

    // 1) faltas (injustificada/justificada/outras) e suspensão
    const faltasF = faltasPor.get(f.id) ?? []
    for (const classe of ORDEM_FALTAS) {
      for (const x of faltasF) {
        if (classificarFalta(x.tipo) !== classe) continue
        origem.set(x.id, { classe, ids: [x.id], confirmada: x.confirmada, inicio_origem: x.data_falta })
        pintar(x.data_falta, fimDaFalta(x), { tipo: 'taxa', classe, dono: x.id })
      }
    }
    for (const x of faltasF) {
      if (classificarFalta(x.tipo) === 'suspensao') pintar(x.data_falta, fimDaFalta(x), { tipo: 'susp' })
    }
    for (const s of suspPor.get(f.id) ?? []) {
      // mesma fase do ciclo 5x1 da janela (que ancora em janela.inicio), recuando em múltiplos de 6 dias
      const anchor = addDias(janela.inicio, -6 * Math.ceil(Math.max(0, diffDias(s.data_inicio, janela.inicio)) / 6))
      const n = Math.max(0, Math.floor(s.dias))
      const dias = diasProgramados(f.regime, anchor, addDias(s.data_inicio, n * 2 + 14), feriados)
        .filter(d => d >= s.data_inicio)
        .slice(0, n)
      for (const d of dias) pintar(d, d, { tipo: 'susp' })
    }

    // 2) atestados: até o 15º dia na taxa; do 16º em diante, prolongado (disponibilidade)
    const atestadosF = atestadosPor.get(f.id) ?? []
    const donoDoAtestado = new Map<string, string>()
    for (const grupo of agruparAtestadosContiguos(atestadosF)) {
      origem.set(grupo[0].id, { classe: 'atestado', ids: grupo.map(a => a.id), confirmada: null, inicio_origem: grupo[0].data_inicio })
      for (const a of grupo) donoDoAtestado.set(a.id, grupo[0].id)
    }
    for (const a of atestadosF) {
      const corte = addDias(a.data_inicio, LIMITE_DIAS_ATESTADO_EMPRESA - 1)
      pintar(a.data_inicio, minData(a.data_fim, corte), {
        tipo: 'taxa', classe: 'atestado', dono: donoDoAtestado.get(a.id) ?? a.id,
      })
    }
    for (const a of atestadosF) {
      const corte = addDias(a.data_inicio, LIMITE_DIAS_ATESTADO_EMPRESA - 1)
      if (a.data_fim > corte) pintar(addDias(corte, 1), a.data_fim, { tipo: 'disp', classe: 'atestado_prolongado' })
    }

    // 3) férias e afastamentos (maior precedência)
    for (const x of feriasPor.get(f.id) ?? []) {
      pintar(x.data_inicio, x.data_fim, { tipo: 'disp', classe: 'ferias' })
    }
    for (const a of afastPor.get(f.id) ?? []) {
      pintar(a.data_inicio, a.data_fim_real ?? a.data_fim_prevista ?? fim, {
        tipo: 'disp', classe: classificarAfastamento(a.motivo),
      })
    }

    // 4) contabilizar dia a dia
    let progF = 0
    let perdF = 0
    const creditados = new Map<string, string[]>()
    for (const d of listarDias(janela.inicio, janela.fim)) {
      const e = estado.get(d)
      const programado = progSet.has(d)
      if (!e) {
        if (programado) progF++
        continue
      }
      if (e.tipo === 'disp') {
        dispDias[e.classe]++
        continue
      }
      if (e.tipo === 'susp') {
        if (programado) suspensaoJornadas++
        continue
      }
      const lista = creditados.get(e.dono)
      if (lista) lista.push(d)
      else creditados.set(e.dono, [d])
      if (programado) {
        progF++
        perdF++
        perdidasPorClasse[e.classe]++
      }
    }

    // 5) episódios (só os que ficaram com pelo menos um dia depois da precedência)
    let nEpisodios = 0
    Array.from(creditados.entries()).forEach(([dono, dias]) => {
      const o = origem.get(dono)
      if (!o) return
      episodios.push({
        id: dono,
        funcionario_id: f.id,
        classe: o.classe,
        inicio: dias[0],
        inicio_origem: o.inicio_origem,
        fim: dias[dias.length - 1],
        jornadas: dias.filter(d => progSet.has(d)).length,
        confirmada: o.confirmada,
        origem_ids: o.ids,
      })
      nEpisodios++
    })

    programadas += progF
    perdidas += perdF
    if (nEpisodios >= 1) afetados++
    if (nEpisodios >= 2) reincidentes++
    porFuncionario[f.id] = { programadas: progF, perdidas: perdF, episodios: nEpisodios }
  }

  const episodiosPorClasse = zeroTaxa()
  for (const ep of episodios) episodiosPorClasse[ep.classe]++

  const indisponiveis =
    dispDias.afastamento_inss + dispDias.licenca_legal + dispDias.afastamento_outros +
    dispDias.atestado_prolongado + dispDias.ferias

  return {
    inicio,
    fim,
    dias_corridos: diffDias(inicio, fim) + 1,
    quadro_medio: quadroMedio(funcionarios, inicio, fim),
    jornadas_programadas: programadas,
    jornadas_perdidas: perdidas,
    perdidas_por_classe: perdidasPorClasse,
    episodios,
    episodios_por_classe: episodiosPorClasse,
    funcionarios_afetados: afetados,
    funcionarios_reincidentes: reincidentes,
    disponibilidade_dias: dispDias,
    indisponiveis_dias_pessoa: indisponiveis,
    suspensao_jornadas: suspensaoJornadas,
    por_funcionario: porFuncionario,
  }
}
