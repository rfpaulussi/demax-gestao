'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Briefcase, Bus, ClipboardCheck, Info, Plus, Search, Shirt, SlidersHorizontal, User, X, type LucideIcon,
} from 'lucide-react'
import {
  buscarSubstituiveis, consultarCep,
  type LinhaConhecida, type SugestaoAdmissao, type Substituivel,
} from '@/app/(admin)/admissao/actions'
import { MOTIVOS_POR_TIPO, TIPOS_DESLIGAMENTO, type TipoDesligamento } from '@/components/efetivo/modal-desligar'
import { EMPRESAS_ONIBUS_MOGI, TARIFA_ONIBUS_MOGI } from '@/lib/admissao/constantes'
import { formatarCep, formatarCpf, formatarTelefone, validarCpf } from '@/lib/admissao/cpf'
import {
  DOCUMENTOS_ADMISSAO, DOCUMENTOS_DEPENDENTES, MAX_LINHAS_VT, TIPOS_TRANSPORTE, UFS, linhaVtVazia,
  type CartaoVT, type DossieAdmissao, type LinhaVT,
} from '@/lib/admissao/tipos'
import { formatarMoeda, totaisVT } from '@/lib/admissao/vt'
import { formatarResumoTurno } from '@/lib/turnos/escala'
import { cn } from '@/lib/utils'

export type PostoOpt = { id: string; nome: string; secretaria: string | null }
export type FuncaoOpt = { id: string; nome: string; postoFiltro: 'apenas_sms' | 'todos' | 'sem_sms' }
export type TurnoOpcao = {
  id: string
  nome: string
  hora_entrada: string
  hora_saida_seg_qui: string
  hora_saida_sex: string | null
  hora_inicio_almoco: string | null
  hora_fim_almoco: string | null
  tipo_escala: string
  hora_entrada_sex?: string | null
  hora_inicio_almoco_sex?: string | null
  hora_fim_almoco_sex?: string | null
  hora_entrada_sabado?: string | null
  hora_inicio_almoco_sabado?: string | null
  hora_fim_almoco_sabado?: string | null
  hora_saida_sabado?: string | null
}

export type Definir = <K extends keyof DossieAdmissao>(campo: K, valor: DossieAdmissao[K]) => void

// ─── Identidade visual das etapas (uma cor por etapa, como as cores por métrica do sistema) ───

export interface InfoEtapa {
  titulo: string
  descricao: string
  icone: LucideIcon
  /** Classes literais (o Tailwind só gera o que aparece escrito por inteiro). */
  tile: string
  barra: string
  borda: string
  anel: string
}

export const INFO_ETAPAS: InfoEtapa[] = [
  { titulo: 'Pessoais',        descricao: 'Dados do funcionário, como estão nos documentos.',             icone: User,              tile: 'bg-blue-100 text-blue-700',       barra: 'bg-blue-600',    borda: 'border-blue-600',    anel: 'ring-blue-200' },
  { titulo: 'Vaga',            descricao: 'Onde, quando e em que turno ele começa.',                      icone: Briefcase,         tile: 'bg-violet-100 text-violet-700',   barra: 'bg-violet-600',  borda: 'border-violet-600',  anel: 'ring-violet-200' },
  { titulo: 'Condições',       descricao: 'Salário e benefícios vêm do cadastro da função.',              icone: SlidersHorizontal, tile: 'bg-indigo-100 text-indigo-700',   barra: 'bg-indigo-600',  borda: 'border-indigo-600',  anel: 'ring-indigo-200' },
  { titulo: 'Vale transporte', descricao: 'Linhas que ele usa de casa ao posto e o cartão.',              icone: Bus,               tile: 'bg-emerald-100 text-emerald-700', barra: 'bg-emerald-600', borda: 'border-emerald-600', anel: 'ring-emerald-200' },
  { titulo: 'Uniforme',        descricao: 'Tamanhos e documentos que ele já entregou.',                   icone: Shirt,             tile: 'bg-orange-100 text-orange-700',   barra: 'bg-orange-500',  borda: 'border-orange-500',  anel: 'ring-orange-200' },
  { titulo: 'Revisão',         descricao: 'Confira tudo antes de enviar e imprimir.',                     icone: ClipboardCheck,    tile: 'bg-amber-100 text-amber-700',     barra: 'bg-amber-500',   borda: 'border-amber-500',   anel: 'ring-amber-200' },
]

export const rotuloClasse = 'mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500'
export const campoClasse =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ' +
  'focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400'

function Rotulado({ rotulo, children, className }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className={rotuloClasse}>{rotulo}</label>
      {children}
    </div>
  )
}

