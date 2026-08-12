import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type AnyClient = SupabaseClient<Database>

/**
 * Resolve o regime (tipo_escala: 5x2 / 5x1 / 12x36 / jovem_aprendiz) de cada
 * funcionário a partir do turno VIGENTE dele (horarios_funcionarios sem
 * data_fim -> turnos_postos.tipo_escala).
 *
 * Fallback: quando o funcionário não tem turno vigente cadastrado (ainda não
 * migrou pro fluxo de turnos), usa o regime configurado no posto dele
 * (config_escalas_postos), igual o comportamento atual do sistema.
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
): Promise<Map<string, string>> {
  const regimes = new Map<string, string>()
  if (funcionarioIds.length === 0) return regimes

  // Sem filtro .in(funcionario_id) de propósito: com centenas de IDs o GET do
  // PostgREST estoura o limite de tamanho de URL e a API responde 400 Bad
  // Request (visto em produção com ~860 funcionários ativos). A tabela de
  // turnos vigentes é pequena (1 linha por funcionário com turno ativo), então
  // trazer tudo e filtrar em memória é seguro e evita o problema.
  const { data, error } = await supabase
    .from('horarios_funcionarios')
    .select('funcionario_id, turnos_postos!turno_id ( tipo_escala )')
    .is('data_fim', null)

  if (error) throw error

  const idsDesejados = new Set(funcionarioIds)

  for (const row of (data ?? []) as unknown as { funcionario_id: string; turnos_postos: { tipo_escala: string } | null }[]) {
    if (idsDesejados.has(row.funcionario_id) && row.turnos_postos?.tipo_escala) {
      regimes.set(row.funcionario_id, row.turnos_postos.tipo_escala)
    }
  }

  for (const fid of funcionarioIds) {
    if (regimes.has(fid)) continue
    const postoId = postoIdPorFuncionario.get(fid) ?? null
    const fallback = (postoId ? postoConfigMap.get(postoId) : null) ?? '5x2'
    regimes.set(fid, fallback)
  }

  return regimes
}
