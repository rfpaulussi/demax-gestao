'use server'

import { createAdminClient } from './supabase/admin'

export type TipoModulo = 'atestado' | 'advertencia' | 'falta' | 'cobertura'
export type TipoOp     = 'criou' | 'editou' | 'excluiu'

export async function logSupervisorAcao(params: {
  supervisorId: string
  tipo: TipoModulo
  acao: TipoOp
  funcionarioNome?: string | null
  detalhes?: string | null
}) {
  try {
    const admin = createAdminClient()
    const { data: perfil } = await admin
      .from('perfis')
      .select('nome')
      .eq('id', params.supervisorId)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('log_supervisor_acoes').insert({
      supervisor_id:    params.supervisorId,
      supervisor_nome:  perfil?.nome ?? 'Supervisor',
      tipo:             params.tipo,
      acao:             params.acao,
      funcionario_nome: params.funcionarioNome ?? null,
      detalhes:         params.detalhes ?? null,
    })
  } catch (err) {
    console.error('[log-supervisor] falha ao registrar:', err)
  }
}
