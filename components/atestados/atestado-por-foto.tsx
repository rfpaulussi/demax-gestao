'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog } from '@base-ui/react/dialog'
import { Camera } from 'lucide-react'
import { ModalAtestado } from '@/components/efetivo/modal-atestado'
import type { FuncionarioRow } from '@/components/efetivo/funcionarios-table'
import { buscarFuncionariosParaAtestado } from '@/app/(admin)/atestados/actions'
import { prepararArquivo } from '@/lib/atestados/leitura/reduzir-imagem'
import type { CandidatoFuncionario } from '@/lib/atestados/leitura/casar-funcionario'
import type { RespostaLeitura } from '@/lib/atestados/leitura/tipos'
import { PassoEscolher, PassoLendo, PassoQuem, botaoPrimario } from './atestado-por-foto-passos'

type Leitura = Extract<RespostaLeitura, { ok: true }>
type Etapa = 'fechado' | 'escolher' | 'lendo' | 'quem' | 'lancar'

/** Leitura vazia: usada quando o supervisor escolhe o funcionário na mão (IA fora do ar ou foto ruim). */
const LEITURA_VAZIA: Leitura = {
  ok: true,
  documento: { tipo: 'atestado_medico', observacao: null, pacienteNome: null, pacienteMenor: null, maeNome: null },
  preenchimento: { dataInicio: '', dias: '', dataFim: '', cidCodigo: '', avisos: { dataInicio: null, dias: null, cid: null } },
  candidatos: [],
  automatico: null,
}

export function AtestadoPorFoto({ cids }: { cids: { codigo: string; descricao: string }[] }) {
  const router = useRouter()
  // Dois inputs escondidos: um com `capture` (abre a câmera no celular) e outro livre (galeria, arquivo, PDF).
  // No computador os navegadores ignoram `capture` e os dois abrem a seleção de arquivos.
  const inputCameraRef = useRef<HTMLInputElement>(null)
  const inputArquivoRef = useRef<HTMLInputElement>(null)
  const idBusca = useId()
  const [etapa, setEtapa] = useState<Etapa>('fechado')
  const [erro, setErro] = useState<string | null>(null)
  const [leitura, setLeitura] = useState<Leitura | null>(null)
  const [escolhido, setEscolhido] = useState<CandidatoFuncionario | null>(null)
  const [termo, setTermo] = useState('')
  const [achados, setAchados] = useState<CandidatoFuncionario[]>([])
  const [buscando, setBuscando] = useState(false)
  const [termoBuscado, setTermoBuscado] = useState('')
  // A foto já reduzida segue para o modal, que a envia ao ambulatório depois de salvar.
  const [arquivoPronto, setArquivoPronto] = useState<File | null>(null)

  function fechar() {
    setEtapa('fechado'); setErro(null); setLeitura(null); setEscolhido(null); setTermo(''); setAchados([]); setTermoBuscado(''); setArquivoPronto(null)
  }

  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    setErro(null)
    setEtapa('lendo')
    try {
      const pronto = await prepararArquivo(arquivo)
      setArquivoPronto(pronto)
      const corpo = new FormData()
      corpo.set('arquivo', pronto)
      const resp = await fetch('/api/atestados/ler', { method: 'POST', body: corpo })
      // Sem sessão, o middleware redireciona para /login e a resposta volta como HTML, não JSON.
      if (resp.redirected || !(resp.headers.get('content-type') ?? '').includes('application/json')) {
        setErro(
          resp.redirected || resp.status === 401
            ? 'Sua sessão pode ter expirado. Recarregue a página e tente de novo.'
            : resp.status === 413
              ? 'A foto é grande demais. Tire outra com menos qualidade ou use um PDF menor.'
              : 'Não foi possível ler o atestado agora. Tente de novo.',
        )
        setEtapa('escolher')
        return
      }
      const json = (await resp.json()) as RespostaLeitura
      if (!json.ok) { setErro(json.erro); setEtapa('escolher'); return }
      setLeitura(json)
      setEscolhido(json.candidatos.find(c => c.id === json.automatico) ?? null)
      setEtapa('quem')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível ler o atestado. Tente de novo.')
      setEtapa('escolher')
    }
  }

  // Busca manual com espera de 400 ms entre as teclas.
  useEffect(() => {
    if (etapa !== 'quem' || termo.trim().length < 3) { setAchados([]); setBuscando(false); setTermoBuscado(''); return }
    let cancelado = false
    setBuscando(true)
    const timer = setTimeout(async () => {
      try {
        const r = await buscarFuncionariosParaAtestado(termo)
        if (!cancelado) setAchados(r)
      } catch {
        if (!cancelado) setAchados([])
      } finally {
        if (!cancelado) { setTermoBuscado(termo); setBuscando(false) }
      }
    }, 400)
    return () => { cancelado = true; clearTimeout(timer) }
  }, [termo, etapa])

  if (etapa === 'lancar' && escolhido && leitura) {
    return (
      <ModalAtestado
        key={escolhido.id}
        funcionario={{ id: escolhido.id, nome: escolhido.nome, status: escolhido.status as FuncionarioRow['status'], posto_id: escolhido.postoId }}
        open
        onClose={() => { fechar(); router.refresh() }}
        cids={cids}
        inicial={leitura.preenchimento}
        arquivoInicial={arquivoPronto ?? undefined}
      />
    )
  }

  const doc = leitura?.documento
  const buscaAtiva = termo.trim().length >= 3
  const lista = buscaAtiva ? achados : leitura?.candidatos ?? []

  return (
    <>
      <input ref={inputCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={aoEscolherArquivo} />
      <input ref={inputArquivoRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={aoEscolherArquivo} />
      <button type="button" onClick={() => setEtapa('escolher')} className={botaoPrimario}>
        <Camera className="h-4 w-4" aria-hidden="true" />
        Lançar por foto
      </button>

      <Dialog.Root open={etapa !== 'fechado'} onOpenChange={aberto => { if (!aberto && etapa !== 'lendo') fechar() }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-slate-900/50" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border-t-4 border-t-amber-500 bg-white shadow-2xl">
            {etapa === 'escolher' && (
              <PassoEscolher
                erro={erro}
                onTirarFoto={() => inputCameraRef.current?.click()}
                onEnviarArquivo={() => inputArquivoRef.current?.click()}
                onDigitar={() => { setLeitura(LEITURA_VAZIA); setErro(null); setEtapa('quem') }}
                onCancelar={fechar}
              />
            )}

            {etapa === 'lendo' && <PassoLendo />}

            {etapa === 'quem' && doc && (
              <PassoQuem
                doc={doc}
                lista={lista}
                rotuloLista={buscaAtiva ? 'Resultado da busca' : leitura?.automatico ? 'Encontrado no cadastro' : 'Você quis dizer…?'}
                semParecido={lista.length === 0 && !buscaAtiva && !!doc.pacienteNome}
                escolhido={escolhido}
                onEscolher={setEscolhido}
                termo={termo}
                onTermo={v => { setTermo(v); setEscolhido(null) }}
                idBusca={idBusca}
                buscando={buscando}
                nadaNaBusca={!buscando && buscaAtiva && termoBuscado === termo && achados.length === 0}
                onCancelar={fechar}
                onContinuar={() => setEtapa('lancar')}
              />
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
