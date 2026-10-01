const slug = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** 'acordo_<título>_<supervisor>_<dd-mm-aaaa>.pdf'; sem supervisor, essa parte some. */
export function nomeArquivoAcordo(a: { titulo: string; criado_por_nome: string | null; data_documento: string }): string {
  const [y, m, d] = a.data_documento.slice(0, 10).split('-')
  const partes = ['acordo', slug(a.titulo).slice(0, 80), slug(a.criado_por_nome ?? '').slice(0, 40), y && m && d ? `${d}-${m}-${y}` : '']
  return `${partes.filter(Boolean).join('_')}.pdf`
}
