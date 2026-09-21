import { AlertTriangle, CircleAlert, CircleCheck, Circle, XCircle } from 'lucide-react'
import { DIAS_SEMANA, type SemanaTurno } from '@/lib/acordos/tipos'
import { semanaParaTexto, totalSemanalMin } from '@/lib/acordos/horario-do-turno'
import { minParaHHMM } from '@/lib/acordos/tempo'
import type { GrupoAchado, ItemChecklistId } from '@/lib/acordos/resumo'
import { INPUT_CLS, LABEL_CLS } from './passo'

export const CORES_TURNO = [
  { borda: 'border-t-blue-500', fundo: 'bg-blue-50', ponto: 'bg-blue-500' },
  { borda: 'border-t-orange-500', fundo: 'bg-orange-50', ponto: 'bg-orange-500' },
  { borda: 'border-t-purple-500', fundo: 'bg-purple-50', ponto: 'bg-purple-500' },
  { borda: 'border-t-indigo-500', fundo: 'bg-indigo-50', ponto: 'bg-indigo-500' },
  { borda: 'border-t-green-500', fundo: 'bg-green-50', ponto: 'bg-green-500' },
]

export type StatusResumo = 'neutro' | 'pronto' | 'aviso' | 'pendente'

export interface ItemResumo {
  id: ItemChecklistId
  label: string
  estado: 'ok' | 'erro' | 'neutro'
}

export interface TurnoResumo {
  rotulo: string
  qtd: number
  semana: SemanaTurno
  nomes: string[]
  /** 'HH:MM–HH:MM' (primeiro dia útil do turno). */
  horario: string
  /** "8h48 a repor"; null quando não há horas calculadas. */
  aRepor: string | null
  cor: number
}

export interface TextoGrupo {
  cabecalho: string | null
  texto: string | null
}

interface Props {
  status: StatusResumo
  nPendencias: number
  nAvisos: number
  checklist: ItemResumo[]
  onIrPara: (id: ItemChecklistId) => void
  turnos: TurnoResumo[]
  gruposDeCompensacao: number
  achados: GrupoAchado[]
  textos: TextoGrupo[]
  temErro: boolean
  dataDoc: string
  onDataDoc: (v: string) => void
  /** "Faltam 3 itens" — só depois de tentar salvar. */
  faltam: string | null
  erroServidor: string
  pending: boolean
  onCancelar: () => void
  onSalvar: () => void
  /** Abre o PDF com marca d'água, sem salvar. */
  onRascunho: () => void
  podeRascunho: boolean
  gerandoRascunho: boolean
}

const SELO: Record<StatusResumo, { cls: string; texto: (p: number, a: number) => string }> = {
  neutro: { cls: 'bg-slate-100 text-slate-600', texto: () => 'Preencha os passos ao lado' },
  pronto: { cls: 'bg-green-100 text-green-700', texto: () => 'Pronto para salvar' },
  aviso: { cls: 'bg-amber-100 text-amber-800', texto: (_p, a) => `Pronto, com ${a} ${a === 1 ? 'aviso' : 'avisos'}` },
  pendente: { cls: 'bg-red-100 text-red-700', texto: p => `${p} ${p === 1 ? 'pendência' : 'pendências'}` },
}

