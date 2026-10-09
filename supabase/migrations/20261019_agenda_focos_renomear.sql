-- Agenda: nomes dos focos iguais aos usados pelos supervisores. Seguro rodar mais de uma vez.
-- Os registros mantêm o mesmo id, então agendas e check-ins já criados continuam ligados a eles.

UPDATE agenda_tipos_foco SET nome = 'Verificação de Qualidade'    WHERE nome = 'Fiscalização de qualidade';
UPDATE agenda_tipos_foco SET nome = 'Entrega de EPI / Uniforme'    WHERE nome = 'Entrega de EPI/uniforme';
UPDATE agenda_tipos_foco SET nome = 'Treinamento de Funcionário'   WHERE nome = 'Treinamento';
