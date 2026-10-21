import { apenasDigitos } from './cpf'
import {
  DOCUMENTOS_ADMISSAO, DOCUMENTOS_DEPENDENTES, MAX_LINHAS_VT, UFS,
  dossieVazio, type CartaoVT, type DossieAdmissao, type LinhaVT, type MotivoAdmissao, type PeriodoExperiencia,
} from './tipos'

const CARTOES: readonly CartaoVT[] = ['nenhum', 'bilhete_unico', 'top', 'outro']
const PERIODOS: readonly PeriodoExperiencia[] = ['nenhum', '30+30', '45+45']
const MOTIVOS: readonly MotivoAdmissao[] = ['aumento_efetivo', 'substituicao']

const texto = (v: unknown, max = 200): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const escolha = <T extends string>(v: unknown, opcoes: readonly T[], padrao: T): T =>
  typeof v === 'string' && (opcoes as readonly string[]).includes(v) ? (v as T) : padrao
const data = (v: unknown): string => {
  const s = texto(v, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''
}

/**
 * O dossiê chega do navegador (ou do rascunho) como JSON qualquer. Antes de gravar em
 * `solicitacoes.dados_depois` forçamos o formato: tipos certos, tamanhos limitados, listas só
 * com valores conhecidos, CPF/CEP só com dígitos.
 */
export function normalizarDossie(bruto: unknown, hoje = new Date().toISOString().slice(0, 10)): DossieAdmissao {
  const r = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
  const vazio = dossieVazio(hoje)

  const linhas: LinhaVT[] = (Array.isArray(r.vt_linhas) ? r.vt_linhas : [])
    .slice(0, MAX_LINHAS_VT)
    .map((l): LinhaVT => {
      const x = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>
      return { tipo: texto(x.tipo, 40), linha: texto(x.linha, 60), empresa: texto(x.empresa, 60), valor: texto(x.valor, 12), qtd: texto(x.qtd, 3) }
    })

  const idsAdmissao = new Set<string>(DOCUMENTOS_ADMISSAO.map(d => d.id))
  const idsDependentes = new Set<string>(DOCUMENTOS_DEPENDENTES.map(d => d.id))
  const lista = (v: unknown, validos: Set<string>) =>
    Array.isArray(v) ? Array.from(new Set(v.filter((x): x is string => typeof x === 'string' && validos.has(x)))) : []

  const ufBruta = texto(r.uf, 2).toUpperCase()
  const diaCurso = Number(r.dia_curso)

  return {
    nome: texto(r.nome, 120).toUpperCase(),
    cpf: apenasDigitos(texto(r.cpf, 20)).slice(0, 11),
    telefone: apenasDigitos(texto(r.telefone, 20)).slice(0, 11),
    email: texto(r.email, 120).toLowerCase(),
    cep: apenasDigitos(texto(r.cep, 12)).slice(0, 8),
    logradouro: texto(r.logradouro, 120),
    numero: texto(r.numero, 15),
    complemento: texto(r.complemento, 60),
    bairro: texto(r.bairro, 60),
    cidade: texto(r.cidade, 60),
    uf: (UFS as readonly string[]).includes(ufBruta) ? ufBruta : '',
    posto_id: texto(r.posto_id, 40),
    funcao_id: texto(r.funcao_id, 40),
    data_admissao: data(r.data_admissao),
    periodo_experiencia: escolha(r.periodo_experiencia, PERIODOS, vazio.periodo_experiencia),
    motivo: escolha(r.motivo, MOTIVOS, vazio.motivo),
    substituido_id: texto(r.substituido_id, 40) || null,
    substituido_nome: texto(r.substituido_nome, 120).toUpperCase(),
    substituido_motivo: texto(r.substituido_motivo, 200),
    substituido_data_desligamento: data(r.substituido_data_desligamento),
    turno_id: texto(r.turno_id, 40),
    dia_curso: Number.isInteger(diaCurso) && diaCurso >= 1 && diaCurso <= 5 ? diaCurso : null,
    contrato: texto(r.contrato, 80),
    centro_custo: texto(r.centro_custo, 60),
    sindicato: texto(r.sindicato, 80),
    cbo: texto(r.cbo, 12),
    setor: texto(r.setor, 80),
    va: texto(r.va, 12),
    vr: texto(r.vr, 12),
    vt_utiliza: r.vt_utiliza === false ? false : true,
    vt_linhas: linhas.length > 0 ? linhas : vazio.vt_linhas,
    vt_cartao: escolha(r.vt_cartao, CARTOES, vazio.vt_cartao),
    vt_cartao_outro: texto(r.vt_cartao_outro, 40),
    uniforme_calca: texto(r.uniforme_calca, 10),
    uniforme_camisa: texto(r.uniforme_camisa, 10),
    uniforme_sapato: texto(r.uniforme_sapato, 10),
    docs: lista(r.docs, idsAdmissao),
    tem_dependentes: r.tem_dependentes === true,
    docs_dependentes: r.tem_dependentes === true ? lista(r.docs_dependentes, idsDependentes) : [],
    data_integracao: data(r.data_integracao) || hoje,
  }
}
