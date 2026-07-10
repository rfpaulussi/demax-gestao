import { cn } from '@/lib/utils'
import { getUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import { calcularFechamentoFinanceiro, listarResumosFechamento } from './actions'
import { FechamentoFinClient } from './fechamento-fin-client'

const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtPct(v: number) {
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}%`
}

interface KpiProps {
  label: string
  value: string | number
  borderColor: string
  sub?: string
  subColor?: string
}

function KpiCard({ label, value, borderColor, sub, subColor }: KpiProps) {
  return (
    <div className={cn('rounded-xl border border-gray-100 border-t-4 bg-white p-5 shadow-sm', borderColor)}>
      <p className="text-2xl font-black tracking-tight text-gray-900">{value}</p>
      {sub && (
        <p className={cn('mt-0.5 text-xs font-semibold', subColor ?? 'text-gray-400')}>{sub}</p>
      )}
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

export default async function FechamentoFinanceiroPage({
  searchParams,
}: {
  searchParams: { mes?: string; ano?: string; excluirAprendiz?: string }
}) {
  const userCtx = await getUser()
  if (!userCtx || !['admin', 'coordenador'].includes(userCtx.perfil.role ?? '')) {
    redirect('/dashboard')
  }

  const now = new Date()
  const mes = Number(searchParams.mes ?? now.getMonth() + 1)
  const ano = Number(searchParams.ano ?? now.getFullYear())
  const excluirAprendiz = searchParams.excluirAprendiz === '1'

  const mesPrev = mes === 1 ? 12 : mes - 1
  const anoPrev = mes === 1 ? ano - 1 : ano
  const opcoes  = { excluirAprendiz }

  const [dados, dadosPrev, resumos] = await Promise.all([
    calcularFechamentoFinanceiro(mes, ano, opcoes),
    calcularFechamentoFinanceiro(mesPrev, anoPrev, opcoes),
    listarResumosFechamento(),
  ])

  const secretarias = Array.from(
    new Set(dados.map(d => d.secretaria).filter((s): s is string => Boolean(s))),
  ).sort()

  const ativos    = dados.filter(d => !d.is_afastado)
  const afastados = dados.filter(d => d.is_afastado)

  const custoTotal      = ativos.reduce((s, d) => s + (d.custo_prop ?? 0), 0)
  const salarioTotal    = ativos.reduce((s, d) => s + d.salario_prop, 0)
  const semCusto        = ativos.filter(d => d.sem_custo).length
  const comDeducao      = ativos.filter(d => d.dias_trabalhados < d.dias_uteis && d.dias_trabalhados > 0).length
  const custoMedio      = ativos.length > 0 ? custoTotal / ativos.length : 0
  const emFerias        = ativos.filter(d => d.em_ferias).length
  const totalDiasFerias = ativos.reduce((s, d) => s + d.dias_ferias, 0)
  const custoExtraFerias = ativos.reduce((s, d) => s + d.custo_ferias_extra, 0)

  const ativosPrev     = dadosPrev.filter(d => !d.is_afastado)
  const custoTotalPrev = ativosPrev.reduce((s, d) => s + (d.custo_prop ?? 0), 0)
  const deltaPct       = custoTotalPrev > 0 ? ((custoTotal - custoTotalPrev) / custoTotalPrev) * 100 : null
  const deltaPctStr    = deltaPct != null ? fmtPct(deltaPct) : null
  const deltaCor       = deltaPct == null ? 'text-gray-400' : deltaPct > 0 ? 'text-red-500' : 'text-green-600'

  const anos = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  const kpis = {
    custoTotal, salarioTotal,
    ativos: ativos.length, afastados: afastados.length,
    emFerias, diasFerias: totalDiasFerias, custoFerias: custoExtraFerias,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Fechamento Financeiro</h1>
        <p className="text-sm text-gray-400">Custo proporcional por funcionário — {MESES[mes]} {ano}</p>
      </div>

      {/* KPIs — linha 1: financeiros */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Custo Total"
          value={fmtBRL(custoTotal)}
          borderColor="border-t-indigo-500"
          sub={deltaPctStr ? `${deltaPctStr} vs ${MESES[mesPrev]}` : undefined}
          subColor={deltaCor}
        />
        <KpiCard
          label="Salários Prop."
          value={fmtBRL(salarioTotal)}
          borderColor="border-t-blue-500"
          sub={`vs ${MESES[mesPrev]}: ${fmtBRL(ativosPrev.reduce((s,d) => s + d.salario_prop, 0))}`}
          subColor="text-gray-400"
        />
        <KpiCard
          label="Custo Médio / Func."
          value={fmtBRL(custoMedio)}
          borderColor="border-t-violet-500"
        />
        <KpiCard
          label="Funcionários Ativos"
          value={ativos.length}
          borderColor="border-t-slate-500"
          sub={`${ativosPrev.length} em ${MESES[mesPrev]}`}
          subColor={ativos.length !== ativosPrev.length ? 'text-amber-500' : 'text-gray-400'}
        />
      </div>

      {/* KPIs — linha 2: operacionais */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Com Deduções"
          value={comDeducao}
          borderColor="border-t-amber-500"
          sub="dias trabalhados &lt; dias úteis"
          subColor="text-gray-400"
        />
        <KpiCard
          label="Afastados (excluídos)"
          value={afastados.length}
          borderColor="border-t-gray-400"
          sub="custo não computado"
          subColor="text-gray-400"
        />
        <KpiCard
          label="Sem Encargos"
          value={semCusto}
          borderColor="border-t-red-400"
          sub={semCusto > 0 ? 'preencher em Funções e Salários' : 'todos OK'}
          subColor={semCusto > 0 ? 'text-red-500' : 'text-green-600'}
        />
      </div>

      {/* KPIs — linha 3: férias */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Em Férias no Período"
          value={emFerias}
          borderColor="border-t-orange-400"
          sub={emFerias > 0 ? 'custo inclui terço constitucional' : 'nenhum em férias'}
          subColor={emFerias > 0 ? 'text-orange-500' : 'text-gray-400'}
        />
        <KpiCard
          label="Dias Úteis de Férias"
          value={totalDiasFerias}
          borderColor="border-t-orange-400"
          sub="somatório do período"
          subColor="text-gray-400"
        />
        <KpiCard
          label="Custo Extra (⅓ Férias)"
          value={fmtBRL(custoExtraFerias)}
          borderColor="border-t-amber-400"
          sub="incluído no custo total acima"
          subColor="text-gray-400"
        />
      </div>

      {semCusto > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>{semCusto}</strong>{' '}
          {semCusto === 1 ? 'funcionário com função sem encargos' : 'funcionários com funções sem encargos'} — valores marcados com{' '}
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
        excluirAprendiz={excluirAprendiz}
        resumos={resumos}
        kpis={kpis}
      />
    </div>
  )
}
