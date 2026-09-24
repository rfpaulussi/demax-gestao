import { createClient } from '@/lib/supabase/server'
import { buscarFaltasParaConfirmar } from '@/app/(admin)/faltas/actions'
import { FaixaFaltasConfirmar } from './faixa-faltas-confirmar'

export async function FaixaFaltasConfirmarServer() {
  const faltas = await buscarFaltasParaConfirmar()
  if (faltas.length === 0) return null
  const { data } = await createClient().from('cid_referencia').select('codigo, descricao').order('codigo')
  return <FaixaFaltasConfirmar faltas={faltas} cids={(data ?? []) as { codigo: string; descricao: string }[]} />
}
