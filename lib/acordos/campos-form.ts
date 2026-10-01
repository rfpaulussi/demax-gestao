import type { CamposAcordo, TemplateId } from './tipos'
import { FORM_VAZIO, type FormState } from './formulario'
import { minParaHHMM } from './tempo'

/** Inverso de `montarCampos`: devolve o estado do formulário a partir dos campos guardados do acordo. */
export function camposParaForm(c: CamposAcordo): FormState {
  const dias = Array.from(new Set([c.dataEvento, ...(c.datasEvento ?? [])].filter((d): d is string => !!d))).sort()
  return {
    ...FORM_VAZIO,
    dataEvento: c.dataEvento ?? '',
    datasEventoExtras: dias.filter(d => d !== c.dataEvento),
    nomeEvento: c.nomeEvento ?? '',
    periodoInicio: c.periodoInicio ?? '',
    periodoFim: c.periodoFim ?? '',
    duracao: c.minutosOrigem && c.minutosOrigem > 0 ? minParaHHMM(c.minutosOrigem) : '',
    horaDispensa: c.horaDispensa ?? '',
    motivo: c.motivo ?? '',
    dataFolga: c.folgasPorFuncionario ? '' : c.dataFolga ?? '',
    folgaParcial: c.minutosFolga !== undefined,
    duracaoFolga: c.minutosFolga !== undefined && c.minutosFolga > 0 ? minParaHHMM(c.minutosFolga) : '',
    revezamento: !!c.folgasPorFuncionario,
    folgas: c.folgasPorFuncionario ?? {},
    datasAjuste: c.datasAjuste ?? [],
    prazoLimite: c.prazoLimite ?? '',
    diasInteiros: !!c.participantes,
    participantes: c.participantes ?? {},
  }
}

export interface MovimentoLinha { funcionario_id: string; data: string; minutos: number; papel: 'origem' | 'quitacao' }
export interface LinhaAcordo { evento_data?: string | null; evento_nome?: string | null; prazo_limite?: string | null }

const unicas = (xs: string[]) => Array.from(new Set(xs)).sort()

/**
 * Acordo antigo, sem o formulário guardado: reconstrói o que dá a partir das colunas e dos movimentos.
 * `faltando` lista o que não dá para recuperar (a pessoa preenche na tela de edição).
 */
export function reconstruirCampos(template: TemplateId, linha: LinhaAcordo, movs: MovimentoLinha[]): { campos: CamposAcordo; faltando: string[] } {
  const origem = movs.filter(m => m.papel === 'origem')
  const quit = movs.filter(m => m.papel === 'quitacao')
  const faltando: string[] = []
  const campos: CamposAcordo = { template, datasAjuste: [], nomeEvento: linha.evento_nome ?? undefined, prazoLimite: linha.prazo_limite ?? undefined }

  const aplicarFolga = (ms: MovimentoLinha[]) => {
    const por = new Map<string, string[]>()
    for (const m of ms) por.set(m.funcionario_id, [...(por.get(m.funcionario_id) ?? []), m.data])
    const multiplas = Array.from(por.values()).some(d => d.length > 1)
    const distintas = unicas(ms.map(m => m.data))
    if (multiplas) {
      // T5 em dias inteiros: o período de cada um não fica guardado
      campos.participantes = Object.fromEntries(Array.from(por.entries()).map(([id, d]) => [id, { inicio: '', fim: '', folgas: unicas(d) }]))
      campos.dataFolga = distintas[0]
      faltando.push('período trabalhado de cada funcionário')
    } else if (distintas.length > 1) {
      campos.folgasPorFuncionario = Object.fromEntries(Array.from(por.entries()).map(([id, d]) => [id, d[0]]))
      campos.dataFolga = distintas[0]
    } else {
      campos.dataFolga = distintas[0]
    }
  }

  switch (template) {
    case 'T1': {
      const dias = unicas(origem.map(m => m.data))
      campos.dataEvento = dias[0]
      if (dias.length > 1) campos.datasEvento = dias
      campos.minutosOrigem = origem[0]?.minutos
      campos.datasAjuste = unicas(quit.map(m => m.data))
      break
    }
    case 'T2':
      campos.dataEvento = linha.evento_data ?? origem[0]?.data
      campos.datasAjuste = unicas(quit.map(m => m.data))
      faltando.push('horário de dispensa', 'motivo')
      break
    case 'T3':
      aplicarFolga(origem)
      campos.datasAjuste = unicas(quit.map(m => m.data))
      faltando.push('motivo')
      break
    case 'T4':
      campos.datasAjuste = unicas(origem.map(m => m.data))
      aplicarFolga(quit)
      faltando.push('motivo')
      break
    case 'T5': {
      const dias = unicas(origem.map(m => m.data))
      campos.dataEvento = dias[0]
      if (dias.length > 1) campos.datasEvento = dias
      campos.minutosOrigem = origem[0]?.minutos
      aplicarFolga(quit)
      break
    }
  }
  return { campos, faltando }
}
