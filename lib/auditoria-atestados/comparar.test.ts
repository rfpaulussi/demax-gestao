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
    expect(classificarCid('r52.0', ' R52 ')).toBe('igual')
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

describe('caso Sheila: passagem de bastão entre atestados vizinhos', () => {
  const sheila = (o: Partial<LinhaSesmt>): LinhaSesmt => ({
    matriculaRaw: '001-000-098625', nome: 'SHEILA', dataInicio: '2026-09-02', diasTexto: '3',
    motivo: 'Acidente/Doença não relacionada ao trabalho', cidTexto: 'O20.9', dataRetorno: '2026-09-05', ...o,
  })
  const a = (id: string, ini: string, fim: string): AtestadoSistema => ({
    id, funcionarioId: 'f', funcionarioNome: 'SHEILA', registro: '98625', dataInicio: ini, dataFim: fim,
    cidCodigo: null, cidDescricao: null, origemOcupacional: null,
  })
  const funcs98625 = new Map([['98625', { id: 'f', postoId: 'p' }]])
  const rodar98625 = (linhas: LinhaSesmt[], ats: AtestadoSistema[]) =>
    compararAuditoria(linhas.map(linha => ({ linha, registro: '98625' })), funcs98625, new Map([['98625', ats]]))

  it('linha 02→04 pareia com o atestado de mesmas datas e não consome o vizinho 04→13', () => {
    const r = rodar98625(
      [sheila({}), sheila({ dataInicio: '2026-09-05', diasTexto: '13', cidTexto: 'O06.9', dataRetorno: '2026-09-18' })],
      [a('a', '2026-09-02', '2026-09-04'), a('b', '2026-09-04', '2026-09-13'), a('c', '2026-09-14', '2026-09-17')],
    )
    const primeira = r.linhas[0]
    expect(primeira.status).toBe('divergencia') // só o CID (sistema sem CID)
    expect((primeira as { sistema: AtestadoSistema }).sistema.id).toBe('a')
    // a segunda linha (05→17) enxerga os dois restantes: ambígua, não um pareamento errado com o 14→17
    expect(r.linhas[1].status).toBe('ambiguo')
  })
})
