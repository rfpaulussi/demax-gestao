'use server'

import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { buscarMovimentacoesPaginado } from '@/lib/auditoria/query'
import { TIPO_LABEL } from '@/lib/auditoria/format'
import { TabelaAuditoria } from '@/components/auditoria/tabela-auditoria'
import { ExportAuditoriaButton } from '@/components/auditoria/export-button'

const inputClass = 'flex h-9 rounded-lg border border-gray-200 bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: { usuario?: string; tipo?: string; data_de?: string; data_ate?: string; busca?: string; pagina?: string }
}) {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (auth.perfil.role !== 'admin') redirect('/dashboard')

  const supabase = createClient()
  const pagina = Math.max(1, Number(searchParams.pagina ?? 1))
  const porPagina = 50

  const filtros = {
    usuario: searchParams.usuario,
    tipo: searchParams.tipo,
    data_de: searchParams.data_de,
    data_ate: searchParams.data_ate,
    busca: searchParams.busca,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyQ = { from: (t: string) => any }

  const [{ data: usuariosRaw }, { movs, total }] = await Promise.all([
    (supabase as unknown as AnyQ)
      .from('perfis')
      .select('id, nome, email, role')
      .order('nome'),
    buscarMovimentacoesPaginado(filtros, pagina, porPagina),
  ])

  type UsuarioOpt = { id: string; nome: string | null; email: string | null; role: string | null }
  const usuarios = (usuariosRaw ?? []) as UsuarioOpt[]

  const totalPaginas = Math.ceil(total / porPagina)
  const tiposUnicos = Object.keys(TIPO_LABEL)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Auditoria</h1>
        <p className="text-sm text-gray-400">Log de ações realizadas no sistema</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-t-4 border-gray-100 border-t-slate-500 bg-white p-5 shadow-sm">
          <p className="text-2xl font-black tracking-tight text-gray-900">{total}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Registros encontrados</p>
        </div>
        <div className="rounded-xl border border-t-4 border-gray-100 border-t-indigo-500 bg-white p-5 shadow-sm">
          <p className="text-2xl font-black tracking-tight text-gray-900">{usuarios.length}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Usuários ativos</p>
        </div>
        <div className="rounded-xl border border-t-4 border-gray-100 border-t-purple-500 bg-white p-5 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-2xl font-black tracking-tight text-gray-900">{tiposUnicos.length}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Tipos de ação</p>
        </div>
      </div>

      {/* Filtros */}
      <form method="get" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
        <input
          type="text"
          name="busca"
          defaultValue={searchParams.busca ?? ''}
          placeholder="Buscar por nome ou RE..."
          className={cn(inputClass, 'col-span-2 w-full sm:w-52')}
        />
        <select name="usuario" defaultValue={searchParams.usuario ?? ''} className={cn(inputClass, 'col-span-2 w-full sm:w-52')}>
          <option value="">Todos os usuários</option>
          {usuarios.map(u => (
            <option key={u.id} value={u.id}>
              {u.nome ?? u.email ?? u.id}
            </option>
          ))}
        </select>
        <select name="tipo" defaultValue={searchParams.tipo ?? ''} className={cn(inputClass, 'col-span-2 w-full sm:w-48')}>
          <option value="">Todos os tipos</option>
          {tiposUnicos.map(t => (
            <option key={t} value={t}>{TIPO_LABEL[t]?.label ?? t}</option>
          ))}
        </select>
        <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
          <input type="date" name="data_de"  defaultValue={searchParams.data_de}  className={cn(inputClass, 'w-full sm:w-36')} title="A partir de" />
          <span className="shrink-0 text-sm text-gray-400">até</span>
          <input type="date" name="data_ate" defaultValue={searchParams.data_ate} className={cn(inputClass, 'w-full sm:w-36')} title="Até" />
        </div>
        <button type="submit" className="flex h-9 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 sm:w-auto">
          Filtrar
        </button>
        <a href="/auditoria" className="flex h-9 w-full items-center justify-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50 sm:w-auto">
          Limpar
        </a>
        <div className="col-span-2 sm:col-span-1 sm:ml-auto">
          <ExportAuditoriaButton filtros={filtros} />
        </div>
      </form>

      {/* Tabela */}
      <TabelaAuditoria movs={movs} />

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Página {pagina} de {totalPaginas} — {total} registros
          </p>
          <div className="flex gap-2">
            {pagina > 1 && (
              <a
                href={`/auditoria?${new URLSearchParams({ ...searchParams, pagina: String(pagina - 1) })}`}
                className="flex h-8 items-center rounded-lg border border-gray-200 px-3 text-sm text-gray-600 hover:bg-gray-50"
              >
                ← Anterior
              </a>
            )}
            {pagina < totalPaginas && (
              <a
                href={`/auditoria?${new URLSearchParams({ ...searchParams, pagina: String(pagina + 1) })}`}
                className="flex h-8 items-center rounded-lg border border-gray-200 px-3 text-sm text-gray-600 hover:bg-gray-50"
              >
                Próxima →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
