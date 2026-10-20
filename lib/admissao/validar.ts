import { apenasDigitos, validarCpf } from './cpf'
import { linhaVtPreenchida, numeroBR } from './vt'
import { MAX_LINHAS_VT, type DossieAdmissao } from './tipos'

export const ETAPAS_ADMISSAO = ['Pessoais', 'Vaga', 'Condições', 'Vale transporte', 'Uniforme e documentos', 'Revisão'] as const

export interface OpcoesValidacao {
  /** O posto (ou o jovem aprendiz) tem turno cadastrado: então escolher um é obrigatório. */
  turnoObrigatorio: boolean
  jovemAprendiz: boolean
}

function dataValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = new Date(`${iso}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso
}

/** Erros de uma etapa (1 a 6), em frases prontas para mostrar ao supervisor. Lista vazia = pode avançar. */
export function errosDaEtapa(etapa: number, d: DossieAdmissao, o: OpcoesValidacao): string[] {
  const erros: string[] = []
  const falta = (cond: boolean, msg: string) => { if (cond) erros.push(msg) }

  switch (etapa) {
    case 1: {
      falta(d.nome.trim().split(/\s+/).filter(Boolean).length < 2, 'Informe o nome completo')
      falta(!validarCpf(d.cpf), 'CPF inválido')
      const tel = apenasDigitos(d.telefone)
      falta(tel.length < 10 || tel.length > 11, 'Telefone com DDD inválido')
      falta(!!d.email.trim() && !/^\S+@\S+\.\S+$/.test(d.email.trim()), 'E-mail inválido')
      falta(apenasDigitos(d.cep).length !== 8, 'CEP inválido')
      falta(!d.logradouro.trim(), 'Informe o endereço')
      falta(!d.numero.trim(), 'Informe o número (ou S/N)')
      falta(!d.bairro.trim(), 'Informe o bairro')
      falta(!d.cidade.trim(), 'Informe a cidade')
      falta(d.uf.length !== 2, 'Informe a UF')
      break
    }
    case 2: {
      falta(!d.posto_id, 'Selecione o posto')
      falta(!d.funcao_id, 'Selecione a função')
      falta(!dataValida(d.data_admissao), 'Informe a data de admissão')
      falta(d.motivo === 'substituicao' && !d.substituido_nome.trim(), 'Informe quem está sendo substituído')
      falta(d.motivo === 'substituicao' && !!d.substituido_data_desligamento && !dataValida(d.substituido_data_desligamento), 'Data do desligamento inválida')
      falta(o.turnoObrigatorio && !d.turno_id, 'Selecione o turno de trabalho')
      falta(o.jovemAprendiz && !!d.turno_id && !d.dia_curso, 'Selecione o dia de curso')
      break
    }
    case 3: {
      falta(!!d.va.trim() && numeroBR(d.va) === null, 'VA inválido')
      falta(!!d.vr.trim() && numeroBR(d.vr) === null, 'VR inválido')
      break
    }
    case 4: {
      if (!d.vt_utiliza) break
      const preenchidas = d.vt_linhas.filter(linhaVtPreenchida)
      falta(preenchidas.length === 0, 'Informe ao menos uma linha de transporte (ou marque "não utiliza")')
      falta(d.vt_linhas.length > MAX_LINHAS_VT, `No máximo ${MAX_LINHAS_VT} linhas de transporte`)
      falta(preenchidas.some(l => !l.linha.trim()), 'Informe o nome/número de cada linha')
      falta(preenchidas.some(l => numeroBR(l.valor) === null || (numeroBR(l.valor) ?? 0) <= 0), 'Informe o valor da passagem de cada linha')
      falta(preenchidas.some(l => (numeroBR(l.qtd) ?? 0) <= 0), 'Informe a quantidade de passagens por dia de cada linha')
      falta(d.vt_cartao === 'outro' && !d.vt_cartao_outro.trim(), 'Informe qual é o cartão')
      break
    }
    case 6: {
      falta(!dataValida(d.data_integracao), 'Informe a data da integração')
      break
    }
  }
  return erros
}

/** Valida tudo (usado no envio, no servidor). */
export function errosDoDossie(d: DossieAdmissao, o: OpcoesValidacao): string[] {
  return [1, 2, 3, 4, 5, 6].flatMap(e => errosDaEtapa(e, d, o))
}
