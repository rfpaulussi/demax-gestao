import { Lightbulb, Scale } from 'lucide-react'
import type { TemplateId } from '@/lib/acordos/tipos'
import { SITUACOES, type CorSituacao } from '@/lib/acordos/situacoes'

const ORDEM: TemplateId[] = ['T1', 'T2', 'T3', 'T4', 'T5']

// Classes estáticas para o Tailwind enxergar cada uma
const BORDA: Record<CorSituacao, string> = {
  blue: 'border-l-blue-500',
  amber: 'border-l-amber-500',
  orange: 'border-l-orange-500',
  indigo: 'border-l-indigo-500',
  green: 'border-l-green-500',
}
const TAG: Record<CorSituacao, string> = {
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  orange: 'bg-orange-50 text-orange-700',
  indigo: 'bg-indigo-50 text-indigo-700',
  green: 'bg-green-50 text-green-700',
}

interface Props {
  /** null enquanto o usuário não escolheu. */
  selecionado: TemplateId | null
  onSelect: (id: TemplateId) => void
}

export function SituacaoCards({ selecionado, onSelect }: Props) {
  return (
    <div className="space-y-2.5">
    <div role="radiogroup" aria-label="O que aconteceu?" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {ORDEM.map(id => {
        const s = SITUACOES[id]
        const ativo = selecionado === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onSelect(id)}
            className={`flex flex-col gap-2 rounded-xl border border-l-4 p-3 text-left transition ${BORDA[s.cor]} ${
              ativo ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-slate-50/60'
            }`}
          >
            <span className="text-sm font-semibold leading-snug text-slate-900">{s.titulo}</span>
            <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${TAG[s.cor]}`}>{s.tag}</span>
            <span className="flex items-start gap-1.5 text-xs italic text-gray-500">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
              {s.exemplo}
            </span>
            <span className="flex items-start gap-1.5 text-xs text-slate-600">
              <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              {s.regra}
            </span>
          </button>
        )
      })}
    </div>
    <p className="text-xs text-gray-500">
      Só compensação em tempo, sem pagamento de horas. Vale para escalas 5x2 e 5x1 (12x36 e jovem aprendiz ficam de fora). Convenção coletiva pode alterar os limites: o RH valida.
    </p>
    </div>
  )
}
