'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'
import { listarCheckinsPendentes, salvarCheckinPendente, type CheckinPendente } from '@/lib/agenda/fila-checkins'
import { listarFotosPendentes } from '@/lib/agenda/fila-fotos'
import { semConexao } from '@/lib/agenda/rede'
import { descartarCheckin, EVENTO_FILA, sincronizarFilas, tentarDeNovo } from '@/lib/agenda/sync-fila'

const INTERVALO_MS = 15_000

function hora(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

/**
 * Envia a fila offline (check-ins e fotos) em qualquer tela do sistema, não só na agenda,
 * e avisa o supervisor do que está guardado no aparelho ou foi recusado. Só para supervisores.
 */
export function SincronizadorOffline() {
  const [pendentes, setPendentes] = useState<CheckinPendente[]>([])
  const [fotos, setFotos] = useState(0)
  const [offline, setOffline] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [justificativas, setJustificativas] = useState<Record<string, string>>({})

  // Justifica aqui mesmo: vale para check-in de qualquer dia, inclusive os que o painel de hoje não mostra.
  async function justificar(item: CheckinPendente) {
    const texto = (justificativas[item.localId] ?? '').trim()
    if (texto.length < 5) return
    await salvarCheckinPendente({ ...item, justificativa: texto, precisaJustificar: false })
    setJustificativas(j => { const n = { ...j }; delete n[item.localId]; return n })
    await atualizar()
    void enviar()
  }

  const atualizar = useCallback(async () => {
    setPendentes(await listarCheckinsPendentes())
    setFotos((await listarFotosPendentes()).length)
  }, [])

  const enviar = useCallback(async () => {
    if (semConexao()) return
    setEnviando(true)
    await sincronizarFilas()
    setEnviando(false)
  }, [])

  useEffect(() => {
    setOffline(semConexao())
    void atualizar()
    void enviar()
    const timer = window.setInterval(() => void enviar(), INTERVALO_MS)
    const aoVoltarSinal = () => { setOffline(false); void enviar() }
    const aoPerderSinal = () => setOffline(true)
    const aoVoltarTela = () => { if (document.visibilityState === 'visible') void enviar() }
    const aoAtualizar = () => void atualizar()
    window.addEventListener('online', aoVoltarSinal)
    window.addEventListener('offline', aoPerderSinal)
    window.addEventListener(EVENTO_FILA, aoAtualizar)
    document.addEventListener('visibilitychange', aoVoltarTela)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('online', aoVoltarSinal)
      window.removeEventListener('offline', aoPerderSinal)
      window.removeEventListener(EVENTO_FILA, aoAtualizar)
      document.removeEventListener('visibilitychange', aoVoltarTela)
    }
  }, [atualizar, enviar])

  const recusados = pendentes.filter(p => p.recusado)
  const aguardando = pendentes.filter(p => !p.recusado)
  const precisamJustificar = aguardando.filter(p => p.precisaJustificar && !p.justificativa)
  const naFila = aguardando.length + fotos

  if (!offline && naFila === 0 && recusados.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex justify-center sm:inset-x-auto sm:right-4 sm:justify-end">
      <div className="pointer-events-auto w-full max-w-sm space-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
        {offline && (
          <p className="flex items-start gap-2 text-xs font-medium text-slate-700">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            Sem conexão. Você pode continuar fazendo check-in: fica guardado no aparelho e é enviado sozinho quando o sinal voltar.
          </p>
        )}

        {naFila > 0 && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-sky-800">
              📡 {aguardando.length > 0 && `${aguardando.length} ${aguardando.length === 1 ? 'check-in aguardando' : 'check-ins aguardando'} envio`}
              {aguardando.length > 0 && fotos > 0 && ' · '}
              {fotos > 0 && `${fotos} ${fotos === 1 ? 'foto' : 'fotos'}`}
            </p>
            {!offline && (
              <button type="button" onClick={() => void enviar()} disabled={enviando}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                <RefreshCw className={`h-3 w-3 ${enviando ? 'animate-spin' : ''}`} /> {enviando ? 'Enviando…' : 'Enviar agora'}
              </button>
            )}
          </div>
        )}

        {aguardando.length > 0 && (
          <ul className="space-y-1">
            {aguardando.map(p => (
              <li key={p.localId} className="flex items-center justify-between gap-2 rounded-lg bg-sky-50 px-2.5 py-1.5 text-[11px] text-sky-900">
                <span className="min-w-0">
                  <b>{p.tipo === 'entrada' ? 'Chegada' : 'Saída'}</b> · {p.postoNome ?? 'Posto'} · {hora(p.capturadoEm)}
                </span>
                {p.precisaJustificar && !p.justificativa && <span className="shrink-0 font-bold text-amber-700">justificar</span>}
              </li>
            ))}
          </ul>
        )}

        {aguardando.length > 0 && precisamJustificar.length === 0 && (
          <Link href="/agenda#checkin-hoje" className="block text-[11px] font-bold text-sky-800 underline">Ver na agenda do dia</Link>
        )}

        {precisamJustificar.map(p => (
          <div key={p.localId} className="rounded-lg border border-amber-300 bg-amber-50 p-2.5">
            <p className="text-[11px] font-bold text-amber-800">
              {p.tipo === 'entrada' ? 'Chegada' : 'Saída'} de {hora(p.capturadoEm)} fora do raio{p.distancia != null ? ` (${Math.round(p.distancia)} m do posto)` : ''}. Justifique para enviar.
            </p>
            <textarea value={justificativas[p.localId] ?? ''} onChange={e => setJustificativas(j => ({ ...j, [p.localId]: e.target.value }))} rows={2}
              placeholder="Ex.: acesso fechado, atendimento na rua ao lado…"
              className="mt-1.5 w-full resize-none rounded-md border border-amber-200 bg-white p-2 text-xs outline-none focus:border-amber-400" />
            <div className="mt-1.5 flex gap-2">
              <button type="button" disabled={(justificativas[p.localId] ?? '').trim().length < 5} onClick={() => void justificar(p)}
                className="rounded-md bg-amber-500 px-3 py-1 text-[11px] font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-40">
                Enviar com justificativa
              </button>
              <button type="button"
                onClick={() => { if (window.confirm('Descartar este check-in do aparelho? Ele será perdido.')) void descartarCheckin(p.localId) }}
                className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-white">
                Descartar
              </button>
            </div>
          </div>
        ))}

        {recusados.map(p => (
          <div key={p.localId} className="rounded-lg border border-rose-200 bg-rose-50 p-2.5">
            <p className="text-[11px] font-bold text-rose-800">
              Check-in de {p.tipo === 'entrada' ? 'chegada' : 'saída'} de {hora(p.capturadoEm)} recusado
            </p>
            <p className="mt-0.5 text-[11px] text-rose-700">{p.recusado}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => void tentarDeNovo(p)}
                className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                Tentar de novo
              </button>
              <button type="button"
                onClick={() => { if (window.confirm('Descartar este check-in do aparelho? Ele será perdido.')) void descartarCheckin(p.localId) }}
                className="rounded-md px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100">
                Descartar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
