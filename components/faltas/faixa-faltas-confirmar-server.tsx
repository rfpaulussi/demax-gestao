import { buscarFaltasParaConfirmar } from '@/app/(admin)/faltas/actions'
import { FaixaFaltasConfirmar } from './faixa-faltas-confirmar'

export async function FaixaFaltasConfirmarServer() {
  const faltas = await buscarFaltasParaConfirmar()
  if (faltas.length === 0) return null
  return <FaixaFaltasConfirmar faltas={faltas} cids={[]} />
}