/** Bloco de apoio dentro de uma etapa. */
function Painel({ titulo, children, tom = 'slate', className }: {
  titulo?: string
  children: ReactNode
  tom?: 'slate' | 'blue' | 'amber' | 'emerald'
  className?: string
}) {
  const tons = {
    slate: 'border-slate-200 bg-slate-50/70',
    blue: 'border-blue-200 bg-blue-50/70',
    amber: 'border-amber-200 bg-amber-50/70',
    emerald: 'border-emerald-200 bg-emerald-50/70',
  }
  const tit = { slate: 'text-slate-700', blue: 'text-blue-800', amber: 'text-amber-800', emerald: 'text-emerald-800' }
  return (
    <div className={cn('space-y-3 rounded-xl border p-4', tons[tom], className)}>
      {titulo && <p className={cn('text-sm font-semibold', tit[tom])}>{titulo}</p>}
      {children}
    </div>
  )
}

const fmtData = (iso: string | null) => {
  if (!iso) return ''
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

/** "demissao"/"justa_causa" → "Demissão — Justa Causa" (sem os parênteses explicativos do formulário de desligamento). */
function descricaoSaida(tipo: string | null, motivo: string | null): string {
  const curto = (s: string) => s.replace(/\s*\(.*\)\s*$/, '')
  const t = TIPOS_DESLIGAMENTO.find(x => x.value === tipo)
  const m = tipo ? MOTIVOS_POR_TIPO[tipo as TipoDesligamento]?.find(x => x.value === motivo) : undefined
  return [t ? curto(t.label) : tipo, m ? curto(m.label) : motivo].filter(Boolean).join(' — ')
}

/** Mês atual e os 11 anteriores, para o filtro "mês da saída". */
function opcoesMeses(): { valor: string; rotulo: string }[] {
  const hoje = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const nome = d.toLocaleDateString('pt-BR', { month: 'long' })
    return { valor, rotulo: `${nome.charAt(0).toUpperCase()}${nome.slice(1)}/${d.getFullYear()}` }
  })
}

// ─── 1. Pessoais ──────────────────────────────────────────────────────────────

type EstadoCep = 'parado' | 'buscando' | 'ok' | 'generico' | 'erro'

