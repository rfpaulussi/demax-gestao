'use server'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'

export type CidOpt = { codigo: string; descricao: string }

const LIMITE = 30

/** Remove caracteres que têm significado em filtros PostgREST/ILIKE. */
function limparTermo(termo: string): string {
  return termo.replace(/[,()%*\\_"]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** "k050" → "K05.0"; qualquer outro texto é devolvido como está. */
function normalizarCodigo(termo: string): string {
  const t = termo.replace(/\s+/g, '').toUpperCase()
  return /^[A-Z]\d{3}$/.test(t) ? `${t.slice(0, 3)}.${t.slice(3)}` : termo
}

/**
 * Busca CIDs por código (prefixo, com ou sem ponto) ou por trecho da descrição.
 * Devolve no máximo 30 resultados; códigos primeiro, depois descrições.
 */
export async function buscarCids(termo: string): Promise<CidOpt[]> {
  const auth = await getUser()
  if (!auth) return []

  const limpo = limparTermo(termo ?? '')
  if (limpo.length < 2) return []

  const supabase = createClient()
  const porCodigo = await supabase
    .from('cid_referencia')
    .select('codigo, descricao')
    .ilike('codigo', `${normalizarCodigo(limpo)}%`)
    .order('codigo')
    .limit(LIMITE)

  const resultado: CidOpt[] = porCodigo.data ?? []
  if (resultado.length >= LIMITE) return resultado

  const porDescricao = await supabase
    .from('cid_referencia')
    .select('codigo, descricao')
    .ilike('descricao', `%${limpo}%`)
    .order('codigo')
    .limit(LIMITE)

  const vistos = new Set(resultado.map(c => c.codigo))
  for (const c of porDescricao.data ?? []) {
    if (resultado.length >= LIMITE) break
    if (!vistos.has(c.codigo)) resultado.push(c)
  }
  return resultado
}

/** Descrições de códigos específicos (ex.: CIDs já usados em atestados). */
export async function descricoesCids(codigos: string[]): Promise<CidOpt[]> {
  const auth = await getUser()
  if (!auth) return []
  const unicos = Array.from(new Set(codigos.filter(Boolean))).slice(0, 200)
  if (unicos.length === 0) return []
  const { data } = await createClient()
    .from('cid_referencia')
    .select('codigo, descricao')
    .in('codigo', unicos)
  return data ?? []
}
