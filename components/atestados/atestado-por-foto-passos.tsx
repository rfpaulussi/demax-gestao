'use client'

import { Dialog } from '@base-ui/react/dialog'
import { AlertTriangle, ArrowRight, Camera, Check, ImagePlus, Search, ShieldCheck, Sparkles, UserRound, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CandidatoFuncionario } from '@/lib/atestados/leitura/casar-funcionario'
import type { DocumentoLido } from '@/lib/atestados/leitura/tipos'

// Só apresentação: o estado e as chamadas ficam em atestado-por-foto.tsx.

export const botaoPrimario =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40'
export const botaoSecundario =
  'inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50'

const ETAPAS = ['Foto', 'Funcionário', 'Conferir']

/** Faixa "1 Foto — 2 Funcionário — 3 Conferir"; `atual` vai de 1 a 3. */
function Etapas({ atual }: { atual: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Etapas">
      {ETAPAS.map((nome, i) => {
        const n = i + 1
        const feito = n < atual
        const ativo = n === atual
        return (
          <li key={nome} className="flex flex-1 items-center gap-2 last:flex-none" aria-current={ativo ? 'step' : undefined}>
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                feito && 'bg-emerald-500 text-white',
                ativo && 'bg-slate-900 text-white',
                !feito && !ativo && 'bg-slate-100 text-slate-400',
              )}
            >
              {feito ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : n}
            </span>
            <span className={cn('text-[11px] font-semibold uppercase tracking-widest', ativo ? 'text-slate-900' : 'text-slate-400')}>{nome}</span>
            {n < ETAPAS.length && <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />}
          </li>
        )
      })}
    </ol>
  )
}

function Cabecalho({ icone: Icone, titulo, subtitulo }: { icone: LucideIcon; titulo: string; subtitulo: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
        <Icone className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <Dialog.Title className="text-base font-bold text-slate-900">{titulo}</Dialog.Title>
        <p className="text-sm text-slate-500">{subtitulo}</p>
      </div>
    </div>
  )
}

function Aviso({ tom, icone: Icone, children }: { tom: 'ambar' | 'vermelho' | 'neutro'; icone: LucideIcon; children: React.ReactNode }) {
  const cores = {
    ambar: 'border-amber-200 bg-amber-50 text-amber-900',
    vermelho: 'border-red-200 bg-red-50 text-red-800',
    neutro: 'border-slate-200 bg-white text-slate-600',
  }[tom]
  const corIcone = { ambar: 'text-amber-600', vermelho: 'text-red-600', neutro: 'text-amber-500' }[tom]
  return (
    <div className={cn('flex gap-2.5 rounded-xl border px-3 py-2.5 text-xs leading-relaxed', cores)}>
      <Icone className={cn('mt-0.5 h-4 w-4 shrink-0', corIcone)} aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

// ─── Passo 1: escolher a foto ─────────────────────────────────────────────────

interface PropsEscolher {
  erro: string | null
  onTirarFoto: () => void
  onEnviarArquivo: () => void
  onDigitar: () => void
  onCancelar: () => void
}

export function PassoEscolher({ erro, onTirarFoto, onEnviarArquivo, onDigitar, onCancelar }: PropsEscolher) {
  const cartao =
    'group flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center transition-colors hover:border-slate-900 hover:bg-white focus-visible:border-slate-900 focus-visible:outline-none'
  const bolinha =
    'flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition-colors group-hover:bg-slate-900 group-hover:text-white'
  return (
    <div className="space-y-5 p-6">
      <Etapas atual={1} />
      <Cabecalho icone={Camera} titulo="Atestado por foto" subtitulo="Eu leio o atestado e você confere antes de salvar." />

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onTirarFoto} className={cartao}>
          <span className={bolinha}><Camera className="h-5 w-5" aria-hidden="true" /></span>
          <span className="text-sm font-bold text-slate-900">Tirar foto</span>
          <span className="text-xs text-slate-500">Abre a câmera do celular</span>
        </button>
        <button type="button" onClick={onEnviarArquivo} className={cartao}>
          <span className={bolinha}><ImagePlus className="h-5 w-5" aria-hidden="true" /></span>
          <span className="text-sm font-bold text-slate-900">Enviar arquivo</span>
          <span className="text-xs text-slate-500">Galeria, JPG, PNG ou PDF</span>
        </button>
      </div>
      <p className="-mt-2 text-center text-[11px] text-slate-400">No computador, os dois botões abrem a seleção de arquivos.</p>

      {erro && (
        <Aviso tom="vermelho" icone={AlertTriangle}>
          <p className="text-sm font-medium">{erro}</p>
        </Aviso>
      )}

      <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
        <span>A imagem é lida e descartada. Só os dados que você confirmar são gravados.</span>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancelar} className={botaoSecundario}>Cancelar</button>
        {erro && <button type="button" onClick={onDigitar} className={botaoSecundario}>Escolher o funcionário e digitar</button>}
      </div>
    </div>
  )
}

// ─── Passo 1b: lendo ──────────────────────────────────────────────────────────

export function PassoLendo() {
  return (
    <div className="space-y-6 p-6">
      <Etapas atual={1} />
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 rounded-full border-4 border-slate-100" aria-hidden="true" />
          <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-amber-500" aria-hidden="true" />
          <Camera className="h-6 w-6 text-slate-500" aria-hidden="true" />
        </span>
        <div>
          <Dialog.Title className="text-base font-bold text-slate-900">Lendo o atestado…</Dialog.Title>
          <p className="mt-1 text-sm text-slate-500">Isso leva alguns segundos. Não feche esta janela.</p>
        </div>
      </div>
    </div>
  )
}

