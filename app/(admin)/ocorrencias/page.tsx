import { createClient } from '@/lib/supabase/server'
import { OcorrenciasTable } from '@/components/ocorrencias/ocorrencias-table'
import type { OcorrenciaRow } from '@/components/ocorrencias/ocorrencias-table'

function CounterCard({ label, value, topColor }: { label: string; value: number; topColor: string }) {
  return (
    <div className={`rounded-xl border border-gray-100 border-t-4 bg-white p-5 shadow-sm ${topColor}`}>
      <p className="text-4xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

export default async function OcorrenciasAdminPage({
  searchParams,
}: {
  searchParams: { gravidade?: string; status?: string; secretaria?: string }
}) {
  const supabase = createClient()

  const { data: raw } = await supabase
    .from('ocorrencias')
    .select(`
      id, descricao, gravidade, status, created_at,
      postos!posto_id ( id, nome, secretaria ),
      perfis!supervisor_id ( id, nome )
    `)
    .order('created_at', { ascending: false })

  const ocorrencias = (raw ?? []) as unknown as OcorrenciaRow[]

  const secretarias = Array.from(
    new Set(
      ocorrencias
        .map(o => o.postos?.secretaria)
        .filter((s): s is string => Boolean(s)),
    ),
  ).sort()

  const total = ocorrencias.length
  const abertas = ocorrencias.filter(o => o.status === 'aberta').length
  const emAnalise = ocorrencias.filter(o => o.status === 'em_analise').length
  const encerradas = ocorrencias.filter(o => o.status === 'encerrada').length

  let filtered = ocorrencias

  if (searchParams.gravidade) {
    filtered = filtered.filter(o => o.gravidade === searchParams.gravidade)
  }
  if (searchParams.status) {
    filtered = filtered.filter(o => o.status === searchParams.status)
  }
  if (searchParams.secretaria) {
    filtered = filtered.filter(o => o.postos?.secretaria === searchParams.secretaria)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Ocorrências</h1>
        <p className="text-sm text-gray-400">Registro e acompanhamento de ocorrências nos postos</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <CounterCard label="Total" value={total} topColor="border-t-gray-400" />
        <CounterCard label="Abertas" value={abertas} topColor="border-t-red-500" />
        <CounterCard label="Em Análise" value={emAnalise} topColor="border-t-yellow-500" />
        <CounterCard label="Encerradas" value={encerradas} topColor="border-t-green-500" />
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Gravidade</label>
          <select
            name="gravidade"
            defaultValue={searchParams.gravidade ?? ''}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
          >
            <option value="">Todas</option>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Status</label>
          <select
            name="status"
            defaultValue={searchParams.status ?? ''}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
          >
            <option value="">Todos</option>
            <option value="aberta">Aberta</option>
            <option value="em_analise">Em Análise</option>
            <option value="encerrada">Encerrada</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Secretaria</label>
          <select
            name="secretaria"
            defaultValue={searchParams.secretaria ?? ''}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
          >
            <option value="">Todas</option>
            {secretarias.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="h-9 rounded-lg bg-gray-900 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-gray-700"
        >
          Filtrar
        </button>
        <a
          href="/ocorrencias"
          className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-400 hover:bg-gray-50"
        >
          Limpar
        </a>
      </form>

      <OcorrenciasTable ocorrencias={filtered} />
    </div>
  )
}
