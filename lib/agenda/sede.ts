// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }

/** Id do posto da sede/base (ADM). Null se não houver ou se a migração 20261013 ainda não foi aplicada. */
export async function buscarSedeId(admin: AnyClient): Promise<string | null> {
  const { data, error } = await admin.from('postos').select('id').eq('sede_base', true).maybeSingle()
  if (error || !data) return null
  return data.id as string
}
