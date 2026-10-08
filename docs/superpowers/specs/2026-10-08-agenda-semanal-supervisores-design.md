# Agenda Semanal dos Supervisores — Fase 1

## Objetivo
Supervisor monta a própria agenda semanal (dia + período), com tipo de foco e postos por bloco, e publica. Admin/coordenador acompanham e comentam. Base para a Fase 2 (check-in georreferenciado).

## Decisões
- Granularidade: dia (seg–sáb) × período (manhã/tarde/noite).
- Fluxo: supervisor publica; coordenador/admin só visualizam e comentam. Edição após publicar exige motivo (replanejamento), registrado em auditoria.
- Sem coordenadas/GPS nesta fase.

## Dados
- `agenda_tipos_foco` (id, nome, cor, icone, ativo, ordem). Seed com 8 tipos.
- `agenda_semanas` (id, supervisor_id→perfis, semana_inicio date segunda, status rascunho|publicada, publicada_em). UNIQUE(supervisor_id, semana_inicio).
- `agenda_blocos` (id, semana_id, data, periodo manha|tarde|noite, tipo_foco_id, observacao, replanejado, motivo_replanejamento).
- `agenda_blocos_postos` (bloco_id, posto_id).
- `agenda_comentarios` (id, semana_id, autor_id, texto, created_at).

## Regras
- Escrita: só o dono, em rascunho; publicada exige motivo. Leitura: dono, admin, coordenador. Viewer sem acesso.
- Postos do bloco: os de `config_supervisores_postos` (ativo) + emprestados via coberturas.
- Server Actions: `getUser()`, role check, `revalidatePath('/agenda')`. Nenhum CPF.

## Telas
- `/agenda` supervisor: grade semanal colorida por foco, modal de bloco, copiar semana anterior, publicar, painel de sugestões (postos sem bloco nas últimas 2 semanas).
- `/agenda` admin/coordenador: visão geral por supervisor (status da semana), abrir grade, comentar.
- `/agenda/tipos` (admin): CRUD dos tipos de foco.
- Sidebar: item "Agenda" (supervisor, coordenador, admin).

## Fora do escopo
Coordenadas, check-in, mapa (Fase 2); PDF, alertas, sugestões por déficit/ocorrência (Fase 3).

## Validação
`npx tsc --noEmit`, `npm run build`, teste manual das duas visões no preview.
