import type { EmprestimoAtivo } from '@/lib/coberturas-emprestimos'

function fmt(iso: string | null) {
  if (!iso) return 'sem data'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

/**
 * Funcionários em cobertura temporária em outro posto. Existe porque, enquanto emprestado,
 * o funcionário aparece só no posto destino — quem cedeu (supervisor de origem) não o
 * encontraria em lugar nenhum da lista.
 */
export function EmprestimosBanner({
  emprestimos,
  titulo,
}: {
  emprestimos: EmprestimoAtivo[]
  titulo: string
}) {
  if (emprestimos.length === 0) return null

  return (
    <details className="rounded-xl border border-gray-100 border-t-4 border-t-indigo-500 bg-white p-3 shadow-sm" open>
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-slate-500">
        {titulo} ({emprestimos.length})
      </summary>
      <ul className="mt-3 divide-y divide-gray-100">
        {emprestimos.map(e => (
          <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 text-sm">
            <span className="font-semibold text-gray-900">{e.funcionario_nome}</span>
            <span className="text-xs text-gray-500">
              {e.posto_origem_nome ?? '—'} → <span className="font-medium text-gray-700">{e.posto_destino_nome ?? '—'}</span>
              {e.supervisor_destino_nome ? ` (${e.supervisor_destino_nome})` : ''}
              {' · '}retorna em {fmt(e.data_prev_retorno)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}
