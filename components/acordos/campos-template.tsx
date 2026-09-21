'use client'

import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import type { CamposAcordo, TemplateId } from '@/lib/acordos/tipos'
import { hhmmParaMin } from '@/lib/acordos/tempo'
import type { MapaFeriados } from '@/lib/acordos/validar'
import type { CalendarioLinha } from '@/lib/calendario/mapa'
import { fmtHM, motivoDoCalendario, rotuloAtalhoCalendario } from '@/lib/acordos/resumo'
import { Campo, INPUT_CLS, INPUT_ERRO_CLS, SubPasso } from './passo'
import { MotivoChips } from './motivo-chips'
import { DiasChips } from './dias-chips'
import { FolgasRevezamento, SeletorModoFolga, type FuncionarioFolga } from './folgas-revezamento'

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

/** Campos que podem mostrar erro vermelho inline (depois de tocados ou de tentar salvar). */
export type CampoChave = 'dataEvento' | 'nomeEvento' | 'horas' | 'horaDispensa' | 'dataFolga' | 'horasFolga' | 'motivo' | 'dias' | 'prazo'

const TIPO_LABEL: Record<string, string> = {
  nacional: 'Feriado nacional', estadual: 'Feriado estadual', municipal: 'Feriado municipal', facultativo: 'Ponto facultativo',
}

function rotuloCalendario(info: { nome: string; tipo: string }): string {
  const tipo = TIPO_LABEL[info.tipo] ?? info.tipo
  const nomeMin = info.nome.toLowerCase()
  const jaTem = nomeMin.includes('facultativo') || nomeMin.includes('feriado')
  return jaTem ? info.nome : `${info.nome} · ${tipo}`
}

function ChipCalendario({ info }: { info: { nome: string; tipo: string } | undefined }) {
  if (!info) return null
  return (
    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
      <CalendarDays className="h-3 w-3" /> {rotuloCalendario(info)}
    </span>
  )
}

const chipCls = (ativo: boolean) =>
  `rounded-full border px-2.5 py-1 text-xs font-medium transition ${
    ativo ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' : 'border-gray-200 bg-white text-slate-600 hover:bg-white hover:border-gray-300'
  }`

const abaCls = (ativo: boolean) =>
  `flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${ativo ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`

interface Props {
  template: TemplateId
  f: FormState
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  feriados: MapaFeriados
  diasManual: boolean
  onDatasManuais: () => void
  onRecalcular: () => void
  /** Mensagens vermelhas por campo (o pai só preenche depois de tocar/tentar salvar). */
  erros: Partial<Record<CampoChave, string>>
  /** "8 dias × 66 min = 8h48 a repor" */
  conta: string | null
  /** T2: dica sobre a saída normal do turno naquele dia. */
  dicaDispensa?: string | null
  /** T1/T5: quanto do período fica fora do horário normal. */
  notaPeriodo?: string | null
  /** Chips de nome de evento: recentes primeiro, depois os sugeridos. */
  nomesEvento: string[]
  /** Próximos feriados/pontos facultativos do calendário de Mogi (atalhos para a data). */
  atalhosCalendario: CalendarioLinha[]
  /** Funcionários do acordo (para a folga em revezamento). */
  funcionarios: FuncionarioFolga[]
}

