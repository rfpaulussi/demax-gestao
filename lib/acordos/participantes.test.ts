import { describe, expect, it } from 'vitest'
import type { CamposAcordo } from './tipos'
import { agruparPorJornada, construirMovimentos, resumoCalculo, saldoMin } from './movimentos'
import { validarAcordo } from './validar'
import { montarTextosAcordo } from './montar'
import { gerarObjeto } from './templates'
import { func, T_5X2_540 as T_OUTRO } from './__fixtures__'

// Eleições: domingo 04/10/2026; meio período = 1 dia de folga, dia todo = 2 dias.
const base: CamposAcordo = {
  template: 'T5', dataEvento: '2026-10-04', nomeEvento: 'Eleições 2026', datasAjuste: [], prazoLimite: '2027-02-28',
  participantes: {
    a: { inicio: '08:00', fim: '12:30', folgas: ['2026-12-23'] },
    b: { inicio: '13:30', fim: '18:00', folgas: ['2026-12-23'] },
    c: { inicio: '08:00', fim: '18:00', folgas: ['2026-12-28', '2026-12-29'] },
  },
}
const fs = [func('a'), func('b'), func('c')]

describe('T5 com participantes (folga em dias inteiros)', () => {
  it('valida sem erro quando cada um tem período e folgas', () => {
    const porGrupo = agruparPorJornada(base, fs).flatMap(g => validarAcordo(base, g))
    expect(porGrupo.filter(a => a.nivel === 'erro')).toEqual([])
  })

  it('movimentos: crédito no 1º dia do evento, uma quitação por dia de folga, saldo zero', () => {
    const movs = construirMovimentos(base, fs)
    const c = movs.filter(m => m.funcionarioId === 'c')
    expect(c.find(m => m.papel === 'origem')).toMatchObject({ data: '2026-10-04', minutos: 1056 })
    expect(c.filter(m => m.papel === 'quitacao').map(m => [m.data, m.minutos])).toEqual([['2026-12-28', -528], ['2026-12-29', -528]])
    for (const id of ['a', 'b', 'c']) expect(saldoMin(movs.filter(m => m.funcionarioId === id))).toBe(0)
    expect(movs.find(m => m.funcionarioId === 'a' && m.papel === 'origem')?.minutos).toBe(528)
  })

  it('agrupa por período + dias de folga', () => {
    expect(agruparPorJornada(base, fs).map(g => g.map(f => f.id))).toEqual([['a'], ['b'], ['c']])
    const igual = { ...base, participantes: { ...base.participantes!, b: { inicio: '08:00', fim: '12:30', folgas: ['2026-12-23'] } } }
    expect(agruparPorJornada(igual, fs).map(g => g.map(f => f.id))).toEqual([['a', 'b'], ['c']])
  })

  it('texto: período do grupo e dias de folga', () => {
    const t = (id: string) => {
      const g = fs.filter(f => f.id === id)
      const r = gerarObjeto(base, resumoCalculo(base, g))
      return r.ok ? r.texto : r.erro
    }
    expect(t('a')).toBe('trabalharem no dia 04/10/2026 (Eleições 2026), das 08h às 12h30, compensando o trabalho prestado com a concessão de 01 (um) dia de folga, no dia 23/12/2026. O prazo máximo para a compensação é 28/02/2027.')
    expect(t('c')).toContain('das 08h às 18h')
    expect(t('c')).toContain('02 (dois) dias de folga, nos dias 28/12/2026 e 29/12/2026.')
  })

  it('montarTextosAcordo abre cada parágrafo com os nomes do grupo', () => {
    const r = montarTextosAcordo(base, fs)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.descricao).toContain('Func a trabalharem')
      expect(r.descricao).toContain('Func c trabalharem')
    }
  })

  it('erros: sem período, sem folga, folga repetida, folga em dia de descanso e folga antes do evento', () => {
    const erros = (p: CamposAcordo['participantes']) => validarAcordo({ ...base, participantes: p }, [func('a')]).filter(a => a.nivel === 'erro').map(a => a.codigo)
    expect(erros({ a: { inicio: '', fim: '', folgas: ['2026-12-23'] } })).toContain('PERIODO_INCOMPLETO')
    expect(erros({ a: { inicio: '12:00', fim: '08:00', folgas: ['2026-12-23'] } })).toContain('PERIODO_INVALIDO')
    expect(erros({ a: { inicio: '08:00', fim: '12:00', folgas: [] } })).toContain('FOLGA_SEM_DATA')
    expect(erros({ a: { inicio: '08:00', fim: '12:00', folgas: ['2026-12-23', '2026-12-23'] } })).toContain('FOLGAS_REPETIDAS')
    expect(erros({ a: { inicio: '08:00', fim: '12:00', folgas: ['2026-12-20'] } })).toContain('DIA_DE_FOLGA') // domingo
    expect(erros({ a: { inicio: '08:00', fim: '12:00', folgas: ['2026-10-01'] } })).toContain('ORDEM_DATAS')
  })

  it('sem participantes o T5 antigo continua igual', () => {
    const c: CamposAcordo = { template: 'T5', dataEvento: '2026-06-27', nomeEvento: 'X', minutosOrigem: 60, dataFolga: '2026-06-29', datasAjuste: [] }
    expect(saldoMin(construirMovimentos(c, [func('a')]))).toBe(0)
  })
})

