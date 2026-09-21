import type { Achado, CamposAcordo, NivelAchado, TemplateId } from './tipos'
import { addMeses, diaSemanaDe, mesDe } from './tempo'
import { camposFaltando } from './validar'
import { PRAZO_MAXIMO_MESES } from './regras'
import { MOTIVOS } from './motivos'

const p2 = (n: number) => String(n).padStart(2, '0')

/** 480 -> '8h'; 528 -> '8h48'; 50 -> '0h50' */
export function fmtDuracao(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h${p2(m)}`
}

/** 480 -> '8h00'; 65 -> '1h05' */
export function fmtHM(min: number): string {
  return `${Math.floor(min / 60)}h${p2(min % 60)}`
}

// ─── Prazo limite ──────────────────────────────────────────────────────────────

const CODIGOS_PRAZO = ['PRAZO_OBRIGATORIO', 'PRAZO_LONGO', 'PRAZO_ANTES']

/** O passo "Prazo limite" só aparece quando obrigatório (T4 ou achado de prazo) ou já preenchido. */
export function precisaPrazo(template: TemplateId, achados: Achado[], prazoLimite?: string): boolean {
  return template === 'T4' || !!prazoLimite || achados.some(a => CODIGOS_PRAZO.includes(a.codigo))
}

/** Menor data do acordo (evento, folga ou dias de ajuste) + 6 meses; null sem nenhuma data. */
export function dataMaximaPrazo(c: CamposAcordo): string | null {
  const datas = [c.dataEvento, c.dataFolga, ...c.datasAjuste].filter((d): d is string => !!d).sort()
  return datas.length ? addMeses(datas[0], PRAZO_MAXIMO_MESES) : null
}

// ─── Avisos agrupados ──────────────────────────────────────────────────────────

export interface GrupoAchado {
  codigo: string
  nivel: NivelAchado
  titulo: string
  itens: string[]
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

const TITULOS: Record<string, (n: number) => string> = {
  STATUS: n => `${plural(n, 'funcionário', 'funcionários')} com status diferente de ativo`,
  SEM_TURNO: n => `${plural(n, 'funcionário', 'funcionários')} sem horário cadastrado (usando 5x2 de 44h)`,
  TURNO_FORA_44H: n => `${plural(n, 'funcionário', 'funcionários')} com turno que não soma 44h por semana`,
  FERIADO: n => `${plural(n, 'data', 'datas')} em feriado ou ponto facultativo`,
  DIA_DE_FOLGA: n => `${plural(n, 'caso', 'casos')} em que o dia é folga na escala do funcionário`,
  SEM_HORAS_A_COMPENSAR: n => `${plural(n, 'funcionário', 'funcionários')} sem horas a compensar`,
}

/** Agrupa achados por código: erros antes de avisos, mantendo a ordem de aparição dentro de cada nível. */
export function agruparAchados(achados: Achado[]): GrupoAchado[] {
  const mapa = new Map<string, GrupoAchado>()
  for (const a of achados) {
    const g = mapa.get(a.codigo)
    if (g) {
      g.itens.push(a.mensagem)
      if (a.nivel === 'erro') g.nivel = 'erro'
    } else {
      mapa.set(a.codigo, { codigo: a.codigo, nivel: a.nivel, titulo: '', itens: [a.mensagem] })
    }
  }
  const grupos = Array.from(mapa.values())
  for (const g of grupos) {
    const fn = TITULOS[g.codigo]
    g.titulo = fn ? fn(g.itens.length) : g.itens[0]
  }
  return [...grupos.filter(g => g.nivel === 'erro'), ...grupos.filter(g => g.nivel !== 'erro')]
}

// ─── A conta, dias em chips ────────────────────────────────────────────────────

const VERBO: Record<TemplateId, string> = {
  T1: 'a reduzir',
  T2: 'a repor',
  T3: 'a repor',
  T4: 'a trabalhar a mais',
  T5: 'a compensar',
}

export function verboCompensacao(template: TemplateId): string {
  return VERBO[template]
}

/** "8 dias × 66 min = 8h48 a repor"; null quando não há dias ou horas. */
export function textoConta(template: TemplateId, nDias: number, minPorDia: number, totalMin: number, variaPorTurno: boolean): string | null {
  if (nDias <= 0 || minPorDia <= 0 || totalMin <= 0) return null
  const base = `${plural(nDias, 'dia', 'dias')} × ${minPorDia} min = ${fmtDuracao(totalMin)} ${VERBO[template]}`
  return variaPorTurno ? `${base} (varia por turno)` : base
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export interface RotuloDiaChip {
  semana: string
  dia: string
  mes: string | null
}

/** Mini-cartão de calendário: "seg", "8" e, se o mês difere do primeiro dia da lista, o mês abreviado. */
export function rotuloDiaChip(iso: string, primeiro: string | undefined): RotuloDiaChip {
  const [, m, d] = iso.slice(0, 10).split('-').map(Number)
  const outroMes = !!primeiro && mesDe(iso) !== mesDe(primeiro)
  return {
    semana: diaSemanaDe(iso).slice(0, 3).toLowerCase(),
    dia: String(d),
    mes: outroMes ? MESES[m - 1] : null,
  }
}

// ─── Motivo ────────────────────────────────────────────────────────────────────

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** 'decreto municipal nº 12' (ou só 'decreto municipal' sem número). */
export function montarMotivoDecreto(numero: string): string {
  const n = numero.trim().replace(/^n[º°o]\.?\s*/i, '').trim()
  return n ? `decreto municipal nº ${n}` : 'decreto municipal'
}

export interface MotivoIdentificado {
  /** id do catálogo, 'outro' (texto livre) ou null (vazio). */
  id: string | null
  decreto: string
}

export function identificarMotivo(motivo: string): MotivoIdentificado {
  const t = motivo.trim()
  if (!t) return { id: null, decreto: '' }
  const dec = /^decreto municipal n[º°o]\.?\s*(.+)$/i.exec(t)
  if (dec) return { id: 'decreto-municipal', decreto: dec[1].trim() }
  const achado = MOTIVOS.find(m => norm(m.texto) === norm(t))
  return { id: achado ? achado.id : 'outro', decreto: '' }
}

/** Motivo sugerido quando a data casa com o calendário de Mogi. */
export function motivoDoCalendario(dica: { nome: string; tipo: string }): string {
  return dica.tipo === 'facultativo' ? 'ponto facultativo municipal' : `feriado ${dica.nome}`
}

// ─── Checklist ─────────────────────────────────────────────────────────────────

export type ItemChecklistId = 'titulo' | 'situacao' | 'funcionarios' | 'datas' | 'motivo' | 'prazo'

export interface ItemChecklist {
  id: ItemChecklistId
  label: string
  ok: boolean
}

export interface EntradaChecklist {
  situacaoEscolhida: boolean
  titulo: string
  postosSel: number
  funcionarios: number
  campos: CamposAcordo
  achados: Achado[]
  prazoObrigatorio: boolean
}

const CODIGOS_FORA_DE_DATAS = [
  'SEM_FUNCIONARIOS', 'REGIME_NAO_ELEGIVEL', 'CAMPO_OBRIGATORIO', ...CODIGOS_PRAZO,
]

export function montarChecklist(e: EntradaChecklist): ItemChecklist[] {
  const erros = e.achados.filter(a => a.nivel === 'erro')
  const funcionariosOk =
    e.postosSel > 0 && e.funcionarios > 0 &&
    !erros.some(a => a.codigo === 'SEM_FUNCIONARIOS' || a.codigo === 'REGIME_NAO_ELEGIVEL')
  const itens: ItemChecklist[] = [
    { id: 'titulo', label: 'Título do acordo', ok: e.titulo.trim() !== '' },
    { id: 'situacao', label: 'Situação', ok: e.situacaoEscolhida },
    { id: 'funcionarios', label: e.funcionarios > 0 ? `Posto e funcionários (${e.funcionarios})` : 'Posto e funcionários', ok: funcionariosOk },
  ]
  if (!e.situacaoEscolhida) return itens

  const t = e.campos.template
  const faltando = camposFaltando(e.campos)
  const datasOk =
    !faltando.some(x => x !== 'motivo' && x !== 'prazo limite') &&
    !erros.some(a => !CODIGOS_FORA_DE_DATAS.includes(a.codigo))
  itens.push({ id: 'datas', label: 'Datas e horas', ok: datasOk })

  if (t === 'T2') itens.push({ id: 'motivo', label: 'Motivo (opcional)', ok: true })
  else if (t === 'T3' || t === 'T4') itens.push({ id: 'motivo', label: 'Motivo', ok: !faltando.includes('motivo') })

  if (e.prazoObrigatorio) {
    itens.push({
      id: 'prazo',
      label: 'Prazo limite',
      ok: !faltando.includes('prazo limite') && !erros.some(a => CODIGOS_PRAZO.includes(a.codigo)),
    })
  }
  return itens
}
