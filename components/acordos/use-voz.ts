'use client'

import { useEffect, useRef, useState } from 'react'

/* eslint-disable @typescript-eslint/no-explicit-any */
function criarReconhecimento(): any | null {
  if (typeof window === 'undefined') return null
  const W = window as any
  const R = W.SpeechRecognition || W.webkitSpeechRecognition
  return R ? new R() : null
}

/**
 * Ditado em português pelo reconhecimento de voz do navegador (Chrome, Edge, Safari; não existe no Firefox).
 * `suporta` só vira true depois de montar, para o servidor e o navegador renderizarem igual.
 */
export function useVoz() {
  const [suporta, setSuporta] = useState(false)
  const [ouvindo, setOuvindo] = useState(false)
  const rec = useRef<any>(null)

  useEffect(() => {
    setSuporta(criarReconhecimento() !== null)
    return () => rec.current?.stop?.()
  }, [])

  /** Liga/desliga o microfone; cada trecho reconhecido chega em `aoTexto`. */
  function alternar(aoTexto: (trecho: string) => void) {
    if (ouvindo) { rec.current?.stop(); return }
    const r = criarReconhecimento()
    if (!r) return
    r.lang = 'pt-BR'
    r.continuous = true
    r.interimResults = false
    r.onresult = (e: any) => {
      let dito = ''
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) dito += e.results[i][0].transcript
      dito = dito.trim()
      if (dito) aoTexto(dito)
    }
    r.onend = () => setOuvindo(false)
    r.onerror = () => setOuvindo(false)
    rec.current = r
    setOuvindo(true)
    r.start()
  }

  function parar() {
    rec.current?.stop?.()
  }

  return { suporta, ouvindo, alternar, parar }
}
