'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Sparkles, Square, Undo2 } from 'lucide-react'
import { melhorarObservacao } from '@/app/(admin)/agenda/ia-actions'
import { comTempoLimite, semConexao } from '@/lib/agenda/rede'

// A Web Speech API ainda não está nos tipos do TypeScript.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Reconhecedor = any
function criarReconhecedor(): Reconhecedor | null {
  if (typeof window === 'undefined') return null
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SR) return null
  const r = new SR()
  r.lang = 'pt-BR'
  r.continuous = true
  r.interimResults = true
  return r
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const MENSAGEM_ERRO_VOZ: Record<string, string> = {
  'not-allowed': 'O microfone está bloqueado. Libere o microfone para este site nas configurações do navegador.',
  'service-not-allowed': 'O microfone está bloqueado. Libere o microfone para este site nas configurações do navegador.',
  'network': 'O ditado precisa de internet. Sem sinal, use o microfone do teclado do celular.',
  'no-speech': 'Não ouvi nada. Fale mais perto do celular e tente de novo.',
  'audio-capture': 'Não encontrei o microfone neste aparelho.',
}

/**
 * Campo de observação para o celular: textarea grande, botão de ditar por voz (Web Speech API, pt-BR)
 * e botão "Melhorar com IA" que limpa o texto sem inventar nada (com "Desfazer").
 */
export function CampoObservacao({
  value, onChange, placeholder, maxLength = 300, rows = 4,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  maxLength?: number
  rows?: number
}) {
  const [ouvindo, setOuvindo] = useState(false)
  const [suportaVoz, setSuportaVoz] = useState(true)
  const [aviso, setAviso] = useState<string | null>(null)
  const [melhorando, setMelhorando] = useState(false)
  const [anterior, setAnterior] = useState<string | null>(null)
  const recRef = useRef<Reconhecedor | null>(null)
  const baseRef = useRef('') // texto que já existia quando o ditado começou
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    setSuportaVoz(criarReconhecedor() !== null)
    return () => { try { recRef.current?.stop() } catch { /* já parado */ } }
  }, [])

  function alternarDitado() {
    setAviso(null)
    if (ouvindo) {
      try { recRef.current?.stop() } catch { /* já parado */ }
      return
    }
    const r = criarReconhecedor()
    if (!r) return setSuportaVoz(false)
    recRef.current = r
    baseRef.current = valueRef.current.trim()
    r.onresult = (e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => {
      let texto = ''
      for (let i = 0; i < e.results.length; i++) texto += e.results[i][0].transcript
      const junto = [baseRef.current, texto.trim()].filter(Boolean).join(' ')
      onChange(junto.slice(0, maxLength))
    }
    r.onerror = (e: { error: string }) => {
      setAviso(MENSAGEM_ERRO_VOZ[e.error] ?? 'Não consegui ouvir. Tente de novo ou use o microfone do teclado.')
      setOuvindo(false)
    }
    r.onend = () => setOuvindo(false)
    try {
      r.start()
      setOuvindo(true)
    } catch {
      setAviso('Não foi possível iniciar o microfone agora.')
    }
  }

  async function melhorar() {
    setAviso(null)
    if (ouvindo) try { recRef.current?.stop() } catch { /* já parado */ }
    if (semConexao()) return setAviso('Sem internet: a IA só funciona com sinal. Seu texto está salvo no campo.')
    setMelhorando(true)
    try {
      const original = value
      const r = await comTempoLimite(melhorarObservacao(original), 20_000)
      if (!r.ok) return setAviso(r.erro)
      setAnterior(original)
      onChange(r.texto.slice(0, maxLength))
    } catch {
      setAviso('A IA demorou para responder. Seu texto continua no campo.')
    } finally {
      setMelhorando(false)
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={e => { onChange(e.target.value); setAnterior(null) }}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        className="min-h-28 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-base leading-snug outline-none focus:border-slate-500"
      />
      <div className="flex flex-wrap items-center gap-2">
        {suportaVoz && (
          <button type="button" onClick={alternarDitado}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              ouvindo ? 'animate-pulse bg-rose-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-700'
            }`}>
            {ouvindo ? <><Square className="h-4 w-4" /> Parar de ouvir</> : <><Mic className="h-4 w-4" /> Falar</>}
          </button>
        )}
        <button type="button" onClick={() => void melhorar()} disabled={melhorando || value.trim().length < 8}
          className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40">
          <Sparkles className="h-4 w-4" /> {melhorando ? 'Melhorando…' : 'Melhorar com IA'}
        </button>
        {anterior !== null && (
          <button type="button" onClick={() => { onChange(anterior); setAnterior(null) }}
            className="flex items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
            <Undo2 className="h-4 w-4" /> Desfazer
          </button>
        )}
        <span className="ml-auto text-[11px] text-slate-400">{value.length}/{maxLength}</span>
      </div>
      {ouvindo && <p className="text-xs font-medium text-rose-600">🎙️ Ouvindo… fale normalmente e toque em &quot;Parar de ouvir&quot; quando terminar.</p>}
      {!suportaVoz && <p className="text-[11px] text-slate-500">Para ditar, toque no 🎤 do teclado do celular.</p>}
      {aviso && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{aviso}</p>}
    </div>
  )
}
