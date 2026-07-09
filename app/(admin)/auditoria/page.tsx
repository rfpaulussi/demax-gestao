'use server'

import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

const TIPO_LABEL: Record<string, { label: string; cls: string }> = {
  admissao:           { label: 'Admissão',            cls: 'bg-green-50 text-green-700 ring-green-200'   },
  atestado:           { label: 'Atestado',            cls: 'bg-blue-50 text-blue-700 ring-blue-200'      },
  exclusao_atestado:  { label: 'Exclusão Atestado',   cls: 'bg-red-50 text-red-700 ring-red-200'         },
  ferias:             { label: 'Férias',               cls: 'bg-orange-50 text-orange-700 ring-orange-200'},
  afastamento:        { label: 'Afastamento',         cls: 'bg-amber-50 text-amber-700 ring-amber-200'   },
  retorno_afastamento:{ label: 'Retorno',             cls: 'bg-teal-50 text-teal-700 ring-teal-200'      },
  desligamento:       { label: 'Desligamento',        cls: 'bg-red-50 text-red-700 ring-red-200'         },
  rescisao_indireta:  { label: 'Rescisão Indireta',   cls: 'bg-red-50 text-red-700 ring-red-200'         },
  transferencia:      { label: 'Transferência',       cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200'},
  mudanca_funcao:     { label: 'Mudança de Função',   cls: 'bg-purple-50 text-purple-700 ring-purple-200'},
  promocao:           { label: 'Promoção',            cls: 'bg-purple-50 text-purple-700 ring-purple-200'},
  alteracao_salario:  { label: 'Alteração Salário',   cls: 'bg-purple-50 text-purple-700 ring-purple-200'},
  edicao_direta:      { label: 'Edição Direta',       cls: 'bg-slate-100 text-slate-700 ring-slate-200'  },
  rejeicao:           { label: 'Rejeição',            cls: 'bg-red-50 text-red-700 ring-red-200'         },
  mudanca_supervisor: { label: 'Mudança Supervisor',  cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200'},
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const inputClass = 'flex h-9 rounded-lg border border-gray-200 bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: { usuario?: string; tipo?: string; data_de?: string; data_ate?: string; pagina?: string }
}) {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (auth.perfil.role !== 'admin') redirect('/dashboard')

  const supabase = createClient()
  const pagina = Math.max(1, Number(searchParams.pagina ?? 1))
  const porPagina = 50
  const from = (pagina - 1) * porPagina
  const to   = from + porPagina - 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyQ = { from: (t: string) => any }

  const [{ data: usuariosRaw }, { data: postosRaw }, { data: funcoesRaw }, { data: rows, count }] = await Promise.all([
    (supabase as unknown as AnyQ)
      .from('perfis')
      .select('id, nome, email, role')
      .order('nome'),
    (supabase as unknown as AnyQ)
      .from('postos')
      .select('id, nome'),
    (supabase as unknown as AnyQ)
      .from('funcoes')
      .select('id, nome'),
    (() => {
      let q = (supabase as unknown as AnyQ)
        .from('movimentacoes')
        .select(`
          id, tipo, campo_alterado, valor_antes, valor_depois, created_at,
          executado_por,
          funcionarios!funcionario_id ( nome ),
          perfis!executado_por ( nome, email, role )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (searchParams.usuario) q = q.eq('executado_por', searchParams.usuario)
      if (searchParams.tipo)    q = q.eq('tipo', searchParams.tipo)
      if (searchParams.data_de) q = q.gte('created_at', searchParams.data_de)
      if (searchParams.data_ate) q = q.lte('created_at', searchParams.data_ate + 'T23:59:59')
      return q
    })(),
  ])

  type UsuarioOpt = { id: string; nome: string | null; email: string | null; role: string | null }
  const usuarios = (usuariosRaw ?? []) as UsuarioOpt[]

  const postosMap = new Map<string, string>()
  for (const p of (postosRaw ?? []) as { id: string; nome: string }[]) {
    postosMap.set(p.id, p.nome)
  }

  const funcaoMap = new Map<string, string>()
  for (const f of (funcoesRaw ?? []) as { id: string; nome: string }[]) {
    funcaoMap.set(f.id, f.nome)
  }

  const CAMPO_LABEL: Record<string, string> = {
    posto_id: 'Posto',
    status:   'Status',
    funcao_id:'Função',
    salario:  'Salário',
    solicitacao: 'Solicitação',
    atestado: 'Atestado',
  }

  function resolveValor(campo: string | null, valor: string | null): string {
    if (!valor) return '—'
    if (campo === 'posto_id')  return postosMap.get(valor)  ?? valor.slice(0, 8) + '…'
    if (campo === 'funcao_id') return funcaoMap.get(valor)  ?? valor.slice(0, 8) + '…'
    return valor
  }

  type MovRow = {
    id: string
    tipo: string
    campo_alterado: string | null
    valor_antes: string | null
    valor_depois: string | null
    created_at: string
    executado_por: string | null
    funcionarios: { nome: string } | null
    perfis: { nome: string | null; email: string | null; role: string | null } | null
  }
  const movs = (rows ?? []) as MovRow[]
  const total = count ?? 0
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
      </form>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {movs.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-400">Nenhum registro encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  {['Data/Hora', 'Usuário', 'Tipo', 'Funcionário', 'Campo', 'Antes', 'Depois'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {movs.map(m => {
                  const badge = TIPO_LABEL[m.tipo] ?? { label: m.tipo, cls: 'bg-gray-50 text-gray-600 ring-gray-200' }
                  const executor = m.perfis?.nome ?? m.perfis?.email ?? m.executado_por ?? '—'
                  return (
                    <tr key={m.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3 tabular-nums text-gray-500 whitespace-nowrap">{fmt(m.created_at)}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{executor}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap', badge.cls)}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{m.funcionarios?.nome ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{CAMPO_LABEL[m.campo_alterado ?? ''] ?? m.campo_alterado ?? '—'}</td>
                      <td className="max-w-[180px] px-4 py-3 text-gray-400 truncate">{resolveValor(m.campo_alterado, m.valor_antes)}</td>
                      <td className="max-w-[180px] px-4 py-3 text-gray-700 truncate">{resolveValor(m.campo_alterado, m.valor_depois)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
