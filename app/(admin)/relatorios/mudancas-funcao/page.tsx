import { buscarMudancasFuncao } from './actions'
import { BackButton } from '@/components/ui/back-button'
import { MudancasFuncaoClient } from '@/components/relatorios/mudancas-funcao-client'

const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default async function MudancasFuncaoPage({
  searchParams,
}: {
  searchParams: { mes?: string; ano?: string }
}) {
  const now = new Date()
  const mes = Number(searchParams.mes ?? now.getMonth() + 1)
  const ano = Number(searchParams.ano ?? now.getFullYear())
  const anos = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  const dados = await buscarMudancasFuncao(mes, ano)

  return (
    <div className="space-y-6">
      <BackButton href="/relatorios" label="Voltar aos Relatórios" />
      <div>
        <h1 className="text-lg font-bold text-gray-900">Mudanças de Função</h1>
        <p className="text-sm text-gray-400">Alterações de função registradas — {MESES[mes]} {ano}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-indigo-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">{dados.length}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Mudanças</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-slate-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">{new Set(dados.map(r => r.funcionario_nome)).size}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Funcionários</p>
        </div>
      </div>

      <MudancasFuncaoClient dados={dados} mes={mes} ano={ano} MESES={MESES} anos={anos} />
    </div>
  )
}
