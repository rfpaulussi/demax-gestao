import { describe, it, expect } from 'vitest'
import { exigeTermo, horarioMudou, supervisorMudou, consolidarTurnos } from './exige-termo'
import { chavesQueExigemTermo } from './exigencia-movs'
import { statusDoTermo } from './constantes'
import type { HorarioTermo } from './tipos'

const h = (o: Partial<HorarioTermo> = {}): HorarioTermo => ({
  nome: 'T', escala: '5x2', entrada: '07:00:00', saidaSegQui: '16:00:00', entradaSex: null,
  saidaSex: '15:00:00', almocoInicio: '12:00:00', almocoFim: '13:00:00', entradaSab: null, saidaSab: null, ...o,
})

describe('horarioMudou', () => {
  it('mesmo conteúdo com nome diferente e segundos => não mudou', () => {
    expect(horarioMudou(h({ nome: 'A' }), h({ nome: 'B', entrada: '07:00' }))).toBe(false)
  })
  it('entrada diferente => mudou', () => {
    expect(horarioMudou(h(), h({ entrada: '08:00:00' }))).toBe(true)
  })
  it('escala diferente => mudou', () => {
    expect(horarioMudou(h(), h({ escala: '12x36' }))).toBe(true)
  })
  it('primeira atribuição (antes vazio) => não mudou', () => {
    expect(horarioMudou(null, h())).toBe(false)
  })
})

describe('supervisorMudou', () => {
  it('desconhecido => false', () => {
    expect(supervisorMudou(null, 'X')).toBe(false)
    expect(supervisorMudou('X', null)).toBe(false)
  })
  it('iguais ignorando caixa => false; diferentes => true', () => {
    expect(supervisorMudou('Ana ', 'ana')).toBe(false)
    expect(supervisorMudou('Ana', 'Bia')).toBe(true)
  })
})

describe('exigeTermo', () => {
  it('transferência com troca de supervisor exige', () => {
    expect(exigeTermo({ tipos: ['transferencia'], supervisorOrigem: 'A', supervisorDestino: 'B' })).toBe(true)
  })
  it('transferência mesmo supervisor sem horário não exige', () => {
    expect(exigeTermo({ tipos: ['transferencia'], supervisorOrigem: 'A', supervisorDestino: 'A' })).toBe(false)
  })
  it('transferência legado (origem desconhecida) sem horário não exige', () => {
    expect(exigeTermo({ tipos: ['transferencia'], supervisorOrigem: null, supervisorDestino: 'B' })).toBe(false)
  })
  it('transferência com horário mudado exige', () => {
    expect(exigeTermo({
      tipos: ['transferencia', 'mudanca_horario'], supervisorOrigem: 'A', supervisorDestino: 'A',
      horario: { antes: h(), depois: h({ entrada: '09:00' }) },
    })).toBe(true)
  })
  it('mudança de horário de mesmo conteúdo não exige', () => {
    expect(exigeTermo({ tipos: ['mudanca_horario'], horario: { antes: h(), depois: h({ nome: 'Outro' }) } })).toBe(false)
  })
  it('primeira atribuição não exige', () => {
    expect(exigeTermo({ tipos: ['mudanca_horario'], horario: { antes: null, depois: h() } })).toBe(false)
  })
  it('outros tipos nunca exigem', () => {
    for (const t of ['mudanca_funcao', 'promocao', 'desligamento', 'afastamento', 'retorno_afastamento', 'alteracao_salario'])
      expect(exigeTermo({ tipos: [t] })).toBe(false)
  })
})

describe('consolidarTurnos', () => {
  it('pega primeiro antes e último depois', () => {
    expect(consolidarTurnos([{ valor_antes: 'a', valor_depois: 'b' }, { valor_antes: 'b', valor_depois: 'c' }]))
      .toEqual({ antesId: 'a', depoisId: 'c' })
    expect(consolidarTurnos([])).toBeNull()
  })
})

describe('statusDoTermo', () => {
  const agora = new Date('2026-10-10T12:00:00Z').getTime()
  it('antes do corte é legado, mesmo protocolado', () => {
    expect(statusDoTermo('2026-09-21T10:00:00Z', null, agora)).toBe('legado')
    expect(statusDoTermo('2026-09-21T10:00:00Z', '2026-09-25T10:00:00Z', agora)).toBe('legado')
  })
  it('a partir do corte: protocolado, atrasado, pendente', () => {
    expect(statusDoTermo('2026-09-24T10:00:00Z', '2026-09-25T10:00:00Z', agora)).toBe('protocolado')
    expect(statusDoTermo('2026-10-01T10:00:00Z', null, agora)).toBe('atrasado')
    expect(statusDoTermo('2026-10-09T10:00:00Z', null, agora)).toBe('pendente')
  })
})

describe('chavesQueExigemTermo', () => {
  const t = (id: string, entrada: string) => ({
    id, nome: id, tipo_escala: '5x2', hora_entrada: entrada, hora_saida_seg_qui: '16:00',
    hora_entrada_sex: null, hora_saida_sex: null, hora_inicio_almoco: null, hora_fim_almoco: null,
    hora_entrada_sabado: null, hora_saida_sabado: null,
  })
  const turnos = new Map([['a', t('a', '07:00')], ['b', t('b', '07:00')], ['c', t('c', '08:00')]])
  it('mesmo conteúdo com ids diferentes não exige; conteúdo diferente exige', () => {
    const r = chavesQueExigemTermo([
      { id: 'm1', tipo: 'mudanca_horario', valor_antes: 'a', valor_depois: 'b', created_at: '2026-09-25', solicitacao_id: null },
      { id: 'm2', tipo: 'mudanca_horario', valor_antes: 'a', valor_depois: 'c', created_at: '2026-09-25', solicitacao_id: null },
      { id: 'm3', tipo: 'mudanca_funcao', valor_antes: null, valor_depois: null, created_at: '2026-09-25', solicitacao_id: null },
    ], turnos)
    expect(Array.from(r)).toEqual(['mov:m2'])
  })
})
