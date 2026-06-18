import { createClient } from '@/lib/supabase/server'
import { MudancasFuncaoAdminClient } from '@/components/mudancas-funcao/mudancas-funcao-client'
import type { MudancaFuncaoAdminRow } from '@/components/mudancas-funcao/mudancas-funcao-client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQ = { from: (t: string) => any }

const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default async function MudancasFuncaoAdminPage({
  searchParams,
}: {
  searchParams: { mes?: string; ano?: string }
}) {
  const now = new Date()
  const mes = Number(searchParams.mes ?? now.getMonth() + 1)
  const ano = Number(searchParams.ano ?? now.getFullYear())
  const anos = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  const pad   = (n: number) => String(n).padStart(2, '0')
  const inicio = `${ano}-${pad(mes)}-01`
  const proxMes = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${pad(mes + 1)}-01`

  const supabase = createClient()

  const { data: raw } = await (supabase as unknown as AnyQ)
    .from('movimentacoes')
    .select(`
      id, created_at, funcionario_id,
      funcionarios!funcionario_id (
        nome, registro,
        postos!posto_id ( nome, secretaria )
      ),
      solicitacoes!solicitacao_id (
        dados_antes, dados_depois, motivo,
        perfis!supervisor_id ( nome )
      )
    `)
    .eq('tipo', 'mudanca_funcao')
    .gte('created_at', inicio)
    .lt('created_at', proxMes)
    .order('created_at', { ascending: false })

  type FuncJoin = {
    nome: string
    registro: string | null
    postos: { nome: string; secretaria: string | null } | null
  } | null

  type SolJoin = {
    dados_antes:  Record<string, unknown> | null
    dados_depois: Record<string, unknown> | null
    motivo:       string | null
    perfis:       { nome: string | null } | null
  } | null

  type RawRow = {
    id: string
    created_at: string
    funcionario_id: string
    funcionarios: FuncJoin
    solicitacoes: SolJoin
  }

  const dados: MudancaFuncaoAdminRow[] = ((raw ?? []) as RawRow[]).map(r => {
    const func = r.funcionarios
    const sol  = r.solicitacoes
    return {
      id:              r.id,
      created_at:      r.created_at,
      nome:            func?.nome ?? '—',
      registro:        func?.registro ?? null,
      posto:           func?.postos?.nome ?? '—',
      secretaria:      func?.postos?.secretaria ?? '—',
      funcao_anterior: (sol?.dados_antes?.['funcao_nome'] as string | undefined) ?? '—',
      funcao_nova:     (sol?.dados_depois?.['funcao_destino_nome'] as string | undefined) ?? '—',
      supervisor:      sol?.perfis?.nome ?? '—',
      motivo:          sol?.motivo ?? null,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Mudanças de Função</h1>
        <p className="text-sm text-gray-400">
          Alterações de função registradas — {MESES[mes]} {ano}
        </p>
      </div>

      <MudancasFuncaoAdminClient dados={dados} mes={mes} ano={ano} anos={anos} />
    </div>
  )
}
