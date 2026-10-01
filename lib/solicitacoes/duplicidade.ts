import { createAdminClient } from '@/lib/supabase/admin'

/** Tipos que podem mexer em horarios_funcionarios na aprovação — conflitam entre si. */
const TIPOS_QUE_ALTERAM_HORARIO = ['transferencia', 'mudanca_funcao', 'retorno_afastamento', 'mudanca_horario']

const TIPO_LABEL: Record<string, string> = {
  desligamento:        'Desligamento',
  transferencia:       'Transferência',
  mudanca_funcao:      'Mudança de Função',
  retorno_afastamento: 'Retorno de Afastamento',
  rescisao_indireta:   'Rescisão Indireta',
  mudanca_horario:     'Mudança de Horário',
  afastamento:         'Afastamento',
  mudanca_supervisor:  'Mudança de Supervisor',
}

export type SolicitacaoEmAnalise = {
  tipo: string
  tipoLabel: string
  criadaEm: string | null
  solicitante: string | null
  mesmoTipo: boolean
}

/**
 * Procura solicitação pendente do funcionário que impeça uma nova do `tipo` informado:
 * mesmo tipo, ou ambos entre os que alteram horário. Usa admin client — o RLS do supervisor
 * só mostra as próprias, e o pedido pendente de outro supervisor também tem que bloquear.
 */
export async function buscarSolicitacaoEmAnalise(
  funcionarioId: string,
  tipo: string,
): Promise<SolicitacaoEmAnalise | null> {
  const tiposConflitantes = TIPOS_QUE_ALTERAM_HORARIO.includes(tipo)
    ? Array.from(new Set([tipo, ...TIPOS_QUE_ALTERAM_HORARIO]))
    : [tipo]

  const { data } = await createAdminClient()
    .from('solicitacoes')
    .select('tipo, created_at, perfis!supervisor_id(nome)')
    .eq('funcionario_id', funcionarioId)
    .eq('status', 'pendente')
    .in('tipo', tiposConflitantes as unknown as 'desligamento'[])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  const row = data as unknown as { tipo: string; created_at: string | null; perfis: { nome: string | null } | null }
  return {
    tipo: row.tipo,
    tipoLabel: TIPO_LABEL[row.tipo] ?? row.tipo,
    criadaEm: row.created_at,
    solicitante: row.perfis?.nome ?? null,
    mesmoTipo: row.tipo === tipo,
  }
}

export function mensagemEmAnalise(s: SolicitacaoEmAnalise): string {
  const data = s.criadaEm ? new Date(s.criadaEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : null
  const quando = data ? ` em ${data}` : ''
  const quem = s.solicitante ? ` por ${s.solicitante}` : ''
  return s.mesmoTipo
    ? `Já existe uma solicitação de ${s.tipoLabel} em análise para este funcionário (enviada${quando}${quem}). Aguarde a decisão da coordenação antes de enviar outra.`
    : `Já existe uma solicitação de ${s.tipoLabel} em análise para este funcionário (enviada${quando}${quem}) que também altera o horário. Aguarde a decisão da coordenação antes de enviar outra.`
}

/** Mensagem de bloqueio, ou null se pode enviar. */
export async function mensagemSolicitacaoEmAnalise(funcionarioId: string, tipo: string): Promise<string | null> {
  const s = await buscarSolicitacaoEmAnalise(funcionarioId, tipo)
  return s ? mensagemEmAnalise(s) : null
}
