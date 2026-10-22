import { prepararArquivo } from '@/lib/atestados/leitura/reduzir-imagem'
import type { RespostaEncaminhamento } from './tipos'

/** Envia o atestado ao ambulatório (navegador → rota). Nunca lança: devolve `{ ok: false, erro }`. */
export async function enviarAoAmbulatorio(atestadoId: string, arquivo: File): Promise<RespostaEncaminhamento> {
  try {
    const pronto = await prepararArquivo(arquivo)
    const corpo = new FormData()
    corpo.set('arquivo', pronto)
    corpo.set('atestadoId', atestadoId)
    const resp = await fetch('/api/atestados/encaminhar', { method: 'POST', body: corpo })
    // Sem sessão, o middleware redireciona para /login e a resposta volta como HTML, não JSON.
    if (resp.redirected || !(resp.headers.get('content-type') ?? '').includes('application/json')) {
      return {
        ok: false,
        erro: resp.redirected || resp.status === 401
          ? 'Sua sessão pode ter expirado. Recarregue a página e tente de novo.'
          : resp.status === 413
            ? 'O arquivo é grande demais (máximo 4 MB). Use uma foto menor ou um PDF mais leve.'
            : 'Não foi possível enviar agora. Tente de novo.',
      }
    }
    return (await resp.json()) as RespostaEncaminhamento
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Não foi possível enviar agora. Tente de novo.' }
  }
}
