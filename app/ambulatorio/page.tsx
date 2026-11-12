import { setorEstaAutenticado } from '@/lib/setores/auth'
import { PinForm } from '@/components/setores/pin-form'
import { BuscaClient } from '@/components/setores/busca-client'

const SLUG = 'ambulatorio'
const TITULO = 'Ambulatório'

export default function AmbulatorioPage() {
  if (!setorEstaAutenticado(SLUG)) {
    return <PinForm slug={SLUG} titulo={TITULO} />
  }
  return <BuscaClient slug={SLUG} titulo={TITULO} />
}
