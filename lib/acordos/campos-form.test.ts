import { describe, expect, it } from 'vitest'
import type { CamposAcordo } from './tipos'
import { montarCampos } from './formulario'
import { camposParaForm, reconstruirCampos } from './campos-form'

const limpa = (c: CamposAcordo) => JSON.parse(JSON.stringify(c))
const ida = (c: CamposAcordo, ids?: string[]) => montarCampos(c.template, camposParaForm(c), ids ? new Set(ids) : undefined)

describe('camposParaForm é o inverso de montarCampos', () => {
  it('T1 com dois dias de evento e período', () => {
    const c: CamposAcordo = {
      template: 'T1', dataEvento: '2026-06-20', datasEvento: ['2026-06-20', '2026-06-21'], nomeEvento: 'Mutirão',
      periodoInicio: '08:00', periodoFim: '12:00', minutosOrigem: 0, datasAjuste: ['2026-06-24', '2026-06-25'],
    }
    expect(limpa(ida(c))).toEqual(limpa(c))
  })

  it('T2, T3 e T4 (folga parcial)', () => {
    const t2: CamposAcordo = { template: 'T2', dataEvento: '2026-09-14', nomeEvento: 'Chuva', horaDispensa: '12:00', motivo: 'chuva forte', datasAjuste: ['2026-09-15'] }
    const t3: CamposAcordo = { template: 'T3', dataFolga: '2026-06-05', motivo: 'emenda', datasAjuste: ['2026-06-08'] }
    const t4: CamposAcordo = { template: 'T4', dataFolga: '2026-06-12', motivo: 'x', minutosFolga: 240, datasAjuste: ['2026-06-08'], prazoLimite: '2026-12-01' }
    for (const c of [t2, t3, t4]) expect(limpa(ida(c)), c.template).toMatchObject(limpa(c))
  })

  it('T5 revezamento e T5 em dias inteiros', () => {
    const rev: CamposAcordo = { template: 'T5', dataEvento: '2026-06-20', nomeEvento: 'X', minutosOrigem: 240, dataFolga: '2026-06-22', folgasPorFuncionario: { a: '2026-06-22', b: '2026-06-23' }, datasAjuste: [] }
    expect(limpa(ida(rev, ['a', 'b']))).toMatchObject(limpa(rev))
    const dias: CamposAcordo = {
      template: 'T5', dataEvento: '2026-10-04', nomeEvento: 'Eleições', datasAjuste: [], prazoLimite: '2027-01-05',
      participantes: { a: { inicio: '08:00', fim: '12:30', folgas: ['2026-12-23'] }, b: { inicio: '08:00', fim: '18:00', folgas: ['2026-12-28', '2026-12-29'] } },
    }
    expect(limpa(ida(dias, ['a', 'b'])).participantes).toEqual(dias.participantes)
    expect(camposParaForm(dias).diasInteiros).toBe(true)
  })
})

describe('reconstruirCampos (acordo antigo)', () => {
  it('T1: eventos, minutos e dias de redução a partir dos movimentos', () => {
    const r = reconstruirCampos('T1', { evento_nome: 'Mutirão', prazo_limite: null }, [
      { funcionario_id: 'a', data: '2026-06-20', minutos: 240, papel: 'origem' },
      { funcionario_id: 'a', data: '2026-06-24', minutos: -120, papel: 'quitacao' },
      { funcionario_id: 'a', data: '2026-06-25', minutos: -120, papel: 'quitacao' },
    ])
    expect(r.campos).toMatchObject({ template: 'T1', dataEvento: '2026-06-20', minutosOrigem: 240, nomeEvento: 'Mutirão', datasAjuste: ['2026-06-24', '2026-06-25'] })
    expect(r.faltando).toEqual([])
  })

  it('T3: folga e reposição; avisa que o motivo não é recuperável', () => {
    const r = reconstruirCampos('T3', {}, [
      { funcionario_id: 'a', data: '2026-06-05', minutos: -528, papel: 'origem' },
      { funcionario_id: 'a', data: '2026-06-08', minutos: 264, papel: 'quitacao' },
      { funcionario_id: 'a', data: '2026-06-09', minutos: 264, papel: 'quitacao' },
    ])
    expect(r.campos).toMatchObject({ dataFolga: '2026-06-05', datasAjuste: ['2026-06-08', '2026-06-09'] })
    expect(r.faltando).toContain('motivo')
  })

  it('T5: revezamento quando cada um folga num dia; dias inteiros quando alguém tem 2 folgas', () => {
    const rev = reconstruirCampos('T5', {}, [
      { funcionario_id: 'a', data: '2026-06-20', minutos: 240, papel: 'origem' },
      { funcionario_id: 'b', data: '2026-06-20', minutos: 240, papel: 'origem' },
      { funcionario_id: 'a', data: '2026-06-22', minutos: -240, papel: 'quitacao' },
      { funcionario_id: 'b', data: '2026-06-23', minutos: -240, papel: 'quitacao' },
    ])
    expect(rev.campos.folgasPorFuncionario).toEqual({ a: '2026-06-22', b: '2026-06-23' })
    const dias = reconstruirCampos('T5', {}, [
      { funcionario_id: 'a', data: '2026-10-04', minutos: 1056, papel: 'origem' },
      { funcionario_id: 'a', data: '2026-12-28', minutos: -528, papel: 'quitacao' },
      { funcionario_id: 'a', data: '2026-12-29', minutos: -528, papel: 'quitacao' },
    ])
    expect(dias.campos.participantes).toEqual({ a: { inicio: '', fim: '', folgas: ['2026-12-28', '2026-12-29'] } })
    expect(dias.faltando).toContain('período trabalhado de cada funcionário')
  })
})
