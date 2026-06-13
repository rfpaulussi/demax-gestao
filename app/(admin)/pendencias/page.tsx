import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'

type FuncRow = { id: string; nome: string }
type PostoRow = { id: string; nome: string; secretaria: string | null }
type PendenciaRow = {
  id: string
  nome: string
  cpf: string | null
  status: string | null
  data_admissao: string | null
  registro: string | null
  posto_id: string | null
  criado_via: string | null
  funcoes: FuncRow | null
  postos: PostoRow | null
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export default async function PendenciasPage() {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin') redirect('/dashboard')

  const supabase = createClient()

  const { data } = await supabase
    .from('funcionarios')
    .select(`
      id, nome, cpf, status, data_admissao, posto_id, criado_via,
      funcoes!funcao_id ( id, nome ),
      postos!posto_id ( id, nome, secretaria )
    `)
    .neq('status', 'desligado')
    .or('registro.is.null,posto_id.is.null')
    .order('nome')

  const rows = (data ?? []) as unknown as PendenciaRow[]

  // Enrich with registro field (nullable TEXT, may not be in TS types yet)
  type WithRegistro = PendenciaRow & { registro: string | null }
  const pendencias = rows as WithRegistro[]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Pendências de Cadastro</h1>
          <p className="text-sm text-gray-400">
            Funcionários com registro ou posto não preenchidos
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
          <span className="text-sm font-semibold text-amber-700">
            {pendencias.length} pendência{pendencias.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {pendencias.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-sm font-medium text-gray-400">Nenhuma pendência encontrada. ✓</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-slate-50">
              <tr>
                {['Funcionário', 'Função', 'Posto', 'Secretaria', 'Admissão', 'Pendências', 'Ação'].map(col => (
                  <th
                    key={col}
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pendencias.map(p => {
                const semRegistro = !p.registro
                const semPosto    = !p.posto_id
                return (
                  <tr key={p.id} className="bg-white hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900">
                      {p.nome}
                      {p.criado_via === 'solicitacao_admissao' && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          via admissão
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {(p.funcoes as unknown as FuncRow | null)?.nome ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {(p.postos as unknown as PostoRow | null)?.nome ?? (
                        <span className="text-amber-600 font-medium">Sem posto</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {(p.postos as unknown as PostoRow | null)?.secretaria ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-gray-500">
                      {fmt(p.data_admissao)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {semRegistro && (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                            Sem registro
                          </span>
                        )}
                        {semPosto && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Sem posto
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/efetivo/${p.id}`}
                        className="inline-flex items-center gap-1 rounded border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        Completar
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
