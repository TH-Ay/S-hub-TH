-- ──────────────────────────────────────────────────────────────────────────────
-- Nuevo rol de sistema 'TI'.
--
-- TI administra la app igual que 'admin' (accesos, configuración, proyectos,
-- ausencias, alertas, reportes), pero NO ve datos sensibles de personas:
-- remuneraciones, evaluaciones, mentorías e hitos de la matriz de talento.
--
-- 1. Amplía el CHECK de persona.rol_sistema con 'TI'.
-- 2. fn_es_admin / fn_puede_aprobar_plan incluyen 'TI'.
-- 3. fn_es_admin_datos_sensibles(): solo 'admin' y 'personas'.
-- 4. Las tablas sensibles pasan a usar fn_es_admin_datos_sensibles().
-- 5. Políticas RLS que nombran roles literalmente ('admin', 'personas')
--    agregan 'TI', excepto en tablas sensibles y anotaciones.
-- Es idempotente.
-- ──────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. CHECK ─────────────────────────────────────────────────────────────────
ALTER TABLE persona DROP CONSTRAINT IF EXISTS persona_rol_sistema_check;
ALTER TABLE persona
  ADD CONSTRAINT persona_rol_sistema_check
  CHECK (rol_sistema IN ('admin', 'personas', 'TI', 'GyD', 'AySr', 'Desarrollo', 'proposer', 'planificador'));

-- ── 2. Helpers de administración ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_es_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM persona p
    WHERE p.auth_user_id = auth.uid()
      AND p.rol_sistema IN ('admin', 'personas', 'TI')
      AND p.acceso_estado IN ('invitada', 'activa')
  );
$$;

-- Planificación sigue en solo lectura (20261029): editor = admin/personas/TI
CREATE OR REPLACE FUNCTION fn_is_editor_rol()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM persona p
    WHERE p.auth_user_id = auth.uid()
      AND p.rol_sistema IN ('admin', 'personas', 'TI')
      AND p.acceso_estado IN ('invitada', 'activa')
  );
$$;

CREATE OR REPLACE FUNCTION fn_puede_aprobar_plan()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM persona p
    WHERE p.auth_user_id = auth.uid()
      AND p.rol_sistema IN ('admin', 'personas', 'TI', 'proposer')
      AND p.acceso_estado IN ('invitada', 'activa')
  );
$$;

-- ── 3. Helper para datos sensibles (sin TI) ──────────────────────────────────
CREATE OR REPLACE FUNCTION fn_es_admin_datos_sensibles()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM persona p
    WHERE p.auth_user_id = auth.uid()
      AND p.rol_sistema IN ('admin', 'personas')
      AND p.acceso_estado IN ('invitada', 'activa')
  );
$$;
REVOKE EXECUTE ON FUNCTION fn_es_admin_datos_sensibles() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_es_admin_datos_sensibles() TO authenticated;

-- ── 3b. TI no puede cambiar su propio rol ────────────────────────────────────
-- La app lo valida en el servidor; esto lo impide también por API directa.
-- (service_role / SQL Editor no tienen auth.uid() y pasan igual que antes)
CREATE OR REPLACE FUNCTION fn_check_rol_sistema_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.rol_sistema IS DISTINCT FROM OLD.rol_sistema THEN
    IF auth.uid() IS NOT NULL AND NOT fn_es_admin() THEN
      RAISE EXCEPTION 'Solo un administrador puede modificar el rol de sistema.';
    END IF;
    IF auth.uid() IS NOT NULL
       AND OLD.auth_user_id = auth.uid()
       AND OLD.rol_sistema = 'TI' THEN
      RAISE EXCEPTION 'El rol TI no puede cambiar su propio rol.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 4 y 5. Políticas RLS ─────────────────────────────────────────────────────
DO $$
DECLARE
  sensibles text[] := ARRAY[
    'persona_remuneracion', 'persona_remuneracion_hito', 'persona_evaluacion',
    'persona_mentoria', 'persona_matriz_hito'
  ];
  pol   record;
  new_q text;
  new_c text;
  sql   text;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    new_q := pol.qual;
    new_c := pol.with_check;

    IF pol.tablename = ANY (sensibles) THEN
      -- Tablas sensibles: fn_es_admin() → fn_es_admin_datos_sensibles()
      new_q := replace(new_q, 'fn_es_admin()', 'fn_es_admin_datos_sensibles()');
      new_c := replace(new_c, 'fn_es_admin()', 'fn_es_admin_datos_sensibles()');
    ELSIF pol.tablename NOT LIKE 'anotacion%'
      AND (coalesce(pol.qual, '') || coalesce(pol.with_check, '')) LIKE '%''admin''%'
      AND (coalesce(pol.qual, '') || coalesce(pol.with_check, '')) NOT LIKE '%''TI''%' THEN
      -- Roles literales: ARRAY['admin'::t, ...] → ARRAY['admin'::t, 'TI'::t, ...]
      new_q := regexp_replace(new_q, $r$ARRAY\['admin'::([a-z ]+)$r$, $r$ARRAY['admin'::\1, 'TI'::\1$r$, 'g');
      new_c := regexp_replace(new_c, $r$ARRAY\['admin'::([a-z ]+)$r$, $r$ARRAY['admin'::\1, 'TI'::\1$r$, 'g');
    END IF;

    -- Solo si algo cambió
    IF new_q IS NOT DISTINCT FROM pol.qual AND new_c IS NOT DISTINCT FROM pol.with_check THEN
      CONTINUE;
    END IF;

    sql := format('ALTER POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    IF new_q IS NOT NULL THEN sql := sql || ' USING (' || new_q || ')'; END IF;
    IF new_c IS NOT NULL THEN sql := sql || ' WITH CHECK (' || new_c || ')'; END IF;

    RAISE NOTICE 'Actualizando política %.%', pol.tablename, pol.policyname;
    EXECUTE sql;
  END LOOP;
END;
$$;

COMMIT;
