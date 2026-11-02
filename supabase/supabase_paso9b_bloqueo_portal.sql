-- PASO 9B — Proyecto ACTIVA-GYM / ENTRENAMIENTO (husokxkdwgpjwtgrijei), SQL Editor.
-- OJO: es el OTRO proyecto, no Gestion Activa.
-- El portal del cliente se pausa cuando Gestión avisa que la cuota lleva 20+ días vencida.
-- Solo llega la lista de usuarios a bloquear; ningún dato de pagos.

alter table gym_clients add column if not exists portal_bloqueado boolean not null default false;
alter table gym_clients add column if not exists portal_bloqueado_desde timestamptz;

create or replace function asistencia_set_bloqueos(p_token text, p_ids text[])
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_token is null or p_token <> (select valor from sync_secretos where clave = 'gestion') then
    raise exception 'token inválido';
  end if;
  update gym_clients set portal_bloqueado = true, portal_bloqueado_desde = coalesce(portal_bloqueado_desde, now())
   where id = any(coalesce(p_ids, '{}')) and not portal_bloqueado;
  update gym_clients set portal_bloqueado = false, portal_bloqueado_desde = null
   where portal_bloqueado and not (id = any(coalesce(p_ids, '{}')));
  select count(*) into n from gym_clients where portal_bloqueado;
  return n;
end $$;
grant execute on function asistencia_set_bloqueos(text, text[]) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

select 'OK' as estado,
  (select count(*) from information_schema.columns where table_name = 'gym_clients' and column_name like 'portal_bloq%') as columnas,
  (select count(*) from pg_proc where proname = 'asistencia_set_bloqueos') as funcion;
