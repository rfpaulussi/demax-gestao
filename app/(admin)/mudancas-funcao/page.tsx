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

  const [{ data: raw }, { data: funcoesList }, { data: escalasData }, { data: supervisoresData }] = await Promise.all([
    (supabase as unknown as AnyQ)
      .from('movimentacoes')
      .select(`
        id, created_at, funcionario_id, solicitacao_id, valor_antes, valor_depois, enviado_rh,
        funcionarios!funcionario_id (
          nome, registro,
          postos!posto_id ( id, nome, secretaria )
        ),
        solicitacoes!solicitacao_id (
          tipo, dados_antes, dados_depois, motivo
        )
      `)
      .eq('tipo', 'mudanca_funcao')
      .gte('created_at', inicio)
      .lt('created_at', proxMes)
      .order('created_at', { ascending: false }),
    supabase
      .from('funcoes')
      .select('id, nome, insalubridade_perc, salario_base')
      .order('nome'),
    supabase
      .from('config_escalas_postos')
      .select('posto_id, regime'),
    (supabase as unknown as AnyQ)
      .from('config_supervisores_postos')
      .select('posto_id, perfis!config_supervisores_postos_supervisor_id_fkey(nome)')
      .eq('ativo', true),
  ])

  // posto_id → regime lookup
  const escalasMap: Record<string, string> = {}
  for (const e of (escalasData ?? []) as { posto_id: string; regime: string }[]) {
    escalasMap[e.posto_id] = e.regime
  }

  // posto_id → nome do supervisor atual (do efetivo)
  const postoSupervisorMap: Record<string, string> = {}
  for (const s of (supervisoresData ?? []) as { posto_id: string; perfis: { nome: string | null } | null }[]) {
    if (s.perfis?.nome && !postoSupervisorMap[s.posto_id]) {
      postoSupervisorMap[s.posto_id] = s.perfis.nome
    }
  }

  type FuncJoin = {
    nome: string
    registro: string | null
    postos: { id: string; nome: string; secretaria: string | null } | null
  } | null

  type SolJoin = {
    tipo:         string | null
    dados_antes:  Record<string, unknown> | null
    dados_depois: Record<string, unknown> | null
    motivo:       string | null
  } | null

  type RawRow = {
    id: string
    created_at: string
    funcionario_id: string
    solicitacao_id: string | null
    valor_antes: string | null
    valor_depois: string | null
    enviado_rh: boolean
    funcionarios: FuncJoin
    solicitacoes: SolJoin
  }

  type FuncaoItem = { id: string; nome: string; insalubridade_perc: number | null; salario_base: number | null }
  const fList = (funcoesList ?? []) as FuncaoItem[]

  const dados: MudancaFuncaoAdminRow[] = ((raw ?? []) as RawRow[]).map(r => {
    const func = r.funcionarios
    const sol  = r.solicitacoes
    const postoId = func?.postos?.id ?? null

    const insAnteriorPerc = fList.find(f => f.id === r.valor_antes)?.insalubridade_perc ?? null
    const insNovaPerc     = fList.find(f => f.id === r.valor_depois)?.insalubridade_perc ?? null

    // Compara nome origem vs destino ignorando acentos, espaços, barras e hífens.
    // NFD decompõe acentos; em seguida remove diacríticos e tudo que não for alfanumérico.
    // eslint-disable-next-line no-control-regex
    const normalize = (s: unknown) =>
      String(s ?? '').normalize('NFD').replace(/̀-ͯ/g, '').replace(/[^A-Z0-9]/gi, '').toUpperCase()
    const nomeOrigem  = normalize(sol?.dados_antes?.['posto_nome'])
    const nomeDestino = normalize(sol?.dados_depois?.['posto_destino_nome'])
    const postoNomeMudou = !!(nomeOrigem && nomeDestino && nomeOrigem !== nomeDestino)
    const tipoEfetivo    = sol?.tipo === 'transferencia' && !postoNomeMudou
      ? 'mudanca_funcao'
      : (sol?.tipo ?? null)

    return {
      id:               r.id,
      created_at:       r.created_at,
      funcionario_id:   r.funcionario_id,
      solicitacao_id:   r.solicitacao_id ?? null,
      funcao_anterior_id: r.valor_antes ?? null,
      funcao_nova_id:   r.valor_depois ?? null,
      nome:             func?.nome ?? '—',
      registro:         func?.registro ?? null,
      posto:            func?.postos?.nome ?? '—',
      secretaria:       func?.postos?.secretaria ?? '—',
      funcao_anterior:  (sol?.dados_antes?.['funcao_nome'] as string | undefined)
        ?? fList.find(f => f.id === r.valor_antes)?.nome
        ?? '—',
      funcao_nova:      (sol?.dados_depois?.['funcao_destino_nome'] as string | undefined)
        ?? (sol?.dados_depois?.['nova_funcao_nome'] as string | undefined)
        ?? fList.find(f => f.id === r.valor_depois)?.nome
        ?? '—',
      supervisor:       postoSupervisorMap[func?.postos?.id ?? ''] ?? '—',
      motivo:           sol?.motivo ?? null,
      enviado_rh:       r.enviado_rh ?? false,
      tipo_solicitacao: tipoEfetivo,
      salario_anterior: fList.find(f => f.id === r.valor_antes)?.salario_base ?? null,
      salario_nova:     fList.find(f => f.id === r.valor_depois)?.salario_base ?? null,
      escala:           postoId ? (escalasMap[postoId] ?? null) : null,
      insalubridade_anterior_perc: insAnteriorPerc,
      insalubridade_nova_perc:     insNovaPerc,
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

      <MudancasFuncaoAdminClient
        dados={dados}
        mes={mes}
        ano={ano}
        anos={anos}
        funcoes={fList}
      />
    </div>
  )
}
