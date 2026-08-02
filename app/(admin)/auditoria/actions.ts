'use server'

import { getUser } from '@/lib/auth/get-user'
import { buscarMovimentacoesCompleto, type AuditoriaFiltros } from '@/lib/auditoria/query'
import type { MovimentacaoAuditoria } from '@/components/auditoria/tabela-auditoria'

/** Busca todo o resultado filtrado (sem paginação) para exportação — somente leitura,
 *  não altera nenhum dado. Restrito a admin, mesma regra de acesso da página. */
export async function buscarAuditoriaParaExportar(filtros: AuditoriaFiltros): Promise<MovimentacaoAuditoria[]> {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin') return []

  return buscarMovimentacoesCompleto(filtros)
}
