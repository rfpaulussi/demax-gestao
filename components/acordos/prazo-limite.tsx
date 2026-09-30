import { fmtDataBR } from '@/lib/acordos/tempo'
import { PRAZO_MAXIMO_MESES } from '@/lib/acordos/regras'
import { INPUT_CLS, INPUT_ERRO_CLS, Passo } from './passo'

interface Props {
  numero: number
  obrigatorio: boolean
  valor: string
  onChange: (v: string) => void
  /** Mensagem do validador a exibir em vermelho (null = sem erro visível). */
  erro: string | null
  /** Data máxima permitida (menor data do acordo + 6 meses). */
  max: string | null
  /** "Preencher automaticamente": o prazo acompanha a última data do acordo. */
  auto: boolean
  onAuto: (v: boolean) => void
  /** Última data do acordo (vazio enquanto não há datas). */
  sugerido: string
}

export function PrazoLimite({ numero, obrigatorio, valor, onChange, erro, max, auto, onAuto, sugerido }: Props) {
  const titulo = (
    <>
      Prazo limite{' '}
      {obrigatorio
        ? <span className={erro ? 'text-red-600' : 'text-slate-500'}>· obrigatório</span>
        : <span className="font-normal text-slate-500">· opcional</span>}
    </>
  )
  return (
    <Passo id="passo-prazo" numero={numero} titulo={titulo} erro={!!erro} feito={!erro && !!valor}>
      <div>
        <label htmlFor="campo-prazo" className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Até quando?</label>
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={auto} onChange={e => onAuto(e.target.checked)} className="accent-slate-900" />
          Preencher automaticamente
          <span className="text-xs text-gray-400">{sugerido ? '(última data do acordo)' : '(aparece quando houver datas)'}</span>
        </label>
        <input
          id="campo-prazo"
          type="date"
          value={valor}
          disabled={auto}
          max={max ?? undefined}
          onChange={e => onChange(e.target.value)}
          className={`max-w-xs ${erro ? INPUT_ERRO_CLS : INPUT_CLS}`}
          aria-invalid={!!erro}
        />
        {erro ? (
          <p className="mt-1.5 text-xs font-medium text-red-600">
            {erro} Máximo de {PRAZO_MAXIMO_MESES} meses{max ? `: ${fmtDataBR(max)}` : ''}.
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-gray-400">
            Data em que a compensação precisa estar concluída. Máximo de {PRAZO_MAXIMO_MESES} meses{max ? ` (até ${fmtDataBR(max)})` : ''}.
          </p>
        )}
      </div>
    </Passo>
  )
}
