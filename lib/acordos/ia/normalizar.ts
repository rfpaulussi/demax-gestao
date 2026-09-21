import type { CamposAcordo, TemplateId } from '../tipos'
import { hhmmParaMin } from '../tempo'
import { camposFaltando } from '../validar'
import { MOTIVOS } from '../motivos'
import type { PedidoExtraido } from './schema'

/** Mesmos nomes dos campos do formulário do modal (FormState), todos opcionais. */
export interface PatchForm {
  dataEvento?: string
  datasEventoExtras?: string[]
  nomeEvento?: string
  periodoInicio?: string
  periodoFim?: string
  duracao?: string
  horaDispensa?: string
  motivo?: string
  dataFolga?: string
  folgaParcial?: boolean
  duracaoFolga?: string
  revezamento?: boolean
  folgas?: Record<string, string>
  datasAjuste?: string[]
  prazoLimite?: string
}

export interface ResultadoIA {
  template: TemplateId | null
  form: PatchForm
  postoId: string | null
  /** Funcionários citados pelo nome. Vazio = o posto todo. */
  funcionarioIds: string[]
  /** "em 6 dias": o modal escolhe as datas a partir disso. */
  quantidadeDias: number | null
  perguntas: string[]
  avisos: string[]
}

export interface ContextoIA {
  postos: { id: string; nome: string }[]
  pessoas: { id: string; nome: string; posto_id: string | null }[]
  /** 'FUNC_1' -> id (vem da anonimização). */
  mapa: Record<string, string>
  /** 'AAAA-MM-DD' de hoje. */
  hoje: string
}

const semAcento = (s: string) =>
  s.split('').map(ch => (ch.normalize('NFD')[0] ?? ch).toLowerCase()).join('')
const chave = (s: string) => semAcento(s).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(Boolean).join(' ')

export function dataValida(iso: string | null | undefined, hoje: string): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const [a, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d))
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  const ano = Number(hoje.slice(0, 4))
  return a >= ano - 1 && a <= ano + 3 ? iso : null
}

