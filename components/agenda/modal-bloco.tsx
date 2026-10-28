'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, MapPin, Search, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { PERIODOS, temaDe, type Periodo } from '@/lib/agenda/tema'
import { diaMes } from '@/lib/agenda/datas'
import { removerBloco, salvarBloco } from '@/app/(admin)/agenda/actions'
import { liberarDia, pedirMudancaExtra } from '@/app/(admin)/agenda/mudancas-actions'
import type { DiaLiberado } from '@/lib/agenda/mudancas-db'
import { CATEGORIAS_MOTIVO, restantes, type ResumoMudancas } from '@/lib/agenda/mudancas'
import { buscarEndereco, salvarLocalPosto } from '@/app/(admin)/agenda/geo-actions'
import type { ResultadoEndereco } from '@/app/(admin)/agenda/geo-actions'
import type { BlocoView, PostoOpt, TipoFoco } from '@/app/(admin)/agenda/actions'

export type SlotAberto = {
  data: string
  periodo: Periodo
  ordem: number
  bloco: BlocoView | null
  postoInicial?: string
  grupoPeriodos?: Periodo[] // períodos já marcados para este mesmo recolhimento (manhã e/ou tarde)
}

type Escolha = Periodo | 'dia'

export function ModalBloco({
  slot,
  semanaInicio,
  supervisorId,
  tipos,
  postos,
  sede,
  podeMarcarSede,
  publicada,
  hoje,
  ehAdmin,
  ehDono,
  mudancas,
  liberados,
  podeLiberar,
  onClose,
}: {
  slot: SlotAberto | null
  semanaInicio: string
  supervisorId: string
  tipos: TipoFoco[]
  postos: PostoOpt[]
  sede: PostoOpt | null
  podeMarcarSede: boolean
  publicada: boolean
  hoje: string
  ehAdmin: boolean
  ehDono: boolean // supervisor editando a própria agenda: sujeito ao limite de mudanças
  mudancas: ResumoMudancas | null
  liberados: DiaLiberado[]
  podeLiberar: boolean // admin editando a agenda de um supervisor: pode liberar dia passado
  onClose: () => void
}) {
  return (
    <Dialog open={!!slot} onOpenChange={o => { if (!o) onClose() }}>
      {slot && (
        <Conteudo
          key={`${slot.data}|${slot.periodo}|${slot.ordem}|${slot.bloco?.id ?? 'novo'}`}
          slot={slot}
          semanaInicio={semanaInicio}
          supervisorId={supervisorId}
          tipos={tipos}
          postos={postos}
          sede={sede}
          podeMarcarSede={podeMarcarSede}
          publicada={publicada}
          hoje={hoje}
          ehAdmin={ehAdmin}
          ehDono={ehDono}
          mudancas={mudancas}
          liberados={liberados}
          podeLiberar={podeLiberar}
          onClose={onClose}
        />
      )}
    </Dialog>
  )
}

const ENDERECO_SEDE = 'Rua Carlos Lacerda, 71, Brás Cubas, Mogi das Cruzes - SP'