export function EtapaPessoais({ d, definir }: { d: DossieAdmissao; definir: Definir }) {
  const [cep, setCep] = useState<{ estado: EstadoCep; msg: string | null }>({ estado: 'parado', msg: null })
  const ultimoCep = useRef('')
  /** O endereço da tela veio de uma busca de CEP (e não digitado à mão). */
  const preenchidoPorCep = useRef(false)
  const refLogradouro = useRef<HTMLInputElement>(null)
  const refNumero = useRef<HTMLInputElement>(null)

  /** Busca o endereço do CEP. `forcar` repete a busca mesmo para o CEP que já foi consultado (nova tentativa). */
  async function buscarCep(digitos: string, forcar = false) {
    if (digitos.length !== 8 || (!forcar && digitos === ultimoCep.current)) return
    ultimoCep.current = digitos
    // CEP novo: o endereço do CEP anterior não vale mais (e não pode passar por válido se esta busca falhar).
    if (preenchidoPorCep.current) {
      definir('logradouro', '')
      definir('bairro', '')
      definir('cidade', '')
      definir('uf', '')
      preenchidoPorCep.current = false
    }
    setCep({ estado: 'buscando', msg: 'Buscando endereço…' })
    const r = await consultarCep(digitos)
    // O supervisor pode ter mudado o CEP enquanto a busca rodava: ignora a resposta velha.
    if (ultimoCep.current !== digitos) return
    if (!r.success) {
      ultimoCep.current = '' // deixa tentar de novo
      setCep({ estado: 'erro', msg: r.error })
      return
    }
    definir('logradouro', r.endereco.logradouro)
    definir('bairro', r.endereco.bairro)
    definir('cidade', r.endereco.cidade)
    definir('uf', r.endereco.uf)
    preenchidoPorCep.current = true
    if (r.endereco.logradouro) {
      setCep({ estado: 'ok', msg: 'Endereço encontrado — falta só o número.' })
      setTimeout(() => refNumero.current?.focus(), 0)
    } else {
      setCep({ estado: 'generico', msg: 'CEP geral da cidade/bairro: digite o nome da rua.' })
      setTimeout(() => refLogradouro.current?.focus(), 0)
    }
  }

  function aoMudarCep(valor: string) {
    const digitos = valor.replace(/\D/g, '').slice(0, 8)
    definir('cep', digitos)
    if (digitos.length < 8) {
      ultimoCep.current = '' // apagou ou está digitando: o mesmo CEP volta a ser buscado se for digitado de novo
      setCep({ estado: 'parado', msg: null })
      return
    }
    void buscarCep(digitos)
  }

  const cpfCompleto = d.cpf.length === 11
  const cpfInvalido = cpfCompleto && !validarCpf(d.cpf)
  const cpfOk = cpfCompleto && !cpfInvalido

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Rotulado rotulo="Nome completo *" className="sm:col-span-2">
          <input className={campoClasse} style={{ textTransform: 'uppercase' }} value={d.nome} autoComplete="off"
            onChange={e => definir('nome', e.target.value.toUpperCase())} placeholder="NOME COMO NO DOCUMENTO" />
        </Rotulado>
        <Rotulado rotulo="CPF *">
          <input className={cn(campoClasse, cpfInvalido && 'border-red-400 focus:border-red-500 focus:ring-red-100', cpfOk && 'border-emerald-400')}
            inputMode="numeric" autoComplete="off" value={formatarCpf(d.cpf)}
            onChange={e => definir('cpf', e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="000.000.000-00" />
          {cpfInvalido && <p className="mt-1 text-xs text-red-600">CPF inválido — confira os dígitos.</p>}
        </Rotulado>
        <Rotulado rotulo="Telefone (com DDD) *">
          <input className={campoClasse} inputMode="tel" autoComplete="off" value={formatarTelefone(d.telefone)}
            onChange={e => definir('telefone', e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="(00) 00000-0000" />
        </Rotulado>
        <Rotulado rotulo="E-mail" className="sm:col-span-2">
          <input className={campoClasse} type="email" autoComplete="off" value={d.email}
            onChange={e => definir('email', e.target.value)} placeholder="opcional" />
        </Rotulado>
      </div>

      <Painel titulo="Endereço" tom="blue">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
          <Rotulado rotulo="CEP *" className="sm:col-span-2">
            <input className={cn(campoClasse, cep.estado === 'ok' && 'border-emerald-400', cep.estado === 'erro' && 'border-amber-400')}
              inputMode="numeric" autoComplete="off" value={formatarCep(d.cep)} placeholder="00000-000"
              onChange={e => aoMudarCep(e.target.value)}
              // Cobre rascunho retomado e colagem: CEP completo sem endereço busca ao sair do campo.
              onBlur={() => { if (d.cep.length === 8 && !d.logradouro.trim()) void buscarCep(d.cep, true) }} />
            {cep.msg && (
              <p className={cn('mt-1 text-xs',
                cep.estado === 'ok' ? 'text-emerald-700' : cep.estado === 'erro' ? 'text-amber-700' : cep.estado === 'generico' ? 'text-amber-700' : 'text-slate-500')}>
                {cep.msg}
                {cep.estado === 'erro' && d.cep.length === 8 && (
                  <button type="button" className="ml-1.5 font-medium underline" onClick={() => void buscarCep(d.cep, true)}>tentar de novo</button>
                )}
              </p>
            )}
          </Rotulado>
          <Rotulado rotulo="Endereço *" className="sm:col-span-4">
            <input ref={refLogradouro} className={campoClasse} value={d.logradouro} autoComplete="off" onChange={e => definir('logradouro', e.target.value)} placeholder="Rua, avenida…" />
          </Rotulado>
          <Rotulado rotulo="Número *" className="sm:col-span-2">
            <input ref={refNumero} className={campoClasse} value={d.numero} autoComplete="off" onChange={e => definir('numero', e.target.value)} placeholder="S/N se não houver" />
          </Rotulado>
          <Rotulado rotulo="Complemento" className="sm:col-span-4">
            <input className={campoClasse} value={d.complemento} autoComplete="off" onChange={e => definir('complemento', e.target.value)} />
          </Rotulado>
          <Rotulado rotulo="Bairro *" className="sm:col-span-3">
            <input className={campoClasse} value={d.bairro} autoComplete="off" onChange={e => definir('bairro', e.target.value)} />
          </Rotulado>
          <Rotulado rotulo="Cidade *" className="sm:col-span-2">
            <input className={campoClasse} value={d.cidade} autoComplete="off" onChange={e => definir('cidade', e.target.value)} />
          </Rotulado>
          <Rotulado rotulo="UF *" className="sm:col-span-1">
            <select className={campoClasse} value={d.uf} onChange={e => definir('uf', e.target.value)}>
              <option value="">—</option>
              {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </Rotulado>
        </div>
      </Painel>
    </div>
  )
}

// ─── 2. Vaga ──────────────────────────────────────────────────────────────────

interface PropsVaga {
  d: DossieAdmissao
  definir: Definir
  postos: PostoOpt[]
  funcoes: FuncaoOpt[]
  postosFiltrados: PostoOpt[]
  jovemAprendiz: boolean
  turnoOpcoes: TurnoOpcao[]
  carregandoTurnos: boolean
}

export function EtapaVaga({ d, definir, funcoes, postosFiltrados, jovemAprendiz, turnoOpcoes, carregandoTurnos }: PropsVaga) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Rotulado rotulo="Função *">
          <select className={campoClasse} value={d.funcao_id} onChange={e => definir('funcao_id', e.target.value)}>
            <option value="">Selecione…</option>
            {funcoes.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </Rotulado>
        <Rotulado rotulo="Posto *">
          <select className={campoClasse} value={d.posto_id} onChange={e => definir('posto_id', e.target.value)}>
            <option value="">Selecione…</option>
            {postosFiltrados.map(p => <option key={p.id} value={p.id}>{p.nome}{p.secretaria ? ` — ${p.secretaria}` : ''}</option>)}
          </select>
        </Rotulado>
        <Rotulado rotulo="Data de admissão *">
          <input type="date" className={campoClasse} value={d.data_admissao} onChange={e => definir('data_admissao', e.target.value)} />
        </Rotulado>
        <Rotulado rotulo="Período de experiência">
          <select className={campoClasse} value={d.periodo_experiencia} disabled={jovemAprendiz}
            onChange={e => definir('periodo_experiencia', e.target.value as DossieAdmissao['periodo_experiencia'])}>
            <option value="nenhum">Nenhum</option>
            <option value="30+30">30 + 30 dias</option>
            <option value="45+45">45 + 45 dias</option>
          </select>
          <p className={cn('mt-1 text-xs', jovemAprendiz ? 'font-medium text-amber-600' : 'text-slate-400')}>
            {jovemAprendiz
              ? '⚠ Jovem Aprendiz não tem período de experiência.'
              : 'Use "Nenhum" se foi recontratado há menos de 6 meses.'}
          </p>
        </Rotulado>
      </div>

      {d.posto_id && (
        <Painel titulo="Turno de trabalho" tom="blue">
          {carregandoTurnos ? (
            <p className="text-xs text-blue-600">Carregando turnos…</p>
          ) : turnoOpcoes.length === 0 ? (
            <p className="text-xs text-amber-700">
              {jovemAprendiz
                ? 'Nenhum turno de jovem aprendiz cadastrado.'
                : 'Nenhum turno cadastrado para este posto — o horário ficará pendente de atribuição após a aprovação e o bloco de horário do Cadastro sairá em branco.'}
            </p>
          ) : (
            <>
              <Rotulado rotulo="Turno *">
                <select className={campoClasse} value={d.turno_id} onChange={e => definir('turno_id', e.target.value)}>
                  <option value="">Selecione…</option>
                  {turnoOpcoes.map(t => <option key={t.id} value={t.id}>{t.nome} — {formatarResumoTurno(t)}</option>)}
                </select>
              </Rotulado>
              {jovemAprendiz && (
                <Rotulado rotulo="Dia de curso *">
                  <select className={campoClasse} value={d.dia_curso ?? ''} onChange={e => definir('dia_curso', e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Selecione…</option>
                    {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
                  </select>
                </Rotulado>
              )}
            </>
          )}
        </Painel>
      )}

      <div>
        <label className={rotuloClasse}>Motivo da admissão</label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {([['aumento_efetivo', 'Aumento de efetivo', 'Uma vaga nova no posto.'], ['substituicao', 'Substituição', 'Entra no lugar de alguém que saiu.']] as const).map(([valor, titulo, apoio]) => (
            <label key={valor}
              className={cn('flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors',
                d.motivo === valor ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300')}>
              <input type="radio" name="motivo" className="mt-1" checked={d.motivo === valor} onChange={() => definir('motivo', valor)} />
              <span>
                <span className="block text-sm font-semibold text-slate-800">{titulo}</span>
                <span className="block text-xs text-slate-500">{apoio}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {d.motivo === 'substituicao' && <Substituido d={d} definir={definir} />}
    </div>
  )
}

function Substituido({ d, definir }: { d: DossieAdmissao; definir: Definir }) {
  const [termo, setTermo] = useState('')
  const [mes, setMes] = useState('')
  const [itens, setItens] = useState<Substituivel[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [manual, setManual] = useState(!!d.substituido_nome && !d.substituido_id)
  const meses = useRef(opcoesMeses()).current

  useEffect(() => {
    if (manual) return
    let cancelado = false
    setCarregando(true)
    const t = setTimeout(async () => {
      try {
        const r = await buscarSubstituiveis(d.posto_id, termo, mes || undefined)
        if (cancelado) return
        if (r.success) { setItens(r.itens); setErro(null) } else setErro(r.error)
      } catch {
        if (!cancelado) setErro('Não foi possível buscar os desligados. Use "Não achei — digitar o nome".')
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }, termo ? 350 : 0)
    return () => { cancelado = true; clearTimeout(t) }
  }, [d.posto_id, termo, mes, manual])

  function escolher(s: Substituivel) {
    definir('substituido_id', s.id)
    definir('substituido_nome', s.nome)
    definir('substituido_motivo', descricaoSaida(s.tipo_desligamento, s.motivo_desligamento))
    definir('substituido_data_desligamento', s.data_desligamento?.slice(0, 10) ?? '')
  }

  function limpar() {
    definir('substituido_id', null)
    definir('substituido_nome', '')
    definir('substituido_motivo', '')
    definir('substituido_data_desligamento', '')
  }

  return (
    <Painel tom="amber" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-amber-800">Quem está sendo substituído?</p>
        <button type="button" className="text-xs font-medium text-amber-800 underline" onClick={() => { limpar(); setManual(m => !m) }}>
          {manual ? 'Buscar entre os desligados' : 'Não achei — digitar o nome'}
        </button>
      </div>

      {!manual && (
        d.substituido_id ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm">
            <span><strong>{d.substituido_nome}</strong>{d.substituido_data_desligamento ? ` · saiu em ${fmtData(d.substituido_data_desligamento)}` : ''}</span>
            <button type="button" className="text-xs font-medium text-emerald-800 underline" onClick={limpar}>trocar</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
              <div className="relative sm:col-span-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input className={cn(campoClasse, 'pl-9')} placeholder="Buscar pelo nome (3+ letras)" value={termo} onChange={e => setTermo(e.target.value)} />
              </div>
              <select className={cn(campoClasse, 'sm:col-span-2')} value={mes} onChange={e => setMes(e.target.value)} disabled={termo.trim().length >= 3} aria-label="Mês da saída">
                <option value="">Últimos 60 dias</option>
                {meses.map(m => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
              </select>
            </div>
            <p className="text-xs text-amber-700">
              {termo.trim().length >= 3
                ? 'Buscando pelo nome nos últimos 24 meses, ignorando o mês.'
                : 'Só aparecem desligados dos seus postos. Escolha o mês da saída ou digite o nome para achar os mais antigos.'}
            </p>
            {erro && <p className="text-xs text-red-600">{erro}</p>}
            <ul className="max-h-56 divide-y divide-amber-100 overflow-y-auto rounded-lg border border-amber-100 bg-white text-sm">
              {carregando && <li className="px-3 py-2.5 text-xs text-slate-400">Buscando…</li>}
              {!carregando && itens.length === 0 && (
                <li className="px-3 py-2.5 text-xs text-slate-400">Nenhum desligado dos seus postos neste período. Tente outro mês ou busque pelo nome.</li>
              )}
              {itens.map(s => (
                <li key={s.id}>
                  <button type="button" onClick={() => escolher(s)} className="flex w-full flex-col px-3 py-2.5 text-left hover:bg-amber-50">
                    <span className="font-medium text-slate-800">{s.nome}</span>
                    <span className="text-xs text-slate-500">
                      {s.posto_nome ?? 'sem posto'}
                      {s.mesmo_posto && <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">mesmo posto</span>}
                      {' '}· saiu em {fmtData(s.data_desligamento)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )
      )}

      {manual && (
        <Rotulado rotulo="Nome do substituído *">
          <input className={campoClasse} style={{ textTransform: 'uppercase' }} value={d.substituido_nome}
            onChange={e => definir('substituido_nome', e.target.value.toUpperCase())} />
        </Rotulado>
      )}

      {(manual || d.substituido_id) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Rotulado rotulo="Motivo da saída">
            <input className={campoClasse} value={d.substituido_motivo} onChange={e => definir('substituido_motivo', e.target.value)} />
          </Rotulado>
          <Rotulado rotulo="Data do desligamento">
            <input type="date" className={campoClasse} value={d.substituido_data_desligamento} onChange={e => definir('substituido_data_desligamento', e.target.value)} />
          </Rotulado>
        </div>
      )}
    </Painel>
  )
}

// ─── 3. Condições ─────────────────────────────────────────────────────────────

export function EtapaCondicoes({ d, definir, sugestao }: { d: DossieAdmissao; definir: Definir; sugestao: SugestaoAdmissao | null }) {
  const f = sugestao?.funcao ?? null
  const adicional = (perc: number | null, valor: number | null) =>
    valor && valor > 0 ? `${perc ? `${perc}% · ` : ''}${formatarMoeda(valor)}` : 'Não'
  const dados = f
    ? [
        { r: 'Função', v: f.nome },
        { r: 'Salário base', v: formatarMoeda(f.salario_base) || '—' },
        { r: 'Insalubridade', v: adicional(f.insalubridade_perc, f.insalubridade_valor) },
        { r: 'Periculosidade', v: adicional(f.periculosidade_perc, f.periculosidade_valor) },
      ]
    : []
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-indigo-700">Do cadastro da função</p>
        {f ? (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {dados.map(x => (
              <div key={x.r} className="rounded-lg bg-white px-3 py-2 shadow-sm">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{x.r}</dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-900">{x.v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-slate-400">Escolha a função e o posto na etapa anterior.</p>
        )}
      </div>

      <p className="flex items-start gap-2 text-xs text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Sugeridos pelo sistema — corrija se for diferente. Saem impressos no Cadastro de Funcionários.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Rotulado rotulo="Contrato"><input className={campoClasse} value={d.contrato} onChange={e => definir('contrato', e.target.value)} /></Rotulado>
        <Rotulado rotulo="Centro de custo"><input className={campoClasse} value={d.centro_custo} onChange={e => definir('centro_custo', e.target.value)} /></Rotulado>
        <Rotulado rotulo="Sindicato"><input className={campoClasse} value={d.sindicato} onChange={e => definir('sindicato', e.target.value)} /></Rotulado>
        <Rotulado rotulo="CBO"><input className={campoClasse} value={d.cbo} onChange={e => definir('cbo', e.target.value)} /></Rotulado>
        <Rotulado rotulo="Setor (Segurança do Trabalho)" className="sm:col-span-2"><input className={campoClasse} value={d.setor} onChange={e => definir('setor', e.target.value)} /></Rotulado>
        <Rotulado rotulo="Vale alimentação (R$)"><input className={campoClasse} inputMode="decimal" value={d.va} onChange={e => definir('va', e.target.value)} placeholder="0,00" /></Rotulado>
        <Rotulado rotulo="Vale refeição (R$)"><input className={campoClasse} inputMode="decimal" value={d.vr} onChange={e => definir('vr', e.target.value)} placeholder="0,00" /></Rotulado>
      </div>
    </div>
  )
}

// ─── 4. Vale transporte ───────────────────────────────────────────────────────

export function EtapaVt({ d, definir, linhasConhecidas }: { d: DossieAdmissao; definir: Definir; linhasConhecidas: LinhaConhecida[] }) {
  const totais = totaisVT(d.vt_linhas)

  function mudarLinha(i: number, campo: keyof LinhaVT, valor: string) {
    definir('vt_linhas', d.vt_linhas.map((l, idx) => {
      if (idx !== i) return l
      const nova = { ...l, [campo]: valor }
      // Linha já conhecida: completa tipo, empresa e valor se ainda estiverem em branco.
      if (campo === 'linha' && !l.empresa.trim()) {
        const conhecida = linhasConhecidas.find(k => k.linha.trim().toLowerCase() === valor.trim().toLowerCase())
        if (conhecida) {
          nova.tipo = conhecida.tipo || nova.tipo
          nova.empresa = conhecida.empresa ?? ''
          if (conhecida.valor !== null) nova.valor = conhecida.valor.toFixed(2).replace('.', ',')
        }
      }
      return nova
    }))
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {([[true, 'Utiliza vale transporte', 'Informe as linhas que ele usa.'], [false, 'Não utiliza', 'Sai sem linhas no formulário.']] as const).map(([valor, titulo, apoio]) => (
          <label key={String(valor)}
            className={cn('flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors',
              d.vt_utiliza === valor ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300')}>
            <input type="radio" name="vt" className="mt-1" checked={d.vt_utiliza === valor} onChange={() => definir('vt_utiliza', valor)} />
            <span>
              <span className="block text-sm font-semibold text-slate-800">{titulo}</span>
              <span className="block text-xs text-slate-500">{apoio}</span>
            </span>
          </label>
        ))}
      </div>

      {d.vt_utiliza && (
        <>
          <datalist id="admissao-linhas">
            {linhasConhecidas.map(l => <option key={l.linha} value={l.linha}>{[l.empresa, l.valor !== null ? formatarMoeda(l.valor) : ''].filter(Boolean).join(' · ')}</option>)}
          </datalist>

          <div className="space-y-3">
            {d.vt_linhas.map((l, i) => (
              <div key={i} className="rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Linha {i + 1}</span>
                  {d.vt_linhas.length > 1 && (
                    <button type="button" aria-label="Remover linha" title="Remover linha"
                      onClick={() => definir('vt_linhas', d.vt_linhas.filter((_, idx) => idx !== i))}
                      className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-12">
                  <Rotulado rotulo="Tipo" className="sm:col-span-3">
                    <select className={campoClasse} value={l.tipo} onChange={e => mudarLinha(i, 'tipo', e.target.value)}>
                      {TIPOS_TRANSPORTE.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </Rotulado>
                  <Rotulado rotulo="Nome e nº da linha *" className="col-span-2 sm:col-span-9">
                    <input className={campoClasse} list="admissao-linhas" value={l.linha} placeholder="Digite para buscar linhas já usadas"
                      onChange={e => mudarLinha(i, 'linha', e.target.value)} />
                  </Rotulado>
                  <Rotulado rotulo="Empresa" className="col-span-2 sm:col-span-6">
                    <input className={campoClasse} value={l.empresa} onChange={e => mudarLinha(i, 'empresa', e.target.value)} />
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {EMPRESAS_ONIBUS_MOGI.map(emp => (
                        <button key={emp} type="button" onClick={() => mudarLinha(i, 'empresa', emp)}
                          className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium',
                            l.empresa === emp ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}>
                          {emp}
                        </button>
                      ))}
                    </div>
                  </Rotulado>
                  <Rotulado rotulo="Valor (R$) *" className="sm:col-span-3">
                    <input className={campoClasse} inputMode="decimal" value={l.valor} placeholder="0,00" onChange={e => mudarLinha(i, 'valor', e.target.value)} />
                  </Rotulado>
                  <Rotulado rotulo="Passagens/dia *" className="sm:col-span-3">
                    <input className={campoClasse} inputMode="numeric" value={l.qtd} onChange={e => mudarLinha(i, 'qtd', e.target.value.replace(/\D/g, '').slice(0, 2))} />
                  </Rotulado>
                </div>
              </div>
            ))}
          </div>

          {d.vt_linhas.length < MAX_LINHAS_VT && (
            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-emerald-400 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
              onClick={() => definir('vt_linhas', [...d.vt_linhas, linhaVtVazia()])}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar linha
            </button>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm">
            <span className="text-emerald-800">Total por dia</span>
            <span><strong className="text-lg text-emerald-900">{formatarMoeda(totais.valorDia) || 'R$ 0,00'}</strong> <span className="text-emerald-700">em {totais.passagensDia} passagem(ns)</span></span>
          </div>
          <p className="text-xs text-slate-400">Tarifa municipal de ônibus: R$ {TARIFA_ONIBUS_MOGI} desde 01/04/2026 (Decreto nº 24.277/2026).</p>

          <div>
            <label className={rotuloClasse}>Possui cartão?</label>
            <div className="flex flex-wrap gap-2">
              {([['nenhum', 'Não possui'], ['bilhete_unico', 'Bilhete Único'], ['top', 'Cartão TOP'], ['outro', 'Outro']] as [CartaoVT, string][]).map(([valor, texto]) => (
                <label key={valor}
                  className={cn('cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                    d.vt_cartao === valor ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
                  <input type="radio" name="cartao" className="sr-only" checked={d.vt_cartao === valor} onChange={() => definir('vt_cartao', valor)} /> {texto}
                </label>
              ))}
            </div>
            {d.vt_cartao === 'outro' && (
              <input className={cn(campoClasse, 'mt-2 max-w-xs')} placeholder="Qual cartão?" value={d.vt_cartao_outro} onChange={e => definir('vt_cartao_outro', e.target.value)} />
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── 5. Uniforme e documentos ─────────────────────────────────────────────────

function alternar(lista: string[], id: string): string[] {
  return lista.includes(id) ? lista.filter(x => x !== id) : [...lista, id]
}

function ItemDocumento({ id, label, marcado, aoAlternar }: { id: string; label: string; marcado: boolean; aoAlternar: () => void }) {
  return (
    <li key={id}>
      <label className={cn('flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors',
        marcado ? 'border-orange-300 bg-orange-50 text-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
        <input type="checkbox" className="mt-0.5" checked={marcado} onChange={aoAlternar} />
        {label}
      </label>
    </li>
  )
}

export function EtapaDocumentos({ d, definir }: { d: DossieAdmissao; definir: Definir }) {
  const todos = d.docs.length === DOCUMENTOS_ADMISSAO.length
  return (
    <div className="space-y-6">
      <Painel titulo="Uniforme (tamanho / nº)">
        <div className="grid grid-cols-3 gap-3">
          <Rotulado rotulo="Calça"><input className={campoClasse} value={d.uniforme_calca} onChange={e => definir('uniforme_calca', e.target.value)} /></Rotulado>
          <Rotulado rotulo="Camisa"><input className={campoClasse} value={d.uniforme_camisa} onChange={e => definir('uniforme_camisa', e.target.value)} /></Rotulado>
          <Rotulado rotulo="Sapato"><input className={campoClasse} value={d.uniforme_sapato} onChange={e => definir('uniforme_sapato', e.target.value)} /></Rotulado>
        </div>
      </Painel>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className={cn(rotuloClasse, 'mb-0')}>Documentos entregues</p>
          <button type="button" className="text-xs font-medium text-orange-700 underline"
            onClick={() => definir('docs', todos ? [] : DOCUMENTOS_ADMISSAO.map(x => x.id))}>
            {todos ? 'Desmarcar todos' : 'Marcar todos'}
          </button>
        </div>
        <p className="mb-3 text-xs text-slate-500">Marque o que o funcionário já trouxe. O que faltar sai sem marcação no Cadastro impresso.</p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DOCUMENTOS_ADMISSAO.map(doc => (
            <ItemDocumento key={doc.id} id={doc.id} label={doc.label} marcado={d.docs.includes(doc.id)} aoAlternar={() => definir('docs', alternar(d.docs, doc.id))} />
          ))}
        </ul>
      </div>

      <div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
          <input type="checkbox" checked={d.tem_dependentes} onChange={e => definir('tem_dependentes', e.target.checked)} />
          Funcionário tem dependentes
        </label>
        {d.tem_dependentes && (
          <ul className="mt-3 grid grid-cols-1 gap-2 border-l-2 border-orange-200 pl-3 sm:grid-cols-2">
            {DOCUMENTOS_DEPENDENTES.map(doc => (
              <ItemDocumento key={doc.id} id={doc.id} label={doc.label} marcado={d.docs_dependentes.includes(doc.id)}
                aoAlternar={() => definir('docs_dependentes', alternar(d.docs_dependentes, doc.id))} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── 6. Revisão ───────────────────────────────────────────────────────────────

interface PropsRevisao {
  d: DossieAdmissao
  postoNome: string
  funcaoNome: string
  turnoNome: string | null
}

export function EtapaRevisao({ d, postoNome, funcaoNome, turnoNome }: PropsRevisao) {
  const totais = totaisVT(d.vt_linhas)
  const grupo = (titulo: string, tom: string, linhas: [string, string][]) => (
    <section className={cn('rounded-xl border-l-4 bg-white p-4 shadow-sm ring-1 ring-slate-200', tom)}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">{titulo}</h3>
      <dl className="space-y-1.5">
        {linhas.map(([r, v]) => (
          <div key={r} className="flex justify-between gap-4 text-sm">
            <dt className="text-slate-500">{r}</dt>
            <dd className="text-right font-medium text-slate-900">{v || '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {grupo('Funcionário', 'border-l-blue-500', [
          ['Nome', d.nome],
          ['CPF', formatarCpf(d.cpf)],
          ['Telefone', formatarTelefone(d.telefone)],
          ['Endereço', `${d.logradouro}, ${d.numero}${d.complemento ? ` ${d.complemento}` : ''} — ${d.bairro}, ${d.cidade}/${d.uf}`],
        ])}
        {grupo('Vaga', 'border-l-violet-500', [
          ['Função', funcaoNome],
          ['Posto', postoNome],
          ['Turno', turnoNome ?? 'Não informado'],
          ['Admissão', fmtData(d.data_admissao)],
          ['Motivo', d.motivo === 'substituicao' ? `Substituição de ${d.substituido_nome}` : 'Aumento de efetivo'],
        ])}
      </div>
      {grupo('Vale transporte', 'border-l-emerald-500', [
        ['Situação', d.vt_utiliza ? `${formatarMoeda(totais.valorDia)}/dia · ${totais.passagensDia} passagem(ns)` : 'Não utiliza'],
      ])}

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          Ao enviar, a solicitação segue para aprovação e o PDF (Cadastro, VT e Lista de Presença da integração) é baixado para impressão.
          O RE e a parte do Departamento de Segurança e Medicina do Trabalho saem em branco para o RH e o SST preencherem.
        </p>
      </div>
    </div>
  )
}
