/** Uma linha da aba LISTAGEM da planilha do RH, já parseada no browser. */
export type LinhaRH = {
  re: string
  nome: string
  funcao: string
  admissao: string | null       // ISO yyyy-mm-dd
  afastadoEm: string | null     // ISO yyyy-mm-dd, null = ativo
  codigoSupervisor: number
}

/** Um funcionário vindo do nosso banco, já achatado pra comparação. */
export type FuncionarioSistema = {
  id: string
  registro: string | null
  nome: string
  funcao: string | null
  afastado: boolean
  supervisorNome: string | null
}

export type TipoDivergencia =
  | 'so_no_rh'
  | 'so_no_sistema'
  | 'nome_diferente'
  | 're_divergente'
  | 'funcao_diferente'
  | 'afastado_diferente'
  | 'supervisor_diferente'

export type Divergencia = {
  chave: string
  tipos: TipoDivergencia[]
  rh: { re: string | null; nome: string | null; funcao: string | null; afastado: boolean | null; supervisor: string | null }
  sistema: { id: string | null; re: string | null; nome: string | null; funcao: string | null; afastado: boolean | null; supervisor: string | null }
}

export type CelulaResumo = { rh: number; sistema: number }

export type LinhaResumo = {
  funcao: string
  // chave = label do código RH: nome do perfil vinculado (config_codigos_rh.supervisor_id),
  // ou o apelido bruto quando o código ainda não está vinculado a nenhum perfil.
  porSupervisor: Record<string, CelulaResumo>
  afastados: CelulaResumo
  total: CelulaResumo
}

export type ResultadoComparacao = {
  resumo: LinhaResumo[]
  totalGeral: LinhaResumo
  divergencias: Divergencia[]
  codigosSemSupervisorVinculado: number[]
  linhasIgnoradas: number
}

/** Um sinônimo resolvido: forma normalizada (pra comparação) e bruta (pra exibição)
 * da função do sistema equivalente à função do RH usada como chave do map. */
export type SinonimoFuncaoResolvido = { normalizado: string; bruto: string }

/** Resolve o label de exibição/agrupamento de um código RH: quando o código está
 * vinculado a um perfil (config_codigos_rh.supervisor_id), usa o nome real desse
 * perfil — é o que precisa bater com FuncionarioSistema.supervisorNome (também
 * vindo de perfis.nome) pra comparação e resumo agregado funcionarem. Sem vínculo,
 * cai pro apelido bruto cadastrado. Usado tanto em actions.ts (pra montar o Map
 * código->label passado a compararListagem) quanto em page.tsx (pros headers do
 * resumo agregado) — mesma lógica, pra headers e agregação nunca divergirem. */
export function resolverLabelCodigo(apelido: string, nomePerfilVinculado: string | null | undefined): string {
  return nomePerfilVinculado ?? apelido
}
