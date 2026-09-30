// lib/auditoria-atestados/candidatos.ts
//
// Para uma linha "ambígua" (o período do SESMT cobre 2+ atestados do sistema): ordena os
// candidatos do mais parecido pro menos, e sinaliza os que se sobrepõem entre si — atestado
// duplicado/sobreposto não pode existir, então isso quase sempre é um lançamento a corrigir.

import { classificarCid, diferencaDias, extrairCodigoCid, fimSesmt, type CategoriaCid } from './parse'
import { atestadosConflitam } from '../atestados/periodos'
import type { AtestadoSistema, LinhaSesmt } from './tipos'

export type CandidatoRankeado = {
  atestado: AtestadoSistema
  diferencaInicioDias: number
  /** null quando o afastamento do SESMT é indeterminado (999 dias) */
  diferencaFimDias: number | null
  cid: CategoriaCid
  maisProvavel: boolean
  /** ids dos outros candidatos que cobrem algum dia em comum com este */
  sobrepoeCom: string[]
}

export function rankearCandidatos(sesmt: LinhaSesmt, candidatos: AtestadoSistema[]): CandidatoRankeado[] {
  const cidSesmt = extrairCodigoCid(sesmt.cidTexto)
  const fim = fimSesmt(sesmt.diasTexto, sesmt.dataRetorno)

  const lista = candidatos.map(atestado => ({
    atestado,
    diferencaInicioDias: diferencaDias(atestado.dataInicio, sesmt.dataInicio),
    diferencaFimDias: fim ? diferencaDias(atestado.dataFim, fim) : null,
    cid: classificarCid(cidSesmt, atestado.cidCodigo),
    maisProvavel: false,
    sobrepoeCom: candidatos
      .filter(o => o.id !== atestado.id && atestadosConflitam(
        { data_inicio: atestado.dataInicio, data_fim: atestado.dataFim },
        { data_inicio: o.dataInicio, data_fim: o.dataFim },
      ))
      .map(o => o.id),
  }))

  lista.sort((a, b) =>
    Number(a.cid !== 'igual') - Number(b.cid !== 'igual') ||
    a.diferencaInicioDias - b.diferencaInicioDias ||
    (a.diferencaFimDias ?? 0) - (b.diferencaFimDias ?? 0),
  )
  if (lista.length > 0) lista[0].maisProvavel = true
  return lista
}

const MS_DIA = 86400000
const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) }

/**
 * true quando os atestados do sistema são consecutivos (sem buraco; dividir um dia de fronteira
 * vale) e juntos cobrem todo o período do SESMT — típico de quando o SESMT unifica em uma linha
 * o que aqui foi lançado em documentos separados. Aí não há duplicidade: só conferir CID/datas.
 */
export function consecutivosCobremSesmt(sesmt: LinhaSesmt, candidatos: AtestadoSistema[]): boolean {
  if (candidatos.length < 2) return false
  const fim = fimSesmt(sesmt.diasTexto, sesmt.dataRetorno)
  if (!fim) return false
  const ordenados = [...candidatos].sort((a, b) => (a.dataInicio < b.dataInicio ? -1 : 1))
  let ate = utc(ordenados[0].dataFim)
  for (const a of ordenados.slice(1)) {
    if (utc(a.dataInicio) > ate + MS_DIA) return false
    ate = Math.max(ate, utc(a.dataFim))
  }
  return utc(ordenados[0].dataInicio) <= utc(sesmt.dataInicio) && ate >= utc(fim)
}
