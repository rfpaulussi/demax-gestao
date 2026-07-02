'use client'

import { useEffect, useMemo, useState } from 'react'
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
  Biohazard,
  ArrowLeftRight,
  UserX,
  Search,
  FileText,
} from 'lucide-react'

type Secao = {
  id: string
  icon: React.ElementType
  titulo: string
  onde: string
  passos: string[]
  dica?: string
  prints?: string[]
}

const SECOES: Secao[] = [
  {
    id: 'falta',
    icon: UserMinus,
    titulo: '🚨 Registrar uma falta',
    onde: 'Menu → Faltas',
    passos: [
      '📋 Clique em **"+ Registrar Falta"**',
      '👤 Selecione o **funcionário** (lista já filtrada pelo seu posto)',
      '📅 Informe a **data de início** e, se souber, a **data de fim**',
      '📌 Escolha o **tipo**: sem atestado, com atestado ou licença',
      '📝 Adicione uma **observação**, se necessário',
      '✅ Clique em **"Registrar"**',
    ],
    dica: 'Faltas com 3 dias ou mais mudam o status do funcionário para "Faltante" automaticamente.',
    prints: ['/ajuda/15.png', '/ajuda/img-1.png'],
  },
  {
    id: 'cobertura',
    icon: Repeat2,
    titulo: '🔄 Solicitar cobertura temporária',
    onde: 'Menu → Cobertura Temp.',
    passos: [
      '🆕 Clique em **"Nova Cobertura"**',
      '👤 Selecione o **substituto** e, se for reforço, marque **"Reforço de posto"**; se for cobrir alguém ausente, marque **"Substituindo funcionário ausente"** e selecione quem está fora',
      '📍 Escolha o **supervisor** e o **posto de destino** do substituto',
      '📌 Escolha o **tipo do motivo** (atestado médico, falta justificada, injustificada, folga, outros) e, se quiser, uma observação',
      '🏥 Se o motivo for **atestado**, já pode incluir os **dias** e o **CID** (se houver); se for **falta**, pode lançar a(s) falta(s) automaticamente — mas primeiro selecione o funcionário ausente',
      '📅 Informe a **data de início e fim** da cobertura, e o **início/fim da ausência** do substituído',
      '💾 Clique em **"Salvar Cobertura"**',
    ],
    dica: 'A urgência é calculada automaticamente pela data de retorno: até 1 dia = alta, até 3 dias = média, acima disso = baixa. A cobertura fica pendente até o admin aprovar.',
    prints: ['/ajuda/img-2.png'],
  },
  {
    id: 'cobertura-insalubre',
    icon: Biohazard,
    titulo: '☣️ Registrar cobertura insalubre',
    onde: 'Menu → Cobertura Insalubre',
    passos: [
      '🆕 Clique em **"Nova Declaração"**',
      '📍 Confirme o **posto** e selecione o **substituto**',
      '👤 Selecione o **agente ausente** que está sendo coberto',
      '📅 Informe a **data da cobertura** e o **período em dias**',
      '📝 Adicione uma **observação** (ex: motivo do afastamento do titular)',
      '✅ Clique em **"Registrar"**',
    ],
    dica: 'Usada quando alguém cobre a função insalubre de outro funcionário (ex: adicional de insalubridade), sem necessariamente virar uma cobertura temporária completa.',
    prints: ['/ajuda/img-3.png'],
  },
  {
    id: 'ferias',
    icon: Palmtree,
    titulo: '🌴 Agendar férias',
    onde: 'Menu → Férias',
    passos: [
      '📋 Clique em **"Agendar Férias"**',
      '👤 Selecione o **funcionário** — o sistema mostra os períodos aquisitivos e o status de cada um',
      '📆 Confira o **período aquisitivo** (número, início e fim) e o **limite de gozo** calculado automaticamente',
      '📅 Informe a **data de início do gozo** — o sistema calcula a data de fim com base nos dias de direito',
      '📝 Adicione uma **observação**, se necessário',
      '💾 Clique em **"Salvar Férias"**',
    ],
    dica: 'O agendamento fica pendente até o admin aprovar. Você recebe a resposta no sino de notificações.',
    prints: ['/ajuda/img-4.png'],
  },
  {
    id: 'advertencia',
    icon: ShieldAlert,
    titulo: '⚠️ Criar advertência',
    onde: 'Menu → Advertências',
    passos: [
      '🆕 Clique em **"Nova Advertência"**',
      '👤 Busque e selecione o **funcionário** — o sistema já mostra o **histórico disciplinar** e reincidência',
      '📅 Informe **data e horário** da ocorrência e escolha a **natureza da infração** (o relato sugerido é preenchido automaticamente, mas pode editar)',
      '📌 Escolha o **grau**: verbal, escrita ou suspensão — e a **data de aplicação**',
      '✍️ Preencha **testemunhas** e a **defesa do colaborador**, se houver',
      '✅ Clique em **"Registrar Advertência"**',
    ],
    dica: 'Se o funcionário já teve advertências anteriores, um aviso vermelho de reincidência aparece antes de você continuar.',
    prints: ['/ajuda/img-5.png', '/ajuda/img-5-1.png'],
  },
  {
    id: 'atestado',
    icon: Stethoscope,
    titulo: '🏥 Registrar atestado do dia a dia',
    onde: 'Menu → Efetivo → Atestados',
    passos: [
      '🔍 Encontre o **funcionário** que entregou o atestado',
      '📅 Informe a **data de início** e a **quantidade de dias** — a data fim é calculada automaticamente',
      '📝 Descreva o **motivo** (ex: consulta, exame, cirurgia)',
      '🏷️ Se tiver o **CID**, informe; caso contrário, marque **"Atestado sem CID"**',
      '⚠️ Se for **acidente ou doença ocupacional**, selecione em **"Origem"**',
      '💾 Clique em **"Salvar"**',
    ],
    prints: ['/ajuda/img-7.png'],
  },
  {
    id: 'afastamento',
    icon: UserMinus,
    titulo: '🏨 Registrar afastamento (INSS, doença prolongada)',
    onde: 'Perfil do funcionário → Solicitar Afastamento',
    passos: [
      '📌 Escolha o **motivo do afastamento** (ex: INSS — Doença)',
      '📅 Informe a **data de início** e a **quantidade de dias** — a data prevista de retorno é calculada automaticamente',
      '📋 Marque **"Registrar atestado junto"** para já lançar o atestado correspondente',
      '✅ Clique em **"Enviar Solicitação"**',
    ],
    dica: 'Igual às demais solicitações, fica pendente até o admin aprovar antes de valer.',
    prints: ['/ajuda/img-6.png'],
  },
  {
    id: 'ocorrencia',
    icon: Siren,
    titulo: '🚨 Registrar ocorrência ou alerta',
    onde: 'Menu → Ocorrências',
    passos: [
      '🆕 Clique em **"Nova Ocorrência"**',
      '📍 Confirme o **posto** e o **supervisor**',
      '📅 Informe a **data** e a **gravidade** (baixa, média, alta, crítica)',
      '📝 Descreva o que aconteceu com o **máximo de detalhes**',
      '💾 Clique em **"Salvar"**',
      '📊 Acompanhe o status depois: **Aberta → Em Análise → Resolvida**',
    ],
    prints: ['/ajuda/img-9.png'],
  },
  {
    id: 'transferencia',
    icon: ArrowLeftRight,
    titulo: '🏢 Transferência ou Transferência + Mudança de Função',
    onde: 'Efetivo → Nova Solicitação',
    passos: [
      '📋 Clique em **"Solicitar"** e escolha o tipo: Transferência, Mudança de Função, Desligamento ou Rescisão Indireta',
      '🏢 **Transferência**: escolha o **posto de destino**; se a função também mudar, marque **"Mudar função junto com a transferência"** e escolha a nova função',
      '🔄 **Mudança de Função**: escolha a **nova função** e justifique o motivo',
      '✅ Clique em **"Enviar Solicitação"**',
    ],
    dica: 'Toda solicitação fica pendente até o admin aprovar — você acompanha pelo sino de notificações.',
    prints: ['/ajuda/img-10.png', '/ajuda/img-10-1.png'],
  },
  {
    id: 'desligamento',
    icon: UserX,
    titulo: '🚪 Solicitar desligamento',
    onde: 'Efetivo → Nova Solicitação → Desligamento',
    passos: [
      '📋 Escolha **"Desligamento"** no tipo e informe a **data**',
      '📌 Escolha o tipo: **Voluntária** (pedido do funcionário), **Demissão** (iniciativa da empresa), **Reprova de Experiência** (até 90 dias) ou **Judicial** (rescisão indireta, ação trabalhista)',
      '⚖️ Se for **Judicial**, escolha a motivação — falta de pagamento, desvio de função, assédio moral, condições inadequadas, alteração contratual ilícita, ou outros',
      '✅ Clique em **"Enviar Solicitação"**',
    ],
    prints: ['/ajuda/img-11.png', '/ajuda/img-12.png'],
  },
  {
    id: 'rescisao-indireta',
    icon: FileText,
    titulo: '⚖️ Rescisão Indireta',
    onde: 'Efetivo → Nova Solicitação → Rescisão Indireta',
    passos: [
      '📋 Clique em **"Solicitar"** e escolha **"Rescisão Indireta"**',
      '📅 Informe a **data** e registre o **motivo alegado** pelo funcionário',
      '✅ Clique em **"Enviar Solicitação"**',
    ],
    dica: 'Use quando o funcionário alega justa causa do empregador (Art. 483 CLT) e deixa o emprego. Registre assim que comunicar — mesmo sem audiência ou processo ainda.',
    prints: ['/ajuda/img-13.png'],
  },
  {
    id: 'postos',
    icon: Building2,
    titulo: '🏗️ Ver status dos meus postos',
    onde: 'Menu → Postos',
    passos: [
      '📊 Veja, por posto, o **efetivo alocado x previsto** e a situação da **insalubridade/cota**',
      '🔴 Status **"Aloc: Déficit"** = faltam pessoas; 🔵 **"Aloc: Excesso"** = tem gente sobrando no posto',
      '🔍 Use os **filtros** de secretaria, supervisor ou status para achar rápido um posto específico',
      '👆 Clique em um posto para ver **mais detalhes**',
    ],
    prints: ['/ajuda/img-8.png'],
  },
  {
    id: 'sino',
    icon: Bell,
    titulo: '🔔 Acompanhar minhas solicitações',
    onde: 'Sino de notificações (topo direito)',
    passos: [
      '🔔 Clique no **sino** para ver as respostas às suas solicitações (férias, coberturas, transferências, etc.)',
      '✅ **Verde/check** = aprovada · ❌ **Vermelho** = rejeitada — o texto explica o motivo',
      '👁️ Clique em **"Lidas"** para limpar o badge de novas',
    ],
    prints: ['/ajuda/img-14.png'],
  },
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    titulo: '📊 Ver o dashboard',
    onde: 'Menu → Dashboard',
    passos: [
      '📈 Veja os **KPIs gerais**: efetivo ativo, ausentes, em férias, postos em déficit',
      '🚨 **Alertas críticos** mostram postos com falta de gente',
      '📅 Confira **próximas férias** e coberturas em andamento',
    ],
    prints: ['/ajuda/dashboard.jpg'],
  },
]

