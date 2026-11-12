import { setorEstaAutenticado } from '@/lib/setores/auth'
import { PinForm } from '@/components/setores/pin-form'
import { BuscaClient } from '@/components/setores/busca-client'

const SLUG = 'seguranca-trabalho'
const TITULO = 'Segurança do Trabalho'

export default function SegurancaTrabalhoPage() {
  if (!setorEstaAutenticado(SLUG)) {
    return <PinForm slug={SLUG} titulo={TITULO} />
  }
  return <BuscaClient slug={SLUG} titulo={TITULO} />
}
