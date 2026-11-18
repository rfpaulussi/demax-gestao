// Verificação em lote dos endereços dos postos no Google. Servidor apenas.
// Só preenche a SUGESTÃO do Google (geo_google_*): o ponto oficial de nenhum posto é alterado.
// O cliente chama em blocos pequenos (cabem no tempo da função) e acompanha o progresso.

import { geocodificarPostoCore, type SaidaGeocodificacao } from './geocodificar-posto'
import { hashEndereco, limparEnderecoBusca } from './endereco'
import type { AnyClient } from './historico'

export const TAMANHO_BLOCO = 10
const CONCORRENCIA = 4

export type SituacaoLote = 'forte' | 'ambiguo' | 'nao_encontrado' | 'erro' | 'cache' | 'sem_endereco'

export type ItemLote = {
  id: string
  nome: string
  situacao: SituacaoLote
  divergenciaM: number | null // distância do pino atual até o endereço do Google
  erro?: string
}

type LinhaPosto = {
  id: string
  nome: string
  endereco_busca: string | null
  endereco_ref: string | null
  geo_status: string | null
  geo_endereco_hash: string | null
  geo_google_lat: number | null
  geo_google_expira_em: string | null
}

/** Texto a enviar ao Google: o endereço digitado para validação ou, na falta, a referência já cadastrada. */
export function enderecoDoPosto(p: Pick<LinhaPosto, 'endereco_busca' | 'endereco_ref'>): string {
  return limparEnderecoBusca(p.endereco_busca ?? p.endereco_ref ?? '')
}

/** Decide quais postos precisam de consulta: tem endereço, não tem sugestão vigente e não é um "não encontrado" já tentado. */
export function selecionarPendentes(linhas: LinhaPosto[], agora: number = Date.now()) {
  const ids: { id: string; nome: string }[] = []
  let semEndereco = 0
  let jaConsultados = 0
  for (const p of linhas) {
    const endereco = enderecoDoPosto(p)
    if (endereco.length < 5) { semEndereco++; continue }
    const vigente = p.geo_google_lat != null && !!p.geo_google_expira_em && Date.parse(p.geo_google_expira_em) > agora
    const jaNaoEncontrado = p.geo_status === 'nao_encontrado' && p.geo_endereco_hash === hashEndereco(endereco)
    if (vigente || jaNaoEncontrado) { jaConsultados++; continue }
    ids.push({ id: p.id, nome: p.nome })
  }
  return { ids, semEndereco, jaConsultados }
}

const COLUNAS = 'id, nome, endereco_busca, endereco_ref, geo_status, geo_endereco_hash, geo_google_lat, geo_google_expira_em'

export async function listarPendentesGeo(db: AnyClient) {
  const todos: LinhaPosto[] = []
  // 221 postos hoje; paginado por segurança contra o limite de 1000 linhas do PostgREST.
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db
      .from('postos')
      .select(COLUNAS)
      .eq('ativo', true)
      .not('nome', 'ilike', 'AFASTADO%') // grupos de afastados não são locais físicos
      .order('nome')
      .range(de, de + 999)
    if (error) return { ok: false as const, erro: 'Recurso indisponível: aplique a migração 20261118_postos_geocodificacao.sql no Supabase Studio.' }
    todos.push(...((data ?? []) as LinhaPosto[]))
    if ((data ?? []).length < 1000) break
  }
  return { ok: true as const, total: todos.length, ...selecionarPendentes(todos) }
}

function situacaoDe(r: SaidaGeocodificacao): { situacao: SituacaoLote; divergenciaM: number | null; fatal?: string } {
  if (r.ok) {
    const d = r.escolhido?.distanciaPinoM ?? null
    if (r.fonte === 'cache') return { situacao: 'cache', divergenciaM: d }
    return { situacao: r.classe === 'forte' ? 'forte' : 'ambiguo', divergenciaM: d }
  }
  if (r.motivo === 'nao_encontrado' || r.motivo === 'nao_encontrado_cache') return { situacao: 'nao_encontrado', divergenciaM: null }
  if (r.motivo === 'sem_endereco') return { situacao: 'sem_endereco', divergenciaM: null }
  // Cota estourada, chave ausente ou recusada: não adianta insistir nos demais.
  if (r.motivo === 'cota' || r.motivo === 'sem_chave' || r.motivo === 'negado' || r.motivo === 'migracao') {
    return { situacao: 'erro', divergenciaM: null, fatal: r.erro }
  }
  return { situacao: 'erro', divergenciaM: null }
}

export async function geocodificarLoteCore(
  db: AnyClient,
  ids: string[],
  usuarioId: string,
): Promise<{ ok: true; itens: ItemLote[]; fatal?: string } | { ok: false; erro: string }> {
  const unicos = Array.from(new Set(ids)).slice(0, TAMANHO_BLOCO)
  if (unicos.length === 0) return { ok: true, itens: [] }

  const { data, error } = await db.from('postos').select('id, nome, endereco_busca, endereco_ref').in('id', unicos)
  if (error) return { ok: false, erro: 'Recurso indisponível: aplique a migração 20261118_postos_geocodificacao.sql no Supabase Studio.' }
  const linhas = (data ?? []) as Pick<LinhaPosto, 'id' | 'nome' | 'endereco_busca' | 'endereco_ref'>[]

  const itens: ItemLote[] = []
  let fatal: string | undefined
  let proximo = 0
  const trabalhar = async () => {
    while (proximo < linhas.length && !fatal) {
      const p = linhas[proximo++]
      const endereco = enderecoDoPosto(p)
      if (endereco.length < 5) { itens.push({ id: p.id, nome: p.nome, situacao: 'sem_endereco', divergenciaM: null }); continue }
      const r = await geocodificarPostoCore(db, p.id, { usuarioId, endereco })
      const s = situacaoDe(r)
      if (s.fatal) fatal = s.fatal
      itens.push({ id: p.id, nome: p.nome, situacao: s.situacao, divergenciaM: s.divergenciaM, erro: r.ok ? undefined : r.erro })
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCORRENCIA, linhas.length) }, trabalhar))
  return { ok: true, itens, fatal }
}
