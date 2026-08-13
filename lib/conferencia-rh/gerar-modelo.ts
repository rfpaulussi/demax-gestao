import * as XLSX from 'xlsx-js-style'

const HEADER_BG = '0F172A'
const HEADER_FG = 'FFFFFF'

/** Cabeçalho esperado pela aba LISTAGEM — ver validação em parseListagem
 * (components/conferencia-rh/upload-form.tsx). A coluna A (RE) é só o
 * identificador único; o parser aceita qualquer rótulo não vazio ali
 * (ex: também aceita "CÓDIGO"), mas usamos "RE" no modelo por ser o
 * rótulo original/canônico. */
const CABECALHO = ['RE', 'NOME DO FUNCIONARIO', 'FUNCAO', 'ADMISSAO', 'AFASTADO', 'CONTRATO']

/** Gera e baixa um .xlsx modelo da aba LISTAGEM, com uma linha de exemplo e
 * uma nota explicativa, pra guiar quem for preparar a planilha do RH. */
export function gerarModeloListagemRH(): void {
  const wb = XLSX.utils.book_new()
  const ws: XLSX.WorkSheet = {}

  const headerStyle = {
    font: { bold: true, color: { rgb: HEADER_FG }, sz: 10 },
    fill: { patternType: 'solid', fgColor: { rgb: HEADER_BG } },
    alignment: { vertical: 'center' },
  }
  CABECALHO.forEach((h, ci) => {
    ws[XLSX.utils.encode_cell({ r: 0, c: ci })] = { v: h, t: 's', s: headerStyle }
  })

  // Linha de exemplo — coluna AFASTADO (índice 4) propositalmente sem célula:
  // célula ausente = "em branco" quando a planilha for lida de volta, exemplo de funcionário ativo.
  ws[XLSX.utils.encode_cell({ r: 1, c: 0 })] = { v: 12345, t: 'n' }
  ws[XLSX.utils.encode_cell({ r: 1, c: 1 })] = { v: 'NOME DO FUNCIONARIO EXEMPLO', t: 's' }
  ws[XLSX.utils.encode_cell({ r: 1, c: 2 })] = { v: 'AJUDANTE DE LIMPEZA', t: 's' }
  ws[XLSX.utils.encode_cell({ r: 1, c: 3 })] = { v: new Date(2024, 0, 1), t: 'd', z: 'dd/mm/yyyy' }
  ws[XLSX.utils.encode_cell({ r: 1, c: 5 })] = { v: 70601, t: 'n' }

  // Linha de nota explicativa, estilo leve, abaixo do exemplo.
  const notaStyle = { font: { italic: true, color: { rgb: '64748B' }, sz: 9 } }
  const nota =
    'AFASTADO: deixe em branco para funcionário ativo, ou preencha com a data de afastamento. ' +
    'CONTRATO: código interno do RH que identifica o supervisor do funcionário.'
  ws[XLSX.utils.encode_cell({ r: 2, c: 0 })] = { v: nota, t: 's', s: notaStyle }

  const nRows = 3
  const nCols = CABECALHO.length
  ws['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: nRows - 1, c: nCols - 1 })
  ws['!cols'] = [{ wch: 10 }, { wch: 32 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 10 }]
  ws['!merges'] = [{ s: { r: 2, c: 0 }, e: { r: 2, c: nCols - 1 } }]

  XLSX.utils.book_append_sheet(wb, ws, 'LISTAGEM')
  XLSX.writeFile(wb, 'modelo-listagem-rh.xlsx')
}