import { participantesValidos } from './participantes-validos'

describe('participantesValidos (checagem do servidor)', () => {
  const ok = (p: CamposAcordo['participantes'], template: CamposAcordo['template'] = 'T5') =>
    participantesValidos({ template, datasAjuste: [], participantes: p })

  it('aceita horários HH:MM e 1+ folgas', () => {
    expect(ok({ a: { inicio: '08:00', fim: '12:30', folgas: ['2026-12-23'] } })).toBe(true)
    expect(ok({ a: { inicio: '13:30', fim: '18:00', folgas: ['2026-12-28', '2026-12-29'] } })).toBe(true)
    expect(ok(undefined)).toBe(true)
  })

  it('recusa horário fora do formato, sem folga, ou em outro template', () => {
    expect(ok({ a: { inicio: '8:00', fim: '12:30', folgas: ['2026-12-23'] } })).toBe(false)
    expect(ok({ a: { inicio: '24:00', fim: '12:30', folgas: ['2026-12-23'] } })).toBe(false)
    expect(ok({ a: { inicio: '08:00', fim: '12:30', folgas: [] } })).toBe(false)
    expect(ok({ a: { inicio: '08:00', fim: '12:30', folgas: ['2026-12-23'] } }, 'T3')).toBe(false)
  })
})

describe('montarTextosAcordo por turno', () => {
  it('cada turno cita só os nomes do turno e não deixa ".;"', () => {
    const a = func('a'), c = func('c')
    const campos: CamposAcordo = {
      template: 'T5', dataEvento: '2026-10-04', nomeEvento: 'Eleições', datasAjuste: [], prazoLimite: '2027-01-05',
      participantes: {
        a: { inicio: '08:00', fim: '12:00', folgas: ['2026-12-28'] },
        b: { inicio: '08:00', fim: '12:00', folgas: ['2026-12-28'] },
        c: { inicio: '13:00', fim: '17:00', folgas: ['2026-12-29'] },
      },
    }
    // turnos diferentes: a e c no turno padrão, b em outro horário
    const outro = func('b', T_OUTRO)
    const r = montarTextosAcordo(campos, [a, outro, c])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    for (const h of r.horarios) expect(h.objeto).not.toMatch(/\.;/)
    const turnoDeB = r.horarios.find(h => h.funcionario_ids.includes('b'))!
    expect(turnoDeB.objeto).toContain('Func b')
    expect(turnoDeB.objeto).not.toContain('Func a')
    expect(turnoDeB.objeto?.endsWith('.')).toBe(true)
    const turnoDeAeC = r.horarios.find(h => h.funcionario_ids.includes('a'))!
    expect(turnoDeAeC.objeto).toContain('Func a')
    expect(turnoDeAeC.objeto).toContain('; e os funcionários Func c')
    expect(turnoDeAeC.objeto).not.toContain('Func b')
  })
})

describe('T5 em dias inteiros: folga antes do dia trabalhado', () => {
  it('diz quem e quais datas', () => {
    const c: CamposAcordo = {
      template: 'T5', dataEvento: '2026-10-04', nomeEvento: 'X', datasAjuste: [], prazoLimite: '2027-01-05',
      participantes: { a: { inicio: '08:00', fim: '12:00', folgas: ['2026-09-28', '2027-01-04'] } },
    }
    const m = validarAcordo(c, [func('a')]).filter(x => x.codigo === 'ORDEM_DATAS').map(x => x.mensagem)
    expect(m).toEqual(['Func a: a folga de 28/09/2026 é anterior ao dia trabalhado (04/10/2026). A folga deve ser depois.'])
  })
})
