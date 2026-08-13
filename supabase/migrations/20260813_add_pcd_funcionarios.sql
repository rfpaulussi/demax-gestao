alter table funcionarios
  add column if not exists pcd boolean not null default false,
  add column if not exists pcd_tipo text null,
  add column if not exists pcd_tipo_outro text null;

alter table funcionarios drop constraint if exists funcionarios_pcd_tipo_check;
alter table funcionarios
  add constraint funcionarios_pcd_tipo_check
  check (pcd_tipo is null or pcd_tipo in ('Visual', 'Física', 'Auditiva', 'Intelectual', 'Outra'));
