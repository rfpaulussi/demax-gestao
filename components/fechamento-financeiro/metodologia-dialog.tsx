'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function Passo({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
        {n}
      </div>
      <div className="flex-1 space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{titulo}</p>
        <div className="text-sm text-slate-700">{children}</div>
      </div>
    </section>
  )
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
      {children}
    </div>
  )
}

export function MetodologiaFechamentoDialog() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        title="Como o Fechamento Financeiro é calculado"
        aria-label="Ver metodologia de cálculo"
      >
        <Info className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Como o Fechamento Financeiro é calculado</DialogTitle>
            <p className="text-sm text-slate-500">
              O mesmo método é aplicado a todos os funcionários, todo mês. Clique no ícone de calculadora
              em qualquer linha da tabela para ver esta conta com os números reais daquele funcionário.
            </p>
          </DialogHeader>

          <div className="space-y-5 border-t border-slate-100 pt-4">
            <Passo n={1} titulo="Regime e dias úteis">
              <p>
                O regime de trabalho do posto (5x2, 5x1 ou 12x36) define quais dias contam como dia útil no
                mês, junto com o calendário de feriados nacionais e municipais.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Fonte: configuração de escala do posto + calendário de feriados fixo do sistema.
              </p>
            </Passo>

            <Passo n={2} titulo="Descontos do período">
              <p>São contados separadamente, no período do mês em que o funcionário esteve ativo:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-600">
                <li>dias de férias</li>
                <li>dias de atestado (os primeiros 15 dias corridos de cada atestado ficam a cargo da empresa)</li>
                <li>dias de falta</li>
                <li>dias de suspensão (advertências de grau &quot;suspensão&quot;)</li>
                <li>dias de afastamento</li>
              </ul>
              <p className="mt-1 text-xs text-slate-400">
                Fonte: tabelas Férias, Atestados, Faltas, Advertências e Afastamentos.
              </p>
            </Passo>

            <Passo n={3} titulo="Dias trabalhados">
              <Formula>dias úteis − (férias + atestado + falta + suspensão + afastamento) = dias trabalhados</Formula>
            </Passo>

            <Passo n={4} titulo="Proporção paga + bônus de 1/3 de férias">
              <p>Dias de férias são remunerados normalmente pela empresa, mais o terço constitucional:</p>
              <Formula>(dias trabalhados + dias de férias) ÷ dias úteis = proporção paga</Formula>
              <Formula>(dias de férias ÷ dias úteis) ÷ 3 = bônus do terço</Formula>
              <Formula>proporção paga + bônus do terço = proporção final</Formula>
            </Passo>

            <Passo n={5} titulo="Salário bruto">
              <Formula>salário base + insalubridade + periculosidade = salário bruto</Formula>
              <p className="mt-1 text-xs text-slate-400">
                Fonte: <Link href="/funcoes" className="underline hover:text-slate-600">Funções e Salários</Link> — cadastro da função do funcionário. Nada aqui é digitado ou calculado dentro do Fechamento Financeiro.
              </p>
            </Passo>

            <Passo n={6} titulo="Custo total (encargos)">
              <p>
                Soma de 14 componentes cadastrados por função: benefícios (VA, VR, VT, Assid/Asseio, BSS,
                Aux. Saúde, PLR), provisões (1/12 13º, 1/3 Férias, Enc. Provisório, 1/12 Lei 12506, Multa 40%)
                e encargos sociais (INSS Patronal, FGTS).
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Fonte: <Link href="/funcoes" className="underline hover:text-slate-600">Funções e Salários</Link> → Custos da função. São valores fixos em R$ cadastrados manualmente, não percentuais calculados.
              </p>
            </Passo>

            <Passo n={7} titulo="Valores proporcionais finais">
              <Formula>salário bruto × proporção final = salário proporcional</Formula>
              <Formula>custo total × proporção final = custo proporcional</Formula>
              <Formula>salário bruto × bônus do terço = custo extra de 1/3 férias</Formula>
            </Passo>

            <section className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Casos especiais</p>
              <p className="text-sm text-slate-600">
                <strong>Afastados:</strong> funcionários em posto da secretaria &quot;AFASTADOS&quot; não geram
                custo contratual — os dias de frequência ainda são calculados, mas nenhum valor é multiplicado.
              </p>
              <p className="text-sm text-slate-600">
                <strong>Sem Encargos:</strong> aparece quando a função do funcionário não tem custos
                cadastrados em Funções e Salários, ou quando o salário base está zerado — em ambos os casos
                o custo não entra no total até o cadastro ser preenchido.
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
