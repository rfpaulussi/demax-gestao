// lib/auditoria-atestados/candidatos.ts
//
// Para uma linha "ambígua" (o período do SESMT cobre 2+ atestados do sistema): ordena os
// candidatos do mais parecido pro menos, e sinaliza os que se sobrepõem entre si — atestado
// duplicado/sobreposto não pode existir, então isso quase sempre é um lançamento a corrigir.

import { classificarCid, diferencaDias, extrairCodigoCid, fimSesmt, type CategoriaCid } from './parse'
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
      .filter(o => o.id !== atestado.id && o.dataInicio <= atestado.dataFim && atestado.dataInicio <= o.dataFim)
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
