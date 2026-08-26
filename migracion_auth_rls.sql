-- ═══════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 2 de 2 — CERRAR RLS DETRÁS DE AUTENTICACIÓN
--
-- ⚠️  NO CORRER ESTO HASTA HABER:
--     1. Deployado el frontend nuevo (con AuthGate.jsx)
--     2. Creado los usuarios en Supabase → Authentication → Users
--     3. Verificado que entrás a la app con email + contraseña
--
-- Si corrés esto antes, la app deja de leer datos hasta que haya login.
--
-- QUÉ HACE: reemplaza las políticas `using(true) with check(true)`
-- (que dejan la base abierta a cualquiera que tenga la anon key, y la
-- anon key está en el bundle público de JS) por políticas atadas a un
-- usuario autenticado real.
--
-- NO afecta al portal del cliente: api/portal.js usa la SERVICE_ROLE_KEY,
-- que ignora RLS por diseño. El portal sigue funcionando igual.
-- ═══════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  p record;
  tablas text[] := array[
    'gym_clients','fisio_pacientes','fisio_evaluaciones','ejercicios',
    'fuerza_tests','fuerza_tests_custom','planes_periodizacion','gym_planes',
    'gym_planes_nutricion','alimentos_custom','ejecucion_registros',
    'ia_conocimiento','sesiones_clinicas','rehab_ejercicios_custom',
    'centro_config','criterios_avance_template','gym_incidencias'
  ];
begin
  foreach t in array tablas loop
    if to_regclass('public.'||t) is null then
      raise notice 'Tabla % no existe — se omite', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    -- Borra las políticas permisivas anteriores
    for p in select policyname from pg_policies
             where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;

    -- Política nueva: solo usuarios autenticados
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      'auth_all_'||t, t);

    raise notice 'RLS cerrado en %', t;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Verificación: todas deberían decir {authenticated} en la columna roles
select tablename, policyname, roles
from pg_policies
where schemaname='public'
order by tablename;
