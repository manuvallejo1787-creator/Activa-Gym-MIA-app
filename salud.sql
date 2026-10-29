-- salud.sql — controles de salud de la base
--
-- Correr después de cada migración y cada vez que `npm run salud` avise que
-- estos controles quedaron pendientes por falta de credenciales de servicio.
--
-- POR QUÉ EXISTE CADA UNO
--   1. RLS sin política: el 20/10/2026 `screening_bandas` quedó con RLS
--      activo y cero políticas. La tabla estaba inerte en producción — la app
--      leía cero filas en silencio y caía al respaldo del código sin avisar.
--   2. Fuera de la publicación de Realtime: la app se suscribe a cambios de
--      varias tablas. Si la tabla no está publicada, el evento nunca llega.
--      El 28/10 ese mismo patrón hizo que un ejercicio guardado no apareciera.
--   3. Columnas 100% nulas: información que nadie llena. La norma pide que no
--      haya material sin conectar ni que no sea esencial en uso.
--   4. Claves de bandas sin consumir y al revés.

-- ═══ 1. Tablas con RLS activo y CERO políticas ═══════════════════════════
-- `sync_secretos` es la excepción correcta: una tabla de secretos DEBE estar
-- inaccesible desde el cliente. Cualquier otra fila acá es un bug.
select c.relname as tabla,
       'RLS activo sin ninguna política: inerte desde el cliente' as problema
from pg_class c
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
where c.relkind = 'r' and c.relrowsecurity
  and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
  and c.relname <> 'sync_secretos'
order by 1;

-- ═══ 2. Tablas públicas fuera de la publicación de Realtime ══════════════
-- Informativo: no toda tabla necesita Realtime. Pero si la app se suscribe a
-- una que no está acá, el evento no llega nunca.
select c.relname as tabla, 'no está en supabase_realtime' as nota
from pg_class c
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
where c.relkind = 'r'
  and not exists (
    select 1 from pg_publication_tables pt
    where pt.pubname = 'supabase_realtime'
      and pt.schemaname = 'public' and pt.tablename = c.relname)
order by 1;

-- ═══ 3. Tablas sin clave primaria ════════════════════════════════════════
-- Sin clave primaria, la replicación lógica no puede identificar la fila y
-- los UPDATE/DELETE de Realtime llegan incompletos o no llegan.
select c.relname as tabla, 'sin clave primaria' as problema
from pg_class c
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
where c.relkind = 'r'
  and not exists (select 1 from pg_constraint k
                  where k.conrelid = c.oid and k.contype = 'p')
order by 1;

-- ═══ 4. Claves del screening que la tabla de bandas no cubre ═════════════
-- Un movimiento medido en algún cliente que no tiene banda definida se pinta
-- sin veredicto: dato cargado que no se conecta a ningún criterio.
with medidas as (
  select distinct regexp_replace(k, '_(grados|metodo|Izq|Der|DBil)$', '') as k
  from gym_clients, jsonb_object_keys(screening) k
  where screening is not null and k like 'mov\_%'
)
select m.k as clave_medida,
       'medida en algún cliente y sin banda en screening_bandas' as problema
from medidas m
where not exists (select 1 from screening_bandas b where b.k = m.k)
order by 1;

-- ═══ 5. Bandas definidas que nadie midió nunca ═══════════════════════════
-- Al revés: criterio cargado que no se usa. Avisa, no es error.
select b.k as clave_banda, b.label,
       'definida en screening_bandas y nunca medida' as nota
from screening_bandas b
where b.k like 'mov\_%'
  and not exists (
    select 1 from gym_clients, jsonb_object_keys(screening) k
    where screening is not null and k = b.k || '_grados')
order by 1;

-- ═══ 6. Clientes con screening marcado completo y sin datos ══════════════
-- El síntoma que Manu reportó el 28/10 como "se borró todo". Esa vez era el
-- navegador; este control distingue el caso real del falso positivo.
select id, nombre, apellido, updated_at,
       (select count(*) from jsonb_object_keys(coalesce(screening,'{}'::jsonb))) as claves
from gym_clients
where screening_completo
  and (select count(*) from jsonb_object_keys(coalesce(screening,'{}'::jsonb))) < 20
order by updated_at desc;
