// lib/auditoria-atestados/planilha.ts
//
// Interpreta as linhas cruas (header: 1) da planilha exportada do sistema do SESMT.
// Dois layouts são aceitos e normalizados pro mesmo `LinhaSesmt`:
//
//  - Legado: Data | Matrícula | Empregado | Afastamento ("15 dias") | Motivo | CID Abonado | Data Retorno
//  - Lista (sistema externo): Origem | Data | Data do retorno | Data de Criação | Razão Social | ... |
//    Nome | Matrícula | Tempo de Afastamento (nº) | ... | Motivo | CID (só o código) | ...
//    Só Origem, Data, Data do retorno, Nome, Matrícula, Tempo, Motivo e CID interessam à auditoria;
//    o resto (empresa, setor, cargo, profissional, conselho) é ignorado.

import { dataBrParaIso } from './parse'
import type { LinhaSesmt } from './tipos'

const COLUNAS_LEGADO = ['Data', 'Matrícula', 'Empregado', 'Afastamento', 'Motivo', 'CID Abonado', 'Data Retorno']
const COLUNAS_LISTA = ['Origem', 'Data', 'Data do retorno', 'Nome', 'Matrícula', 'Tempo de Afastamento', 'Motivo', 'CID']

export const MOTIVO_OCUPACIONAL = 'Acidente/Doença do trabalho'

export type ResultadoParsePlanilha = {
  linhas: LinhaSesmt[]
  linhasIgnoradas: number
  erro?: string
}

export function celulaParaDataIso(valor: unknown): string | null {
  if (valor == null || valor === '') return null
  if (valor instanceof Date) {
    const y = valor.getFullYear()
    const m = String(valor.getMonth() + 1).padStart(2, '0')
    const d = String(valor.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const t = String(valor).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
  return dataBrParaIso(t)
}

export function somarDiasIso(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + dias)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

const texto = (v: unknown) => String(v ?? '').trim()

function indicesDe(header: string[], colunas: string[]): number[] | null {
  const idx = colunas.map(c => header.indexOf(c))
  return idx.some(i => i === -1) ? null : idx
}

export function parsePlanilhaSesmt(raw: unknown[][]): ResultadoParsePlanilha {
  const header = (raw[0] ?? []).map(texto)
  // linhas totalmente vazias (rodapé em branco do export) não contam como ignoradas
  const corpo = raw.slice(1).filter(row => row.some(c => texto(c) !== ''))

  const idxLista = indicesDe(header, COLUNAS_LISTA)
  if (idxLista) {
    const [iOrigem, iData, iRetorno, iNome, iMatricula, iTempo, iMotivo, iCid] = idxLista
    const linhas: LinhaSesmt[] = []
    let linhasIgnoradas = 0
    // O sistema externo lista o mesmo afastamento como "CAT" e como "Afastamento Temporário":
    // mesma matrícula + início + retorno + CID = 1 só linha, senão vira "ambíguo" na comparação.
    const vistas = new Map<string, LinhaSesmt>()
    for (const row of corpo) {
      const origem = texto(row[iOrigem])
      if (/^total\b/i.test(origem)) continue // rodapé "Total: N"
      const matriculaRaw = texto(row[iMatricula])
      const dataInicio = celulaParaDataIso(row[iData])
      const diasTexto = texto(row[iTempo])
      if (!matriculaRaw || !dataInicio) { linhasIgnoradas++; continue }

      // CAT vem sem retorno e sem motivo: é sempre ocupacional. Retorno = início + tempo
      // (mesma regra de todas as linhas com retorno preenchido).
      const dias = parseInt(diasTexto, 10)
      const dataRetorno = celulaParaDataIso(row[iRetorno]) ?? (Number.isNaN(dias) ? null : somarDiasIso(dataInicio, dias))
      if (!dataRetorno) { linhasIgnoradas++; continue }

      const chave = [matriculaRaw, dataInicio, dataRetorno, texto(row[iCid])].join('|')
      const existente = vistas.get(chave)
      if (existente) {
        if (/^cat$/i.test(origem)) existente.motivo = MOTIVO_OCUPACIONAL
        continue
      }

      const nova: LinhaSesmt = {
        matriculaRaw,
        nome: texto(row[iNome]),
        dataInicio,
        diasTexto,
        motivo: /^cat$/i.test(origem) ? MOTIVO_OCUPACIONAL : texto(row[iMotivo]),
        cidTexto: texto(row[iCid]),
        dataRetorno,
      }
      vistas.set(chave, nova)
      linhas.push(nova)
    }
    return { linhas, linhasIgnoradas }
  }

  const idxLegado = indicesDe(header, COLUNAS_LEGADO)
  if (idxLegado) {
    const [iData, iMatricula, iEmpregado, iAfastamento, iMotivo, iCid, iRetorno] = idxLegado
    const linhas: LinhaSesmt[] = []
    let linhasIgnoradas = 0
    for (const row of corpo) {
      const matriculaRaw = texto(row[iMatricula])
      if (!matriculaRaw) { linhasIgnoradas++; continue }
      const dataInicio = celulaParaDataIso(row[iData])
      const dataRetorno = celulaParaDataIso(row[iRetorno])
      if (!dataInicio || !dataRetorno) { linhasIgnoradas++; continue }
      linhas.push({
        matriculaRaw,
        nome: texto(row[iEmpregado]),
        dataInicio,
        diasTexto: texto(row[iAfastamento]),
        motivo: texto(row[iMotivo]),
        cidTexto: texto(row[iCid]),
        dataRetorno,
      })
    }
    return { linhas, linhasIgnoradas }
  }

  return {
    linhas: [],
    linhasIgnoradas: 0,
    erro: `Cabeçalho não reconhecido. Colunas esperadas: ${COLUNAS_LISTA.join(', ')} (ou o layout antigo: ${COLUNAS_LEGADO.join(', ')}).`,
  }
}
