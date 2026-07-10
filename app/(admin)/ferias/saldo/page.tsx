import Link from 'next/link'
import { buscarSaldoFeriasAgregado } from '../actions'

function formatDate(str: string | null): string {
  if (!str) return '—'
  const d = new Date(str + 'T00:00:00')
  return d.toLocaleDateString('pt-BR')
}

function diasParaVencer(limite: string | null): number | null {
  if (!limite) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return Math.ceil((new Date(limite + 'T00:00:00').getTime() - hoje.getTime()) / 86400000)
}

export default async function SaldoFeriasPage() {
  const saldos = await buscarSaldoFeriasAgregado()

  const totalFuncionarios = saldos.length
  const totalDias         = saldos.reduce((s, i) => s + i.total_dias, 0)
  const vencidos          = saldos.filter(i => i.tem_vencido).length
  const criticos          = saldos.filter(i => {
    const d = diasParaVencer(i.limite_mais_proximo)
    return d !== null && d >= 0 && d <= 30
  }).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Saldo de Férias</h1>
          <p className="text-sm text-slate-500">
            Funcionários com períodos ainda não gozados (Disponível, Agendado ou Aprovado)
          </p>
        </div>
        <Link
          href="/ferias"
          className="px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
        >
          ← Voltar para Férias
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-t-4 border-t-blue-500">
          <div className="text-4xl font-bold text-slate-900">{totalFuncionarios}</div>
          <div className="text-xs uppercase tracking-widest text-slate-400 mt-1">Funcionários c/ saldo</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-t-4 border-t-indigo-500">
          <div className="text-4xl font-bold text-slate-900">{totalDias}</div>
          <div className="text-xs uppercase tracking-widest text-slate-400 mt-1">Total dias pendentes</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-t-4 border-t-red-500">
          <div className="text-4xl font-bold text-red-600">{vencidos}</div>
          <div className="text-xs uppercase tracking-widest text-slate-400 mt-1">Com limite vencido</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-t-4 border-t-orange-400">
          <div className="text-4xl font-bold text-orange-600">{criticos}</div>
          <div className="text-xs uppercase tracking-widest text-slate-400 mt-1">Vencem em 30 dias</div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Funcionário</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Posto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Secretaria</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Supervisor</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-slate-500">Períodos</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-slate-500">Dias pendentes</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Limite + próximo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {saldos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    Nenhum funcionário com saldo de férias pendente
                  </td>
                </tr>
              ) : (
                saldos.map(item => {
                  const dias  = diasParaVencer(item.limite_mais_proximo)
                  const rowBg = item.tem_vencido
                    ? 'bg-red-50 hover:bg-red-100'
                    : dias !== null && dias <= 30
                    ? 'bg-orange-50 hover:bg-orange-100'
                    : dias !== null && dias <= 60
                    ? 'bg-amber-50 hover:bg-amber-100'
                    : 'bg-white hover:bg-slate-50'

                  return (
                    <tr key={item.funcionario_id} className={`transition-colors ${rowBg}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{item.funcionario_nome}</div>
                        <div className="text-xs text-slate-400">{item.funcionario_registro}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.posto_nome}</td>
                      <td className="px-4 py-3 text-slate-600">{item.secretaria}</td>
                      <td className="px-4 py-3 text-slate-600">{item.supervisor_nome}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {item.periodos_pendentes}×
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-lg font-bold ${item.total_dias >= 60 ? 'text-red-600' : item.total_dias >= 30 ? 'text-amber-600' : 'text-slate-900'}`}>
                          {item.total_dias}d
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {item.tem_vencido ? (
                          <div>
                            <span className="text-sm font-semibold text-red-700">{formatDate(item.limite_mais_proximo)}</span>
                            <div className="text-xs text-red-600 font-bold mt-0.5">🔴 VENCIDO há {Math.abs(dias!)}d</div>
                          </div>
                        ) : dias !== null && dias <= 30 ? (
                          <div>
                            <span className="text-sm font-semibold text-orange-700">{formatDate(item.limite_mais_proximo)}</span>
                            <div className="text-xs text-orange-600 font-medium mt-0.5">⚠️ {dias}d restantes</div>
                          </div>
                        ) : dias !== null && dias <= 60 ? (
                          <div>
                            <span className="text-sm text-amber-700">{formatDate(item.limite_mais_proximo)}</span>
                            <div className="text-xs text-amber-600 mt-0.5">⏰ {dias}d restantes</div>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-600">{formatDate(item.limite_mais_proximo)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/ferias?busca=${encodeURIComponent(item.funcionario_nome)}`}
                          className="text-xs text-slate-500 hover:text-slate-800 underline"
                        >
                          Ver férias
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        {totalFuncionarios} funcionários · Total de {totalDias} dias de férias pendentes de gozo ·
        Ordenado: vencidos primeiro, depois por total de dias (maior→menor)
      </p>
    </div>
  )
}
