import { TIPOS_DESLIGAMENTO, MOTIVOS_POR_TIPO, type TipoDesligamento } from '@/components/efetivo/modal-desligar'
import type { TipoSolicitacao } from '@/types'

type Dados = Record<string, unknown> | null

export type CampoExibicao = { label: string; valor: string }

export const TIPO_BADGE: Record<TipoSolicitacao, { label: string; className: string }> = {
  desligamento:        { label: 'Desligamento',       className: 'bg-red-50 text-red-700 ring-red-200'          },
  transferencia:       { label: 'Transferência',       className: 'bg-blue-50 text-blue-700 ring-blue-200'       },
  mudanca_funcao:      { label: 'Mudança de Função',   className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  promocao:            { label: 'Promoção',            className: 'bg-green-50 text-green-700 ring-green-200'    },
  mudanca_supervisor:  { label: 'Mudança Supervisor',  className: 'bg-purple-50 text-purple-700 ring-purple-200'   },
  alteracao_salario:   { label: 'Alteração Salarial',  className: 'bg-amber-50 text-amber-700 ring-amber-200'     },
  afastamento:         { label: 'Afastamento',         className: 'bg-orange-50 text-orange-700 ring-orange-200'  },
  retorno_afastamento: { label: 'Retorno Afastamento', className: 'bg-teal-50 text-teal-700 ring-teal-200'        },
  rescisao_indireta:   { label: 'Rescisão Indireta',   className: 'bg-rose-50 text-rose-700 ring-rose-200'        },
  admissao:            { label: 'Admissão',            className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  mudanca_horario:     { label: 'Mudança Horário',      className: 'bg-cyan-50 text-cyan-700 ring-cyan-200'          },
}

export function badgeDaSolicitacao(tipo: TipoSolicitacao, dadosDepois: Record<string, unknown> | null): { label: string; className: string } {
  const isTransfComFuncao = tipo === 'transferencia' && !!dadosDepois?.nova_funcao_id
  if (isTransfComFuncao) {
    return { label: 'Transferência + Função', className: 'bg-amber-50 text-amber-700 ring-amber-200' }
  }
  return TIPO_BADGE[tipo]
}

const DIA_CURSO_LABEL: Record<number, string> = {
  1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta',
}

export function fmtData(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function str(v: unknown, fallback = '—'): string {
  if (v === null || v === undefined || v === '') return fallback
  return String(v)
}

function diaCursoLabel(v: unknown): string {
  const n = Number(v)
  return DIA_CURSO_LABEL[n] ?? String(v)
}

function labelTipoDesligamento(v: unknown): string {
  const found = TIPOS_DESLIGAMENTO.find(t => t.value === v)
  return found?.label ?? str(v)
}

function labelMotivoDesligamento(tipoDesligamento: unknown, motivo: unknown): string {
  const tipo = tipoDesligamento as TipoDesligamento | undefined
  if (tipo && MOTIVOS_POR_TIPO[tipo]) {
    const found = MOTIVOS_POR_TIPO[tipo].find(m => m.value === motivo)
    if (found) return found.label
  }
  return str(motivo)
}

/** Campos explícitos por tipo — nunca faz dump genérico de dados_antes/dados_depois. */
export function camposDaSolicitacao(tipo: TipoSolicitacao, dadosAntes: Dados, dadosDepois: Dados): CampoExibicao[] {
  const antes  = dadosAntes ?? {}
  const depois = dadosDepois ?? {}
  const campos: CampoExibicao[] = []

  switch (tipo) {
    case 'desligamento':
      campos.push({ label: 'Data de Desligamento', valor: fmtData(depois.data_desligamento) })
      if (depois.tipo_desligamento) campos.push({ label: 'Tipo de Desligamento', valor: labelTipoDesligamento(depois.tipo_desligamento) })
      campos.push({ label: 'Motivação', valor: labelMotivoDesligamento(depois.tipo_desligamento, depois.motivo) })
      break

    case 'transferencia':
      campos.push({ label: 'Posto', valor: `${str(antes.posto_nome)} → ${str(depois.posto_destino_nome)}` })
      if (depois.nova_funcao_nome) campos.push({ label: 'Função', valor: str(depois.nova_funcao_nome) })
      if (depois.turno_destino_nome) campos.push({ label: 'Turno', valor: str(depois.turno_destino_nome) })
      if (depois.dia_curso_destino) campos.push({ label: 'Dia de Curso', valor: diaCursoLabel(depois.dia_curso_destino) })
      if (depois.motivo) campos.push({ label: 'Motivo', valor: str(depois.motivo) })
      break

    case 'mudanca_funcao':
    case 'promocao':
      campos.push({ label: 'Função', valor: `${str(antes.funcao_nome)} → ${str(depois.funcao_destino_nome)}` })
      if (depois.motivo) campos.push({ label: 'Motivo', valor: str(depois.motivo) })
      if (depois.turno_destino_nome) campos.push({ label: 'Turno', valor: str(depois.turno_destino_nome) })
      if (depois.dia_curso_destino) campos.push({ label: 'Dia de Curso', valor: diaCursoLabel(depois.dia_curso_destino) })
      break

    case 'retorno_afastamento':
      campos.push({ label: 'Data de Retorno', valor: fmtData(depois.data_retorno) })
      campos.push({
        label: 'Posto de Retorno',
        valor: depois.posto_retorno_nome ? str(depois.posto_retorno_nome) : `${str(antes.posto_nome)} (mesmo posto atual)`,
      })
      if (depois.turno_destino_nome) campos.push({ label: 'Turno', valor: str(depois.turno_destino_nome) })
      if (depois.dia_curso_destino) campos.push({ label: 'Dia de Curso', valor: diaCursoLabel(depois.dia_curso_destino) })
      break

    case 'rescisao_indireta':
      campos.push({ label: 'Data em que Parou de Trabalhar', valor: fmtData(depois.data_parou_trabalhar) })
      campos.push({ label: 'Motivo', valor: str(depois.motivo) })
      if (depois.observacao) campos.push({ label: 'Observação', valor: str(depois.observacao) })
      break

    case 'afastamento':
      campos.push({ label: 'Motivo', valor: str(depois.motivo) })
      campos.push({ label: 'Data de Início', valor: fmtData(depois.data_inicio) })
      if (depois.data_retorno_prevista) campos.push({ label: 'Retorno Previsto', valor: fmtData(depois.data_retorno_prevista) })
      if (depois.dias) campos.push({ label: 'Dias', valor: str(depois.dias) })
      break

    case 'mudanca_supervisor':
      campos.push({ label: 'Supervisor', valor: `${str(antes.supervisor_nome)} → ${str(depois.novo_supervisor_nome)}` })
      if (depois.motivo) campos.push({ label: 'Motivo', valor: str(depois.motivo) })
      break

    case 'mudanca_horario':
      campos.push({ label: 'Turno', valor: `${str(antes.turno_atual_nome)} → ${str(depois.turno_destino_nome)}` })
      if (depois.dia_curso_destino) campos.push({ label: 'Dia de Curso', valor: diaCursoLabel(depois.dia_curso_destino) })
      break

    case 'admissao':
      campos.push({ label: 'Nome', valor: str(depois.nome) })
      campos.push({ label: 'Função', valor: str(depois.funcao_nome) })
      campos.push({ label: 'Posto', valor: str(depois.posto_nome) })
      campos.push({ label: 'Data de Admissão', valor: fmtData(depois.data_admissao) })
      if (depois.registro) campos.push({ label: 'Registro (PIS/NIT)', valor: str(depois.registro) })
      if (depois.periodo_experiencia) campos.push({ label: 'Período de Experiência', valor: str(depois.periodo_experiencia) })
      break

    case 'alteracao_salario':
      campos.push({ label: 'Salário', valor: `${str(antes.salario)} → ${str(depois.novo_salario)}` })
      break

    default:
      // Tipos sem action de criação ativa hoje — fallback defensivo, sem esconder campos por convenção de nome.
      Object.entries(depois).forEach(([k, v]) => campos.push({ label: k, valor: str(v) }))
  }

  return campos
}

/** Resumo curto (1 linha) pro card compacto da listagem. */
export function resumoCurto(tipo: TipoSolicitacao, dadosAntes: Dados, dadosDepois: Dados): string {
  const campos = camposDaSolicitacao(tipo, dadosAntes, dadosDepois)
  if (campos.length === 0) return '—'
  return campos.map(c => c.valor).join(' · ')
}