/** Marca o local (GPS do check-in) da sede/base pela busca de endereço. Só coordenação. */
function LocalSede({ sede }: { sede: PostoOpt }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [consulta, setConsulta] = useState(ENDERECO_SEDE)
  const [achados, setAchados] = useState<ResultadoEndereco[]>([])
  const [buscando, setBuscando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const marcado = sede.tem_local || salvo

  async function pesquisar() {
    setMsg(null)
    setBuscando(true)
    const r = await buscarEndereco(consulta)
    setBuscando(false)
    if (!r.ok) return setMsg(r.erro)
    setAchados(r.itens)
    if (r.itens.length === 0) setMsg('Nenhum endereço encontrado. Tente sem o número ou ajuste o ponto em Localização dos postos.')
  }

  function usar(a: ResultadoEndereco) {
    setMsg(null)
    start(async () => {
      const r = await salvarLocalPosto({ postoId: sede.id, latitude: a.lat, longitude: a.lng, raioM: 150, enderecoRef: a.nome })
      if (!r.ok) return setMsg(r.erro)
      setSalvo(true)
      setAchados([])
      router.refresh()
    })
  }

  return (
    <section className={`rounded-xl border p-3 ${marcado ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-700">
        <MapPin className="h-3.5 w-3.5" /> Local da sede/base
      </p>
      {marcado && (
        <p className="mb-2 text-xs text-emerald-800">
          ✅ Local marcado: o check-in valida o GPS dentro do raio. Para trocar, busque e escolha outro ponto.
        </p>
      )}
      {!marcado && (
        <p className="mb-2 text-xs text-amber-800">
          A sede ainda não tem local marcado: sem ele ninguém consegue fazer check-in. Busque o endereço e escolha o ponto correto.
        </p>
      )}
      <div className="flex gap-2">
        <input
          value={consulta}
          onChange={e => setConsulta(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); pesquisar() } }}
          className="flex-1 rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none focus:border-slate-400"
        />
        <button type="button" onClick={pesquisar} disabled={buscando || pending}
          className="rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
          {buscando ? '…' : 'Buscar'}
        </button>
      </div>
      {achados.length > 0 && (
        <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white">
          {achados.map((a, i) => (
            <li key={i}>
              <button type="button" disabled={pending} onClick={() => usar(a)}
                className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-emerald-50 disabled:opacity-50">
                {a.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="mt-2 text-xs font-medium text-red-700">{msg}</p>}
    </section>
  )
}

function Conteudo({
  slot, semanaInicio, supervisorId, tipos, postos, sede, podeMarcarSede, publicada, hoje, ehAdmin, ehDono, mudancas, liberados, podeLiberar, onClose,
}: {
  slot: SlotAberto
  semanaInicio: string
  supervisorId: string
  tipos: TipoFoco[]
  postos: PostoOpt[]
  sede: PostoOpt | null
  podeMarcarSede: boolean
  publicada: boolean
  hoje: string
  ehAdmin: boolean
  ehDono: boolean
  mudancas: ResumoMudancas | null
  liberados: DiaLiberado[]
  podeLiberar: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [tipoId, setTipoId] = useState(slot.bloco?.tipo_foco_id ?? '')
  const [sel, setSel] = useState<Set<string>>(
    new Set(slot.bloco ? slot.bloco.postos.map(p => p.id) : slot.postoInicial ? [slot.postoInicial] : []),
  )
  const [obs, setObs] = useState(slot.bloco?.observacao ?? '')
  const [escolha, setEscolha] = useState<Escolha>(
    slot.grupoPeriodos && slot.grupoPeriodos.length === 2 ? 'dia' : slot.grupoPeriodos?.[0] ?? (slot.bloco ? slot.periodo : 'dia'),
  )
  const [motivo, setMotivo] = useState('')
  const [categoria, setCategoria] = useState('')
  const [pedido, setPedido] = useState('')
  const [pedidoEnviado, setPedidoEnviado] = useState(false)
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const periodo = PERIODOS.find(p => p.id === slot.periodo)!
  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return q ? postos.filter(p => p.nome.toLowerCase().includes(q) || (p.secretaria ?? '').toLowerCase().includes(q)) : postos
  }, [busca, postos])

  function alternar(id: string) {
    setSel(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const tipoSel = tipos.find(t => t.id === tipoId)
  const semPosto = !!tipoSel?.sem_posto
  // Regras da agenda publicada: foco administrativo (sem posto) é livre; dia passado só o admin; supervisor tem limite.
  const diaPassado = publicada && slot.data < hoje
  const liberacao = liberados.find(l => l.data === slot.data) ?? null
  const passadoTravado = diaPassado && !ehAdmin && !liberacao
  const pedeMotivo = publicada && !semPosto && !passadoTravado
  const limiteAtingido = pedeMotivo && ehDono && !!mudancas && restantes(mudancas) <= 0
  const travado = passadoTravado || limiteAtingido
  const notaSemPosto = tipoSel?.usa_sede
    ? '🏢 Foco feito na sede/base da administração: o posto é definido automaticamente. No dia, o check-in exige GPS dentro do raio da sede e foto.'
    : tipoSel?.dia_inteiro
      ? '🕒 Recolhimento de cartão: sem postos e sem check-in, registro manual. Escolha o período abaixo.'
      : '📝 Foco sem posto: registro manual, sem check-in.'

  function salvar() {
    setErro(null)
    if (!tipoId) return setErro('Escolha o tipo de foco')
    if (!semPosto && sel.size === 0) return setErro('Escolha ao menos um posto')
    if (pedeMotivo && !categoria) return setErro('Escolha o motivo da mudança')
    start(async () => {
      const periodos: Periodo[] | undefined = tipoSel?.dia_inteiro
        ? (escolha === 'dia' ? ['manha', 'tarde'] : [escolha])
        : undefined
      const r = await salvarBloco({
        semanaInicio, data: slot.data, periodo: slot.periodo, ordem: slot.ordem,
        tipoFocoId: tipoId, postoIds: Array.from(sel), observacao: obs, periodos, categoria: pedeMotivo ? categoria : undefined, motivo, supervisorId,
      })
      if (!r.ok) {
        if (r.limite) router.refresh()
        return setErro(r.erro)
      }
      router.refresh()
      onClose()
    })
  }

  function liberar() {
    setErro(null)
    start(async () => {
      const r = await liberarDia({ semanaInicio, supervisorId, data: slot.data })
      if (!r.ok) return setErro(r.erro)
      router.refresh()
    })
  }

  function pedirExtra() {
    setErro(null)
    start(async () => {
      const r = await pedirMudancaExtra({ semanaInicio, motivo: pedido })
      if (!r.ok) return setErro(r.erro)
      setPedidoEnviado(true)
      router.refresh()
    })
  }

  function remover() {
    if (!slot.bloco) return
    setErro(null)
    if (pedeMotivo && !categoria) return setErro('Escolha o motivo da mudança')
    start(async () => {
      const r = await removerBloco({ semanaInicio, blocoId: slot.bloco!.id, categoria: pedeMotivo ? categoria : undefined, motivo, supervisorId })
      if (!r.ok) {
        if (r.limite) router.refresh()
        return setErro(r.erro)
      }
      router.refresh()
      onClose()
    })
  }

  return (
    <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
      <div className={`h-1.5 w-full ${periodo.faixa}`} />
      <div className="flex max-h-[calc(92vh-6px)] flex-col overflow-y-auto">
        <DialogHeader className="px-5 pt-4">
          <DialogTitle className="text-lg font-black text-slate-900">
            {slot.bloco ? 'Editar visita' : 'Nova visita'} · {diaMes(slot.data)} · {periodo.label} · nº {slot.ordem}
          </DialogTitle>
          <DialogDescription>Escolha o foco da visita e os postos que serão atendidos.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 py-4">
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Tipo de foco</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {tipos.map(t => {
                const tema = temaDe(t.cor)
                const ativo = tipoId === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTipoId(t.id)}
                    className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs font-semibold transition ${tema.card} ${tema.texto} ${
                      ativo ? `ring-2 ring-offset-1 ${tema.ring} scale-[1.02] shadow-md` : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <span className="text-xl leading-none">{t.icone}</span>
                    <span className="leading-tight">{t.nome}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {tipoSel?.dia_inteiro && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Período do recolhimento</p>
              <div className="grid grid-cols-3 gap-2">
                {([['manha', 'Manhã'], ['tarde', 'Tarde'], ['dia', 'Dia inteiro']] as const).map(([id, rotulo]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setEscolha(id)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      escolha === id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                A outra metade do dia fica livre para outro compromisso.
              </p>
            </section>
          )}

          {semPosto ? (
            <>
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                {notaSemPosto}
              </section>
              {tipoSel?.usa_sede && sede && podeMarcarSede && <LocalSede sede={sede} />}
              {tipoSel?.usa_sede && sede && !podeMarcarSede && !sede.tem_local && (
                <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-medium text-amber-800">
                  A sede ainda não tem local marcado. Estando na sede, toque em &quot;Marcar local aqui&quot; no painel do check-in: o GPS registra o ponto e a coordenação confere depois.
                </p>
              )}
            </>
          ) : (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Postos</p>
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">{sel.size} selecionado(s)</span>
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar posto ou secretaria…"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-slate-400"
              />
            </div>
            <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-xl bg-slate-50 p-2">
              {visiveis.length === 0 && <p className="p-2 text-xs text-slate-400">Nenhum posto encontrado.</p>}
              {visiveis.map(p => {
                const ativo = sel.has(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => alternar(p.id)}
                    title={p.secretaria ?? undefined}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      ativo
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {p.nome}
                  </button>
                )
              })}
            </div>
          </section>
          )}

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Observação</p>
            <textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="O que precisa ser visto/feito nessa visita? (opcional)"
              className="w-full resize-none rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-slate-400"
            />
          </section>

          {passadoTravado && (
            <section className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
              🔒 Este dia já passou. Numa agenda publicada, dias passados só o admin altera. Peça ao admin para liberar este dia se precisar corrigir.
            </section>
          )}

          {diaPassado && liberacao && (
            <section className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-medium text-sky-900">
              🔓 Dia liberado pelo admin até {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(liberacao.ate))}.
              {ehDono ? ' A correção conta como uma das suas mudanças da semana.' : ''}
            </section>
          )}

          {diaPassado && podeLiberar && !liberacao && (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-sm text-slate-700">
                Este dia já passou. Você (admin) pode corrigir agora, ou liberar o dia para o supervisor corrigir por 48 h.
              </p>
              <button type="button" onClick={liberar} disabled={pending}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                🔓 Liberar este dia para o supervisor (48 h)
              </button>
            </section>
          )}

          {pedeMotivo && !limiteAtingido && (
            <section className="rounded-xl border border-amber-300 bg-amber-50 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" /> Agenda publicada — replanejamento
              </p>
              {ehDono && mudancas && (
                <p className="mb-2 text-xs text-amber-900">
                  Esta é a mudança <b>{mudancas.usadas + 1}</b> de <b>{mudancas.limite + mudancas.extras}</b> permitidas nesta semana.
                  Depois do limite, só com aprovação da coordenação.
                </p>
              )}
              <select value={categoria} onChange={e => setCategoria(e.target.value)}
                className="mb-2 w-full rounded-lg border border-amber-200 bg-white p-2 text-sm outline-none focus:border-amber-400">
                <option value="">Motivo da mudança (obrigatório)…</option>
                {CATEGORIAS_MOTIVO.map(c => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
              </select>
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                rows={2}
                placeholder={categoria === 'outro' ? 'Descreva o motivo (obrigatório)' : 'Detalhes (opcional)'}
                className="w-full resize-none rounded-lg border border-amber-200 bg-white p-2.5 text-sm outline-none focus:border-amber-400"
              />
            </section>
          )}

          {limiteAtingido && mudancas && (
            <section className="rounded-xl border border-rose-200 bg-rose-50 p-3">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-rose-800">Limite de mudanças da semana atingido</p>
              <p className="mb-2 text-sm text-rose-900">
                Você já usou {mudancas.usadas} de {mudancas.limite + mudancas.extras} mudanças. Para mudar de novo, peça aprovação à coordenação.
              </p>
              {mudancas.pedidoPendente || pedidoEnviado ? (
                <p className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700">⏳ Pedido enviado: aguardando a coordenação.</p>
              ) : (
                <>
                  <textarea
                    value={pedido}
                    onChange={e => setPedido(e.target.value)}
                    rows={2}
                    placeholder="O que precisa mudar e por quê?"
                    className="w-full resize-none rounded-lg border border-rose-200 bg-white p-2.5 text-sm outline-none focus:border-rose-400"
                  />
                  <button type="button" onClick={pedirExtra} disabled={pending || pedido.trim().length < 10}
                    className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">
                    Pedir aprovação
                  </button>
                </>
              )}
            </section>
          )}

          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{erro}</p>}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-slate-100 bg-white px-5 py-3">
          {slot.bloco ? (
            <button
              type="button"
              onClick={remover}
              disabled={pending || travado}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Remover
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={pending || travado}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
            >
              {pending ? 'Salvando…' : 'Salvar bloco'}
            </button>
          </div>
        </div>
      </div>
    </DialogContent>
  )
}
