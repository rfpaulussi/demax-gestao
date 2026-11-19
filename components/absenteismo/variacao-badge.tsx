// components/absenteismo/variacao-badge.tsx
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { fmtVariacaoPct, fmtVariacaoPp } from '@/lib/absenteismo/formatar'

interface Props {
  /** null = sem base de comparação */
  valor: number | null
  /** 'pct' = variação relativa; 'pp' = pontos percentuais (taxas) */
  tipo: 'pct' | 'pp'
  /** ex.: "vs out/26" */
  rotulo: string
}

export function VariacaoBadge({ valor, tipo, rotulo }: Props) {
  if (valor === null) {
    return <p className="mt-1 text-xs text-gray-300">sem base {rotulo}</p>
  }
  const direcao = Math.abs(valor) < 0.005 ? 0 : valor > 0 ? 1 : -1
  const cor = direcao < 0 ? 'text-emerald-600' : direcao > 0 ? 'text-red-600' : 'text-gray-400'
  const Icone = direcao < 0 ? ArrowDown : direcao > 0 ? ArrowUp : Minus
  const texto = tipo === 'pct' ? fmtVariacaoPct(valor) : fmtVariacaoPp(valor)
  return (
    <p className={`mt-1 flex flex-wrap items-center gap-1 text-xs ${cor}`}>
      <Icone className="h-3 w-3" aria-hidden />
      <span className="font-semibold">{texto}</span>
      <span className="text-gray-400">{rotulo}</span>
    </p>
  )
}
