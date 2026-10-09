-- Agenda: uma cor própria para cada um dos 15 focos (registro; já aplicado no banco). Idempotente.
UPDATE agenda_tipos_foco SET cor = 'emerald' WHERE nome = 'Verificação de Qualidade';
UPDATE agenda_tipos_foco SET cor = 'blue'    WHERE nome = 'Conferência de efetivo/ponto';
UPDATE agenda_tipos_foco SET cor = 'orange'  WHERE nome = 'Entrega de EPI / Uniforme';
UPDATE agenda_tipos_foco SET cor = 'violet'  WHERE nome = 'Reunião com secretaria';
UPDATE agenda_tipos_foco SET cor = 'cyan'    WHERE nome = 'Treinamento de Funcionário';
UPDATE agenda_tipos_foco SET cor = 'red'     WHERE nome = 'Visita pós-ocorrência';
UPDATE agenda_tipos_foco SET cor = 'amber'   WHERE nome = 'Cobertura emergencial';
UPDATE agenda_tipos_foco SET cor = 'slate'   WHERE nome = 'Administrativo';
UPDATE agenda_tipos_foco SET cor = 'pink'    WHERE nome = 'Entrega de Material / Químicos';
UPDATE agenda_tipos_foco SET cor = 'teal'    WHERE nome = 'Tratamento de Piso / Limpeza Pesada';
UPDATE agenda_tipos_foco SET cor = 'indigo'  WHERE nome = 'Reunião com Direção / Gestor';
UPDATE agenda_tipos_foco SET cor = 'fuchsia' WHERE nome = 'Ocorrência de Pessoal';
UPDATE agenda_tipos_foco SET cor = 'stone'   WHERE nome = 'Check-in Sede / Base';
UPDATE agenda_tipos_foco SET cor = 'lime'    WHERE nome = 'Resolução de Ocorrência';
UPDATE agenda_tipos_foco SET cor = 'sky'     WHERE nome = 'Coleta de Cartão de Ponto';
