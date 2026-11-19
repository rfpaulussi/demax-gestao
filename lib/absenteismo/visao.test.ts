// lib/absenteismo/visao.test.ts
import { describe, it, expect } from 'vitest'
import { compararKpis, montarVisao } from './visao'
import { calcularKpis } from './kpis'
import { calcularPeriodo } from './calculo'
import type { DadosAbsenteismo, FuncionarioCalc } from './tipos'

const F = (id: string, secretaria: string, over: Partial<FuncionarioCalc> = {}): FuncionarioCalc => ({
  id, nome: id, registro: null, admissao: '2020-01-01', desligamento: null, fora_do_quadro: false,
  regime: '5x2', posto_id: `p-${id}`, posto_nome: `Posto ${id}`, secretaria, supervisor_id: null, supervisor: '—', ...over,
})
const falta = (id: string, funcionario_id: string, data: string) =>
  ({ id, funcionario_id, data_falta: data, data_fim: null, dias: 1, tipo: 'sem_justificativa', confirmada: true, observacao: null })

const dados: DadosAbsenteismo = {
  funcionarios: [F('f1', 'SME'), F('f2', 'SMEL')],
  faltas: [falta('n1', 'f1', '2026-11-03'), falta('o1', 'f1', '2026-10-06'), falta('o2', 'f1', '2026-10-07')],
  atestados: [], afastamentos: [], ferias: [], suspensoes: [],
}
const HOJE = '2026-11-19'

describe('montarVisao — novembro/2026 (parcial até 19/11)', () => {
  const v = montarVisao({ dados, filtros: { secretaria: null, posto_id: null, supervisor_id: null }, ano: 2026, mes: 11, hoje: HOJE })

  it('período parcial e sem "semDados"', () => {
    expect(v.periodo).toEqual({ inicio: '2026-11-01', fim: '2026-11-19', parcial: true })
    expect(v.semDados).toBe(false)
  })
  it('KPIs do mês: 1 falta em 26 jornadas programadas, quadro 2', () => {
    expect(v.kpis.jornadas_perdidas).toBe(1)
    expect(v.jornadas_programadas).toBe(26)
    expect(v.kpis.taxa).toBeCloseTo(100 / 26, 6)
    expect(v.kpis.quadro_medio).toBe(2)
    expect(v.kpis.indice_frequencia).toBeCloseTo(50, 6)
  })
  it('compara com 1 a 19/10 (2 faltas em 24 jornadas)', () => {
    expect(v.vsMesAnterior?.periodo).toEqual({ inicio: '2026-10-01', fim: '2026-10-19' })
    expect(v.vsMesAnterior?.kpis.taxa).toBeCloseTo(200 / 24, 6)
    expect(v.vsMesAnterior?.variacoes.taxa_pp).toBeCloseTo(100 / 26 - 200 / 24, 6)
    expect(v.vsMesAnterior?.variacoes.jornadas_perdidas_pct).toBeCloseTo(-50, 6)
    expect(v.vsMesAnterior?.variacoes.afetados_pct).toBeCloseTo(0, 6)
  })
  it('ano anterior sem base', () => {
    expect(v.vsAnoAnterior).toBeNull()
  })
  it('série de 12 meses: os 5 primeiros sem dados, junho parcial, novembro parcial', () => {
    expect(v.serie).toHaveLength(12)
    expect(v.serie[0]).toMatchObject({ mes: '2025-12', taxa: null })
    expect(v.serie[4]).toMatchObject({ mes: '2026-04', taxa: null })
    expect(v.serie[6]).toMatchObject({ mes: '2026-06', parcial: true })
    expect(v.serie[11]).toMatchObject({ mes: '2026-11', parcial: true })
  })
  it('composição, ranking e calor', () => {
    expect(v.composicao[0]).toMatchObject({ classe: 'falta_injustificada', jornadas: 1 })
    expect(v.ranking.map(l => l.valor)).toEqual(['SME', 'SMEL'])
    expect(v.calor.find(l => l.classe === 'falta_injustificada')?.porDia).toEqual([0, 1, 0, 0, 0, 0, 0]) // 03/11 é terça
  })
  it('opções de filtro vêm do quadro, ordenadas', () => {
    expect(v.opcoes.secretarias).toEqual(['SME', 'SMEL'])
    expect(v.opcoes.postos.map(p => p.nome)).toEqual(['Posto f1', 'Posto f2'])
    expect(v.opcoes.supervisores).toEqual([])
  })
})

describe('montarVisao — filtros e casos de borda', () => {
  it('filtro de secretaria restringe os KPIs, mas o ranking continua comparando as secretarias', () => {
    const v = montarVisao({ dados, filtros: { secretaria: 'SMEL', posto_id: null, supervisor_id: null }, ano: 2026, mes: 11, hoje: HOJE })
    expect(v.kpis.jornadas_perdidas).toBe(0)
    expect(v.kpis.quadro_medio).toBe(1)
    expect(v.ranking.map(l => l.valor)).toEqual(['SME', 'SMEL'])
  })
  it('mês antes de 18/06/2026: sem dados', () => {
    const v = montarVisao({ dados, filtros: { secretaria: null, posto_id: null, supervisor_id: null }, ano: 2026, mes: 5, hoje: HOJE })
    expect(v.semDados).toBe(true)
    expect(v.vsMesAnterior).toBeNull()
    expect(v.ranking).toEqual([])
    expect(v.kpis.taxa).toBe(0)
  })
})

describe('compararKpis', () => {
  const kpisDe = (faltasExtras: number) => {
    const r = calcularPeriodo({
      inicio: '2026-11-01', fim: '2026-11-30', funcionarios: [F('f1', 'SME')],
      faltas: Array.from({ length: faltasExtras }, (_, i) => falta(`x${i}`, 'f1', `2026-11-0${i + 3}`)),
      atestados: [], afastamentos: [], ferias: [], suspensoes: [],
    })
    return calcularKpis(r)
  }
  it('percentual relativo nas contagens, null sem base', () => {
    const v = compararKpis(kpisDe(2), kpisDe(1))
    expect(v.jornadas_perdidas_pct).toBeCloseTo(100, 6)
    expect(v.episodios_pct).toBeCloseTo(100, 6)
    expect(compararKpis(kpisDe(1), kpisDe(0)).jornadas_perdidas_pct).toBeNull()
  })
})
