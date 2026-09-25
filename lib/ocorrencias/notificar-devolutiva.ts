import { createAdminClient } from '@/lib/supabase/admin'
import { logSupervisorAcao } from '@/lib/log-supervisor'
import { enviarEmail, buscarEmailsAdmins, buscarEmailsPorPerfil } from '@/lib/email'
import {
  assuntoDevolutiva,
  montarDestinatariosSupervisores,
  templateDevolutivaOcorrencia,
} from './devolutiva'

export type NotificarDevolutivaParams = {
  funcionarioId: string
  funcionarioNome: string
  postoId: string | null
  supervisorDaOcorrencia: string | null
  autorId: string
  autorRole: string
  parecer: boolean
}

// Avisa a outra parte da conversa (sino + e-mail sem o texto da mensagem).
// Nunca lança: a mensagem já foi gravada, falha de aviso não pode desfazer nem quebrar a ação.
export async function notificarDevolutiva(p: NotificarDevolutivaParams): Promise<void> {
  try {
    const subject = assuntoDevolutiva(p.funcionarioNome)
    const html = templateDevolutivaOcorrencia({
      funcionarioNome: p.funcionarioNome,
      funcionarioId: p.funcionarioId,
      parecer: p.parecer,
    })

    // Supervisor respondeu -> sino do admin (log_supervisor_acoes) + e-mail pros admins
    if (p.autorRole === 'supervisor') {
      await logSupervisorAcao({
        supervisorId: p.autorId,
        tipo: 'ocorrencia',
        acao: 'respondeu',
        funcionarioNome: p.funcionarioNome,
        detalhes: JSON.stringify({ funcionario_id: p.funcionarioId }),
      })
      await enviarEmail({ to: await buscarEmailsAdmins(), subject, html })
      return
    }

    // RH respondeu -> sino do supervisor (alertas_supervisor) + e-mail pra ele
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    let supervisoresDoPosto: string[] = []
    if (p.postoId) {
      const { data: cfg } = await admin
        .from('config_supervisores_postos')
        .select('supervisor_id')
        .eq('posto_id', p.postoId)
        .eq('ativo', true)
      supervisoresDoPosto = ((cfg ?? []) as { supervisor_id: string }[]).map(r => r.supervisor_id)
    }

    const destinatarios = montarDestinatariosSupervisores({
      supervisoresDoPosto,
      supervisorDaOcorrencia: p.supervisorDaOcorrencia,
      autorId: p.autorId,
    })
    if (destinatarios.length === 0) return

    await admin.from('alertas_supervisor').insert(
      destinatarios.map(supervisor_id => ({
        supervisor_id,
        tipo: 'ocorrencia_devolutiva',
        titulo: p.parecer ? 'Ocorrência encerrada com parecer' : 'Nova devolutiva em ocorrência',
        detalhes: JSON.stringify({
          funcionario_id: p.funcionarioId,
          funcionario_nome: p.funcionarioNome,
        }),
      })),
    )

    await enviarEmail({ to: await buscarEmailsPorPerfil(destinatarios), subject, html })
  } catch (err) {
    console.error('[devolutiva] falha ao notificar:', err)
  }
}
