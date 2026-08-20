// lib/auditoria-atestados/comparar.ts

import { extrairCodigoCid, ehAfastamentoIndeterminado, motivoIndicaOcupacional, ultimoDiaAfastadoAntesDoRetorno } from './parse'
import type { LinhaSesmt, AtestadoSistema, LinhaResultado, ResultadoAuditoria, CampoDivergente } from './tipos'

function periodosSeSobrepoem(aInicio: string, aFim: string, bInicio: string, bFim: string): boolean {
  return aInicio <= bFim && bInicio <= aFim
}

function compararCampos(sesmt: LinhaSesmt, sistema: AtestadoSistema): CampoDivergente[] {
  const divergentes: CampoDivergente[] = []
  const indeterminado = ehAfastamentoIndeterminado(sesmt.diasTexto)

  if (sesmt.dataInicio !== sistema.dataInicio) divergentes.push('data_inicio')
  // sesmt.dataRetorno é o 1º dia de volta ao trabalho; sistema.dataFim é o último dia
  // afastado (inclusive) — sempre 1 dia antes por definição, não comparar direto.
  if (!indeterminado && ultimoDiaAfastadoAntesDoRetorno(sesmt.dataRetorno) !== sistema.dataFim) divergentes.push('data_fim')

  const cidSesmt = extrairCodigoCid(sesmt.cidTexto)
  if (cidSesmt !== sistema.cidCodigo) divergentes.push('cid')

  const esperaOcupacional = motivoIndicaOcupacional(sesmt.motivo)
  const temOcupacional = sistema.origemOcupacional != null
  if (esperaOcupacional !== temOcupacional) divergentes.push('origem_ocupacional')

  return divergentes
}

/**
 * Cruza as linhas do SESMT com os atestados do sistema já filtrados por registro
 * (um funcionário pode ter 0, 1 ou N atestados candidatos por linha SESMT).
 *
 * @param linhasSesmt linhas parseadas da planilha SESMT
 * @param atestadosPorRegistro atestados do sistema agrupados por registro do funcionário
 */
export function compararAuditoria(
  linhasSesmt: Array<{ linha: LinhaSesmt; registro: string | null }>,
  atestadosPorRegistro: Map<string, AtestadoSistema[]>,
): ResultadoAuditoria {
  const linhas: LinhaResultado[] = []
  const atestadosUsados = new Set<string>()

  for (const { linha, registro } of linhasSesmt) {
    if (registro === null) {
      linhas.push({ status: 'matricula_nao_encontrada', sesmt: linha })
      continue
    }

    const candidatosTodos = atestadosPorRegistro.get(registro) ?? []
    if (candidatosTodos.length === 0) {
      linhas.push({ status: 'matricula_nao_encontrada', sesmt: linha })
      continue
    }

    const indeterminado = ehAfastamentoIndeterminado(linha.diasTexto)
    // Pareamento guloso 1:1, na ordem das linhas do SESMT: um atestado do sistema já
    // pareado com uma linha anterior deste registro não é oferecido como candidato de
    // novo — evita que duas linhas SESMT "capturem" o mesmo atestado.
    const candidatos = candidatosTodos.filter(a =>
      !atestadosUsados.has(a.id) &&
      (indeterminado
        ? a.dataInicio <= linha.dataInicio && a.dataFim >= linha.dataInicio
        : periodosSeSobrepoem(linha.dataInicio, ultimoDiaAfastadoAntesDoRetorno(linha.dataRetorno), a.dataInicio, a.dataFim)),
    )

    if (candidatos.length === 0) {
      linhas.push({ status: 'nao_lancado', sesmt: linha })
    } else if (candidatos.length === 1) {
      const sistema = candidatos[0]
      atestadosUsados.add(sistema.id)
      const camposDivergentes = compararCampos(linha, sistema)
      linhas.push(
        camposDivergentes.length === 0
          ? { status: 'confere', sesmt: linha, sistema }
          : { status: 'divergencia', sesmt: linha, sistema, camposDivergentes },
      )
    } else {
      for (const c of candidatos) atestadosUsados.add(c.id)
      linhas.push({ status: 'ambiguo', sesmt: linha, candidatos })
    }
  }

  // Segunda passada: atestados do sistema não usados em nenhum pareamento
  for (const candidatos of Array.from(atestadosPorRegistro.values())) {
    for (const a of candidatos) {
      if (!atestadosUsados.has(a.id)) {
        linhas.push({ status: 'sem_sesmt', sistema: a })
      }
    }
  }

  const contadores = {
    confere: linhas.filter(l => l.status === 'confere').length,
    divergencia: linhas.filter(l => l.status === 'divergencia').length,
    naoLancado: linhas.filter(l => l.status === 'nao_lancado').length,
    matriculaNaoEncontrada: linhas.filter(l => l.status === 'matricula_nao_encontrada').length,
    ambiguo: linhas.filter(l => l.status === 'ambiguo').length,
    semSesmt: linhas.filter(l => l.status === 'sem_sesmt').length,
  }

  return { linhas, contadores }
}
