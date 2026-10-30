'use client'

import { useEffect, useState } from 'react'
import { MapPin, MapPinOff, Search } from 'lucide-react'
import { listarPostosApoio, type PostoApoio } from '@/app/(admin)/agenda/geo-actions'
import { buscarPorNome, guardarPostos, lerPostosGuardados, listaVencida, postosPerto, type PostoPerto } from '@/lib/agenda/cache-postos-apoio'
import { formatarDistancia } from '@/lib/agenda/geo'
import { comTempoLimite, semConexao } from '@/lib/agenda/rede'
import type { TipoFoco } from '@/app/(admin)/agenda/actions'
import { CampoObservacao } from './campo-observacao'

type Coords = { lat: number; lng: number; precisao: number | null }

/** Atualiza (com sinal) a lista de postos guardada no aparelho. Sem sinal ou com erro, segue com a guardada. */
async function carregarLista(): Promise<PostoApoio[] | null> {
  const guardada = lerPostosGuardados()
  if (!listaVencida(guardada) || semConexao()) return guardada?.postos ?? null
  try {
    const r = await comTempoLimite(listarPostosApoio())
    if (r.ok) {
      guardarPostos(r.postos)
      return r.postos
    }
  } catch {
    // sem resposta: usa a lista guardada
  }
  return guardada?.postos ?? null
}

/**
 * Supervisor de apoio: "Check-in aqui". Lê o GPS, mostra os postos mais próximos (ou busca por nome),
 * pede a atividade e dispara o check-in. A lista de postos fica no aparelho: funciona sem sinal.
 */
export function NovoCheckinApoio({
  tipos, ocupado, jaHoje, lerGps, onConfirmar, onMarcarLocal,
}: {
  tipos: TipoFoco[]
  ocupado: boolean
  jaHoje: string[] // postos que já têm check-in hoje (só sinaliza: o posto pode ser visitado de novo)
  lerGps: () => Promise<Coords>
  onConfirmar: (posto: { id: string; nome: string }, coords: Coords, focoId: string, obs: string) => void
  onMarcarLocal: (postoId: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [coords, setCoords] = useState<Coords | null>(null)
  const [todos, setTodos] = useState<PostoApoio[]>([])
  const [perto, setPerto] = useState<PostoPerto[]>([])
  const [busca, setBusca] = useState('')
  const [escolhido, setEscolhido] = useState<PostoApoio | null>(null)
  const [focoId, setFocoId] = useState('')
  const [obs, setObs] = useState('')

  // Deixa a lista de postos pronta no aparelho enquanto há sinal.
  useEffect(() => { void carregarLista() }, [])

  const atividades = tipos.filter(t => t.ativo && !t.dia_inteiro).sort((a, b) => a.ordem - b.ordem)
  const achados = busca.trim().length >= 2 ? buscarPorNome(todos, busca) : []
  const visitados = new Set(jaHoje)

  async function abrir() {
    setErro(null)
    setEscolhido(null)
    setBusca('')
    setAberto(true)
    setCarregando(true)
    try {
      const lista = await carregarLista()
      if (!lista || lista.length === 0) {
        setErro('A lista de postos ainda não está neste aparelho. Abra esta tela uma vez com internet e tente de novo.')
        return
      }
      setTodos(lista)
      const c = await lerGps()
      setCoords(c)
      setPerto(postosPerto(lista, c.lat, c.lng))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível ler a localização.')
    } finally {
      setCarregando(false)
    }
  }

  function confirmar() {
    if (!escolhido || !coords || !focoId) return
    onConfirmar({ id: escolhido.id, nome: escolhido.nome }, coords, focoId, obs.trim())
    setAberto(false)
    setEscolhido(null)
    setFocoId('')
    setObs('')
  }

  if (!aberto) {
    return (
      <button type="button" onClick={() => void abrir()} disabled={ocupado}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50">
        <MapPin className="h-4 w-4" /> Check-in aqui
      </button>
    )
  }

  const itemPosto = (p: PostoApoio, distancia?: number) => {
    const ativo = escolhido?.id === p.id
    const feito = visitados.has(p.id)
    return (
      <li key={p.id}>
        <button type="button" onClick={() => setEscolhido(p)}
          className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
            ativo ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400'
          }`}>
          <span className="min-w-0">
            <b className="block break-words leading-tight">{p.nome}</b>
            <span className={`text-[11px] ${ativo ? 'text-white/70' : 'text-slate-500'}`}>{p.secretaria ?? 'Sem secretaria'}{feito ? ' · já visitado hoje (nova visita)' : ''}</span>
          </span>
          {distancia !== undefined && <span className={`shrink-0 text-xs font-bold ${ativo ? 'text-white' : 'text-emerald-700'}`}>{formatarDistancia(distancia)}</span>}
          {distancia === undefined && p.latitude == null && <span className="shrink-0 text-[10px] font-bold text-amber-700">sem local</span>}
        </button>
      </li>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Onde você está?</p>
        <button type="button" onClick={() => setAberto(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-900">Cancelar</button>
      </div>

      {carregando && <p className="text-sm text-slate-500">Localizando e buscando postos por perto…</p>}
      {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{erro}</p>}

      {!carregando && !erro && (
        <>
          {perto.length > 0 ? (
            <ul className="space-y-1.5">{perto.map(p => itemPosto(p, p.distancia))}</ul>
          ) : (
            <p className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm text-slate-600">
              <MapPinOff className="h-4 w-4 text-slate-400" /> Nenhum posto cadastrado num raio de 2 km. Busque pelo nome abaixo.
            </p>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Não está na lista? Buscar posto pelo nome…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-slate-400" />
          </div>
          {achados.length > 0 && <ul className="space-y-1.5">{achados.map(p => itemPosto(p))}</ul>}

          {escolhido && escolhido.latitude == null && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <p className="mb-2 text-xs font-medium text-amber-800">
                Este posto ainda não tem localização. Estando nele, toque abaixo: o GPS registra o ponto e a coordenação confere depois.
              </p>
              <button type="button" disabled={ocupado} onClick={() => onMarcarLocal(escolhido.id)}
                className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50">
                Marcar local aqui
              </button>
            </div>
          )}

          {escolhido && escolhido.latitude != null && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">O que você vai fazer em {escolhido.nome}?</p>
              <select value={focoId} onChange={e => setFocoId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none focus:border-slate-400">
                <option value="">Atividade (obrigatório)…</option>
                {atividades.map(a => <option key={a.id} value={a.id}>{a.icone} {a.nome}</option>)}
              </select>
              <CampoObservacao value={obs} onChange={setObs} maxLength={300}
                placeholder="Observação (opcional): o que foi feito ou combinado. Toque em Falar para ditar." />
              <button type="button" disabled={!focoId || ocupado} onClick={confirmar}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40">
                Fazer check-in de chegada
              </button>
              <p className="text-[11px] text-slate-500">📷 Depois do check-in, anexe a foto: ela é obrigatória em toda visita.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
