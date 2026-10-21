import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import { validarCpf } from './cpf'
import { normalizarDossie } from './normalizar'
import { linhaVtPreenchida } from './vt'

/**
 * Passa para o cadastro os dados que o supervisor digitou no assistente de admissão: CPF vai para
 * `funcionarios` e o resto (endereço, contato, VT, uniforme) para `funcionarios_dados_pessoais`.
 * Recebe o client admin (o RLS de dados pessoais é só admin/coord). Devolve a mensagem de erro, ou null.
 * Chamado depois de o funcionário já existir, então um erro aqui não desfaz a admissão — o dossiê
 * continua guardado em `solicitacoes.dados_depois`.
 */
export async function gravarDadosPessoaisDaAdmissao(
  admin: SupabaseClient<Database>,
  funcionarioId: string,
  dossieBruto: unknown,
): Promise<string | null> {
  const d = normalizarDossie(dossieBruto)

  if (validarCpf(d.cpf)) {
    const { error } = await admin.from('funcionarios').update({ cpf: d.cpf }).eq('id', funcionarioId)
    if (error) return `CPF: ${error.message}`
  }

  const { error } = await admin.from('funcionarios_dados_pessoais').upsert({
    funcionario_id: funcionarioId,
    telefone: d.telefone || null,
    email: d.email || null,
    cep: d.cep || null,
    logradouro: d.logradouro || null,
    numero: d.numero || null,
    complemento: d.complemento || null,
    bairro: d.bairro || null,
    cidade: d.cidade || null,
    uf: d.uf || null,
    vt_utiliza: d.vt_utiliza,
    vt_linhas: (d.vt_utiliza ? d.vt_linhas.filter(linhaVtPreenchida) : []) as unknown as Json,
    vt_cartao: d.vt_utiliza ? d.vt_cartao : 'nenhum',
    vt_cartao_outro: d.vt_cartao === 'outro' ? d.vt_cartao_outro || null : null,
    uniforme: { calca: d.uniforme_calca, camisa: d.uniforme_camisa, sapato: d.uniforme_sapato } as unknown as Json,
    updated_at: new Date().toISOString(),
  })
  return error ? `Dados pessoais: ${error.message}` : null
}