export function horaValida(hhmm: string | null | undefined): string | null {
  if (!hhmm) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

/** Casa o posto dito no pedido com o cadastro: só devolve id quando há um único candidato. */
export function casarPosto(texto: string | null, postos: { id: string; nome: string }[]): { id: string | null; candidatos: string[] } {
  const q = chave(texto ?? '')
  if (!q) return { id: null, candidatos: [] }
  const exato = postos.filter(p => chave(p.nome) === q)
  if (exato.length === 1) return { id: exato[0].id, candidatos: [] }
  const tokens = q.split(' ')
  const contem = postos.filter(p => {
    const nome = ` ${chave(p.nome)} `
    return tokens.every(t => nome.includes(` ${t} `) || nome.includes(` ${t}`))
  })
  if (contem.length === 1) return { id: contem[0].id, candidatos: [] }
  return { id: null, candidatos: contem.slice(0, 4).map(p => p.nome) }
}

const SINONIMOS: [string, string][] = [
  ['chuva', 'alagamento-chuva'], ['alag', 'alagamento-chuva'],
  ['falta de agua', 'falta-agua'], ['sem agua', 'falta-agua'],
  ['falta de energia', 'falta-energia'], ['falta de luz', 'falta-energia'], ['sem luz', 'falta-energia'],
  ['facultativo', 'ponto-facultativo'], ['emenda', 'emenda-feriado'], ['decreto', 'decreto-municipal'],
  ['obra', 'obra-reforma'], ['reforma', 'obra-reforma'], ['eleic', 'eleicoes-local-votacao'],
  ['greve', 'greve-transporte'], ['dedetiz', 'dedetizacao'], ['recesso', 'recesso-ferias-escolares'],
  ['ferias escolares', 'recesso-ferias-escolares'], ['interdic', 'interdicao'], ['luto', 'luto-oficial'],
  ['jogo', 'jogos-selecao'], ['selecao', 'jogos-selecao'], ['feriado municipal', 'feriado-municipal'],
]

/** Usa a frase do catálogo (com o conector certo) quando o motivo bate; senão o texto livre, curto. */
export function motivoDoCatalogo(motivo: string | null): string | null {
  if (!motivo) return null
  const m = chave(motivo)
  if (!m) return null
  const direto = MOTIVOS.find(i => chave(i.texto) === m || chave(i.rotulo) === m)
  if (direto) return direto.texto
  const sin = SINONIMOS.find(([k]) => m.includes(k))
  if (sin) {
    const item = MOTIVOS.find(i => i.id === sin[1])
    if (item) return item.texto
  }
  return motivo.replace(/\s+/g, ' ').trim().slice(0, 80)
}

/** O pedido fala em pagar horas? O módulo só compensa em tempo. */
export function mencionaPagamento(texto: string): boolean {
  const t = ` ${chave(texto)} `
  return /( pag(ar|a|as|o|os|ue|uem|amento|amentos|ando) | dinheiro | horas? extras? | holerite | receber | adicional de | banco de horas pago )/.test(t)
}

export const AVISO_PAGAMENTO =
  'O pedido fala em pagamento de horas. Este módulo só compensa em tempo (folga, redução ou acréscimo de jornada); não paga horas.'

const PERGUNTA_DE: Record<string, string> = {
  'data do evento': 'Em que dia foi?',
  'nome do evento': 'Qual foi o evento ou o motivo do dia?',
  'horas trabalhadas no evento': 'Das que horas às que horas trabalharam (ou quantas horas)?',
  'horário de dispensa': 'A que horas foram liberados?',
  'data da folga': 'Em que dia é a folga?',
  'motivo': 'Qual o motivo?',
  'prazo limite': 'Até quando podem compensar (prazo máximo, até 6 meses)?',
  'horas de folga': 'Quantas horas de folga?',
}

export function aplicarExtracao(ex: PedidoExtraido, ctx: ContextoIA): ResultadoIA {
  const avisos: string[] = []
  const perguntas: string[] = []
  const template = ex.situacao
  const dv = (d: string | null | undefined, rotulo: string): string | undefined => {
    if (!d) return undefined
    const ok = dataValida(d, ctx.hoje)
    if (!ok) avisos.push(`Ignorei a data de ${rotulo} (“${d}”): não é uma data válida.`)
    return ok ?? undefined
  }

  // posto e funcionários
  const ids = Array.from(new Set(ex.funcionarios.map(c => ctx.mapa[c]).filter((x): x is string => !!x)))
  let postoId: string | null = null
  const posto = casarPosto(ex.posto, ctx.postos)
  if (posto.id) postoId = posto.id
  else if (ex.posto && posto.candidatos.length > 1) perguntas.push(`Qual posto? (${posto.candidatos.join(' ou ')})`)
  else if (ex.posto) avisos.push(`Não achei o posto “${ex.posto}” no cadastro.`)
  if (!postoId && ids.length) {
    const postosDeles = new Set(ctx.pessoas.filter(p => ids.includes(p.id)).map(p => p.posto_id).filter((x): x is string => !!x))
    if (postosDeles.size === 1) postoId = Array.from(postosDeles)[0]
    else if (postosDeles.size > 1) avisos.push('Os funcionários citados são de postos diferentes: escolha o posto.')
  }
  if (!postoId && !ex.posto && !perguntas.length && ids.length === 0) perguntas.push('De qual posto são os funcionários?')

  const form: PatchForm = {}
  const usaEvento = template === 'T1' || template === 'T2' || template === 'T5'
  const usaPeriodo = template === 'T1' || template === 'T5'
  const usaFolga = template === 'T3' || template === 'T4' || template === 'T5'
  const usaMotivo = template === 'T2' || template === 'T3' || template === 'T4'

  // a IA às vezes põe a data no campo vizinho: T3/T4 usam data_folga; T2, data_evento
  const dataEventoBruta = ex.data_evento ?? (template === 'T2' ? ex.data_folga : null)
  const dataFolgaBruta = ex.data_folga ?? (template === 'T3' || template === 'T4' ? ex.data_evento : null)
  if (usaEvento) {
    form.dataEvento = dv(dataEventoBruta, 'o evento')
    if (ex.nome_evento) form.nomeEvento = ex.nome_evento.slice(0, 80)
  }
  if (usaPeriodo) {
    const extras = ex.datas_evento_extras.map(d => dv(d, 'outro dia do evento')).filter((d): d is string => !!d && d !== form.dataEvento)
    if (extras.length) form.datasEventoExtras = extras
    const ini = horaValida(ex.periodo_inicio)
    const fim = horaValida(ex.periodo_fim)
    if (ini && fim) { form.periodoInicio = ini; form.periodoFim = fim }
    else {
      const h = horaValida(ex.horas_trabalhadas)
      if (h) form.duracao = h
    }
  }
  if (template === 'T2') form.horaDispensa = horaValida(ex.hora_dispensa) ?? undefined
  if (usaMotivo) form.motivo = motivoDoCatalogo(ex.motivo) ?? undefined
  if (usaFolga) {
    form.dataFolga = dv(dataFolgaBruta, 'a folga')
    if (template === 'T4' && ex.folga_horas) {
      const h = horaValida(ex.folga_horas)
      if (h) { form.folgaParcial = true; form.duracaoFolga = h }
    }
    const rev = ex.revezamento
      .map(r => ({ id: ctx.mapa[r.funcionario], data: dv(r.data, 'folga em revezamento') }))
      .filter((r): r is { id: string; data: string } => !!r.id && !!r.data)
    if (rev.length) {
      form.revezamento = true
      form.folgas = Object.fromEntries(rev.map(r => [r.id, r.data]))
      form.dataFolga = rev.map(r => r.data).sort()[0]
    }
  }
  if (template && template !== 'T5') {
    const dias = ex.dias_compensacao.map(d => dv(d, 'compensação')).filter((d): d is string => !!d)
    if (dias.length) form.datasAjuste = Array.from(new Set(dias)).sort()
  }
  const prazo = dv(ex.prazo_limite, 'o prazo')
  if (prazo) form.prazoLimite = prazo

  // o que ainda falta, com as mesmas regras do formulário
  if (!template) {
    perguntas.push('O que aconteceu? Trabalharam a mais, foram liberados mais cedo, tiveram um dia de folga ou vão fazer banco de horas?')
  } else {
    const campos: CamposAcordo = {
      template,
      dataEvento: form.dataEvento,
      nomeEvento: form.nomeEvento,
      periodoInicio: form.periodoInicio,
      periodoFim: form.periodoFim,
      minutosOrigem: form.duracao ? hhmmParaMin(form.duracao) : 0,
      horaDispensa: form.horaDispensa,
      motivo: form.motivo,
      dataFolga: form.dataFolga,
      minutosFolga: form.folgaParcial && form.duracaoFolga ? hhmmParaMin(form.duracaoFolga) : undefined,
      datasAjuste: form.datasAjuste ?? [],
      prazoLimite: form.prazoLimite,
    }
    for (const f of camposFaltando(campos)) {
      const p = PERGUNTA_DE[f]
      if (p) perguntas.push(p)
    }
    // dúvida do modelo só entra quando o formulário não achou o que perguntar
    if (perguntas.length === 0) perguntas.push(...ex.perguntas)
  }

  return {
    template,
    form,
    postoId,
    funcionarioIds: ids,
    quantidadeDias: template && template !== 'T5' && !form.datasAjuste ? ex.quantidade_dias : null,
    perguntas: perguntas.slice(0, 4),
    avisos,
  }
}
