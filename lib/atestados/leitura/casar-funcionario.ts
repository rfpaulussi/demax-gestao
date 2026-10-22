import { apenasDigitos, validarCpf } from '@/lib/admissao/cpf'
import { normalizarNome, similaridadeNomes } from './nomes'

export interface FuncionarioParaCasar {
  id: string
  nome: string
  /** Só para comparar; nunca é devolvido. */
  cpf: string | null
  postoId: string | null
  postoNome: string | null
  funcaoNome: string | null
  status: string | null
}

export interface CandidatoFuncionario {
  id: string
  nome: string
  postoId: string | null
  postoNome: string | null
  funcaoNome: string | null
  status: string | null
  /** 0 a 1 */
  nota: number
  /** Achado pelo nome da mãe (atestado de menor). */
  viaMae: boolean
}

export interface EntradaCasamento {
  pacienteNome: string | null
  pacienteCpf: string | null
  pacienteMenor: boolean | null
  maeNome: string | null
}

export interface ResultadoCasamento {
  candidatos: CandidatoFuncionario[]
  /** id pré-selecionado, ou null quando o supervisor precisa escolher. */
  automatico: string | null
}

export const NOTA_MINIMA = 0.55
export const NOTA_AUTOMATICA = 0.9
export const VANTAGEM_AUTOMATICA = 0.08
export const MAX_CANDIDATOS = 5
/** Só o CPF dá nota 1; casamento por nome fica limitado a este teto. */
export const NOTA_MAXIMA_POR_NOME = 0.99
/** Quantos resultados a busca manual devolve, no máximo. */
export const LIMITE_BUSCA_MANUAL = 15

function paraCandidato(f: FuncionarioParaCasar, nota: number, viaMae: boolean): CandidatoFuncionario {
  return {
    id: f.id, nome: f.nome, postoId: f.postoId, postoNome: f.postoNome, funcaoNome: f.funcaoNome,
    status: f.status, nota, viaMae,
  }
}

const porNota = (a: CandidatoFuncionario, b: CandidatoFuncionario) => b.nota - a.nota || a.nome.localeCompare(b.nome)

export function casarFuncionarios(entrada: EntradaCasamento, funcionarios: FuncionarioParaCasar[]): ResultadoCasamento {
  const menor = entrada.pacienteMenor === true
  const cpf = apenasDigitos(entrada.pacienteCpf ?? '')
  const usarCpf = !menor && validarCpf(cpf)
  const acertosCpf = new Set<string>()
  const candidatos: CandidatoFuncionario[] = []

  for (const f of funcionarios) {
    if (f.status === 'desligado') continue
    if (usarCpf && apenasDigitos(f.cpf ?? '') === cpf) {
      acertosCpf.add(f.id)
      candidatos.push(paraCandidato(f, 1, false))
      continue
    }
    let nota = entrada.pacienteNome ? similaridadeNomes(entrada.pacienteNome, f.nome) : 0
    let viaMae = false
    if (menor && entrada.maeNome) {
      const notaMae = similaridadeNomes(entrada.maeNome, f.nome)
      if (notaMae > nota) { nota = notaMae; viaMae = true }
    }
    // Só o CPF chega a 1: nome igual vale no máximo NOTA_MAXIMA_POR_NOME.
    if (nota >= NOTA_MINIMA) candidatos.push(paraCandidato(f, Math.min(nota, NOTA_MAXIMA_POR_NOME), viaMae))
  }

  candidatos.sort(porNota)
  const lista = candidatos.slice(0, MAX_CANDIDATOS)

  let automatico: string | null = null
  if (acertosCpf.size === 1) {
    automatico = Array.from(acertosCpf)[0]
  } else if (!menor && lista[0] && lista[0].nota >= NOTA_AUTOMATICA && (!lista[1] || lista[0].nota - lista[1].nota >= VANTAGEM_AUTOMATICA)) {
    automatico = lista[0].id
  }
  return { candidatos: lista, automatico }
}

/** Busca manual: pedaço do nome (3+ letras) ou nome parecido. */
export function buscarPorNome(termo: string, funcionarios: FuncionarioParaCasar[], limite = LIMITE_BUSCA_MANUAL): CandidatoFuncionario[] {
  const t = normalizarNome(termo)
  if (t.length < 3) return []
  return funcionarios
    .filter(f => f.status !== 'desligado')
    .map(f => paraCandidato(f, normalizarNome(f.nome).includes(t) ? 1 : similaridadeNomes(termo, f.nome), false))
    .filter(c => c.nota >= NOTA_MINIMA)
    .sort(porNota)
    .slice(0, limite)
}