export function CamposTemplate({
  template: t, f, set, feriados, diasManual, onDatasManuais, onRecalcular, erros, conta, dicaDispensa, notaPeriodo, nomesEvento, atalhosCalendario, funcionarios,
}: Props) {
  const [modo, setModo] = useState<'periodo' | 'horas'>(f.duracao && !f.periodoInicio ? 'horas' : 'periodo')
  const cls = (k: CampoChave) => (erros[k] ? INPUT_ERRO_CLS : INPUT_CLS)
  const calEvento = f.dataEvento ? feriados.get(f.dataEvento) : undefined
  const calFolga = f.dataFolga ? feriados.get(f.dataFolga) : undefined
  const calMotivo = t === 'T2' ? calEvento : calFolga
  const sugestaoMotivo = calMotivo ? motivoDoCalendario(calMotivo) : undefined
  let letra = 0
  const proxima = () => String.fromCharCode(97 + letra++)

  function trocarModo(m: 'periodo' | 'horas') {
    setModo(m)
    if (m === 'periodo') set('duracao', '')
    else { set('periodoInicio', ''); set('periodoFim', '') }
  }

  const totalMin =
    modo === 'periodo'
      ? f.periodoInicio && f.periodoFim && hhmmParaMin(f.periodoFim) > hhmmParaMin(f.periodoInicio)
        ? hhmmParaMin(f.periodoFim) - hhmmParaMin(f.periodoInicio)
        : 0
      : f.duracao ? hhmmParaMin(f.duracao) : 0

  const nomeEvento = (rotulo: string) => (
    <Campo titulo={rotulo} htmlFor="campo-nomeEvento" ajuda="ex: Festa Junina" erro={erros.nomeEvento}>
      <input id="campo-nomeEvento" value={f.nomeEvento} onChange={e => set('nomeEvento', e.target.value)} placeholder="ex: Festa Junina" className={cls('nomeEvento')} />
    </Campo>
  )

  const chipsNome = () => (
    <div className="-mt-1 flex flex-wrap gap-1.5">
      {nomesEvento.map(n => (
        <button key={n} type="button" aria-pressed={f.nomeEvento === n} onClick={() => set('nomeEvento', n)} className={chipCls(f.nomeEvento === n)}>
          {n}
        </button>
      ))}
    </div>
  )

  const periodoOuHoras = () => (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">Quanto tempo trabalharam?</p>
      <div role="tablist" className="mb-2 flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
        <button type="button" role="tab" aria-selected={modo === 'periodo'} onClick={() => trocarModo('periodo')} className={abaCls(modo === 'periodo')}>
          Informar o período
        </button>
        <button type="button" role="tab" aria-selected={modo === 'horas'} onClick={() => trocarModo('horas')} className={abaCls(modo === 'horas')}>
          Informar só as horas
        </button>
      </div>
      {modo === 'periodo' ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="campo-periodoInicio" className="mb-1 block text-xs font-semibold text-slate-500">Das</label>
            <input id="campo-periodoInicio" type="time" value={f.periodoInicio} onChange={e => set('periodoInicio', e.target.value)} className={cls('horas')} />
          </div>
          <div>
            <label htmlFor="campo-periodoFim" className="mb-1 block text-xs font-semibold text-slate-500">Às</label>
            <input id="campo-periodoFim" type="time" value={f.periodoFim} onChange={e => set('periodoFim', e.target.value)} className={cls('horas')} />
          </div>
        </div>
      ) : (
        <div className="max-w-[10rem]">
          <label htmlFor="campo-duracao" className="mb-1 block text-xs font-semibold text-slate-500">Horas trabalhadas</label>
          <input id="campo-duracao" type="time" value={f.duracao} onChange={e => set('duracao', e.target.value)} className={cls('horas')} />
        </div>
      )}
      {totalMin > 0 && <p className="mt-1.5 text-sm font-semibold text-slate-700">= {fmtHM(totalMin)}</p>}
      {erros.horas
        ? <p className="mt-1 text-xs font-medium text-red-600">{erros.horas}</p>
        : <p className="mt-1 text-xs text-gray-400">
            {modo === 'periodo'
              ? 'ex: das 08:00 às 12:00. O sistema desconta o que cai dentro do horário normal de cada turno.'
              : 'ex: 04:00 para 4 horas trabalhadas fora do horário normal.'}
          </p>}
      {notaPeriodo && <p className="mt-1 text-xs text-slate-600">{notaPeriodo}</p>}
    </div>
  )

  /** Clique num atalho: preenche a data, sugere o motivo (se vazio) e, em meio período no T2, a hora de dispensa. */
  function usarAtalho(chave: 'dataEvento' | 'dataFolga', l: CalendarioLinha) {
    set(chave, l.data)
    if (t === 'T2' || t === 'T3' || t === 'T4') {
      if (!f.motivo) set('motivo', motivoDoCalendario({ nome: l.nome, tipo: l.tipo }))
    }
    if (t === 'T2' && l.ate_hora) set('horaDispensa', l.ate_hora.slice(0, 5))
  }

  const atalhos = (chave: 'dataEvento' | 'dataFolga') => (
    <div className="mb-2">
      <p className="mb-1 text-[11px] font-semibold text-gray-400">Datas do calendário de Mogi:</p>
      <div className="flex flex-wrap gap-1.5">
        {atalhosCalendario.map(l => (
          <button
            key={l.data + l.nome}
            type="button"
            aria-pressed={f[chave] === l.data}
            onClick={() => usarAtalho(chave, l)}
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
              f[chave] === l.data
                ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                : l.tipo === 'facultativo'
                  ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {rotuloAtalhoCalendario(l)}
          </button>
        ))}
      </div>
    </div>
  )

  const dataCampo = (rotulo: string, chave: 'dataEvento' | 'dataFolga', ajuda: string, cal?: { nome: string; tipo: string }, comAtalhos = false) => (
    <Campo titulo={rotulo} htmlFor={`campo-${chave}`} ajuda={ajuda} erro={erros[chave]}>
      {comAtalhos && atalhosCalendario.length > 0 && atalhos(chave)}
      <input id={`campo-${chave}`} type="date" value={f[chave]} onChange={e => set(chave, e.target.value)} className={`max-w-xs ${cls(chave)}`} />
      <div><ChipCalendario info={cal} /></div>
    </Campo>
  )

  function trocarModoFolga(revezamento: boolean) {
    set('revezamento', revezamento)
    // ao entrar no revezamento, todos começam na data já escolhida
    if (revezamento && f.dataFolga && Object.keys(f.folgas).length === 0) {
      set('folgas', Object.fromEntries(funcionarios.map(x => [x.id, f.dataFolga])))
    }
  }

  /** Folga de todos no mesmo dia, ou revezamento com uma data por funcionário. */
  const blocoFolga = (rotulo: string, ajuda: string) => (
    <div className="space-y-3">
      <SeletorModoFolga revezamento={f.revezamento} onModo={trocarModoFolga} />
      {f.revezamento ? (
        <FolgasRevezamento
          funcionarios={funcionarios}
          folgas={f.folgas}
          onFolga={(id, d) => set('folgas', { ...f.folgas, [id]: d })}
          onTodos={d => set('folgas', Object.fromEntries(funcionarios.map(x => [x.id, d])))}
          feriados={feriados}
          erro={erros.dataFolga}
        />
      ) : (
        dataCampo(rotulo, 'dataFolga', ajuda, calFolga, true)
      )}
    </div>
  )

  /** T1/T5: mais de um dia trabalhado (ex.: sábado e domingo), com o mesmo período em cada dia. */
  const blocoOutrosDias = () => (
    <div className="space-y-2">
      {f.datasEventoExtras.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="date"
            aria-label={`Outro dia trabalhado ${i + 1}`}
            value={d}
            onChange={e => set('datasEventoExtras', f.datasEventoExtras.map((x, j) => (j === i ? e.target.value : x)))}
            className={`max-w-xs ${INPUT_CLS}`}
          />
          <button
            type="button"
            onClick={() => set('datasEventoExtras', f.datasEventoExtras.filter((_, j) => j !== i))}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
          >
            Remover
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => set('datasEventoExtras', [...f.datasEventoExtras, ''])}
        className="text-xs font-medium text-slate-600 underline hover:text-slate-900"
      >
        + Trabalharam em outro dia também (ex.: sábado e domingo)
      </button>
      {f.datasEventoExtras.length > 0 && <p className="text-xs text-gray-400">O mesmo período (ou as mesmas horas) vale para cada dia.</p>}
    </div>
  )

  /** T4: folga do dia inteiro ou só de algumas horas. */
  const blocoDuracaoFolga = () => (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">Quanto vão folgar nesse dia?</p>
      <div role="tablist" className="mb-2 flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
        <button type="button" role="tab" aria-selected={!f.folgaParcial} onClick={() => set('folgaParcial', false)} className={abaCls(!f.folgaParcial)}>
          Dia inteiro
        </button>
        <button type="button" role="tab" aria-selected={f.folgaParcial} onClick={() => set('folgaParcial', true)} className={abaCls(f.folgaParcial)}>
          Só algumas horas
        </button>
      </div>
      {f.folgaParcial && (
        <div className="max-w-[10rem]">
          <label htmlFor="campo-duracaoFolga" className="mb-1 block text-xs font-semibold text-slate-500">Horas de folga</label>
          <input
            id="campo-duracaoFolga"
            type="time"
            value={f.duracaoFolga}
            onChange={e => set('duracaoFolga', e.target.value)}
            className={erros.horasFolga ? INPUT_ERRO_CLS : INPUT_CLS}
          />
        </div>
      )}
      {erros.horasFolga
        ? <p className="mt-1 text-xs font-medium text-red-600">{erros.horasFolga}</p>
        : f.folgaParcial && <p className="mt-1 text-xs text-gray-400">ex: 04:00 para sair 4 horas mais cedo nesse dia. Precisa caber na jornada do dia.</p>}
    </div>
  )

  const blocoMotivo = (opcional: boolean) => (
    <div id="passo-motivo" className="scroll-mt-4 space-y-2">
      <MotivoChips motivo={f.motivo} onChange={m => set('motivo', m)} sugestao={sugestaoMotivo} erro={!!erros.motivo} />
      {erros.motivo
        ? <p className="text-xs font-medium text-red-600">{erros.motivo}</p>
        : opcional && <p className="text-xs text-gray-400">Opcional. Se ficar em branco, o texto usa &ldquo;decreto municipal&rdquo;.</p>}
    </div>
  )

  const blocoDias = (dica: string) => (
    <div>
      <p className="mb-2 text-xs text-gray-500">{dica}</p>
      <DiasChips
        datas={f.datasAjuste}
        onChange={d => { onDatasManuais(); set('datasAjuste', d) }}
        diasManual={diasManual}
        onRecalcular={onRecalcular}
        conta={conta}
        erro={erros.dias}
      />
    </div>
  )

  return (
    <div className="space-y-3">
      {t === 'T1' && (
        <>
          <SubPasso letra={proxima()} titulo="Sobre o evento">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {dataCampo('Em que dia foi?', 'dataEvento', 'ex: sábado, 20/06/2026', calEvento)}
              {nomeEvento('Qual foi o evento?')}
            </div>
            {chipsNome()}
            {blocoOutrosDias()}
            {periodoOuHoras()}
          </SubPasso>
          <SubPasso letra={proxima()} titulo="Dias em que vão sair mais cedo">
            {blocoDias('Os dias de descanso são sugeridos automaticamente (dias úteis depois do evento). Clique num dia para tirá-lo.')}
          </SubPasso>
        </>
      )}

      {t === 'T2' && (
        <>
          <SubPasso letra={proxima()} titulo="Quando foi">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {dataCampo('Em que dia foram liberados?', 'dataEvento', 'ex: 14/09/2026', calEvento, true)}
              {nomeEvento('Nome do evento / motivo do dia')}
            </div>
            <Campo
              titulo="A que horas foram liberados?"
              htmlFor="campo-horaDispensa"
              ajuda={dicaDispensa || 'Cada funcionário é comparado ao horário de saída do próprio turno. ex: 12:00'}
              erro={erros.horaDispensa}
            >
              <input id="campo-horaDispensa" type="time" value={f.horaDispensa} onChange={e => set('horaDispensa', e.target.value)} className={`max-w-[10rem] ${cls('horaDispensa')}`} />
            </Campo>
          </SubPasso>
          <SubPasso letra={proxima()} titulo="Motivo">{blocoMotivo(true)}</SubPasso>
          <SubPasso letra={proxima()} titulo="Dias de reposição">
            {blocoDias('Dias em que vão trabalhar um pouco a mais para repor as horas. Sugeridos automaticamente.')}
          </SubPasso>
        </>
      )}

      {t === 'T3' && (
        <>
          <SubPasso letra={proxima()} titulo="Dia da folga">
            {blocoFolga('Qual dia não trabalharam?', 'ex: sexta-feira, 05/06/2026')}
          </SubPasso>
          <SubPasso letra={proxima()} titulo="Motivo">{blocoMotivo(false)}</SubPasso>
          <SubPasso letra={proxima()} titulo="Dias de reposição">
            {blocoDias('Dias em que vão trabalhar um pouco a mais para repor o dia. Sugeridos automaticamente.')}
          </SubPasso>
        </>
      )}

      {t === 'T4' && (
        <>
          <SubPasso letra={proxima()} titulo="Quando será a folga">
            {blocoFolga('Em que dia vão folgar?', 'ex: 12/06/2026')}
            {blocoDuracaoFolga()}
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">Motivo</p>
              {blocoMotivo(false)}
            </div>
          </SubPasso>
          <SubPasso letra={proxima()} titulo="Dias em que vão trabalhar a mais">
            {blocoDias('Dias úteis antes da folga, sugeridos automaticamente. Clique num dia para tirá-lo.')}
          </SubPasso>
        </>
      )}

      {t === 'T5' && (
        <>
          <SubPasso letra={proxima()} titulo="Sobre o dia trabalhado">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {dataCampo('Em que dia trabalharam?', 'dataEvento', 'ex: sábado, 20/06/2026', calEvento)}
              {nomeEvento('Qual foi o evento?')}
            </div>
            {chipsNome()}
            {blocoOutrosDias()}
            {periodoOuHoras()}
          </SubPasso>
          <SubPasso letra={proxima()} titulo="Dia da folga">
            {blocoFolga('Em que dia vão folgar?', 'ex: 26/06/2026')}
          </SubPasso>
        </>
      )}
    </div>
  )
}
