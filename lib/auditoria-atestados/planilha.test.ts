import { describe, it, expect } from 'vitest'
import { parsePlanilhaSesmt, somarDiasIso } from './planilha'

const H = ['Origem', 'Data', 'Data do retorno', 'Data de Criação', 'Razão Social', 'Nome Fantasia', 'Nome', 'Matrícula', 'Tempo de Afastamento', 'Unidade afastamento', 'Setor', 'Cargo', 'Motivo', 'CID', 'Profissional', 'Conselho', 'Nº Conselho']
const row = (o: Partial<Record<string, string>>) => H.map(h => o[h] ?? '')

describe('parsePlanilhaSesmt (layout Lista)', () => {
  it('normaliza afastamento, CAT e ignora rodapé Total', () => {
    const r = parsePlanilhaSesmt([
      H,
      row({ Origem: 'Afastamento Temporário', Data: '23/09/2026', 'Data do retorno': '24/09/2026', Nome: 'A', Matrícula: '001-000-108838', 'Tempo de Afastamento': '1', Motivo: 'Acidente/Doença não relacionada ao trabalho', CID: 'F41.9' }),
      row({ Origem: 'CAT', Data: '04/09/2026', Nome: 'B', Matrícula: '001-000-099533', 'Tempo de Afastamento': '7', CID: 'S51.9' }),
      row({ Origem: 'Total: 2' }),
    ])
    expect(r.erro).toBeUndefined()
    expect(r.linhasIgnoradas).toBe(0)
    expect(r.linhas).toHaveLength(2)
    expect(r.linhas[0]).toMatchObject({ dataInicio: '2026-09-23', dataRetorno: '2026-09-24', cidTexto: 'F41.9' })
    expect(r.linhas[1]).toMatchObject({ motivo: 'Acidente/Doença do trabalho', dataRetorno: '2026-09-11' })
  })
  it('rejeita cabeçalho desconhecido', () => {
    expect(parsePlanilhaSesmt([['x']]).erro).toBeTruthy()
  })
  it('somarDiasIso cruza mês', () => {
    expect(somarDiasIso('2026-09-28', 5)).toBe('2026-10-03')
  })
})
