import { cn } from '@/lib/utils'
import { getUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import { calcularFechamentoFinanceiro } from './actions'
import { FechamentoFinClient } from './fechamento-fin-client'

const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function KpiCard({ label, value, borderColor }: { label: string; value: string | number; borderColor: string }) {
  return (
    <div className={cn('rounded-xl border border-gray-100 border-t-4 bg-white p-5 shadow-sm', borderColor)}>
      <p className="text-2xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

export default async function FechamentoFinanceiroPage({
  searchParams,
}: {
  searchParams: { mes?: string; ano?: string }
}) {
  const userCtx = await getUser()
  if (!userCtx || !['admin', 'coordenador'].includes(userCtx.perfil.role ?? '')) {
    redirect('/dashboard')
  }

  const now = new Date()
  const mes = Number(searchParams.mes ?? now.getMonth() + 1)
  const ano = Number(searchParams.ano ?? now.getFullYear())

  const dados = await calcularFechamentoFinanceiro(mes, ano)

  const secretarias = Array.from(
    new Set(dados.map(d => d.secretaria).filter((s): s is string => Boolean(s))),
  ).sort()

  const custoTotal   = dados.reduce((s, d) => s + (d.custo_prop ?? 0), 0)
  const salarioTotal = dados.reduce((s, d) => s + d.salario_prop, 0)
  const semCusto     = dados.filter(d => d.sem_custo).length
  const totalFunc    = dados.length

  const anos = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Fechamento Financeiro</h1>
        <p className="text-sm text-gray-400">Custo proporcional por funcionário — {MESES[mes]} {ano}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Funcionários"   value={totalFunc}            borderColor="border-t-slate-500" />
        <KpiCard label="Custo Total"    value={fmtBRL(custoTotal)}   borderColor="border-t-indigo-500" />
        <KpiCard label="Salários Prop." value={fmtBRL(salarioTotal)} borderColor="border-t-blue-500" />
        <KpiCard label="Sem Encargos"   value={semCusto}             borderColor="border-t-amber-500" />
      </div>

      {semCusto > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>{semCusto}</strong>{' '}
          {semCusto === 1 ? 'funcionário com função sem encargos cadastrados' : 'funcionários com funções sem encargos cadastrados'} — valores marcados com{' '}
          <strong>—</strong> não entram no custo total.{' '}
          <a href="/funcoes" className="underline font-medium">Preencher em Funções e Salários →</a>
        </div>
      )}

      <FechamentoFinClient
        dados={dados}
        mes={mes}
        ano={ano}
        secretarias={secretarias}
        MESES={MESES}
        anos={anos}
      />
    </div>
  )
}
