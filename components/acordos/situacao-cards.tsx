import { Lightbulb } from 'lucide-react'
import type { TemplateId } from '@/lib/acordos/tipos'
import { GRUPO_TRABALHOU, SITUACOES } from '@/lib/acordos/situacoes'

const OUTRAS: TemplateId[] = ['T2', 'T3', 'T4']

interface Props {
  /** null enquanto o usuário não escolheu. */
  selecionado: TemplateId | null
  onSelect: (id: TemplateId) => void
}

interface CartaoProps {
  ativo: boolean
  onClick: () => void
  titulo: string
  tag: string
  exemplo: string
  regra: string
  radio?: boolean
}

/** Mesmo tratamento visual para todas as opções: só o estado selecionado usa cor (nada de rótulo carregar cor própria). */
function Cartao({ ativo, onClick, titulo, tag, exemplo, regra, radio = true }: CartaoProps) {
  return (
    <button
      type="button"
      role={radio ? 'radio' : undefined}
      aria-checked={radio ? ativo : undefined}
      aria-pressed={radio ? undefined : ativo}
      onClick={onClick}
      className={`flex flex-col gap-1.5 rounded-xl border p-3 text-left transition ${
        ativo ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-slate-50/60'
      }`}
    >
      <span className="text-sm font-semibold leading-snug text-slate-900">{titulo}</span>
      <span className="w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{tag}</span>
      <span className="flex items-start gap-1.5 text-xs italic text-gray-500">
        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
        {exemplo}
      </span>
      <span className="text-xs text-slate-500">{regra}</span>
    </button>
  )
}

export function SituacaoCards({ selecionado, onSelect }: Props) {
  const mostrarSub = selecionado !== null && GRUPO_TRABALHOU.templates.includes(selecionado)

  return (
    <div className="space-y-2.5">
      <div role="radiogroup" aria-label="O que aconteceu?" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Cartao
          ativo={mostrarSub}
          onClick={() => { if (!mostrarSub) onSelect(GRUPO_TRABALHOU.templates[0]) }}
          titulo={GRUPO_TRABALHOU.titulo}
          tag={GRUPO_TRABALHOU.tag}
          exemplo={GRUPO_TRABALHOU.exemplo}
          regra={GRUPO_TRABALHOU.regra}
        />
        {OUTRAS.map(id => {
          const s = SITUACOES[id]
          return (
            <Cartao
              key={id}
              ativo={selecionado === id}
              onClick={() => onSelect(id)}
              titulo={s.titulo}
              tag={s.tag}
              exemplo={s.exemplo}
              regra={s.regra}
            />
          )
        })}
      </div>

      {mostrarSub && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Como vão descansar?</p>
          <div role="radiogroup" aria-label="Como vão descansar?" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {GRUPO_TRABALHOU.templates.map(id => {
              const s = SITUACOES[id]
              return (
                <Cartao
                  key={id}
                  ativo={selecionado === id}
                  onClick={() => onSelect(id)}
                  titulo={s.opcao ?? s.titulo}
                  tag={s.tag}
                  exemplo={s.exemplo}
                  regra={s.regra}
                />
              )
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Só compensação em tempo (sem pagamento). Vale para 5x2 e 5x1; RH valida os limites.
      </p>
    </div>
  )
}
