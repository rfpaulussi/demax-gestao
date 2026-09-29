import { describe, it, expect } from 'vitest'
import { compararAuditoria } from './comparar'
import { classificarCid, fimSesmt } from './parse'
import type { AtestadoSistema, LinhaSesmt } from './tipos'

const sesmt = (o: Partial<LinhaSesmt> = {}): LinhaSesmt => ({
  matriculaRaw: '001-000-105045', nome: 'MARILZA', dataInicio: '2026-09-08', diasTexto: '1',
  motivo: 'Acidente/Doença não relacionada ao trabalho', cidTexto: 'A09', dataRetorno: '2026-09-09', ...o,
})
const at = (o: Partial<AtestadoSistema> = {}): AtestadoSistema => ({
  id: 'a1', funcionarioId: 'f1', funcionarioNome: 'MARILZA', registro: '105045',
  dataInicio: '2026-09-09', dataFim: '2026-09-09', cidCodigo: 'A09', cidDescricao: null, origemOcupacional: null, ...o,
})
const funcs = new Map([['105045', { id: 'f1', postoId: 'p1' }]])
const rodar = (linhas: LinhaSesmt[], ats: AtestadoSistema[]) =>
  compararAuditoria(linhas.map(linha => ({ linha, registro: '105045' })), funcs, new Map([['105045', ats]]))

describe('compararAuditoria', () => {
  it('início com 1 dia de diferença e mesmo CID vira divergência de data, não "não lançado" + "sem SESMT"', () => {
    const r = rodar([sesmt()], [at()])
    expect(r.linhas).toHaveLength(1)
    expect(r.linhas[0]).toMatchObject({ status: 'divergencia', porProximidade: true })
    expect((r.linhas[0] as { camposDivergentes: string[] }).camposDivergentes).toContain('data_inicio')
  })
  it('CID de outro grupo não pareia por proximidade', () => {
    const r = rodar([sesmt(), sesmt({ dataInicio: '2026-09-20', dataRetorno: '2026-09-21', cidTexto: 'Z00' })], [at({ cidCodigo: 'M54' })])
    expect(r.linhas.map(l => l.status).sort()).toEqual(['nao_lancado', 'nao_lancado', 'sem_sesmt'])
  })
  it('atestado do sistema fora da janela da planilha não vira "sem SESMT"', () => {
    const r = rodar([sesmt()], [at({ id: 'x', dataInicio: '2026-07-01', dataFim: '2026-07-02', cidCodigo: 'Z00' })])
    expect(r.linhas.map(l => l.status)).toEqual(['nao_lancado'])
    expect(r.janela).toEqual({ inicio: '2026-09-08', fim: '2026-09-08' })
  })
  it('atestado dentro da janela sem par continua "sem SESMT"', () => {
    const r = rodar([sesmt({ dataInicio: '2026-09-01', dataRetorno: '2026-09-25', diasTexto: '24' })], [at({ dataInicio: '2026-09-15', dataFim: '2026-09-15', cidCodigo: 'Z00' })])
    // sobrepõe o período do SESMT → é o par (divergência), não sobra sem_sesmt
    expect(r.linhas.map(l => l.status)).not.toContain('sem_sesmt')
  })
})

describe('classificarCid', () => {
  it('categorias', () => {
    expect(classificarCid('A09', 'A09')).toBe('igual')
    expect(classificarCid('R52.0', null)).toBe('sistema_sem_cid')
    expect(classificarCid(null, 'R52')).toBe('sesmt_sem_cid')
    expect(classificarCid('R52.0', 'R52')).toBe('igual')
    expect(classificarCid('J02.9', 'J02')).toBe('igual')
    expect(classificarCid('F41.9', 'F41.1')).toBe('subcodigo')
    expect(classificarCid('Z10.8', 'F32')).toBe('cid_diferente')
  })
})

describe('CID compatível não gera divergência', () => {
  it('R52.0 no SESMT e R52 no sistema confere', () => {
    const r = rodar([sesmt({ dataInicio: '2026-09-09', dataRetorno: '2026-09-10', cidTexto: 'R52.0' })], [at({ cidCodigo: 'R52' })])
    expect(r.linhas[0].status).toBe('confere')
  })
})

describe('fimSesmt', () => {
  it('retorno − 1, e null para 999 dias', () => {
    expect(fimSesmt('1', '2026-09-24')).toBe('2026-09-23')
    expect(fimSesmt('999', '2029-06-04')).toBeNull()
  })
})