/** Um grupo de achados: até 2 itens viram linhas; mais que isso vira uma linha expansível. */
export function LinhaAchado({ g }: { g: GrupoAchado }) {
  const erro = g.nivel === 'erro'
  const cls = erro ? 'border-red-100 bg-red-50 text-red-700' : 'border-amber-100 bg-amber-50 text-amber-800'
  const Icone = erro ? XCircle : AlertTriangle
  if (g.itens.length > 2) {
    const resumido = /^\d+ /.test(g.titulo)
    return (
      <details className={`rounded-lg border px-3 py-2 text-xs ${cls}`}>
        <summary className="flex cursor-pointer items-start gap-2 font-medium">
          <Icone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{g.titulo}{!resumido && ` (+${g.itens.length - 1})`}</span>
        </summary>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-9 font-normal">{g.itens.map((m, i) => <li key={i}>{m}</li>)}</ul>
      </details>
    )
  }
  return (
    <>
      {g.itens.map((m, i) => (
        <div key={i} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${cls}`}>
          <Icone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{m}</span>
        </div>
      ))}
    </>
  )
}

export function ResumoAcordo(p: Props) {
  const pronto = p.status === 'pronto' || p.status === 'aviso'
  const selo = SELO[p.status]

  return (
    <aside className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <h3 className={LABEL_CLS}>Resumo do acordo</h3>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selo.cls}`}>{selo.texto(p.nPendencias, p.nAvisos)}</span>
      </div>

      <ul className="space-y-1">
        {p.checklist.map(i => (
          <li key={i.id}>
            <button type="button" onClick={() => p.onIrPara(i.id)} className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm hover:bg-slate-50">
              {i.estado === 'ok' && <CircleCheck className="h-4 w-4 shrink-0 text-green-600" />}
              {i.estado === 'erro' && <CircleAlert className="h-4 w-4 shrink-0 text-red-600" />}
              {i.estado === 'neutro' && <Circle className="h-4 w-4 shrink-0 text-gray-300" />}
              <span className={i.estado === 'erro' ? 'font-medium text-red-700' : i.estado === 'ok' ? 'text-slate-800' : 'text-gray-400'}>{i.label}</span>
            </button>
          </li>
        ))}
      </ul>

      {p.turnos.length > 0 && (
        <div className="space-y-1.5 border-t border-gray-100 pt-3">
          <p className={LABEL_CLS}>Turnos</p>
          {p.turnos.map((t, i) => (
            <p key={i} className="flex items-start gap-2 text-xs text-slate-700">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${CORES_TURNO[t.cor % CORES_TURNO.length].ponto}`} />
              <span>
                <span className="font-semibold">{t.rotulo}</span> · {t.qtd} func. · {t.horario}
                {t.aRepor && <> · <span className="font-semibold">{t.aRepor}</span></>}
              </span>
            </p>
          ))}
          {p.gruposDeCompensacao > 1 && (
            <p className="text-xs text-amber-700">
              Será gerado um único acordo com {p.gruposDeCompensacao} grupos de compensação (jornadas ou horários diferentes por turno).
            </p>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer font-semibold text-slate-600">Ver horários completos</summary>
            <div className="mt-2 space-y-3">
              {p.turnos.map((t, ti) => {
                const txt = semanaParaTexto(t.semana)
                const cor = CORES_TURNO[t.cor % CORES_TURNO.length]
                return (
                  <div key={ti} className={`overflow-hidden rounded-xl border border-t-4 border-gray-200 ${cor.borda}`}>
                    <div className={`flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-600 ${cor.fundo}`}>
                      <span>{t.rotulo} · {t.qtd} func.</span>
                      <span className="font-normal normal-case tracking-normal text-gray-500">{minParaHHMM(totalSemanalMin(t.semana))}h/semana</span>
                    </div>
                    {DIAS_SEMANA.map(d => (
                      <div key={d} className="flex gap-3 border-t border-gray-100 px-3 py-1 text-xs">
                        <span className="w-24 shrink-0 font-semibold text-slate-600">{d}</span>
                        <span className={txt[d] === 'FOLGA' ? 'font-bold uppercase text-gray-400' : 'font-mono text-gray-700'}>{txt[d]}</span>
                      </div>
                    ))}
                    <details className="border-t border-gray-100 px-3 py-1.5">
                      <summary className="cursor-pointer font-semibold text-slate-600">Ver funcionários</summary>
                      <ul className="mt-1 space-y-0.5 text-gray-700">{t.nomes.map((n, i) => <li key={`${i}-${n}`}>{n}</li>)}</ul>
                    </details>
                  </div>
                )
              })}
            </div>
          </details>
        </div>
      )}

      {p.achados.length > 0 && (
        <div className="space-y-1.5 border-t border-gray-100 pt-3">
          <p className={LABEL_CLS}>Avisos</p>
          {p.achados.map(g => <LinhaAchado key={g.codigo} g={g} />)}
        </div>
      )}

      <div className="space-y-2 border-t border-gray-100 pt-3">
        <p className={LABEL_CLS}>Texto do acordo (gerado)</p>
        <div className={`space-y-2 rounded-xl bg-slate-900 px-3 py-3 ${p.temErro ? 'opacity-60' : ''}`}>
          {(p.textos.length ? p.textos : [{ cabecalho: null, texto: null }]).map((t, i) => (
            <div key={i}>
              {t.cabecalho && <p className="mb-0.5 font-sans text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.cabecalho}</p>}
              <p className="font-mono text-[11px] leading-relaxed text-slate-300">
                <span className="text-slate-500">…com a finalidade de que os funcionários </span>
                {t.texto && !p.temErro
                  ? <span className="text-amber-300">{t.texto}</span>
                  : <span className="italic text-slate-500">{p.temErro ? 'Corrija os itens em vermelho para gerar o texto' : 'preencha os dados ao lado para gerar o texto'}</span>}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={p.onRascunho}
          disabled={!p.podeRascunho || p.gerandoRascunho}
          title={p.podeRascunho ? "Abre o PDF com marca d'água, sem salvar" : 'Preencha os dados para ver o rascunho'}
          className="flex h-9 w-full items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {p.gerandoRascunho ? 'Gerando rascunho…' : "Ver rascunho em PDF (marca d'água)"}
        </button>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <label htmlFor="campo-data-documento" className={`${LABEL_CLS} mb-1.5`}>Data do documento</label>
        <input id="campo-data-documento" type="date" value={p.dataDoc} onChange={e => p.onDataDoc(e.target.value)} className={INPUT_CLS} />
      </div>

      {p.faltam && <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{p.faltam}</div>}
      {p.erroServidor && <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{p.erroServidor}</div>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={p.onCancelar} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-600 hover:bg-gray-100">
          Cancelar
        </button>
        <button
          type="button"
          onClick={p.onSalvar}
          disabled={p.pending}
          aria-disabled={!pronto}
          title={pronto ? undefined : 'Ainda há itens a preencher'}
          className={`flex h-9 items-center rounded-lg px-6 text-sm font-bold text-white disabled:opacity-40 ${pronto ? 'bg-slate-900 hover:bg-slate-700' : 'bg-slate-400 hover:bg-slate-500'}`}
        >
          {p.pending ? 'Salvando…' : 'Salvar Acordo'}
        </button>
      </div>
    </aside>
  )
}
