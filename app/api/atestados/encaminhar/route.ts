import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarEmail } from '@/lib/email'
import { destinosAmbulatorio } from '@/lib/atestados/ambulatorio/destinatarios'
import { montarEmailAmbulatorio, nomeDoAnexo } from '@/lib/atestados/ambulatorio/email'
import { assinaturaConfere } from '@/lib/atestados/ambulatorio/assinatura'
import type { RespostaEncaminhamento } from '@/lib/atestados/ambulatorio/tipos'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_BYTES = 4 * 1024 * 1024
const TIPOS: readonly string[] = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const resposta = (corpo: RespostaEncaminhamento, status = 200) => NextResponse.json(corpo, { status })
const falha = (erro: string, status: number) => resposta({ ok: false, erro }, status)

type AtestadoParaEmail = {
  id: string
  posto_id: string | null
  data_inicio: string
  data_fim: string
  funcionarios: { nome: string; registro: string | null } | null
  postos: { nome: string; secretaria: string | null } | null
  perfis: { nome: string } | null
}

export async function POST(req: Request) {
  const auth = await getUser()
  if (!auth) return falha('Sessão expirada. Entre de novo.', 401)
  if (auth.perfil.role === 'viewer') return falha('Acesso negado.', 403)

  const { para: destinatarios, teste } = destinosAmbulatorio(auth.user.email)
  if (destinatarios.length === 0) return falha('O envio ao ambulatório não está configurado neste ambiente.', 503)

  let arquivo: File | null = null
  let atestadoId = ''
  try {
    const form = await req.formData()
    const campo = form.get('arquivo')
    if (campo instanceof File) arquivo = campo
    atestadoId = String(form.get('atestadoId') ?? '')
  } catch {
    /* corpo inválido: cai nos erros abaixo */
  }
  if (!UUID.test(atestadoId)) return falha('Atestado inválido.', 400)
  if (!arquivo) return falha('Anexe a foto ou o PDF do atestado.', 400)
  if (!TIPOS.includes(arquivo.type)) return falha('Formato não aceito. Envie JPG, PNG, WEBP ou PDF.', 400)
  if (arquivo.size === 0) return falha('O arquivo está vazio.', 400)
  if (arquivo.size > MAX_BYTES) return falha('Arquivo grande demais (máximo 4 MB).', 413)
  const conteudo = Buffer.from(await arquivo.arrayBuffer())
  if (!assinaturaConfere(arquivo.type, conteudo)) return falha('O arquivo não parece uma foto ou PDF válido.', 400)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('atestados')
    .select(`
      id, posto_id, data_inicio, data_fim,
      funcionarios!funcionario_id ( nome, registro ),
      postos!posto_id ( nome, secretaria ),
      perfis!registrado_por ( nome )
    `)
    .eq('id', atestadoId)
    .maybeSingle()
  if (error) {
    console.error('[atestados/encaminhar]', 'CONSULTA_FALHOU')
    return falha('Não foi possível consultar o atestado. Tente de novo.', 500)
  }
  const atestado = data as unknown as AtestadoParaEmail | null
  if (!atestado || !atestado.funcionarios || !atestado.postos) return falha('Atestado não encontrado.', 404)

  // Mesma regra do restante do módulo: admin/coordenador veem tudo; supervisor só o próprio posto.
  if (auth.perfil.role !== 'admin' && auth.perfil.role !== 'coordenador') {
    if (!atestado.posto_id) return falha('Acesso negado.', 403)
    const { data: cfg } = await createClient()
      .from('config_supervisores_postos')
      .select('posto_id')
      .eq('supervisor_id', auth.user.id)
      .eq('posto_id', atestado.posto_id)
      .eq('ativo', true)
      .maybeSingle()
    if (!cfg) return falha('Acesso negado.', 403)
  }

  const { assunto, html } = montarEmailAmbulatorio({
    funcionarioNome: atestado.funcionarios.nome,
    registro: atestado.funcionarios.registro,
    postoNome: atestado.postos.nome,
    secretaria: atestado.postos.secretaria,
    lancadoPor: atestado.perfis?.nome ?? null,
    dataInicio: atestado.data_inicio,
    dataFim: atestado.data_fim,
    teste,
  })

  const enviado = await enviarEmail({
    to: destinatarios,
    subject: assunto,
    html,
    attachments: [{
      filename: nomeDoAnexo(atestado.funcionarios.nome, arquivo.type),
      content: conteudo,
    }],
  })
  if (!enviado) {
    console.error('[atestados/encaminhar]', 'ENVIO_FALHOU', { atestadoId })
    return falha('Não foi possível enviar o e-mail agora. Tente de novo.', 502)
  }

  const enviadoEm = new Date().toISOString()
  const { error: erroGravar } = await admin
    .from('atestados')
    .update({ ambulatorio_enviado_em: enviadoEm, ambulatorio_enviado_por: auth.user.id })
    .eq('id', atestadoId)
  if (erroGravar) {
    // O e-mail já saiu; só o registro do envio falhou.
    console.error('[atestados/encaminhar]', 'GRAVAR_ENVIO_FALHOU', { atestadoId })
  }

  console.info('[atestados/encaminhar] ok', { atestadoId })
  return resposta({ ok: true, enviadoEm })
}
