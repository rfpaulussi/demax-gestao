'use client'

import Link from 'next/link'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { FechamentoFinanceiro } from '@/app/(admin)/fechamento-financeiro/actions'

function fmtBRL(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtPct(v: number) {
  return `${(v * 100).toFixed(2)}%`
}

function fmtData(iso: string) {
  const [y, m, dd] = iso.split('-')
  return `${dd}/${m}/${y}`
}

function Item({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-slate-400">{label}</p>
      <p className="font-medium text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
      {children}
    </div>
  )
}

function GrupoEncargos({ titulo, itens }: { titulo: string; itens: [string, number | null][] }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-slate-400">{titulo}</p>
      <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {itens.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs">
            <p className="text-slate-400">{label}</p>
            <p className="font-medium text-slate-700">{fmtBRL(value)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

interface Props {
  dados: FechamentoFinanceiro
  mes: number
  ano: number
  MESES: string[]
  onClose: () => void
}

export function MemoriaCalculoDialog({ dados: d, mes, ano, MESES, onClose }: Props) {
  const semSalarioBase = d.salario_bruto === 0

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Memória de Cálculo — {d.funcionario_nome}</DialogTitle>
          <p className="text-sm text-slate-500">
            {d.funcao ?? 'Sem função'} · {d.posto_nome ?? 'Sem posto'} · {MESES[mes]} {ano}
          </p>
        </DialogHeader>

        <div className="space-y-5 border-t border-slate-100 pt-4">
          {d.is_afastado && (
            <section className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              Este funcionário está no posto <strong>{d.posto_nome ?? '—'}</strong>, secretaria{' '}
              <strong>{d.secretaria ?? '—'}</strong> — por isso nenhum custo é computado neste fechamento,
              independentemente da frequência abaixo.
            </section>
          )}

          <section>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">1. Regime e dias úteis</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <Item label="Regime" value={d.regime} />
              <Item label="Período no mês" value={`${fmtData(d.periodo_inicio)} – ${fmtData(d.periodo_fim)}`} />
              <Item label="Dias úteis" value={String(d.dias_uteis)} />
            </div>
            <p className="mt-1 text-xs text-slate-400">Fonte: escala do posto + calendário de feriados.</p>
          </section>

          <section>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">2. Descontos do período</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <Item label="Férias" value={`${d.dias_ferias} dia(s)`} sub="tabela Férias" />
              <Item label="Atestado" value={`${d.dias_atestado} dia(s)`} sub="tabela Atestados" />
              <Item label="Falta" value={`${d.dias_falta} dia(s)`} sub="tabela Faltas" />
              <Item label="Suspensão" value={`${d.dias_suspensao} dia(s)`} sub="tabela Advertências" />
              <Item label="Afastamento" value={`${d.dias_afastamento} dia(s)`} sub="tabela Afastamentos" />
            </div>
          </section>

          <section>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">3. Dias trabalhados</p>
            <Formula>
              {d.dias_uteis} − ({d.dias_ferias} + {d.dias_falta} + {d.dias_atestado} + {d.dias_suspensao} + {d.dias_afastamento}) = {d.dias_trabalhados} dia(s) trabalhados
            </Formula>
          </section>

          <section>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">4. Proporção</p>
            <Formula>
              ({d.dias_trabalhados} + {d.dias_ferias}) ÷ {d.dias_uteis || 1} = {fmtPct(d.proporcao_paga)} — proporção paga
            </Formula>
            <Formula>
              ({d.dias_ferias} ÷ {d.dias_uteis || 1}) ÷ 3 = {fmtPct(d.bonus_terco_ferias)} — bônus 1/3 férias
            </Formula>
            <Formula>
              {fmtPct(d.proporcao_paga)} + {fmtPct(d.bonus_terco_ferias)} = {fmtPct(d.proporcao_final)} — proporção final
            </Formula>
          </section>

          <section>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">5. Salário bruto</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <Item label="Salário base" value={fmtBRL(d.salario_base)} />
              <Item
                label="Insalubridade"
                value={fmtBRL(d.insalubridade_valor)}
                sub={d.insalubridade_perc != null ? `${d.insalubridade_perc}% sobre o salário mínimo` : undefined}
              />
              <Item
                label="Periculosidade"
                value={fmtBRL(d.periculosidade_valor)}
                sub={d.periculosidade_perc != null ? `${d.periculosidade_perc}% sobre o salário base` : undefined}
              />
            </div>
            <Formula>
              {fmtBRL(d.salario_base)} + {fmtBRL(d.insalubridade_valor)} + {fmtBRL(d.periculosidade_valor)} = {fmtBRL(d.salario_bruto)}
            </Formula>
            {semSalarioBase && (
              <p className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Função sem salário base cadastrado (ou funcionário sem função atribuída) — por isso o
                salário/custo proporcional desta linha aparece zerado.
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Fonte: <Link href="/funcoes" className="underline hover:text-slate-600">Funções e Salários</Link> → {d.funcao ?? 'função'}. Nenhum destes valores é calculado dentro do Fechamento Financeiro.
            </p>
          </section>

          <section>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">6. Custo total (encargos)</p>
            {d.custo_detalhe == null ? (
              <p className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Função sem custos cadastrados em{' '}
                <Link href="/funcoes" className="underline">Funções e Salários</Link> — este valor não entra
                no custo total até o cadastro ser preenchido.
              </p>
            ) : (
              <>
                <div className="mt-1.5 space-y-2">
                  <GrupoEncargos
                    titulo="Benefícios"
                    itens={[
                      ['VA', d.custo_detalhe.va], ['VR', d.custo_detalhe.vr], ['VT', d.custo_detalhe.vt],
                      ['Assid/Asseio', d.custo_detalhe.assid_asseio], ['BSS', d.custo_detalhe.bss],
                      ['Aux. Saúde', d.custo_detalhe.aux_saude], ['PLR', d.custo_detalhe.plr],
                    ]}
                  />
                  <GrupoEncargos
                    titulo="Provisões"
                    itens={[
                      ['1/12 13º', d.custo_detalhe.um_doze_decimo_terceiro],
                      ['1/3 Férias', d.custo_detalhe.um_terceiro_ferias],
                      ['Enc. Provisório', d.custo_detalhe.enc_provisorio],
                      ['1/12 Lei 12506', d.custo_detalhe.um_doze_lei_12506],
                      ['Multa 40%', d.custo_detalhe.multa_40_pct],
                    ]}
                  />
                  <GrupoEncargos
                    titulo="Encargos Sociais"
                    itens={[['INSS Patronal', d.custo_detalhe.enc_inss], ['FGTS', d.custo_detalhe.fgts]]}
                  />
                </div>
                <Formula>soma dos 14 componentes acima = {fmtBRL(d.custo_total)}</Formula>
              </>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Fonte: <Link href="/funcoes" className="underline hover:text-slate-600">Funções e Salários</Link> → Custos da função.
            </p>
          </section>

          {!d.is_afastado && (
            <section>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">7. Valores proporcionais finais</p>
              <Formula>
                {fmtBRL(d.salario_bruto)} × {fmtPct(d.proporcao_final)} = {fmtBRL(d.salario_prop)} — salário proporcional
              </Formula>
              <Formula>
                {d.custo_total != null
                  ? <>{fmtBRL(d.custo_total)} × {fmtPct(d.proporcao_final)} = {fmtBRL(d.custo_prop)}</>
                  : '— (sem custo cadastrado)'} — custo proporcional
              </Formula>
              <Formula>
                {fmtBRL(d.salario_bruto)} × {fmtPct(d.bonus_terco_ferias)} = {fmtBRL(d.custo_ferias_extra)} — custo extra 1/3 férias
              </Formula>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
