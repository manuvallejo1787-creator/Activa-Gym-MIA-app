-- ════════════════════════════════════════════════════════════════════════════
-- POLÍTICA RLS DE screening_bandas  ·  20/10/2026  ·  va después de la "_b"
--
-- EL AGUJERO
-- `screening_bandas` quedó con RLS activada y CERO políticas. Con esa
-- combinación, toda consulta desde la app devuelve cero filas: el permiso de
-- SELECT existe, pero RLS filtra todas las filas antes de entregarlas.
--
-- Efecto real, verificado en producción: la app consulta la tabla, recibe un
-- array vacío, y `useBandasScreening` hace lo que tiene que hacer —se queda
-- con los valores del código y lo informa en el panel. No se rompió nada,
-- porque el respaldo funcionó. Pero la tabla estaba inerte: recalibrar una
-- banda ahí no habría cambiado nada en la app, en silencio.
--
-- Es el modo de falla más incómodo de todos: el que no falla.
--
-- POR QUÉ PASÓ
-- El `create table` de la migración "_a" no enciende RLS por sí solo. Este
-- proyecto la activa igual sobre toda tabla nueva de `public`, así que una
-- tabla recién creada nace cerrada hasta que se le escribe su política.
-- Las demás tablas del proyecto ya la tienen; esta se creó sin ella.
--
-- LA POLÍTICA
-- Misma forma que `rom_normas`, `ejercicios` y `centro_config`: acceso total
-- para `authenticated`, que es con lo que entra la app. `anon` queda fuera, o
-- sea que sin sesión no se leen las bandas.
-- ════════════════════════════════════════════════════════════════════════════

begin;

drop policy if exists auth_all_screening_bandas on screening_bandas;

create policy auth_all_screening_bandas
  on screening_bandas
  for all
  to authenticated
  using (true)
  with check (true);

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ════════════════════════════════════════════════════════════════════════════
select 'la política existe' as control,
       coalesce(string_agg(policyname || ' (' || cmd || ' → ' || roles::text || ')', ', '), 'NINGUNA') as resultado,
       case when count(*) = 1 then 'OK' else 'REVISAR' end as estado
from pg_policies where schemaname = 'public' and tablename = 'screening_bandas'
union all
select 'misma forma que las otras tablas',
       count(*)::text || ' de 4 tablas con política ALL para authenticated',
       case when count(*) = 4 then 'OK' else 'REVISAR' end
from pg_policies
where schemaname = 'public'
  and tablename in ('screening_bandas','rom_normas','ejercicios','centro_config')
  and cmd = 'ALL' and roles::text = '{authenticated}'
union all
select 'anon NO lee las bandas',
       case when exists (select 1 from pg_policies where schemaname='public'
                          and tablename='screening_bandas' and roles::text like '%anon%')
            then 'anon tiene política — revisar' else 'anon sin política — correcto' end,
       case when exists (select 1 from pg_policies where schemaname='public'
                          and tablename='screening_bandas' and roles::text like '%anon%')
            then 'REVISAR' else 'OK' end
union all
select 'las 14 filas siguen ahí', count(*)::text,
       case when count(*) = 14 then 'OK' else 'REVISAR' end
from screening_bandas
union all
select 'ninguna otra tabla quedó sin política',
       coalesce(string_agg(c.relname, ', '), 'ninguna'),
       case when count(*) = 0 then 'OK' else 'REVISAR' end
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  and not exists (select 1 from pg_policies p where p.tablename = c.relname and p.schemaname = 'public');
