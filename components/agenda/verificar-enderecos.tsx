'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ScanSearch } from 'lucide-react'
import { ajustarRaiosEmMassa, confirmarEmMassa, geocodificarLote, previaAjusteRaios, listarPendentesGeocodificacao, previaConfirmacaoMassa } from '@/app/(admin)/agenda/geocodificar-actions'
import type { ItemLote, PendentesGeo } from '@/app/(admin)/agenda/geocodificar-actions'

const BLOCO = 10

type Placar = { forte: number; cache: number; ambiguo: number; nao_encontrado: number; erro: number; sem_endereco: number }
const ZERO: Placar = { forte: 0, cache: 0, ambiguo: 0, nao_encontrado: 0, erro: 0, sem_endereco: 0 }

/**
 * Consulta o Google para todos os postos com endereço que ainda não têm sugestão vigente, em blocos de 10, com
 * progresso e botão de parar. Só preenche a sugestão (vale 30 dias); nenhum ponto oficial é alterado.
 */
export function VerificarEnderecos() {
  const router = useRouter()
  const [pendentes, setPendentes] = useState<PendentesGeo | null>(null)
  const [rodando, setRodando] = useState(false)
  const [feitos, setFeitos] = useState(0)
  const [placar, setPlacar] = useState<Placar>(ZERO)
  const [aviso, setAviso] = useState<string | null>(null)
  const [fim, setFim] = useState(false)
  const pararRef = useRef(false)

  async function preparar() {
    setAviso(null)
    setFim(false)
    setPlacar(ZERO)
    setFeitos(0)
    const r = await listarPendentesGeocodificacao()
    if (!r.ok) return setAviso(r.erro)
    setPendentes(r.pendentes)
    if (r.pendentes.ids.length === 0) setAviso('Nenhum posto a consultar agora: todos já têm sugestão vigente ou estão sem endereço.')
  }

  async function iniciar() {
    if (!pendentes || pendentes.ids.length === 0) return
    pararRef.current = false
    setRodando(true)
    setAviso(null)
    setFim(false)
    let n = feitos
    try {
      // "Continuar" retoma de onde parou: os `feitos` primeiros já foram consultados.
      for (let i = feitos; i < pendentes.ids.length; i += BLOCO) {
        if (pararRef.current) break
        const r = await geocodificarLote(pendentes.ids.slice(i, i + BLOCO))
        if (!r.ok) { setAviso(r.erro); break }
        n += r.itens.length
        setPlacar(p => somar(p, r.itens))
        setFeitos(n)
        if (r.fatal) { setAviso(`Interrompido: ${r.fatal}`); break }
      }
      if (!pararRef.current && n >= pendentes.ids.length) setFim(true)
    } catch {
      setAviso('A conexão caiu durante a verificação. O que já foi consultado ficou salvo; é só continuar depois.')
    } finally {
      setRodando(false)
      router.refresh() // recarrega a lista com as distâncias novas
    }
  }

  const total = pendentes?.ids.length ?? 0
  const pct = total ? Math.min(100, Math.round((feitos / total) * 100)) : 0

  return (
    <div className="rounded-2xl border border-slate-200 border-t-4 border-t-sky-500 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <ScanSearch className="h-5 w-5 text-sky-600" />
        <div className="mr-auto">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Verificação automática</p>
          <p className="text-sm font-bold text-slate-800">Conferir os endereços de todos os postos no Google</p>
          <p className="text-xs text-slate-500">
            Compara cada endereço com o pino atual e lista os mais distantes primeiro. Não altera nenhum ponto. A sugestão vale 30 dias.
          </p>
        </div>
        {!pendentes && (
          <button type="button" onClick={preparar}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            Ver o que falta verificar
          </button>
        )}
        {pendentes && !rodando && pendentes.ids.length > 0 && !fim && (
          <button type="button" onClick={iniciar}
            className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600">
            {feitos > 0 ? 'Continuar' : `Verificar ${pendentes.ids.length} postos`}
          </button>
        )}
        {rodando && (
          <button type="button" onClick={() => { pararRef.current = true }}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
            Parar
          </button>
        )}
      </div>

      {pendentes && (
        <p className="mt-2 text-xs text-slate-500">
          {pendentes.total} postos ativos · {pendentes.ids.length} a consultar · {pendentes.jaConsultados} já consultados · {pendentes.semEndereco} sem endereço cadastrado
        </p>
      )}

      {(rodando || feitos > 0) && total > 0 && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-600">
            {rodando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span><b>{feitos}</b>/{total}</span>
            <span className="text-emerald-700">{placar.forte + placar.cache} encontrados</span>
            <span className="text-amber-700">{placar.ambiguo} ambíguos</span>
            <span className="text-rose-700">{placar.nao_encontrado} não encontrados</span>
            {placar.erro > 0 && <span className="text-red-700">{placar.erro} com erro</span>}
          </p>
        </div>
      )}

      {fim && (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          Verificação concluída. Na lista, marque <b>Divergentes</b> para ver primeiro os postos com o pino mais longe do endereço.
        </p>
      )}
      {aviso && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 ring-1 ring-amber-200">{aviso}</p>}

      <ConfirmacaoEmMassa />
      <AjusteDeRaios />
    </div>
  )
}

/**
 * Reduz o raio de check-in (500 m importado) dos postos JÁ CONFIRMADOS. Não toca em raio escolhido à mão
 * (menor que 500 m), em posto "a conferir" nem em pino.
 */
function AjusteDeRaios() {
  const router = useRouter()
  const [alvo, setAlvo] = useState(150)
  const [previa, setPrevia] = useState<{ total: number; aConferirGrandes: number; alvo: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function ver() {
    setMsg(null)
    setBusy(true)
    const r = await previaAjusteRaios(alvo)
    setBusy(false)
    if (!r.ok) return setMsg({ tipo: 'erro', texto: r.erro })
    setPrevia({ total: r.total, aConferirGrandes: r.aConferirGrandes, alvo })
  }

  async function aplicar() {
    if (!previa || previa.total === 0) return
    const ok = window.confirm(
      `Reduzir o raio de ${previa.total} postos confirmados de 500 m (ou mais) para ${previa.alvo} m?\n\n` +
      'Vale para os próximos check-ins. Raios que você ajustou à mão e postos "a conferir" não são alterados. ' +
      'Fica registrado no histórico de cada posto.',
    )
    if (!ok) return
    setMsg(null)
    setBusy(true)
    const r = await ajustarRaiosEmMassa(previa.alvo)
    setBusy(false)
    if (!r.ok) return setMsg({ tipo: 'erro', texto: r.erro })
    setPrevia(null)
    setMsg({ tipo: 'ok', texto: `${r.ajustados} postos ajustados para ${previa.alvo} m.` })
    router.refresh()
  }

  return (
    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-800">Ajuste de raios</p>
      <p className="text-xs text-slate-600">
        Quase todos os postos estão com raio de 500 m, o que deixa o check-in frouxo (com a tolerância do GPS, passa a até 600 m).
        Reduz o raio só dos postos já <b>confirmados</b>. Postos grandes (terminais, parques) você ajusta depois, um a um.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          Novo raio
          <select value={alvo} onChange={e => { setAlvo(Number(e.target.value)); setPrevia(null) }}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm">
            <option value={100}>100 m</option>
            <option value={150}>150 m (recomendado)</option>
            <option value={200}>200 m</option>
            <option value={250}>250 m</option>
          </select>
        </label>
        <button type="button" onClick={ver} disabled={busy}
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-violet-800 ring-1 ring-violet-300 hover:bg-violet-100 disabled:opacity-50">
          {busy && !previa ? 'Calculando…' : 'Ver quantos'}
        </button>
        {previa && previa.total > 0 && (
          <button type="button" onClick={aplicar} disabled={busy}
            className="rounded-lg bg-violet-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-50">
            {busy ? 'Ajustando…' : `Ajustar ${previa.total} postos`}
          </button>
        )}
      </div>
      {previa && (
        <p className="mt-2 text-xs text-slate-600">
          {previa.total === 0
            ? 'Nenhum posto confirmado com raio de 500 m ou mais.'
            : `${previa.total} postos confirmados passam de 500 m (ou mais) para ${previa.alvo} m.`}
          {previa.aConferirGrandes > 0 && ` Outros ${previa.aConferirGrandes} ainda estão "a conferir" com 500 m e ficam de fora até serem confirmados.`}
        </p>
      )}
      {msg && (
        <p className={`mt-2 rounded-lg px-3 py-2 text-sm font-medium ${msg.tipo === 'ok' ? 'bg-violet-100 text-violet-800' : 'bg-red-50 text-red-700'}`}>{msg.texto}</p>
      )}
    </div>
  )
}

/**
 * Confirma de uma vez os postos "a conferir" cujo pino está a poucos metros do endereço (preciso) do Google.
 * Não move pino nem mexe no raio: só marca como conferido, com o responsável e o motivo no histórico.
 */
function ConfirmacaoEmMassa() {
  const router = useRouter()
  const [limite, setLimite] = useState(50)
  const [previa, setPrevia] = useState<{ total: number; maisLonge: number; limite: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function ver() {
    setMsg(null)
    setBusy(true)
    const r = await previaConfirmacaoMassa(limite)
    setBusy(false)
    if (!r.ok) return setMsg({ tipo: 'erro', texto: r.erro })
    setPrevia({ total: r.total, maisLonge: r.maisLonge, limite })
  }

  async function confirmar() {
    if (!previa || previa.total === 0) return
    const ok = window.confirm(
      `Confirmar ${previa.total} postos cujo pino está a até ${previa.limite} m do endereço do Google?\n\n` +
      'Eles deixam de aparecer como "a conferir". Nenhum pino ou raio é alterado. Fica registrado no histórico de cada posto.',
    )
    if (!ok) return
    setMsg(null)
    setBusy(true)
    const r = await confirmarEmMassa(previa.limite)
    setBusy(false)
    if (!r.ok) return setMsg({ tipo: 'erro', texto: r.erro })
    setPrevia(null)
    setMsg({ tipo: 'ok', texto: `${r.confirmados} postos confirmados.` })
    router.refresh()
  }

  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-800">Confirmação em massa</p>
      <p className="text-xs text-slate-600">
        Marca como conferidos os postos &quot;a conferir&quot; cujo pino já confere com o endereço do Google (endereço exato ou número estimado).
        Os divergentes continuam na fila para você olhar.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          Pino a até
          <select value={limite} onChange={e => { setLimite(Number(e.target.value)); setPrevia(null) }}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm">
            <option value={30}>30 m</option>
            <option value={50}>50 m (recomendado)</option>
            <option value={100}>100 m</option>
          </select>
          do endereço
        </label>
        <button type="button" onClick={ver} disabled={busy}
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-300 hover:bg-emerald-100 disabled:opacity-50">
          {busy && !previa ? 'Calculando…' : 'Ver quantos'}
        </button>
        {previa && previa.total > 0 && (
          <button type="button" onClick={confirmar} disabled={busy}
            className="rounded-lg bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
            {busy ? 'Confirmando…' : `Confirmar ${previa.total} postos`}
          </button>
        )}
      </div>
      {previa && (
        <p className="mt-2 text-xs text-slate-600">
          {previa.total === 0
            ? `Nenhum posto a conferir está a até ${previa.limite} m do endereço do Google.`
            : `${previa.total} postos a até ${previa.limite} m (o mais distante está a ${previa.maisLonge} m).`}
        </p>
      )}
      {msg && (
        <p className={`mt-2 rounded-lg px-3 py-2 text-sm font-medium ${msg.tipo === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{msg.texto}</p>
      )}
    </div>
  )
}

function somar(p: Placar, itens: ItemLote[]): Placar {
  const r = { ...p }
  for (const i of itens) r[i.situacao] += 1
  return r
}
