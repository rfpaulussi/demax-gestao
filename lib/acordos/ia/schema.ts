import type { TemplateId } from '../tipos'

/** O que a IA devolve. Só extração: nada aqui é cálculo nem texto jurídico. */
export interface PedidoExtraido {
  situacao: TemplateId | null
  /** Nome do posto como aparece no pedido (o servidor casa com o cadastro). */
  posto: string | null
  /** Códigos FUNC_n citados no pedido. */
  funcionarios: string[]
  /** "todos", "o pessoal", "a equipe" do posto. */
  todos_do_posto: boolean
  nome_evento: string | null
  data_evento: string | null
  datas_evento_extras: string[]
  periodo_inicio: string | null
  periodo_fim: string | null
  /** Horas trabalhadas por dia, 'HH:MM', quando o pedido dá a duração e não o período. */
  horas_trabalhadas: string | null
  hora_dispensa: string | null
  data_folga: string | null
  /** T4: folga de só algumas horas, 'HH:MM'. */
  folga_horas: string | null
  motivo: string | null
  /** Dias de compensação/acréscimo citados uma a uma. */
  dias_compensacao: string[]
  /** "em 6 dias": só a quantidade, sem datas. */
  quantidade_dias: number | null
  prazo_limite: string | null
  /** Revezamento: data de folga de cada funcionário citado. */
  revezamento: { funcionario: string; data: string }[]
  /** Dúvidas que impedem de preencher (só as que o pedido realmente não responde). */
  perguntas: string[]
}

export const NOME_FERRAMENTA = 'preencher_acordo'

const STR = { type: ['string', 'null'] }

/** Definição da ferramenta (tool use): a IA é obrigada a responder neste formato. */
export const FERRAMENTA_PREENCHER = {
  name: NOME_FERRAMENTA,
  description:
    'Registra os campos de um pedido de acordo de compensação de horas. Preencha só o que o pedido diz de forma clara; use null quando não estiver dito. Nunca invente datas, horários ou nomes.',
  input_schema: {
    type: 'object' as const,
    properties: {
      situacao: {
        type: ['string', 'null'],
        enum: ['T1', 'T2', 'T3', 'T4', 'T5', null],
        description:
          'T1 = trabalharam além do horário (evento, sábado, domingo) e vão sair mais cedo em vários dias. ' +
          'T5 = trabalharam num dia (sábado, domingo, evento) e ganham uma folga em outro dia (inteira ou parte das horas). ' +
          'T2 = foram liberados antes do fim do expediente (numa hora) e vão repor as horas depois. ' +
          'T3 = não trabalharam o dia todo (emenda, ponto facultativo) e vão repor depois. ' +
          'T4 = vão trabalhar a mais agora (banco de horas) para folgar depois. ' +
          'null se o pedido não deixa claro qual é.',
      },
      posto: { ...STR, description: 'Nome da unidade/posto citado (ex.: "Casarão", "CAPS II").' },
      funcionarios: {
        type: 'array',
        items: { type: 'string' },
        description: 'Códigos FUNC_n citados no pedido (ex.: ["FUNC_1", "FUNC_2"]). Vazio se o pedido fala do grupo todo.',
      },
      todos_do_posto: { type: 'boolean', description: 'true se o pedido fala de todos/o pessoal/a equipe do posto.' },
      nome_evento: { ...STR, description: 'Nome do evento ou do motivo do dia (ex.: "Festa Junina", "Chuva forte").' },
      data_evento: { ...STR, description: 'Data do dia trabalhado (T1/T5) ou do dia da dispensa (T2), AAAA-MM-DD.' },
      datas_evento_extras: {
        type: 'array',
        items: { type: 'string' },
        description: 'Outros dias trabalhados no mesmo evento (T1/T5), AAAA-MM-DD.',
      },
      periodo_inicio: { ...STR, description: 'Início do período trabalhado (T1/T5), HH:MM.' },
      periodo_fim: { ...STR, description: 'Fim do período trabalhado (T1/T5), HH:MM.' },
      horas_trabalhadas: { ...STR, description: 'Duração trabalhada por dia quando o pedido dá só as horas (ex.: 4h -> "04:00").' },
      hora_dispensa: { ...STR, description: 'Hora em que foram liberados (T2), HH:MM.' },
      data_folga: { ...STR, description: 'Dia da folga (T3/T4/T5), AAAA-MM-DD. Em revezamento, use o campo revezamento.' },
      folga_horas: { ...STR, description: 'T4: quando a folga é só de algumas horas, HH:MM.' },
      motivo: { ...STR, description: 'Motivo da dispensa/folga em poucas palavras (ex.: "chuva forte", "ponto facultativo", "falta de água").' },
      dias_compensacao: {
        type: 'array',
        items: { type: 'string' },
        description: 'Dias de reposição/redução/acréscimo citados um a um, AAAA-MM-DD. Vazio se o pedido não os lista.',
      },
      quantidade_dias: { type: ['integer', 'null'], description: 'Quantos dias de compensação o pedido cita ("em 6 dias"), sem datas.' },
      prazo_limite: { ...STR, description: 'Prazo máximo para compensar, AAAA-MM-DD.' },
      revezamento: {
        type: 'array',
        items: {
          type: 'object',
          properties: { funcionario: { type: 'string' }, data: { type: 'string' } },
          required: ['funcionario', 'data'],
        },
        description: 'Quando cada funcionário folga num dia diferente: [{funcionario: "FUNC_1", data: "AAAA-MM-DD"}].',
      },
      perguntas: {
        type: 'array',
        items: { type: 'string' },
        description: 'No máximo 3 perguntas curtas, só sobre o que impede de preencher e o pedido não responde. Vazio se nada impede.',
      },
    },
    required: ['situacao', 'perguntas'],
  },
}

