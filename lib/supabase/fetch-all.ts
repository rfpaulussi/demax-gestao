type QueryFactory<T> = (
  from: number,
  to: number,
) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/**
 * Pagina automaticamente uma query Supabase até buscar todas as linhas,
 * contornando o max_rows do PostgREST (configurado em 1000 no projeto).
 *
 * A factory recebe (from, to) e deve retornar um builder com .range(from, to)
 * já aplicado — os builders do supabase-js não são reutilizáveis após .range().
 */
export async function fetchAllRows<T>(
  factory: QueryFactory<T>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  let page = 0
  while (true) {
    page++
    const { data, error } = await factory(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    // [DEBUG-PAGINATION]
    console.log(`[DEBUG-PAGINATION] página ${page}: ${data?.length ?? 0} registros (range ${from}–${from + pageSize - 1})`)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  console.log(`[DEBUG-PAGINATION] total geral: ${all.length} registros em ${page} página(s)`)
  return all
}
