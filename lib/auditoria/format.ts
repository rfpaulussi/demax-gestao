export const TIPO_LABEL: Record<string, { label: string; cls: string }> = {
  admissao:           { label: 'Admissão',            cls: 'bg-green-50 text-green-700 ring-green-200'   },
  atestado:           { label: 'Atestado',            cls: 'bg-blue-50 text-blue-700 ring-blue-200'      },
  exclusao_atestado:  { label: 'Exclusão Atestado',   cls: 'bg-red-50 text-red-700 ring-red-200'         },
  ferias:             { label: 'Férias',               cls: 'bg-orange-50 text-orange-700 ring-orange-200'},
  afastamento:        { label: 'Afastamento',         cls: 'bg-amber-50 text-amber-700 ring-amber-200'   },
  retorno_afastamento:{ label: 'Retorno',             cls: 'bg-teal-50 text-teal-700 ring-teal-200'      },
  desligamento:       { label: 'Desligamento',        cls: 'bg-red-50 text-red-700 ring-red-200'         },
  rescisao_indireta:  { label: 'Rescisão Indireta',   cls: 'bg-red-50 text-red-700 ring-red-200'         },
  transferencia:      { label: 'Transferência',       cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200'},
  mudanca_funcao:     { label: 'Mudança de Função',   cls: 'bg-purple-50 text-purple-700 ring-purple-200'},
  promocao:           { label: 'Promoção',            cls: 'bg-purple-50 text-purple-700 ring-purple-200'},
  alteracao_salario:  { label: 'Alteração Salário',   cls: 'bg-purple-50 text-purple-700 ring-purple-200'},
  edicao_direta:      { label: 'Edição Direta',       cls: 'bg-slate-100 text-slate-700 ring-slate-200'  },
  rejeicao:           { label: 'Rejeição',            cls: 'bg-red-50 text-red-700 ring-red-200'         },
  mudanca_supervisor: { label: 'Mudança Supervisor',  cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200'},
  mudanca_horario:    { label: 'Mudança de Horário',  cls: 'bg-cyan-50 text-cyan-700 ring-cyan-200'      },
}

export const CAMPO_LABEL: Record<string, string> = {
  posto_id:    'Posto',
  status:      'Status',
  funcao_id:   'Função',
  turno_id:    'Turno',
  salario:     'Salário',
  solicitacao: 'Solicitação',
  atestado:    'Atestado',
}

/** Rótulo do badge para linhas de rejeição — recupera o tipo original guardado em valor_antes,
 *  em vez de esconder atrás do rótulo genérico "Rejeição". Puramente de exibição: não altera
 *  o que é gravado em movimentacoes. */
export function badgeRejeicao(valorAntes: string | null): { label: string; cls: string } {
  const original = valorAntes ? TIPO_LABEL[valorAntes]?.label ?? valorAntes : null
  return {
    label: original ? `Rejeitado: ${original}` : 'Rejeição',
    cls: 'bg-red-50 text-red-700 ring-red-200',
  }
}

export function badgeParaMovimentacao(tipo: string, valorAntes: string | null): { label: string; cls: string } {
  if (tipo === 'rejeicao') return badgeRejeicao(valorAntes)
  return TIPO_LABEL[tipo] ?? { label: tipo, cls: 'bg-gray-50 text-gray-600 ring-gray-200' }
}

export function fmtDataHora(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function fmtMoeda(valor: string | null): string {
  if (!valor) return '—'
  const n = Number(valor)
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : valor
}

export type MapasResolucao = {
  postos: Map<string, string>
  funcoes: Map<string, string>
  turnos: Map<string, string>
}

/** Traduz o valor bruto de movimentacoes.valor_antes/valor_depois para algo legível,
 *  de acordo com o campo alterado. Mantém o comportamento anterior (mostrar os 8
 *  primeiros caracteres do UUID) quando o id não é encontrado nos mapas. */
export function resolveValor(maps: MapasResolucao, campo: string | null, valor: string | null): string {
  if (!valor) return '—'
  if (campo === 'posto_id')  return maps.postos.get(valor)  ?? valor.slice(0, 8) + '…'
  if (campo === 'funcao_id') return maps.funcoes.get(valor) ?? valor.slice(0, 8) + '…'
  if (campo === 'turno_id')  return maps.turnos.get(valor)  ?? valor.slice(0, 8) + '…'
  if (campo === 'salario')   return fmtMoeda(valor)
  return valor
}

/** Escapa caracteres especiais do ILIKE (% e _) antes de montar o termo de busca. */
export function escapeIlike(termo: string): string {
  return termo.replace(/[%_]/g, m => `\\${m}`)
}
