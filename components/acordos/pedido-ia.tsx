'use client'

import { useState } from 'react'
import { Mic, Sparkles, Square } from 'lucide-react'
import { interpretarPedidoAcordo, type RespostaInterpretacao } from '@/app/(admin)/acordos/ia-actions'
import { SITUACOES } from '@/lib/acordos/situacoes'
import { LABEL_CLS } from './passo'
import { useVoz } from './use-voz'

interface Props {
  /** Chave da IA configurada neste ambiente. */
  disponivel: boolean
  /** Recebe o pedido já interpretado para preencher o formulário (nunca salva). */
  onAplicar: (dados: RespostaInterpretacao) => void
}

export function PedidoIa({ disponivel, onAplicar }: Props) {
  const [texto, setTexto] = useState('')
  const [resposta, setResposta] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [ultimo, setUltimo] = useState<RespostaInterpretacao | null>(null)
  const { suporta: temVoz, ouvindo, alternar, parar } = useVoz()

  function alternarVoz(destino: 'pedido' | 'resposta') {
    alternar(dito => {
      const junta = (prev: string) => (prev ? `${prev} ${dito}` : dito)
      if (destino === 'pedido') setTexto(junta)
      else setResposta(junta)
    })
  }

  async function interpretar(textoFinal: string) {
    if (ouvindo) parar()
    setCarregando(true)
    setErro('')
    const r = await interpretarPedidoAcordo(textoFinal)
    setCarregando(false)
    if (!r.ok) { setErro(r.erro); return }
    setUltimo(r.dados)
    if (r.dados.resultado.template) onAplicar(r.dados)
  }

  function responder() {
    if (!ultimo || !resposta.trim()) return
    // guarda a pergunta junto da resposta, para o pedido continuar fazendo sentido sozinho
    const novo = `${texto.trim()}\nPergunta: ${ultimo.resultado.perguntas.join(' / ')}\nResposta: ${resposta.trim()}`
    setTexto(novo)
    setResposta('')
    void interpretar(novo)
  }

  if (!disponivel) return null

  const res = ultimo?.resultado
  const perguntas = res?.perguntas ?? []
  const avisos = res?.avisos ?? []

  return (
    <section id="passo-ia" className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/40 p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-600" />
        <h3 className={LABEL_CLS}>Descrever o pedido (opcional)</h3>
      </div>
      <p className="text-xs text-slate-500">
        Escreva ou fale como o pedido chegou. O sistema preenche o formulário abaixo; você confere tudo antes de salvar.
      </p>
      <textarea
        aria-label="Pedido em texto livre"
        value={texto}
        onChange={e => setTexto(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="ex: Liberamos o pessoal do Casarão às 12h no dia 14/09 por causa da chuva. Repõem em 6 dias."
        className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm text-slate-800 outline-none focus:border-violet-400"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => interpretar(texto)}
          disabled={carregando || texto.trim().length < 8}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-violet-700 px-4 text-sm font-bold text-white hover:bg-violet-600 disabled:opacity-40"
        >
          <Sparkles className="h-3.5 w-3.5" /> {carregando ? 'Lendo o pedido…' : 'Preencher o formulário'}
        </button>
        {temVoz && (
          <button
            type="button"
            onClick={() => alternarVoz('pedido')}
            aria-pressed={ouvindo}
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold ${
              ouvindo ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {ouvindo ? <><Square className="h-3.5 w-3.5" /> Parar</> : <><Mic className="h-3.5 w-3.5" /> Falar</>}
          </button>
        )}
      </div>
      <p className="text-[11px] text-gray-400">
        Nomes de funcionários, CPF e contatos são trocados por códigos antes de irem à IA.
        {temVoz && ' O ditado usa o reconhecimento de voz do navegador, que pode enviar o áudio ao serviço dele.'}
      </p>

      {erro && <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {res && res.template && (
        <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-800">
          Preenchi o formulário como <b>{SITUACOES[res.template].titulo}</b>. Confira os passos abaixo.
        </p>
      )}

      {avisos.map(a => (
        <p key={a} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">⚠ {a}</p>
      ))}

      {perguntas.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-800">Preciso saber</p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-amber-900">
            {perguntas.map(p => <li key={p}>{p}</li>)}
          </ul>
          <textarea
            aria-label="Resposta às perguntas"
            value={resposta}
            onChange={e => setResposta(e.target.value)}
            rows={2}
            placeholder="Responda aqui (pode falar também)"
            className="w-full rounded-lg border border-amber-200 bg-white p-2 text-sm outline-none focus:border-amber-400"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={responder}
              disabled={carregando || !resposta.trim()}
              className="flex h-8 items-center rounded-lg bg-amber-600 px-3 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-40"
            >
              Responder e refazer
            </button>
            {temVoz && (
              <button
                type="button"
                onClick={() => alternarVoz('resposta')}
                className="flex h-8 items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                <Mic className="h-3 w-3" /> {ouvindo ? 'Parar' : 'Falar'}
              </button>
            )}
          </div>
          <p className="text-[11px] text-amber-700">Se preferir, preencha o que falta direto no formulário abaixo.</p>
        </div>
      )}
    </section>
  )
}
