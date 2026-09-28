import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type AnyClient = SupabaseClient<Database>

/**
 * Resolve o regime (tipo_escala: 5x2 / 5x1 / 12x36 / jovem_aprendiz) de cada
 * funcionário a partir do turno vigente dele em `asOfDate` (horarios_funcionarios
 * cujo período cobre essa data -> turnos_postos.tipo_escala). Sem `asOfDate`,
 * usa o turno vigente HOJE (data_fim IS NULL) — comportamento de sempre, usado
 * por telas que só precisam do regime atual (ex.: cadastro de férias).
 *
 * Passar `asOfDate` (fim do mês fechado, por ex.) é essencial em qualquer
 * cálculo retroativo: sem isso, um funcionário cujo turno mudou DEPOIS do
 * período calculado usaria o regime NOVO pro período INTEIRO, incluindo dias
 * em que o regime antigo é que valia.
 *
 * Fallback: quando o funcionário não tem turno cadastrado pra aquela data
 * (ainda não migrou pro fluxo de turnos), usa o regime configurado no posto
 * dele (config_escalas_postos, sempre o ATUAL — essa tabela não tem
 * histórico), igual o comportamento de sempre do sistema.
 *
 * Hoje `criarTurno` (app/(admin)/postos/turnos/actions.ts) força todo turno
 * de um posto a ter o mesmo tipo_escala do posto — então o resultado deste
 * helper é idêntico ao regime-por-posto para todo posto existente. Ele só
 * passa a divergir quando um posto tiver turnos com tipo_escala diferentes
 * (Fase 2, ainda não habilitada).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function obterRegimesPorFuncionario(
  supabase: AnyClient,
  funcionarioIds: string[],
  postoConfigMap: Map<string, string>,
  postoIdPorFuncionario: Map<string, string | null>,
  asOfDate?: string,
): Promise<Map<string, string>> {
  const regimes = new Map<string, string>()
  if (funcionarioIds.length === 0) return regimes

  // Sem filtro .in(funcionario_id) de propósito: com centenas de IDs o GET do
  // PostgREST estoura o limite de tamanho de URL e a API responde 400 Bad
  // Request (visto em produção com ~860 funcionários ativos). A tabela inteira
  // (~900 linhas, vigentes + histórico) é pequena, então trazer tudo e filtrar
  // em memória é seguro e evita o problema.
  const { data, error } = await supabase
    .from('horarios_funcionarios')
    .select('funcionario_id, data_inicio, data_fim, turnos_postos!turno_id ( tipo_escala )')

  if (error) throw error

  const idsDesejados = new Set(funcionarioIds)
  type Row = { funcionario_id: string; data_inicio: string | null; data_fim: string | null; turnos_postos: { tipo_escala: string } | null }
  const linhas = (data ?? []) as unknown as Row[]

  for (const row of linhas) {
    if (!idsDesejados.has(row.funcionario_id) || !row.turnos_postos?.tipo_escala) continue
    const vigenteNaData = asOfDate
      ? (row.data_inicio ?? '') <= asOfDate && (row.data_fim === null || row.data_fim >= asOfDate)
      : row.data_fim === null
    if (vigenteNaData) regimes.set(row.funcionario_id, row.turnos_postos.tipo_escala)
  }

  for (const fid of funcionarioIds) {
    if (regimes.has(fid)) continue
    const postoId = postoIdPorFuncionario.get(fid) ?? null
    const fallback = (postoId ? postoConfigMap.get(postoId) : null) ?? '5x2'
    regimes.set(fid, fallback)
  }

  return regimes
}