// Converte **texto** em <strong>
function renderPasso(texto: string): React.ReactNode {
  const parts = texto.split(/\*\*(.+?)\*\*/g)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <strong key={i} className="font-semibold text-gray-900">{part}</strong>
          : part
      )}
    </>
  )
}

function PrintTela({ src, titulo, multi }: { src: string; titulo: string; multi?: boolean }) {
  const [existe, setExiste] = useState(false)

  useEffect(() => {
    let ativo = true
    const img = new Image()
    img.onload = () => { if (ativo) setExiste(true) }
    img.src = src
    return () => { ativo = false }
  }, [src])

  if (!existe) return null

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`Tela: ${titulo}`}
      className={`rounded-xl border border-slate-200 ${multi ? 'flex-1 min-w-0 max-w-[49%]' : 'max-w-full'}`}
      style={{ imageRendering: 'auto' }}
    />
  )
}

function SecaoItem({ secao, aberto, onToggle }: { secao: Secao; aberto: boolean; onToggle: () => void }) {
  const Icon = secao.icon
  const multiPrints = (secao.prints?.length ?? 0) > 1

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
                <span className="pt-0.5">{renderPasso(passo)}</span>
              </li>
            ))}
          </ol>

          {secao.dica && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
              <p className="text-xs font-semibold text-amber-800 mb-0.5">💡 Dica</p>
              <p className="text-xs text-amber-700">{secao.dica}</p>
            </div>
          )}

          {secao.prints && secao.prints.length > 0 && (
            <div className={`flex gap-2 ${multiPrints ? 'flex-row flex-wrap items-start' : 'flex-col'}`}>
              {secao.prints.map((src) => (
                <PrintTela key={src} src={src} titulo={secao.titulo} multi={multiPrints} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function AjudaClient() {
  const [abertoId, setAbertoId] = useState<string | null>(SECOES[0].id)
  const [busca, setBusca] = useState('')

  const secoesFiltradas = useMemo(() => {
    if (!busca.trim()) return SECOES
    const q = busca.toLowerCase()
    return SECOES.filter((s) =>
      s.titulo.toLowerCase().includes(q) ||
      s.onde.toLowerCase().includes(q) ||
      s.passos.some((p) => p.toLowerCase().includes(q))
    )
  }, [busca])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="O que aconteceu? Ex: funcionário faltou, precisa trocar de posto..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
        />
      </div>

      <div className="space-y-3">
        {secoesFiltradas.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">Nada encontrado. Tente outro termo.</p>
        )}
        {secoesFiltradas.map((secao) => (
          <SecaoItem
            key={secao.id}
            secao={secao}
            aberto={abertoId === secao.id}
            onToggle={() => setAbertoId(abertoId === secao.id ? null : secao.id)}
          />
        ))}
      </div>
    </div>
  )
}
