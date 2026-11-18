'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ScanSearch } from 'lucide-react'
import { geocodificarLote, listarPendentesGeocodificacao } from '@/app/(admin)/agenda/geocodificar-actions'
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
    </div>
  )
}

function somar(p: Placar, itens: ItemLote[]): Placar {
  const r = { ...p }
  for (const i of itens) r[i.situacao] += 1
  return r
}
