-- Turnos 12x36 nunca têm almoço fixo nem saída diferenciada de sexta (ver
-- lib/turnos/escala.ts::calcularHorariosDerivados e modal-turnos-posto.tsx::handleSalvar).
-- Este turno foi criado/editado antes dessa regra ser aplicada e ficou com dados
-- inconsistentes com o próprio tipo_escala. Zera os campos para refletir o regime real.
-- Os 4 funcionários vinculados a ele (via horarios_funcionarios.turno_id) são corrigidos
-- automaticamente, sem necessidade de tocar nas linhas deles.
update turnos_postos
set hora_inicio_almoco = null,
    hora_fim_almoco = null,
    hora_saida_sex = null
where tipo_escala = '12x36'
  and (hora_inicio_almoco is not null or hora_fim_almoco is not null or hora_saida_sex is not null);
