import type { CamposAcordo, TemplateId } from './tipos'
import type { ResumoCalculo } from './movimentos'
import { conectorDoMotivo } from './motivos'
import { fmtAcrescimo, fmtDataBR, fmtDatasComPrefixo, fmtHoraCurta, fmtHorasTotal } from './tempo'

export const TEMPLATES: Record<TemplateId, { titulo: string; resumo: string; subtipo: 'evento' | 'antecipado' }> = {
  T1: { titulo: 'Evento trabalhado', resumo: 'Trabalharam num evento; compensam com redução de jornada nos dias seguintes.', subtipo: 'evento' },
  T2: { titulo: 'Dispensa antecipada', resumo: 'Saíram antes do horário; compensam com acréscimo de jornada depois.', subtipo: 'evento' },
  T3: { titulo: 'Dia inteiro de folga', resumo: 'Dispensados o dia todo (emenda/ponto facultativo); compensam com acréscimo depois.', subtipo: 'evento' },
  T4: { titulo: 'Banco de horas', resumo: 'Trabalham a mais antes e folgam depois, com prazo máximo.', subtipo: 'antecipado' },
  T5: { titulo: 'Dia de descanso trabalhado', resumo: 'Trabalharam num dia de descanso; compensam com folga.', subtipo: 'evento' },
}

export type ResultadoTexto = { ok: true; texto: string } | { ok: false; erro: string }

export function contemPlaceholder(texto: string): boolean {
  return /\[[^\]]*\]/.test(texto)
}

const limpa = (s?: string) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
const INICIOS_COMUNS = [
  'acordado', 'acordo', 'ponto', 'decreto', 'feriado', 'emenda',
  'determinacao', 'autorizacao', 'solicitacao', 'portaria', 'ordem',
]
const semAcento = (w: string) => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * Encaixa o motivo no meio da frase: sem pontuação final, sem "conforme" inicial e, só quando começa por uma
 * palavra comum (decreto, ponto, acordado…), com a 1ª letra minúscula. Nomes próprios e siglas ficam como digitados.
 */
export function normalizaMotivo(m: string): string {
  let t = m.replace(/\s+/g, ' ').trim().replace(/[.,;:!]+$/, '').trim()
  t = t.replace(/^conforme\s+/i, '')
  const primeira = semAcento(t.split(' ')[0] ?? '')
  if (t && INICIOS_COMUNS.includes(primeira)) return t[0].toLowerCase() + t.slice(1)
  return t
}

const falta = (): ResultadoTexto => ({ ok: false, erro: 'O texto gerado contém colchetes ou campo em branco.' })

/** Gera o parágrafo do objeto (depois de "…com a finalidade de que os funcionários "). */
export function gerarObjeto(c: CamposAcordo, r: ResumoCalculo): ResultadoTexto {
  const nome = limpa(c.nomeEvento)
  const motivo = normalizaMotivo(limpa(c.motivo))
  const datas = c.datasAjuste.length ? fmtDatasComPrefixo(c.datasAjuste) : ''
  const periodo = c.periodoInicio && c.periodoFim
    ? `, das ${fmtHoraCurta(c.periodoInicio)} às ${fmtHoraCurta(c.periodoFim)}`
    : ''
  const sufixoPrazo = c.template !== 'T4' && c.prazoLimite
    ? ` O prazo máximo para a compensação é ${fmtDataBR(c.prazoLimite)}.`
    : ''
  const horas = fmtHorasTotal(r.horasTotalMin)
  const porDia = fmtAcrescimo(r.minutosPorDia)

  let texto = ''
  switch (c.template) {
    case 'T1':
      if (!c.dataEvento || !nome || !datas || r.minutosPorDia <= 0) return falta()
      texto = `trabalharem no dia ${fmtDataBR(c.dataEvento)} (${nome})${periodo}, com redução de ${porDia} diária no horário normal ${datas}, compensando assim ${horas} laborada(s) no referido evento.${sufixoPrazo}`
      break
    case 'T2':
      if (!c.dataEvento || !nome || !r.horaNormal || !c.horaDispensa || !datas || r.minutosPorDia <= 0) return falta()
      texto = `trabalharem normalmente até as ${fmtHoraCurta(r.horaNormal)} no dia ${fmtDataBR(c.dataEvento)} (${nome}), sendo dispensados às ${fmtHoraCurta(c.horaDispensa)} ${conectorDoMotivo(motivo)} ${motivo || 'decreto municipal'}, compensando as ${horas} não laboradas com acréscimo de ${porDia} diária no horário normal ${datas}.${sufixoPrazo}`
      break
    case 'T3':
      if (!c.dataFolga || !motivo || !datas || r.minutosPorDia <= 0) return falta()
      texto = `serem dispensados do trabalho no dia ${fmtDataBR(c.dataFolga)} (${motivo}), compensando as ${horas} não laboradas com acréscimo de ${porDia} diária no horário normal ${datas}.${sufixoPrazo}`
      break
    case 'T4':
      if (!c.dataFolga || !motivo || !datas || !c.prazoLimite || r.minutosPorDia <= 0) return falta()
      texto = `trabalharem com acréscimo de ${porDia} diária no horário normal ${datas}, formando um saldo de ${horas} a ser compensado com a dispensa do trabalho no dia ${fmtDataBR(c.dataFolga)} (${motivo}), com prazo máximo de compensação até ${fmtDataBR(c.prazoLimite)}.`
      break
    case 'T5': {
      if (!c.dataEvento || !nome || !c.dataFolga || r.horasTotalMin <= 0) return falta()
      const folga = fmtDataBR(c.dataFolga)
      const dispensa = r.horasTotalMin === r.jornadaFolgaMin
        ? `com a dispensa do trabalho no dia ${folga}`
        : `com a dispensa de ${horas} do horário de trabalho no dia ${folga}`
      texto = `trabalharem no dia ${fmtDataBR(c.dataEvento)} (${nome})${periodo}, compensando as ${horas} laboradas ${dispensa}.${sufixoPrazo}`
      break
    }
  }
  return contemPlaceholder(texto) ? falta() : { ok: true, texto }
}