// ─── Passo 2: quem é o funcionário ────────────────────────────────────────────

const ROTULO_STATUS: Record<string, { texto: string; classe: string }> = {
  afastado: { texto: 'Afastado', classe: 'bg-red-50 text-red-700 ring-red-200' },
  ferias: { texto: 'Férias', classe: 'bg-orange-50 text-orange-700 ring-orange-200' },
  atestado: { texto: 'Em atestado', classe: 'bg-amber-50 text-amber-700 ring-amber-200' },
  faltante: { texto: 'Faltante', classe: 'bg-rose-50 text-rose-700 ring-rose-200' },
  rescisao_indireta: { texto: 'Rescisão indireta', classe: 'bg-purple-50 text-purple-700 ring-purple-200' },
}

const pilula = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset'

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  const primeira = partes[0][0]
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return `${primeira}${ultima}`.toUpperCase()
}

function classeNota(nota: number): string {
  if (nota >= 0.9) return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (nota >= 0.7) return 'bg-sky-50 text-sky-700 ring-sky-200'
  return 'bg-amber-50 text-amber-700 ring-amber-200'
}

function Opcao({ c, marcado, onEscolher }: { c: CandidatoFuncionario; marcado: boolean; onEscolher: (c: CandidatoFuncionario) => void }) {
  const status = c.status ? ROTULO_STATUS[c.status] : undefined
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-slate-900/30',
        marcado ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      <input type="radio" name="funcionario" className="sr-only" checked={marcado} onChange={() => onEscolher(c)} />
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          marcado ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600',
        )}
        aria-hidden="true"
      >
        {marcado ? <Check className="h-4 w-4" /> : iniciais(c.nome)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900">{c.nome}</span>
        <span className="block truncate text-xs text-slate-500">{[c.postoNome, c.funcaoNome].filter(Boolean).join(' · ') || 'Sem posto'}</span>
        <span className="mt-1.5 flex flex-wrap gap-1.5">
          <span className={cn(pilula, classeNota(c.nota))}>{Math.round(c.nota * 100)}% parecido</span>
          {c.viaMae && <span className={cn(pilula, 'bg-indigo-50 text-indigo-700 ring-indigo-200')}>pelo nome da mãe</span>}
          {status && <span className={cn(pilula, status.classe)}>{status.texto}</span>}
        </span>
      </span>
    </label>
  )
}

interface PropsQuem {
  doc: DocumentoLido
  lista: CandidatoFuncionario[]
  /** Título da lista: "Encontrado no cadastro", "Você quis dizer…?" ou "Resultado da busca". */
  rotuloLista: string
  /** Não há candidato nem busca em andamento, mas havia nome no papel. */
  semParecido: boolean
  escolhido: CandidatoFuncionario | null
  onEscolher: (c: CandidatoFuncionario) => void
  termo: string
  onTermo: (v: string) => void
  idBusca: string
  buscando: boolean
  /** A busca por esse termo terminou sem achar ninguém. */
  nadaNaBusca: boolean
  onCancelar: () => void
  onContinuar: () => void
}

export function PassoQuem(p: PropsQuem) {
  const { doc } = p
  return (
    <div className="space-y-5 p-6">
      <Etapas atual={2} />
      <Cabecalho icone={UserRound} titulo="Quem é o funcionário?" subtitulo="Confirme de quem é este atestado." />

      {doc.pacienteNome && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">No papel</p>
          <p className="mt-0.5 text-sm font-bold text-slate-900">{doc.pacienteNome}</p>
        </div>
      )}

      {doc.tipo === 'outro' && (
        <Aviso tom="ambar" icone={AlertTriangle}>
          Este papel não parece um atestado médico. Confira antes de seguir.
        </Aviso>
      )}
      {doc.pacienteMenor && (
        <Aviso tom="ambar" icone={AlertTriangle}>
          O paciente é menor de idade — pode ser acompanhamento de filho(a).
          {doc.maeNome ? ` Procurei também pelo nome da mãe: ${doc.maeNome}.` : ''} Escolha o funcionário responsável.
        </Aviso>
      )}
      {doc.observacao && (
        <Aviso tom="neutro" icone={Sparkles}>
          <span className="font-semibold text-slate-700">Nota da leitura:</span> {doc.observacao}
        </Aviso>
      )}

      {p.lista.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{p.rotuloLista}</p>
          {p.lista.map(c => <Opcao key={c.id} c={c} marcado={p.escolhido?.id === c.id} onEscolher={p.onEscolher} />)}
        </div>
      ) : (
        p.semParecido && <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-500">Não achei ninguém parecido nos seus postos. Busque pelo nome abaixo.</p>
      )}

      <div>
        <label htmlFor={p.idBusca} className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Buscar pelo nome</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id={p.idBusca}
            type="text"
            value={p.termo}
            onChange={e => p.onTermo(e.target.value)}
            placeholder="Digite 3 letras ou mais"
            autoComplete="off"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </div>
        {p.buscando && <p className="mt-1.5 text-xs text-slate-400">Buscando…</p>}
        {p.nadaNaBusca && <p className="mt-1.5 text-xs text-slate-500">Ninguém encontrado com esse nome nos seus postos.</p>}
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" onClick={p.onCancelar} className={botaoSecundario}>Cancelar</button>
        <button type="button" disabled={!p.escolhido} onClick={p.onContinuar} className={botaoPrimario}>
          Continuar
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
