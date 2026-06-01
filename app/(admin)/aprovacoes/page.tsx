import { createClient } from '@/lib/supabase/server'
import { AprovacoesList } from '@/components/aprovacoes/aprovacoes-list'
import type { SolicitacaoPendente } from '@/components/aprovacoes/aprovacoes-list'

export default async function AprovacoesPage() {
  const supabase = createClient()

  const { data: raw } = await supabase
    .from('solicitacoes')
    .select(`
      id, tipo, motivo, dados_antes, dados_depois, created_at,
      funcionarios!funcionario_id ( nome, cpf ),
      perfis!supervisor_id ( nome, email )
    `)
    .eq('status', 'pendente')
    .order('created_at', { ascending: true })

  const solicitacoes = (raw ?? []) as unknown as SolicitacaoPendente[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Aprovações</h1>
        <p className="text-sm text-gray-400">
          {solicitacoes.length === 0
            ? 'Nenhuma solicitação pendente'
            : `${solicitacoes.length} solicitaç${solicitacoes.length === 1 ? 'ão' : 'ões'} aguardando aprovação`}
        </p>
      </div>

      <AprovacoesList solicitacoes={solicitacoes} />
    </div>
  )
}
