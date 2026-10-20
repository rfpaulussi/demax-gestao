import { Document } from '@react-pdf/renderer'
import type { PacoteAdmissao } from '@/lib/admissao/tipos'
import { CadastroPage } from './cadastro-pdf'
import { IntegracaoPage } from './integracao-pdf'
import { VtPage } from './vt-pdf'

export type DocumentoAdmissao = 'cadastro' | 'vt' | 'integracao'

/** Os três documentos da admissão, na ordem de impressão (ou só os pedidos). */
export function PacoteAdmissaoDoc({ pacote, documentos = ['cadastro', 'vt', 'integracao'] }: { pacote: PacoteAdmissao; documentos?: DocumentoAdmissao[] }) {
  return (
    <Document title={`Admissão — ${pacote.dossie.nome}`} author="Demax Gestão">
      {documentos.includes('cadastro') && <CadastroPage pacote={pacote} />}
      {documentos.includes('vt') && <VtPage pacote={pacote} />}
      {documentos.includes('integracao') && <IntegracaoPage pacote={pacote} />}
    </Document>
  )
}

const NOMES_ARQUIVO: Record<DocumentoAdmissao, string> = { cadastro: 'cadastro', vt: 'vt', integracao: 'integracao' }

/** Gera o PDF no navegador e baixa. `documentos` omitido = os três juntos. */
export async function baixarPacoteAdmissaoPDF(pacote: PacoteAdmissao, documentos?: DocumentoAdmissao[]): Promise<void> {
  const { pdf } = await import('@react-pdf/renderer')
  const blob = await pdf(<PacoteAdmissaoDoc pacote={pacote} documentos={documentos} />).toBlob()
  const url = URL.createObjectURL(blob)
  const nome = pacote.dossie.nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
  const sufixo = documentos && documentos.length === 1 ? NOMES_ARQUIVO[documentos[0]] : 'admissao'
  const a = document.createElement('a')
  a.href = url
  a.download = `${sufixo}_${nome || 'funcionario'}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
