import { describe, expect, it } from 'vitest'
import type { CamposAcordo, MapaAusencias } from './tipos'
import { conflitosDeAusencia, datasDoAcordoDe, todasAsDatasDoAcordo } from './ausencias'
import { validarAcordo } from './validar'
import { func } from './__fixtures__'

const f = func('a', undefined, { status: 'atestado' })

const t1: CamposAcordo = { template: 'T1', dataEvento: '2026-10-04', nomeEvento: 'X', minutosOrigem: 240, datasAjuste: ['2026-10-06', '2026-10-07'] }
const t2: CamposAcordo = { template: 'T2', dataEvento: '2026-10-05', nomeEvento: 'X', horaDispensa: '15:00', datasAjuste: ['2026-10-09'] }
const t3: CamposAcordo = { template: 'T3', dataFolga: '2026-10-09', motivo: 'emenda', datasAjuste: ['2026-10-13'] }
const t4: CamposAcordo = { template: 'T4', dataFolga: '2026-10-30', motivo: 'x', datasAjuste: ['2026-10-26'], prazoLimite: '2026-12-01' }
const t5: CamposAcordo = { template: 'T5', dataEvento: '2026-10-04', nomeEvento: 'X', minutosOrigem: 240, dataFolga: '2026-10-07', datasAjuste: [] }

describe('datas do acordo por situação (papel de cada data)', () => {
  it('T1: evento + dias de redução', () => {
    expect(datasDoAcordoDe(t1, f)).toEqual([
      { data: '2026-10-04', papel: 'dia trabalhado' },
      { data: '2026-10-06', papel: 'dia de redução' },
      { data: '2026-10-07', papel: 'dia de redução' },
    ])
  })
  it('T2: dispensa + acréscimo; T3: sem trabalhar + acréscimo; T4: acréscimo + folga; T5: evento + folga', () => {
    expect(datasDoAcordoDe(t2, f).map(x => x.papel)).toEqual(['dia da dispensa', 'dia de acréscimo'])
    expect(datasDoAcordoDe(t3, f).map(x => x.papel)).toEqual(['dia sem trabalhar', 'dia de acréscimo'])
    expect(datasDoAcordoDe(t4, f).map(x => x.papel)).toEqual(['dia de folga', 'dia de acréscimo'])
    expect(datasDoAcordoDe(t5, f).map(x => x.papel)).toEqual(['dia trabalhado', 'dia de folga'])
  })
  it('todasAsDatasDoAcordo: ordenadas e sem repetição', () => {
    expect(todasAsDatasDoAcordo(t1, [f])).toEqual(['2026-10-04', '2026-10-06', '2026-10-07'])
  })
})

describe('projeção de ausência', () => {
  it('atestado que termina antes das datas do acordo não conflita (data futura)', () => {
    expect(conflitosDeAusencia(t5, f, [{ tipo: 'atestado', inicio: '2026-09-20', fim: '2026-10-02' }])).toEqual([])
  })

  it('atestado que cobre o dia trabalhado conflita, com tipo e período na mensagem', () => {
    const r = conflitosDeAusencia(t5, f, [{ tipo: 'atestado', inicio: '2026-10-01', fim: '2026-10-06' }])
    expect(r).toEqual(['04/10/2026 (dia trabalhado) cai em atestado de 01/10/2026 a 06/10/2026'])
  })

  it('férias e afastamento na folga também conflitam', () => {
    const r = conflitosDeAusencia(t5, f, [
      { tipo: 'ferias', inicio: '2026-10-05', fim: '2026-10-20' },
      { tipo: 'afastamento', inicio: '2026-10-01', fim: '9999-12-31' },
    ])
    expect(r).toHaveLength(2)
    expect(r[0]).toMatch(/04\/10\/2026.*afastamento/)
    expect(r[1]).toMatch(/07\/10\/2026.*férias/)
  })

  it('validarAcordo: aviso AUSENCIA_NA_DATA (não erro) em todos os templates, e some o aviso de status', () => {
    const aus: MapaAusencias = { a: [{ tipo: 'atestado', inicio: '2026-01-01', fim: '2027-12-31' }] }
    for (const c of [t1, t2, t3, t4, t5]) {
      const achados = validarAcordo(c, [f], new Map(), aus)
      const a = achados.find(x => x.codigo === 'AUSENCIA_NA_DATA')
      expect(a, c.template).toBeDefined()
      expect(a!.nivel).toBe('aviso')
      expect(achados.some(x => x.codigo === 'STATUS')).toBe(false)
    }
  })

  it('sem conflito, com a projeção carregada, o status "atestado" de hoje não gera aviso nenhum', () => {
    const aus: MapaAusencias = { a: [{ tipo: 'atestado', inicio: '2026-09-20', fim: '2026-10-02' }] }
    const achados = validarAcordo(t5, [f], new Map(), aus)
    expect(achados.some(x => x.codigo === 'AUSENCIA_NA_DATA' || x.codigo === 'STATUS')).toBe(false)
  })

  it('sem a projeção carregada, continua o aviso de status de antes', () => {
    expect(validarAcordo(t5, [f]).some(x => x.codigo === 'STATUS')).toBe(true)
  })
})
