import type { PedidoExtraido } from './schema'

export interface CasoTeste {
  id: string
  /** 'sintetico' = escrito por nós; 'real' = pedido de supervisor de verdade (sem nomes nem CPF). */
  origem: 'sintetico' | 'real'
  pedido: string
  /** Só os campos que importam conferir. Datas sempre com ano explícito no pedido, para o caso não depender do dia de hoje. */
  esperado: Partial<Pick<PedidoExtraido,
    'situacao' | 'data_evento' | 'data_folga' | 'hora_dispensa' | 'periodo_inicio' | 'periodo_fim' | 'horas_trabalhadas' |
    'quantidade_dias' | 'todos_do_posto' | 'datas_evento_extras' | 'folga_horas' | 'prazo_limite'>>
  /** true = o pedido é vago de propósito: o certo é a IA perguntar em vez de preencher. */
  devePerguntar?: boolean
}

/**
 * Casos para medir a extração. Os sintéticos servem para começar; troque/adicione pedidos REAIS
 * de supervisores (do jeito que chegam) antes de confiar na taxa de acerto.
 */
export const CASOS: CasoTeste[] = [
  {
    id: 's1-liberados-chuva', origem: 'sintetico',
    pedido: 'Liberamos o pessoal do Casarão às 12h no dia 14/09/2026 por causa da chuva forte. Repõem em 6 dias.',
    esperado: { situacao: 'T2', data_evento: '2026-09-14', hora_dispensa: '12:00', quantidade_dias: 6, todos_do_posto: true },
  },
  {
    id: 's2-emenda', origem: 'sintetico',
    pedido: 'Sexta 05/06/2026 é ponto facultativo e a prefeitura fechou. O CAPS II não trabalha e repõe depois em 8 dias úteis.',
    esperado: { situacao: 'T3', data_folga: '2026-06-05', quantidade_dias: 8 },
  },
  {
    id: 's3-sabado-folga', origem: 'sintetico',
    pedido: 'A equipe do CEADIM trabalhou no sábado 20/06/2026 das 8h às 12h no mutirão de limpeza e vai folgar dia 26/06/2026.',
    esperado: { situacao: 'T5', data_evento: '2026-06-20', periodo_inicio: '08:00', periodo_fim: '12:00', data_folga: '2026-06-26', todos_do_posto: true },
  },
  {
    id: 's4-sair-cedo', origem: 'sintetico',
    pedido: 'Trabalharam sábado 20/06/2026, das 8h às 12h, na festa junina. Vão sair 1 hora mais cedo por 4 dias.',
    esperado: { situacao: 'T1', data_evento: '2026-06-20', periodo_inicio: '08:00', periodo_fim: '12:00', quantidade_dias: 4 },
  },
  {
    id: 's5-banco-horas', origem: 'sintetico',
    pedido: 'Vamos trabalhar 1 hora a mais por dia de 01/06/2026 a 10/06/2026 para folgar em 12/06/2026. Prazo até 31/08/2026.',
    esperado: { situacao: 'T4', data_folga: '2026-06-12', prazo_limite: '2026-08-31' },
  },
  {
    id: 's6-dois-dias', origem: 'sintetico',
    pedido: 'A escola teve evento sábado 20/06/2026 e domingo 21/06/2026, 4 horas cada dia. O pessoal do Casarão folga na sexta 26/06/2026.',
    esperado: { situacao: 'T5', data_evento: '2026-06-20', datas_evento_extras: ['2026-06-21'], horas_trabalhadas: '04:00', data_folga: '2026-06-26', todos_do_posto: true },
  },
  {
    id: 's7-folga-parcial', origem: 'sintetico',
    pedido: 'Vamos fazer banco de horas: 1h a mais por dia de 01/06/2026 a 04/06/2026 para sair 4 horas mais cedo em 12/06/2026. Prazo até 30/09/2026.',
    esperado: { situacao: 'T4', data_folga: '2026-06-12', folga_horas: '04:00', prazo_limite: '2026-09-30' },
  },
  {
    id: 's8-falta-agua', origem: 'sintetico',
    pedido: 'Faltou água no CEMPRE Benedito dia 10/09/2026 e liberamos todo mundo às 14h. Compensam em 5 dias.',
    esperado: { situacao: 'T2', data_evento: '2026-09-10', hora_dispensa: '14:00', quantidade_dias: 5, todos_do_posto: true },
  },
  {
    id: 's9-vago', origem: 'sintetico',
    pedido: 'O CAPS vai folgar na sexta.',
    esperado: {}, devePerguntar: true,
  },
  {
    id: 's10-sem-informacao', origem: 'sintetico',
    pedido: 'Preciso fazer um acordo de compensação para o pessoal.',
    esperado: {}, devePerguntar: true,
  },
]

export interface ConferenciaCampo {
  campo: string
  esperado: string
  obtido: string
  ok: boolean
}

const fmt = (v: unknown): string => (Array.isArray(v) ? v.join(', ') : v === null || v === undefined ? '—' : String(v))

/** Compara só os campos que o caso espera; em caso vago, o certo é a IA fazer pergunta em vez de preencher às cegas. */
export function conferirCaso(caso: CasoTeste, obtido: PedidoExtraido): { ok: boolean; campos: ConferenciaCampo[] } {
  const campos: ConferenciaCampo[] = []
  for (const [campo, esperado] of Object.entries(caso.esperado)) {
    const valor = (obtido as unknown as Record<string, unknown>)[campo]
    const ok = Array.isArray(esperado)
      ? Array.isArray(valor) && esperado.length === valor.length && esperado.every((x, i) => x === valor[i])
      : valor === esperado
    campos.push({ campo, esperado: fmt(esperado), obtido: fmt(valor), ok })
  }
  if (caso.devePerguntar) {
    const perguntou = obtido.perguntas.length > 0
    campos.push({ campo: 'perguntou', esperado: 'sim', obtido: perguntou ? 'sim' : 'não', ok: perguntou })
  }
  return { ok: campos.every(c => c.ok), campos }
}
