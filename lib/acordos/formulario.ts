import type { CamposAcordo, TemplateId } from './tipos'
import { hhmmParaMin } from './tempo'

/** Estado do formulário do modal de novo acordo (texto/booleanos, como nos inputs). */
export interface FormState {
  dataEvento: string
  /** T1/T5: outros dias trabalhados além de `dataEvento` (mesmo período em cada um). */
  datasEventoExtras: string[]
  nomeEvento: string
  periodoInicio: string
  periodoFim: string
  duracao: string          // 'HH:MM' — usado quando não há período
  horaDispensa: string
  motivo: string
  dataFolga: string
  /** T4: folga de só algumas horas (em vez da jornada inteira). */
  folgaParcial: boolean
  duracaoFolga: string     // 'HH:MM'
  /** Revezamento: cada funcionário na sua data de folga. */
  revezamento: boolean
  folgas: Record<string, string>
  datasAjuste: string[]
  prazoLimite: string
}

export const FORM_VAZIO: FormState = {
  dataEvento: '', datasEventoExtras: [], nomeEvento: '', periodoInicio: '', periodoFim: '', duracao: '',
  horaDispensa: '', motivo: '', dataFolga: '', folgaParcial: false, duracaoFolga: '', revezamento: false, folgas: {}, datasAjuste: [], prazoLimite: '',
}

/** `idsSelecionados`: no revezamento só entram as datas de quem está no acordo. */
export function montarCampos(template: TemplateId, f: FormState, idsSelecionados?: Set<string>): CamposAcordo {
  const usaEvento = template === 'T1' || template === 'T2' || template === 'T5'
  const usaPeriodo = template === 'T1' || template === 'T5'
  const usaFolga = template === 'T3' || template === 'T4' || template === 'T5'
  const usaMotivo = template === 'T2' || template === 'T3' || template === 'T4'
  // T1/T5: o primeiro dia (ordenado) é a data do evento; os demais entram em datasEvento
  const diasEvento = Array.from(new Set([f.dataEvento, ...f.datasEventoExtras].filter(Boolean))).sort()
  const folgas = usaFolga && f.revezamento
    ? Object.fromEntries(Object.entries(f.folgas).filter(([id, d]) => d && (!idsSelecionados || idsSelecionados.has(id))))
    : undefined
  const dataFolga = folgas ? Object.values(folgas).sort()[0] : usaFolga ? f.dataFolga || undefined : undefined
  // Só repassa o que o template mostra: campos ocultos preenchidos antes não podem vazar para validação/gravação
  return {
    template,
    dataEvento: usaEvento ? (usaPeriodo ? diasEvento[0] : f.dataEvento) || undefined : undefined,
    datasEvento: usaPeriodo && diasEvento.length > 1 ? diasEvento : undefined,
    nomeEvento: usaEvento ? f.nomeEvento || undefined : undefined,
    periodoInicio: usaPeriodo ? f.periodoInicio || undefined : undefined,
    periodoFim: usaPeriodo ? f.periodoFim || undefined : undefined,
    // T1/T5 com período: o lib calcula por funcionário; aqui vai só a duração digitada
    minutosOrigem: usaPeriodo && f.duracao ? hhmmParaMin(f.duracao) : 0,
    minutosFolga: template === 'T4' && f.folgaParcial ? (f.duracaoFolga ? hhmmParaMin(f.duracaoFolga) : 0) : undefined,
    horaDispensa: template === 'T2' ? f.horaDispensa || undefined : undefined,
    motivo: usaMotivo ? f.motivo || undefined : undefined,
    dataFolga,
    folgasPorFuncionario: folgas,
    datasAjuste: template === 'T5' ? [] : f.datasAjuste,
    prazoLimite: f.prazoLimite || undefined,
  }
}
