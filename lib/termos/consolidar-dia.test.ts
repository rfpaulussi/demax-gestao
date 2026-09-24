import { describe, it, expect } from 'vitest'
import { chaveConsolidada, diaLocal, chaveDiaParse, protocoloDoGrupo } from './consolidar-dia'
import { chavesQueExigemTermo, type MovParaExigencia } from './exigencia-movs'
import type { TurnoRow } from './montar-termo'

const turno = (id: string, saida: string): TurnoRow => ({
  id, nome: id, tipo_escala: '5x2', hora_entrada: '08:00:00', hora_saida_seg_qui: saida,
  hora_entrada_sex: null, hora_saida_sex: null, hora_inicio_almoco: '12:00:00', hora_fim_almoco: '13:00:00',
  hora_entrada_sabado: null, hora_saida_sabado: null,
})
const turnos = new Map<string, TurnoRow>([
  ['T8h12', turno('T8h12', '17:12:00')],
  ['T7h12a', turno('T7h12a', '16:12:00')],
  ['T7h12b', turno('T7h12b', '16:12:00')], // mesmo conteúdo de 'a'
  ['T6h', turno('T6h', '15:00:00')],
])
const mov = (id: string, func: string, antes: string, depois: string, created_at: string): MovParaExigencia & { funcionario_id: string } => ({
  id, funcionario_id: func, tipo: 'mudanca_horario', valor_antes: antes, valor_depois: depois, created_at, solicitacao_id: null,
})

describe('diaLocal', () => {
  it('23:30 local (02:30Z do dia seguinte) permanece no dia local', () => {
    expect(diaLocal('2026-09-24T02:30:00Z')).toBe('2026-09-23')
  })
  it('09:53 local', () => expect(diaLocal('2026-09-23T12:53:00Z')).toBe('2026-09-23'))
})

describe('chaveConsolidada', () => {
  it('solicitação mantém sol:', () => {
    expect(chaveConsolidada({ id: 'x', funcionario_id: 'f', tipo: 'mudanca_horario', solicitacao_id: 's1', created_at: '2026-09-23T12:00:00Z' })).toBe('sol:s1')
  })
  it('horário manual vira dia:', () => {
    expect(chaveConsolidada({ id: 'x', funcionario_id: 'f1', tipo: 'mudanca_horario', solicitacao_id: null, created_at: '2026-09-24T02:30:00Z' })).toBe('dia:f1:2026-09-23')
  })
  it('outro tipo manual segue mov:', () => {
    expect(chaveConsolidada({ id: 'x', funcionario_id: 'f1', tipo: 'transferencia', solicitacao_id: null, created_at: '2026-09-23T12:00:00Z' })).toBe('mov:x')
  })
  it('parse da chave do dia', () => {
    expect(chaveDiaParse('dia:abc:2026-09-23')).toEqual({ funcionarioId: 'abc', dia: '2026-09-23' })
    expect(chaveDiaParse('mov:abc')).toBeNull()
  })
})

describe('exigência consolidada por dia', () => {
  it('caso Michel: 2 mudanças distintas viram 1 termo', () => {
    const movs = [
      mov('m1', 'F', 'T8h12', 'T7h12a', '2026-09-23T12:53:00Z'),
      mov('m2', 'F', 'T7h12a', 'T6h', '2026-09-23T18:38:00Z'),
    ]
    expect(Array.from(chavesQueExigemTermo(movs, turnos))).toEqual(['dia:F:2026-09-23'])
  })
  it('volta ao original (conteúdo igual) não exige termo', () => {
    const movs = [
      mov('m1', 'F', 'T7h12a', 'T6h', '2026-09-23T12:53:00Z'),
      mov('m2', 'F', 'T6h', 'T7h12b', '2026-09-23T18:38:00Z'),
    ]
    expect(chavesQueExigemTermo(movs, turnos).size).toBe(0)
  })
  it('dois dias => 2 termos', () => {
    const movs = [
      mov('m1', 'F', 'T8h12', 'T7h12a', '2026-09-23T12:53:00Z'),
      mov('m2', 'F', 'T7h12a', 'T6h', '2026-09-24T12:38:00Z'),
    ]
    expect(chavesQueExigemTermo(movs, turnos).size).toBe(2)
  })
  it('dois funcionários => 2 termos', () => {
    const movs = [
      mov('m1', 'F1', 'T8h12', 'T7h12a', '2026-09-23T12:53:00Z'),
      mov('m2', 'F2', 'T8h12', 'T6h', '2026-09-23T13:00:00Z'),
    ]
    expect(chavesQueExigemTermo(movs, turnos).size).toBe(2)
  })
  it('fuso: 23:30 local e 08:00 do mesmo dia local ficam juntos', () => {
    const movs = [
      mov('m1', 'F', 'T8h12', 'T7h12a', '2026-09-23T11:00:00Z'),
      mov('m2', 'F', 'T7h12a', 'T6h', '2026-09-24T02:30:00Z'), // 23:30 local de 23/09
    ]
    expect(Array.from(chavesQueExigemTermo(movs, turnos))).toEqual(['dia:F:2026-09-23'])
  })
})

describe('protocoloDoGrupo', () => {
  const p = { 'mov:m1': { em: 'X' } } as Record<string, { em: string }>
  it('usa a chave do dia', () => {
    expect(protocoloDoGrupo('dia:F:d', ['m1'], { 'dia:F:d': { em: 'Y' } })?.em).toBe('Y')
  })
  it('compat: qualquer mov:<id> do grupo', () => {
    expect(protocoloDoGrupo('dia:F:d', ['m0', 'm1'], p)?.em).toBe('X')
  })
  it('sem protocolo', () => expect(protocoloDoGrupo('dia:F:d', ['m9'], p)).toBeNull())
  it('chave não-dia não usa compat', () => expect(protocoloDoGrupo('sol:1', ['m1'], p)).toBeNull())
})
