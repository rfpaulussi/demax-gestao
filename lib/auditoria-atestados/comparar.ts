// lib/auditoria-atestados/comparar.ts

import { extrairCodigoCid, classificarCid, ehAfastamentoIndeterminado, motivoIndicaOcupacional, ultimoDiaAfastadoAntesDoRetorno, diferencaDias } from './parse'
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
  if (classificarCid(cidSesmt, sistema.cidCodigo) !== 'igual') divergentes.push('cid')

  const esperaOcupacional = motivoIndicaOcupacional(sesmt.motivo)
  const temOcupacional = sistema.origemOcupacional != null
  if (esperaOcupacional !== temOcupacional) divergentes.push('origem_ocupacional')

  return divergentes
}

/** Tolerância (dias) no início pra parear "não lançado" com um atestado do sistema que quase bate. */
const TOLERANCIA_INICIO_DIAS = 2

function mesmoGrupoCid(a: string | null, b: string | null): boolean {
  return !a || !b || a.slice(0, 3).toUpperCase() === b.slice(0, 3).toUpperCase()
}

export type FuncionarioLookup = { id: string; postoId: string | null }

/**
 * Cruza as linhas do SESMT com os atestados do sistema já filtrados por registro
 * (um funcionário pode ter 0, 1 ou N atestados candidatos por linha SESMT).
 *
 * @param linhasSesmt linhas parseadas da planilha SESMT
 * @param funcionariosPorRegistro funcionários do sistema indexados por registro — usado pra
 *   distinguir "matrícula não existe no sistema" de "funcionário existe mas sem atestado no
 *   período" (nao_lancado), e pra saber o funcionário/posto certo pra pré-preencher o lançamento
 * @param atestadosPorRegistro atestados do sistema agrupados por registro do funcionário
 */
export function compararAuditoria(
  linhasSesmt: Array<{ linha: LinhaSesmt; registro: string | null }>,
  funcionariosPorRegistro: Map<string, FuncionarioLookup>,
  atestadosPorRegistro: Map<string, AtestadoSistema[]>,
): Omit<ResultadoAuditoria, 'cids'> {
  const linhas: LinhaResultado[] = []
  const atestadosUsados = new Set<string>()
  const quaseNaoLancados: Array<{ idx: number; registro: string; linha: LinhaSesmt }> = []

  for (const { linha, registro } of linhasSesmt) {
    const funcionario = registro ? funcionariosPorRegistro.get(registro) : undefined
    if (registro === null || !funcionario) {
      linhas.push({ status: 'matricula_nao_encontrada', sesmt: linha })
      continue
    }

    const candidatosTodos = atestadosPorRegistro.get(registro) ?? []
    if (candidatosTodos.length === 0) {
      quaseNaoLancados.push({ idx: linhas.length, registro, linha })
      linhas.push({ status: 'nao_lancado', sesmt: linha, funcionarioId: funcionario.id, postoId: funcionario.postoId })
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
      quaseNaoLancados.push({ idx: linhas.length, registro, linha })
      linhas.push({ status: 'nao_lancado', sesmt: linha, funcionarioId: funcionario.id, postoId: funcionario.postoId })
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

  // Passada por proximidade: linha do SESMT sem atestado sobreposto, mas com um atestado do
  // mesmo funcionário começando até TOLERANCIA_INICIO_DIAS dias de distância e CID compatível,
  // é quase certamente o mesmo atestado lançado com a data trocada — vira divergência de data
  // (corrigível) em vez de "não lançado" + "sem SESMT".
  for (const { idx, registro, linha } of quaseNaoLancados) {
    const cidSesmt = extrairCodigoCid(linha.cidTexto)
    const proximos = (atestadosPorRegistro.get(registro) ?? [])
      .filter(a => !atestadosUsados.has(a.id) && diferencaDias(a.dataInicio, linha.dataInicio) <= TOLERANCIA_INICIO_DIAS && mesmoGrupoCid(cidSesmt, a.cidCodigo))
      .sort((x, y) => diferencaDias(x.dataInicio, linha.dataInicio) - diferencaDias(y.dataInicio, linha.dataInicio))
    if (proximos.length === 0) continue
    const sistema = proximos[0]
    atestadosUsados.add(sistema.id)
    const camposDivergentes = compararCampos(linha, sistema)
    linhas[idx] = camposDivergentes.length === 0
      ? { status: 'confere', sesmt: linha, sistema }
      : { status: 'divergencia', sesmt: linha, sistema, camposDivergentes, porProximidade: true }
  }

  // Janela coberta pela planilha: atestado do sistema fora dela não é "sem registro no SESMT",
  // é só período que a planilha não cobre.
  let janelaInicio = ''
  let janelaFim = ''
  for (const { linha } of linhasSesmt) {
    const fim = ehAfastamentoIndeterminado(linha.diasTexto) ? linha.dataInicio : ultimoDiaAfastadoAntesDoRetorno(linha.dataRetorno)
    if (!janelaInicio || linha.dataInicio < janelaInicio) janelaInicio = linha.dataInicio
    if (!janelaFim || fim > janelaFim) janelaFim = fim
  }

  // Segunda passada: atestados do sistema não usados em nenhum pareamento
  for (const candidatos of Array.from(atestadosPorRegistro.values())) {
    for (const a of candidatos) {
      if (!atestadosUsados.has(a.id) && periodosSeSobrepoem(a.dataInicio, a.dataFim, janelaInicio, janelaFim)) {
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

  return { linhas, contadores, janela: janelaInicio ? { inicio: janelaInicio, fim: janelaFim } : null }
}
