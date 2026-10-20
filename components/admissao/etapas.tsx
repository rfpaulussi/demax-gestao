'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { buscarSubstituiveis, consultarCep, type SugestaoAdmissao, type Substituivel } from '@/app/(admin)/postos/admissao-actions'
import { formatarCep, formatarCpf, formatarTelefone, validarCpf } from '@/lib/admissao/cpf'
import {
  DOCUMENTOS_ADMISSAO, DOCUMENTOS_DEPENDENTES, MAX_LINHAS_VT, TIPOS_TRANSPORTE, UFS,
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

export const rotuloClasse = 'mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500'
export const campoClasse =
  'w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600 disabled:bg-gray-50 disabled:text-gray-400'

function Rotulado({ rotulo, children, className }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className={rotuloClasse}>{rotulo}</label>
      {children}
    </div>
  )
}

const fmtData = (iso: string | null) => {
  if (!iso) return ''
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

// ─── 1. Pessoais ──────────────────────────────────────────────────────────────

export function EtapaPessoais({ d, definir }: { d: DossieAdmissao; definir: Definir }) {
  const [cepMsg, setCepMsg] = useState<string | null>(null)
  const ultimoCep = useRef<string>('')

  async function aoMudarCep(valor: string) {
    const cep = formatarCep(valor)
    definir('cep', cep.replace(/\D/g, ''))
    setCepMsg(null)
    const digitos = cep.replace(/\D/g, '')
    if (digitos.length !== 8 || digitos === ultimoCep.current) return
    ultimoCep.current = digitos
    setCepMsg('Buscando endereço…')
    const r = await consultarCep(digitos)
    if (!r.success) { setCepMsg(r.error); return }
    definir('logradouro', r.endereco.logradouro)
    definir('bairro', r.endereco.bairro)
    definir('cidade', r.endereco.cidade)
    definir('uf', r.endereco.uf)
    setCepMsg(r.endereco.logradouro ? null : 'CEP genérico: digite a rua')
  }

  const cpfCompleto = d.cpf.length === 11
  const cpfInvalido = cpfCompleto && !validarCpf(d.cpf)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Rotulado rotulo="Nome completo *" className="sm:col-span-2">
        <input className={campoClasse} style={{ textTransform: 'uppercase' }} value={d.nome} autoComplete="off"
          onChange={e => definir('nome', e.target.value.toUpperCase())} placeholder="NOME COMO NO DOCUMENTO" />
      </Rotulado>
      <Rotulado rotulo="CPF *">
        <input className={cn(campoClasse, cpfInvalido && 'border-red-400 focus:ring-red-500')} inputMode="numeric" autoComplete="off"
          value={formatarCpf(d.cpf)} onChange={e => definir('cpf', e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="000.000.000-00" />
        {cpfInvalido && <p className="mt-1 text-xs text-red-600">CPF inválido — confira os dígitos.</p>}
      </Rotulado>
      <Rotulado rotulo="Telefone (com DDD) *">
        <input className={campoClasse} inputMode="tel" autoComplete="off"
          value={formatarTelefone(d.telefone)} onChange={e => definir('telefone', e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="(00) 00000-0000" />
      </Rotulado>
      <Rotulado rotulo="E-mail" className="sm:col-span-2">
        <input className={campoClasse} type="email" autoComplete="off" value={d.email}
          onChange={e => definir('email', e.target.value)} placeholder="opcional" />
      </Rotulado>

      <Rotulado rotulo="CEP *">
        <input className={campoClasse} inputMode="numeric" autoComplete="off" value={formatarCep(d.cep)}
          onChange={e => aoMudarCep(e.target.value)} placeholder="00000-000" />
        {cepMsg && <p className="mt-1 text-xs text-slate-500">{cepMsg}</p>}
      </Rotulado>
      <Rotulado rotulo="UF *">
        <select className={campoClasse} value={d.uf} onChange={e => definir('uf', e.target.value)}>
          <option value="">—</option>
          {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
        </select>
      </Rotulado>
      <Rotulado rotulo="Endereço *" className="sm:col-span-2">
        <input className={campoClasse} value={d.logradouro} autoComplete="off" onChange={e => definir('logradouro', e.target.value)} placeholder="Rua, avenida…" />
      </Rotulado>
      <Rotulado rotulo="Número *">
        <input className={campoClasse} value={d.numero} autoComplete="off" onChange={e => definir('numero', e.target.value)} placeholder="S/N se não houver" />
      </Rotulado>
      <Rotulado rotulo="Complemento">
        <input className={campoClasse} value={d.complemento} autoComplete="off" onChange={e => definir('complemento', e.target.value)} />
      </Rotulado>
      <Rotulado rotulo="Bairro *">
        <input className={campoClasse} value={d.bairro} autoComplete="off" onChange={e => definir('bairro', e.target.value)} />
      </Rotulado>
      <Rotulado rotulo="Cidade *">
        <input className={campoClasse} value={d.cidade} autoComplete="off" onChange={e => definir('cidade', e.target.value)} />
      </Rotulado>
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
        <p className={cn('mt-1 text-xs', jovemAprendiz ? 'font-medium text-amber-600' : 'text-gray-400')}>
          {jovemAprendiz
            ? '⚠ Jovem Aprendiz não tem período de experiência.'
            : 'Use "Nenhum" se o funcionário foi recontratado há menos de 6 meses.'}
        </p>
      </Rotulado>

      {d.posto_id && (
        <div className="space-y-3 rounded border border-blue-200 bg-blue-50 px-4 py-3 sm:col-span-2">
          <p className="text-sm font-semibold text-blue-800">Turno de trabalho</p>
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
        </div>
      )}

      <div className="sm:col-span-2">
        <label className={rotuloClasse}>Motivo da admissão</label>
        <div className="flex flex-wrap gap-4 text-sm">
          {([['aumento_efetivo', 'Aumento de efetivo'], ['substituicao', 'Substituição']] as const).map(([valor, texto]) => (
            <label key={valor} className="flex items-center gap-2">
              <input type="radio" name="motivo" checked={d.motivo === valor} onChange={() => definir('motivo', valor)} />
              {texto}
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
  const [itens, setItens] = useState<Substituivel[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [manual, setManual] = useState(!!d.substituido_nome && !d.substituido_id)

  useEffect(() => {
    if (manual) return
    let cancelado = false
    setCarregando(true)
    const t = setTimeout(async () => {
      try {
        const r = await buscarSubstituiveis(d.posto_id, termo)
        if (cancelado) return
        if (r.success) { setItens(r.itens); setErro(null) } else setErro(r.error)
      } catch {
        if (!cancelado) setErro('Não foi possível buscar os desligados. Use "Não consta na lista".')
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }, termo ? 350 : 0)
    return () => { cancelado = true; clearTimeout(t) }
  }, [d.posto_id, termo, manual])

  function escolher(s: Substituivel) {
    definir('substituido_id', s.id)
    definir('substituido_nome', s.nome)
    definir('substituido_motivo', [s.tipo_desligamento, s.motivo_desligamento].filter(Boolean).join(' — '))
    definir('substituido_data_desligamento', s.data_desligamento?.slice(0, 10) ?? '')
  }

  function limpar() {
    definir('substituido_id', null)
    definir('substituido_nome', '')
    definir('substituido_motivo', '')
    definir('substituido_data_desligamento', '')
  }

  return (
    <div className="space-y-3 rounded border border-amber-200 bg-amber-50 px-4 py-3 sm:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-amber-800">Quem está sendo substituído?</p>
        <button type="button" className="text-xs font-medium text-amber-800 underline"
          onClick={() => { limpar(); setManual(m => !m) }}>
          {manual ? 'Buscar entre os desligados' : 'Não consta na lista — digitar'}
        </button>
      </div>

      {!manual && (
        <>
          {d.substituido_id ? (
            <div className="flex items-center justify-between gap-2 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm">
              <span><strong>{d.substituido_nome}</strong>{d.substituido_data_desligamento ? ` · desligado em ${fmtData(d.substituido_data_desligamento)}` : ''}</span>
              <button type="button" className="text-xs font-medium text-green-800 underline" onClick={limpar}>trocar</button>
            </div>
          ) : (
            <>
              <input className={campoClasse} placeholder="Buscar por nome (3+ letras amplia para 12 meses)" value={termo} onChange={e => setTermo(e.target.value)} />
              {erro && <p className="text-xs text-red-600">{erro}</p>}
              <ul className="max-h-48 divide-y divide-amber-100 overflow-y-auto rounded border border-amber-100 bg-white text-sm">
                {carregando && <li className="px-3 py-2 text-xs text-gray-400">Buscando…</li>}
                {!carregando && itens.length === 0 && <li className="px-3 py-2 text-xs text-gray-400">Nenhum desligado encontrado neste período.</li>}
                {itens.map(s => (
                  <li key={s.id}>
                    <button type="button" onClick={() => escolher(s)} className="flex w-full flex-col px-3 py-2 text-left hover:bg-amber-50">
                      <span className="font-medium text-gray-800">{s.nome}</span>
                      <span className="text-xs text-gray-500">
                        {s.posto_nome ?? 'sem posto'}{s.mesmo_posto ? ' · mesmo posto' : ''} · desligado em {fmtData(s.data_desligamento)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
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
    </div>
  )
}

// ─── 3. Condições ─────────────────────────────────────────────────────────────

export function EtapaCondicoes({ d, definir, sugestao }: { d: DossieAdmissao; definir: Definir; sugestao: SugestaoAdmissao | null }) {
  const f = sugestao?.funcao ?? null
  const adicional = (perc: number | null, valor: number | null) =>
    valor && valor > 0 ? `${perc ? `${perc}% · ` : ''}${formatarMoeda(valor)}` : 'Não'
  return (
    <div className="space-y-4">
      <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Do cadastro da função (somente leitura)</p>
        {f ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-slate-500">Função</dt><dd className="font-medium">{f.nome}</dd></div>
            <div><dt className="text-xs text-slate-500">Salário base</dt><dd className="font-medium">{formatarMoeda(f.salario_base) || '—'}</dd></div>
            <div><dt className="text-xs text-slate-500">Insalubridade</dt><dd className="font-medium">{adicional(f.insalubridade_perc, f.insalubridade_valor)}</dd></div>
            <div><dt className="text-xs text-slate-500">Periculosidade</dt><dd className="font-medium">{adicional(f.periculosidade_perc, f.periculosidade_valor)}</dd></div>
          </dl>
        ) : (
          <p className="text-sm text-gray-400">Escolha a função e o posto na etapa anterior.</p>
        )}
      </div>

      <p className="text-xs text-gray-500">Sugeridos pelo sistema — corrija se for diferente. Saem impressos no Cadastro.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Rotulado rotulo="Contrato"><input className={campoClasse} value={d.contrato} onChange={e => definir('contrato', e.target.value)} /></Rotulado>
        <Rotulado rotulo="Centro de custo"><input className={campoClasse} value={d.centro_custo} onChange={e => definir('centro_custo', e.target.value)} /></Rotulado>
        <Rotulado rotulo="Sindicato"><input className={campoClasse} value={d.sindicato} onChange={e => definir('sindicato', e.target.value)} /></Rotulado>
        <Rotulado rotulo="CBO"><input className={campoClasse} value={d.cbo} onChange={e => definir('cbo', e.target.value)} /></Rotulado>
        <Rotulado rotulo="Vale alimentação (R$)"><input className={campoClasse} inputMode="decimal" value={d.va} onChange={e => definir('va', e.target.value)} placeholder="0,00" /></Rotulado>
        <Rotulado rotulo="Vale refeição (R$)"><input className={campoClasse} inputMode="decimal" value={d.vr} onChange={e => definir('vr', e.target.value)} placeholder="0,00" /></Rotulado>
      </div>
    </div>
  )
}

// ─── 4. Vale transporte ───────────────────────────────────────────────────────

export function EtapaVt({ d, definir }: { d: DossieAdmissao; definir: Definir }) {
  const totais = totaisVT(d.vt_linhas)

  function mudarLinha(i: number, campo: keyof LinhaVT, valor: string) {
    definir('vt_linhas', d.vt_linhas.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="radio" name="vt" checked={d.vt_utiliza} onChange={() => definir('vt_utiliza', true)} /> Utiliza vale transporte</label>
        <label className="flex items-center gap-2"><input type="radio" name="vt" checked={!d.vt_utiliza} onChange={() => definir('vt_utiliza', false)} /> Não utiliza</label>
      </div>

      {d.vt_utiliza && (
        <>
          <div className="space-y-3">
            {d.vt_linhas.map((l, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded border border-gray-200 p-3 sm:grid-cols-12">
                <Rotulado rotulo="Tipo" className="sm:col-span-2">
                  <select className={campoClasse} value={l.tipo} onChange={e => mudarLinha(i, 'tipo', e.target.value)}>
                    {TIPOS_TRANSPORTE.map(t => <option key={t}>{t}</option>)}
                  </select>
                </Rotulado>
                <Rotulado rotulo="Nome e nº da linha *" className="col-span-2 sm:col-span-3">
                  <input className={campoClasse} value={l.linha} onChange={e => mudarLinha(i, 'linha', e.target.value)} />
                </Rotulado>
                <Rotulado rotulo="Empresa" className="col-span-2 sm:col-span-3">
                  <input className={campoClasse} value={l.empresa} onChange={e => mudarLinha(i, 'empresa', e.target.value)} />
                </Rotulado>
                <Rotulado rotulo="Valor (R$) *" className="sm:col-span-2">
                  <input className={campoClasse} inputMode="decimal" value={l.valor} placeholder="0,00" onChange={e => mudarLinha(i, 'valor', e.target.value)} />
                </Rotulado>
                <Rotulado rotulo="Passagens/dia *" className="sm:col-span-2">
                  <div className="flex items-center gap-1">
                    <input className={campoClasse} inputMode="numeric" value={l.qtd} onChange={e => mudarLinha(i, 'qtd', e.target.value.replace(/\D/g, '').slice(0, 2))} />
                    {d.vt_linhas.length > 1 && (
                      <button type="button" aria-label="Remover linha" title="Remover linha"
                        onClick={() => definir('vt_linhas', d.vt_linhas.filter((_, idx) => idx !== i))}
                        className="rounded px-2 py-2 text-sm text-red-600 hover:bg-red-50">✕</button>
                    )}
                  </div>
                </Rotulado>
              </div>
            ))}
          </div>
          {d.vt_linhas.length < MAX_LINHAS_VT && (
            <button type="button" className="rounded border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              onClick={() => definir('vt_linhas', [...d.vt_linhas, { tipo: 'Ônibus', linha: '', empresa: '', valor: '', qtd: '2' }])}>
              + Adicionar linha
            </button>
          )}
          <p className="text-sm text-slate-600">
            Total por dia: <strong>{formatarMoeda(totais.valorDia) || 'R$ 0,00'}</strong> em <strong>{totais.passagensDia}</strong> passagem(ns)
          </p>

          <div>
            <label className={rotuloClasse}>Possui cartão?</label>
            <div className="flex flex-wrap gap-4 text-sm">
              {([['nenhum', 'Não possui'], ['bilhete_unico', 'Bilhete Único'], ['top', 'Cartão TOP'], ['outro', 'Outro']] as [CartaoVT, string][]).map(([valor, texto]) => (
                <label key={valor} className="flex items-center gap-2">
                  <input type="radio" name="cartao" checked={d.vt_cartao === valor} onChange={() => definir('vt_cartao', valor)} /> {texto}
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

export function EtapaDocumentos({ d, definir }: { d: DossieAdmissao; definir: Definir }) {
  return (
    <div className="space-y-5">
      <div>
        <p className={rotuloClasse}>Uniforme (tamanho / nº)</p>
        <div className="grid grid-cols-3 gap-3">
          <Rotulado rotulo="Calça"><input className={campoClasse} value={d.uniforme_calca} onChange={e => definir('uniforme_calca', e.target.value)} /></Rotulado>
          <Rotulado rotulo="Camisa"><input className={campoClasse} value={d.uniforme_camisa} onChange={e => definir('uniforme_camisa', e.target.value)} /></Rotulado>
          <Rotulado rotulo="Sapato"><input className={campoClasse} value={d.uniforme_sapato} onChange={e => definir('uniforme_sapato', e.target.value)} /></Rotulado>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className={cn(rotuloClasse, 'mb-0')}>Documentos entregues</p>
          <button type="button" className="text-xs font-medium text-slate-600 underline"
            onClick={() => definir('docs', d.docs.length === DOCUMENTOS_ADMISSAO.length ? [] : DOCUMENTOS_ADMISSAO.map(x => x.id))}>
            {d.docs.length === DOCUMENTOS_ADMISSAO.length ? 'Desmarcar todos' : 'Marcar todos'}
          </button>
        </div>
        <p className="mb-2 text-xs text-gray-500">Marque o que o funcionário já trouxe. O que faltar sai sem marcação no Cadastro impresso.</p>
        <ul className="space-y-1.5">
          {DOCUMENTOS_ADMISSAO.map(doc => (
            <li key={doc.id}>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5" checked={d.docs.includes(doc.id)} onChange={() => definir('docs', alternar(d.docs, doc.id))} />
                {doc.label}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={d.tem_dependentes} onChange={e => definir('tem_dependentes', e.target.checked)} />
          Funcionário tem dependentes
        </label>
        {d.tem_dependentes && (
          <ul className="mt-2 space-y-1.5 border-l-2 border-slate-200 pl-3">
            {DOCUMENTOS_DEPENDENTES.map(doc => (
              <li key={doc.id}>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-0.5" checked={d.docs_dependentes.includes(doc.id)} onChange={() => definir('docs_dependentes', alternar(d.docs_dependentes, doc.id))} />
                  {doc.label}
                </label>
              </li>
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
  definir: Definir
  postoNome: string
  funcaoNome: string
  turnoNome: string | null
}

export function EtapaRevisao({ d, definir, postoNome, funcaoNome, turnoNome }: PropsRevisao) {
  const totais = totaisVT(d.vt_linhas)
  const linha = (rotulo: string, valor: string) => (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1.5 text-sm">
      <dt className="text-slate-500">{rotulo}</dt>
      <dd className="text-right font-medium text-slate-800">{valor || '—'}</dd>
    </div>
  )
  return (
    <div className="space-y-4">
      <dl className="rounded border border-slate-200 px-4 py-2">
        {linha('Nome', d.nome)}
        {linha('CPF', formatarCpf(d.cpf))}
        {linha('Telefone', formatarTelefone(d.telefone))}
        {linha('Endereço', `${d.logradouro}, ${d.numero}${d.complemento ? ` ${d.complemento}` : ''} — ${d.bairro}, ${d.cidade}/${d.uf}`)}
        {linha('Função', funcaoNome)}
        {linha('Posto', postoNome)}
        {linha('Turno', turnoNome ?? 'Não informado')}
        {linha('Admissão', fmtData(d.data_admissao))}
        {linha('Motivo', d.motivo === 'substituicao' ? `Substituição de ${d.substituido_nome}` : 'Aumento de efetivo')}
        {linha('Vale transporte', d.vt_utiliza ? `${formatarMoeda(totais.valorDia)}/dia · ${totais.passagensDia} passagem(ns)` : 'Não utiliza')}
      </dl>

      <Rotulado rotulo="Data da integração *" className="max-w-xs">
        <input type="date" className={campoClasse} value={d.data_integracao} onChange={e => definir('data_integracao', e.target.value)} />
      </Rotulado>

      <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Ao enviar, a solicitação segue para aprovação e o PDF (Cadastro, VT e Lista de Presença da integração) é baixado para impressão.
        O RE e o bloco de Segurança do Trabalho saem em branco.
      </div>
    </div>
  )
}
