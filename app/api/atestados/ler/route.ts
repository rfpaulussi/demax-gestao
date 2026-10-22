import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { ErroIA, iaConfigurada } from '@/lib/acordos/ia/cliente'
import { lerAtestado, type TipoArquivoAtestado } from '@/lib/atestados/leitura/ler'
import { prepararPreenchimento } from '@/lib/atestados/leitura/normalizar'
import { casarFuncionarios } from '@/lib/atestados/leitura/casar-funcionario'
import { carregarFuncionariosVisiveis } from '@/lib/atestados/leitura/funcionarios-visiveis'
import { removerCpf } from '@/lib/atestados/leitura/privacidade'
import type { RespostaLeitura } from '@/lib/atestados/leitura/tipos'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const MAX_BYTES = 4 * 1024 * 1024
const TIPOS: readonly string[] = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

const resposta = (corpo: RespostaLeitura, status = 200) => NextResponse.json(corpo, { status })
const falha = (erro: string, status: number) => resposta({ ok: false, erro }, status)

/** Códigos que `normalizarCid` pode procurar para o texto lido: como veio, completo e categoria. */
function candidatosCid(lido: string | null): string[] {
  if (!lido) return []
  const limpo = lido.replace(/\s+/g, '').toUpperCase().replace(/^CID(?:-?10)?[:.\-]*/, '')
  if (!limpo) return []
  const out = new Set<string>([limpo])
  const m = /^([A-Z])(\d{2})[.,\-/]?(\d{1,2})?$/.exec(limpo)
  if (m) {
    const categoria = `${m[1]}${m[2]}`
    out.add(categoria)
    if (m[3]) out.add(`${categoria}.${m[3]}`)
  }
  return Array.from(out)
}

export async function POST(req: Request) {
  const auth = await getUser()
  if (!auth) return falha('Sessão expirada. Entre de novo.', 401)
  if (auth.perfil.role === 'viewer') return falha('Acesso negado.', 403)
  if (!iaConfigurada()) return falha('A leitura por IA não está configurada neste ambiente.', 503)

  let arquivo: File | null = null
  try {
    const campo = (await req.formData()).get('arquivo')
    if (campo instanceof File) arquivo = campo
  } catch {
    /* corpo inválido: cai no erro abaixo */
  }
  if (!arquivo) return falha('Envie a foto do atestado.', 400)
  if (!TIPOS.includes(arquivo.type)) return falha('Formato não aceito. Envie JPG, PNG, WEBP ou PDF.', 400)
  if (arquivo.size > MAX_BYTES) return falha('Arquivo grande demais (máximo 4 MB).', 413)

  const base64 = Buffer.from(await arquivo.arrayBuffer()).toString('base64')
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

  try {
    const { leitura, tokensEntrada, tokensSaida } = await lerAtestado(base64, arquivo.type as TipoArquivoAtestado, hoje)

    const [funcionarios, { data: cids, error: erroCid }] = await Promise.all([
      carregarFuncionariosVisiveis(auth),
      // A tabela tem milhares de CIDs: consulta só o código lido e suas variações (exato e categoria).
      createClient().from('cid_referencia').select('codigo').in('codigo', candidatosCid(leitura.cid)),
    ])
    if (erroCid) {
      console.error('[atestados/ler]', 'CID_REFERENCIA_FALHOU')
      return falha('Não foi possível consultar a referência de CID. Tente de novo.', 500)
    }
    const codigosCid = new Set((cids ?? []).map(c => c.codigo as string))

    const { candidatos, automatico } = casarFuncionarios(leitura, funcionarios)
    console.info('[atestados/ler] ok', { tokensEntrada, tokensSaida })
    return resposta({
      ok: true,
      documento: {
        tipo: leitura.tipoDocumento,
        observacao: removerCpf(leitura.observacao),
        pacienteNome: removerCpf(leitura.pacienteNome),
        pacienteMenor: leitura.pacienteMenor,
        maeNome: removerCpf(leitura.maeNome),
      },
      preenchimento: prepararPreenchimento(leitura, hoje, codigosCid),
      candidatos,
      automatico,
    })
  } catch (e) {
    // Sem nome, CPF ou CID no log: só o código do erro.
    console.error('[atestados/ler]', e instanceof ErroIA ? e.codigo : 'ERRO_INESPERADO')
    if (e instanceof ErroIA) {
      // Só o aviso de limite de taxa é repassado; as demais mensagens podem citar configuração interna.
      const msg = e.message.startsWith('Muitos pedidos')
        ? e.message
        : 'A leitura por IA falhou agora. Tente de novo ou escolha o funcionário manualmente.'
      return falha(msg, 502)
    }
    return falha('Não foi possível ler o atestado. Tente de novo ou lance manualmente.', 500)
  }
}
