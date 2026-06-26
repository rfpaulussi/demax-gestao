-- CID F01: Demência vascular
INSERT INTO cid_referencia (codigo, descricao) VALUES
('F01',   'Demência vascular'),
('F01.0', 'Demência vascular de início agudo'),
('F01.1', 'Demência por infartos múltiplos'),
('F01.2', 'Demência vascular subcortical'),
('F01.3', 'Demência vascular mista cortical e subcortical'),
('F01.8', 'Outras demências vasculares'),
('F01.9', 'Demência vascular não especificada')
ON CONFLICT (codigo) DO NOTHING;

-- CID F10–F19: Transtornos mentais devidos ao uso de substâncias psicoativas
INSERT INTO cid_referencia (codigo, descricao) VALUES
('F10',   'Transtornos mentais devidos ao uso de álcool'),
('F10.0', 'Intoxicação aguda por álcool'),
('F10.1', 'Uso nocivo de álcool'),
('F10.2', 'Síndrome de dependência de álcool'),
('F10.3', 'Abstinência de álcool'),
('F10.4', 'Abstinência de álcool com delirium'),
('F10.5', 'Transtorno psicótico devido ao álcool'),
('F10.9', 'Transtorno mental devido ao álcool, não especificado'),

('F11',   'Transtornos mentais devidos ao uso de opiáceos'),
('F11.0', 'Intoxicação aguda por opiáceos'),
('F11.1', 'Uso nocivo de opiáceos'),
('F11.2', 'Síndrome de dependência de opiáceos'),
('F11.3', 'Abstinência de opiáceos'),
('F11.9', 'Transtorno mental devido a opiáceos, não especificado'),

('F12',   'Transtornos mentais devidos ao uso de canabinoides'),
('F12.0', 'Intoxicação aguda por canabinoides'),
('F12.1', 'Uso nocivo de canabinoides'),
('F12.2', 'Síndrome de dependência de canabinoides'),
('F12.9', 'Transtorno mental devido a canabinoides, não especificado'),

('F13',   'Transtornos mentais devidos ao uso de sedativos e hipnóticos'),
('F13.0', 'Intoxicação aguda por sedativos/hipnóticos'),
('F13.1', 'Uso nocivo de sedativos/hipnóticos'),
('F13.2', 'Síndrome de dependência de sedativos/hipnóticos'),
('F13.3', 'Abstinência de sedativos/hipnóticos'),
('F13.9', 'Transtorno mental devido a sedativos/hipnóticos, não especificado'),

('F14',   'Transtornos mentais devidos ao uso de cocaína'),
('F14.0', 'Intoxicação aguda por cocaína'),
('F14.1', 'Uso nocivo de cocaína'),
('F14.2', 'Síndrome de dependência de cocaína'),
('F14.9', 'Transtorno mental devido a cocaína, não especificado'),

('F15',   'Transtornos mentais devidos ao uso de outros estimulantes'),
('F15.0', 'Intoxicação aguda por estimulantes'),
('F15.1', 'Uso nocivo de estimulantes'),
('F15.2', 'Síndrome de dependência de estimulantes'),
('F15.9', 'Transtorno mental devido a estimulantes, não especificado'),

('F16',   'Transtornos mentais devidos ao uso de alucinógenos'),
('F16.0', 'Intoxicação aguda por alucinógenos'),
('F16.1', 'Uso nocivo de alucinógenos'),
('F16.2', 'Síndrome de dependência de alucinógenos'),
('F16.9', 'Transtorno mental devido a alucinógenos, não especificado'),

('F17',   'Transtornos mentais devidos ao uso de tabaco'),
('F17.0', 'Intoxicação aguda por tabaco'),
('F17.1', 'Uso nocivo de tabaco'),
('F17.2', 'Síndrome de dependência de tabaco'),
('F17.3', 'Abstinência de tabaco'),
('F17.9', 'Transtorno mental devido a tabaco, não especificado'),

('F18',   'Transtornos mentais devidos ao uso de solventes voláteis'),
('F18.0', 'Intoxicação aguda por solventes voláteis'),
('F18.1', 'Uso nocivo de solventes voláteis'),
('F18.2', 'Síndrome de dependência de solventes voláteis'),
('F18.9', 'Transtorno mental devido a solventes voláteis, não especificado'),

('F19',   'Transtornos mentais devidos ao uso de múltiplas substâncias'),
('F19.0', 'Intoxicação aguda por múltiplas substâncias'),
('F19.1', 'Uso nocivo de múltiplas substâncias'),
('F19.2', 'Síndrome de dependência de múltiplas substâncias'),
('F19.9', 'Transtorno mental devido a múltiplas substâncias, não especificado')
ON CONFLICT (codigo) DO NOTHING;