const ehStr = (v: unknown): v is string => typeof v === 'string'
const strOuNull = (v: unknown): string | null => (ehStr(v) && v.trim() !== '' ? v.trim() : null)
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter(ehStr).map(x => x.trim()).filter(Boolean) : [])

/** Confere o que voltou da API (nunca confiar no formato): devolve null se nem for um objeto. */
export function lerExtracao(bruto: unknown): PedidoExtraido | null {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return null
  const o = bruto as Record<string, unknown>
  const situacao = ['T1', 'T2', 'T3', 'T4', 'T5'].includes(o.situacao as string) ? (o.situacao as TemplateId) : null
  const q = typeof o.quantidade_dias === 'number' && Number.isInteger(o.quantidade_dias) && o.quantidade_dias > 0 && o.quantidade_dias <= 62
    ? o.quantidade_dias
    : null
  const revezamento = Array.isArray(o.revezamento)
    ? o.revezamento
        .filter((r): r is { funcionario: string; data: string } => !!r && ehStr((r as Record<string, unknown>).funcionario) && ehStr((r as Record<string, unknown>).data))
        .map(r => ({ funcionario: r.funcionario.trim(), data: r.data.trim() }))
    : []
  return {
    situacao,
    posto: strOuNull(o.posto),
    funcionarios: lista(o.funcionarios),
    todos_do_posto: o.todos_do_posto === true,
    nome_evento: strOuNull(o.nome_evento),
    data_evento: strOuNull(o.data_evento),
    datas_evento_extras: lista(o.datas_evento_extras),
    periodo_inicio: strOuNull(o.periodo_inicio),
    periodo_fim: strOuNull(o.periodo_fim),
    horas_trabalhadas: strOuNull(o.horas_trabalhadas),
    hora_dispensa: strOuNull(o.hora_dispensa),
    data_folga: strOuNull(o.data_folga),
    folga_horas: strOuNull(o.folga_horas),
    motivo: strOuNull(o.motivo),
    dias_compensacao: lista(o.dias_compensacao),
    quantidade_dias: q,
    prazo_limite: strOuNull(o.prazo_limite),
    revezamento,
    perguntas: lista(o.perguntas).slice(0, 3),
  }
}
