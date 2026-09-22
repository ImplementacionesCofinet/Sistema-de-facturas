-- =============================================================================
-- Migracion 002: credenciales locales
--
-- Permite operar sin salida a internet ni HTTPS: el inicio de sesion con
-- Microsoft Entra ID exige que el servidor alcance login.microsoftonline.com
-- y que la URL de la app sea HTTPS, cosa que en una instalacion interna no
-- siempre se tiene. Con esta tabla la app puede autenticar contra su propia
-- base de datos.
--
-- La autorizacion (rol y areas) sigue saliendo de la tabla aprobadores: esta
-- tabla solo responde "esta persona es quien dice ser".
-- =============================================================================

CREATE TABLE IF NOT EXISTS credenciales (
  correo             TEXT PRIMARY KEY,
  clave_hash         TEXT NOT NULL,
  debe_cambiar_clave BOOLEAN NOT NULL DEFAULT TRUE,
  intentos_fallidos  INTEGER NOT NULL DEFAULT 0,
  bloqueado_hasta    TIMESTAMPTZ,
  actualizado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- El correo se guarda siempre en minusculas para que la busqueda sea directa.
CREATE OR REPLACE FUNCTION credenciales_normalizar_correo() RETURNS trigger AS $$
BEGIN
  NEW.correo := lower(btrim(NEW.correo));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS credenciales_normalizar ON credenciales;
CREATE TRIGGER credenciales_normalizar
  BEFORE INSERT OR UPDATE ON credenciales
  FOR EACH ROW EXECUTE FUNCTION credenciales_normalizar_correo();
