'use client'

import { useEffect, useState } from 'react'
import {
  ChevronDown,
  UserMinus,
  Repeat2,
  Palmtree,
  ShieldAlert,
  Stethoscope,
  Siren,
  Building2,
  Bell,
  LayoutDashboard,
} from 'lucide-react'

type Secao = {
  id: string
  icon: React.ElementType
  titulo: string
  onde: string
  passos: string[]
  dica?: string
  print?: string
}

const SECOES: Secao[] = [
  {
    id: 'falta',
    icon: UserMinus,
    titulo: 'Registrar uma falta',
    onde: 'Menu → Faltas',
    passos: [
      'Clique em "Nova Falta"',
      'Selecione o funcionário (lista já filtrada pelo seu posto)',
      'Informe a data de início e, se souber, a data de fim',
      'Escolha o tipo: sem atestado, com atestado ou licença',
      'Adicione uma observação, se necessário',
      'Clique em "Registrar"',
    ],
    dica: 'Faltas com 3 dias ou mais mudam o status do funcionário para "Faltante" automaticamente.',
    print: '/ajuda/falta-form.jpg',
  },
  {
    id: 'cobertura',
    icon: Repeat2,
    titulo: 'Solicitar cobertura temporária',
    onde: 'Menu → Cobertura Temp.',
    passos: [
      'Clique em "Nova Cobertura"',
      'Selecione o funcionário ausente',
      'Selecione o substituto (deve estar ativo)',
      'Informe o posto de destino do substituto',
      'Informe a data de início da ausência e a data prevista de retorno',
      'Escolha o motivo (férias, afastamento, etc.)',
      'Se necessário, marque para registrar atestado da pessoa ausente',
      'Clique em "Solicitar"',
    ],
    dica: 'A urgência é calculada automaticamente pela data de retorno: até 1 dia = alta, até 3 dias = média, acima disso = baixa. A cobertura fica pendente até o admin aprovar.',
    print: '/ajuda/cobertura-form.jpg',
  },
  {
    id: 'ferias',
    icon: Palmtree,
    titulo: 'Agendar férias',
    onde: 'Menu → Férias',
    passos: [
      'Clique em "Agendar Férias"',
      'Selecione o funcionário',
      'Escolha o período de direito (1º, 2º ou 3º)',
      'Informe a data de início e fim das férias',
      'Adicione uma observação, se necessário',
      'Clique em "Agendar"',
    ],
    dica: 'O agendamento fica pendente até o admin aprovar. Você recebe a resposta no sino de notificações.',
    print: '/ajuda/ferias-form.jpg',
  },
  {
    id: 'advertencia',
    icon: ShieldAlert,
    titulo: 'Criar advertência',
    onde: 'Menu → Advertências',
    passos: [
      'Clique em "Nova Advertência"',
      'Selecione o funcionário',
      'Escolha o tipo (comportamento, inassiduidade, etc.) e o grau (verbal, escrita, suspensão)',
      'Informe data e horário da ocorrência e a natureza do fato',
      'Descreva o relato, testemunhas e defesa do colaborador (se houver)',
      'Clique em "Criar"',
      'Depois de analisada, marque "Gerada" e, após entrega, "Entregue"',
      'Use "Gerar PDF" para imprimir o documento',
    ],
    print: '/ajuda/advertencia-form.jpg',
  },
  {
    id: 'atestado',
    icon: Stethoscope,
    titulo: 'Registrar ou editar atestado',
    onde: 'Menu → Atestados',
    passos: [
      'Atestados novos são registrados junto com uma Cobertura Temporária (opção "Registrar atestado")',
      'Para editar um atestado existente, clique nele na lista',
      'Atualize datas, motivo, CID e se é acidente ou doença ocupacional',
      'Clique em "Salvar"',
    ],
    print: '/ajuda/atestado-form.jpg',
  },
  {
    id: 'ocorrencia',
    icon: Siren,
    titulo: 'Registrar ocorrência ou alerta',
    onde: 'Menu → Ocorrências',
    passos: [
      'Clique em "Nova Ocorrência"',
      'Escolha o tipo: Ocorrência (vinculada a um posto) ou Alerta (só seu, sem posto)',
      'Preencha título, descrição, data e gravidade (baixa, média, alta, crítica)',
      'Clique em "Registrar"',
      'Acompanhe o status: Aberta → Em Análise → Resolvida',
    ],
    print: '/ajuda/ocorrencia-form.jpg',
  },
  {
    id: 'postos',
    icon: Building2,
    titulo: 'Ver status dos meus postos',
    onde: 'Menu → Meus Postos',
    passos: [
      'Veja, por posto, o efetivo previsto e os funcionários ativos, em atestado, em férias ou faltantes',
      'Confira as coberturas ativas e quem é o substituto',
      'Fique atento às marcações em vermelho: posto descoberto ou cobertura vencendo hoje/amanhã',
      'Clique em um funcionário faltante para ir direto ao histórico dele',
    ],
    print: '/ajuda/postos-dashboard.jpg',
  },
  {
    id: 'sino',
    icon: Bell,
    titulo: 'Acompanhar minhas solicitações',
    onde: 'Sino de notificações (topo direito)',
    passos: [
      'Clique no sino para ver as respostas às suas solicitações (férias, coberturas, etc.)',
      'Verde = aprovada, vermelho = rejeitada',
      'Se rejeitada, leia a observação do admin explicando o motivo',
      'Clique em "Marcar como lidas" para limpar o badge',
    ],
    print: '/ajuda/sino-notificacoes.jpg',
  },
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    titulo: 'Ver o dashboard',
    onde: 'Menu → Dashboard',
    passos: [
      'Veja os KPIs dos seus postos: ausentes por atestado, férias e faltas',
      'Confira coberturas vencendo e próximas férias',
      'Cards em destaque avisam sobre postos descobertos ou coberturas críticas',
    ],
    print: '/ajuda/dashboard.jpg',
  },
]

function PrintTela({ src, titulo }: { src: string; titulo: string }) {
  const [existe, setExiste] = useState(false)

  useEffect(() => {
    const img = new Image()
    img.onload = () => setExiste(true)
    img.src = src
  }, [src])

  if (!existe) return null

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`Tela: ${titulo}`}
      className="w-full rounded-xl border border-slate-200"
    />
  )
}

function SecaoItem({ secao, aberto, onToggle }: { secao: Secao; aberto: boolean; onToggle: () => void }) {
  const Icon = secao.icon

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100">
          <Icon className="h-4 w-4 text-slate-600" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold text-gray-900">{secao.titulo}</span>
          <span className="block text-xs text-slate-400">{secao.onde}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          <ol className="space-y-2">
            {secao.passos.map((passo, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="pt-0.5">{passo}</span>
              </li>
            ))}
          </ol>

          {secao.dica && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
              <p className="text-xs font-semibold text-amber-800 mb-0.5">Dica</p>
              <p className="text-xs text-amber-700">{secao.dica}</p>
            </div>
          )}

          {secao.print && <PrintTela src={secao.print} titulo={secao.titulo} />}
        </div>
      )}
    </div>
  )
}

export function AjudaClient() {
  const [abertoId, setAbertoId] = useState<string | null>(SECOES[0].id)

  return (
    <div className="space-y-3">
      {SECOES.map((secao) => (
        <SecaoItem
          key={secao.id}
          secao={secao}
          aberto={abertoId === secao.id}
          onToggle={() => setAbertoId(abertoId === secao.id ? null : secao.id)}
        />
      ))}
    </div>
  )
}
