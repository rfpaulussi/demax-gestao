// lib/atestados/episodio-inss.ts

export type AtestadoParaEpisodio = {
  id: string
  dataInicio: string  // ISO yyyy-mm-dd
  dataFim: string     // ISO yyyy-mm-dd
  cidCodigo: string | null
}

export type EpisodioInss = {
  dataInicio: string
  dataFim: string
  dias: number
  atestadosIncluidos: AtestadoParaEpisodio[]
}

const JANELA_MESMA_DOENCA_DIAS = 60

function calcDias(inicio: string, fim: string): number {
  const [ay, am, ad] = inicio.split('-').map(Number)
  const [by, bm, bd] = fim.split('-').map(Number)
  const a = new Date(ay, am - 1, ad)
  const b = new Date(by, bm - 1, bd)
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

/** Dias corridos ENTRE o fim de um atestado e o início do próximo (exclusive dos dois extremos).
 *  0 quando o próximo começa no dia seguinte ao fim do anterior (emendados). */
function gapDias(fimAnterior: string, inicioProximo: string): number {
  return calcDias(fimAnterior, inicioProximo) - 2
}

/** CID igual conta como mesma doença; "sem CID" (null) funciona como ponte — não quebra o
 *  encadeamento mesmo que o CID do lado oposto seja diferente. */
function cidCompativel(a: AtestadoParaEpisodio, b: AtestadoParaEpisodio): boolean {
  return a.cidCodigo === null || b.cidCodigo === null || a.cidCodigo === b.cidCodigo
}

function seEncadeiam(anterior: AtestadoParaEpisodio, proximo: AtestadoParaEpisodio): boolean {
  return cidCompativel(anterior, proximo) && gapDias(anterior.dataFim, proximo.dataInicio) <= JANELA_MESMA_DOENCA_DIAS
}

/**
 * Calcula o "episódio de doença" (regra do INSS: mesma doença dentro de 60 dias corridos soma
 * pra contagem dos 15 dias pagos pela empresa) que contém o atestado-âncora — caminha
 * cronologicamente pra trás e pra frente a partir dele, encadeando enquanto CID compatível e
 * gap ≤60 dias.
 *
 * `dias` do episódio é o SPAN de calendário entre o início do primeiro atestado e o fim do
 * último — não a soma dos dias individuais de cada atestado — porque a regra trata gaps dentro
 * da janela de 60 dias como parte do mesmo benefício.
 */
export function calcularEpisodioInss(
  atestadoAncoraId: string,
  atestados: AtestadoParaEpisodio[],
): EpisodioInss {
  const ordenados = [...atestados].sort((a, b) =>
    a.dataInicio < b.dataInicio ? -1 : a.dataInicio > b.dataInicio ? 1 : 0,
  )
  const indiceAncora = ordenados.findIndex(a => a.id === atestadoAncoraId)
  if (indiceAncora === -1) {
    throw new Error(`Atestado âncora ${atestadoAncoraId} não encontrado na lista de atestados do funcionário`)
  }

  let inicio = indiceAncora
  while (inicio > 0 && seEncadeiam(ordenados[inicio - 1], ordenados[inicio])) {
    inicio -= 1
  }

  let fim = indiceAncora
  while (fim < ordenados.length - 1 && seEncadeiam(ordenados[fim], ordenados[fim + 1])) {
    fim += 1
  }

  const grupo = ordenados.slice(inicio, fim + 1)
  const dataInicio = grupo[0].dataInicio
  const dataFim = grupo[grupo.length - 1].dataFim

  return {
    dataInicio,
    dataFim,
    dias: calcDias(dataInicio, dataFim),
    atestadosIncluidos: grupo,
  }
}
