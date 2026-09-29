import { describe, it, expect } from 'vitest'
import { rankearCandidatos } from './candidatos'
import type { AtestadoSistema, LinhaSesmt } from './tipos'

const sesmt: LinhaSesmt = {
  matriculaRaw: '001-000-093219', nome: 'KARINE', dataInicio: '2026-09-02', diasTexto: '14',
  motivo: 'Acidente/Doença não relacionada ao trabalho', cidTexto: 'Z35.9', dataRetorno: '2026-09-16',
}
const at = (id: string, ini: string, fim: string, cid: string | null): AtestadoSistema => ({
  id, funcionarioId: 'f', funcionarioNome: 'KARINE', registro: '93219', dataInicio: ini, dataFim: fim,
  cidCodigo: cid, cidDescricao: null, origemOcupacional: null,
})

describe('rankearCandidatos', () => {
  it('início mais próximo vem primeiro e é o mais provável', () => {
    const r = rankearCandidatos(sesmt, [at('b', '2026-09-13', '2026-09-19', null), at('a', '2026-09-02', '2026-09-15', null)])
    expect(r.map(c => c.atestado.id)).toEqual(['a', 'b'])
    expect(r[0].maisProvavel).toBe(true)
    expect(r[1].maisProvavel).toBe(false)
    expect(r[0].diferencaInicioDias).toBe(0)
    expect(r[0].diferencaFimDias).toBe(0)
  })
  it('CID compatível ganha de início mais próximo', () => {
    const r = rankearCandidatos(sesmt, [at('perto', '2026-09-02', '2026-09-15', 'M54'), at('cid', '2026-09-04', '2026-09-15', 'Z35')])
    expect(r[0].atestado.id).toBe('cid')
  })
  it('sinaliza candidatos que se sobrepõem entre si', () => {
    const r = rankearCandidatos(sesmt, [at('a', '2026-09-02', '2026-09-15', null), at('b', '2026-09-13', '2026-09-19', null)])
    expect(r[0].sobrepoeCom).toEqual(['b'])
    expect(r[1].sobrepoeCom).toEqual(['a'])
  })
  it('candidatos que não se tocam não são sinalizados', () => {
    const r = rankearCandidatos(sesmt, [at('a', '2026-09-02', '2026-09-05', null), at('b', '2026-09-10', '2026-09-12', null)])
    expect(r.every(c => c.sobrepoeCom.length === 0)).toBe(true)
  })
  it('afastamento indeterminado não calcula diferença de fim', () => {
    const r = rankearCandidatos({ ...sesmt, diasTexto: '999', dataRetorno: '2029-06-04' }, [at('a', '2026-09-02', '2026-09-15', null)])
    expect(r[0].diferencaFimDias).toBeNull()
  })
})
