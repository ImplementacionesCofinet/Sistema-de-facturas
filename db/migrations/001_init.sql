-- =============================================================================
-- Cofinet - Sistema de facturas
-- Migracion 001: esquema inicial
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- importaciones: una fila por cada archivo Excel de la DIAN cargado a la app.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS importaciones (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_archivo     TEXT,
  total_filas        INTEGER NOT NULL DEFAULT 0,
  filas_nuevas       INTEGER NOT NULL DEFAULT 0,
  filas_actualizadas INTEGER NOT NULL DEFAULT 0,
  filas_sin_cambios  INTEGER NOT NULL DEFAULT 0,
  filas_ignoradas    INTEGER NOT NULL DEFAULT 0,
  errores            JSONB  NOT NULL DEFAULT '[]'::jsonb,
  importado_por      TEXT,
  importado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- facturas: registro oficial. id_unico es la llave de negocio que evita
-- duplicados entre importaciones mensuales sucesivas.
--   Facturas electronicas -> NIT_NumFactura
--   Cuentas de cobro      -> CC_NIT_Fecha_Total
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facturas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_unico         TEXT UNIQUE NOT NULL,
  tipo_documento   TEXT NOT NULL DEFAULT 'FACTURA',
  n_factura        TEXT,
  fra_abr          TEXT,
  cufe             TEXT,
  fecha_emision    DATE,
  fecha_recepcion  TIMESTAMPTZ,
  nit              TEXT,
  tercero          TEXT,
  total            DECIMAL(18,2),
  area             TEXT,
  estado           TEXT NOT NULL DEFAULT 'PENDIENTE',
  cbte             TEXT,
  cbte_ok          BOOLEAN NOT NULL DEFAULT FALSE,
  cbte_ok_fecha    TIMESTAMPTZ,
  cbte_ok_usuario  TEXT,
  observaciones    TEXT,
  documento_ref    TEXT,
  forma_pago       TEXT,
  estado_pago      TEXT,
  fecha_aprobacion TIMESTAMPTZ,
  aprobado_por     TEXT,
  mes_periodo      TEXT,
  importacion_id   UUID REFERENCES importaciones(id) ON DELETE SET NULL,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT facturas_estado_chk
    CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA')),
  CONSTRAINT facturas_tipo_documento_chk
    CHECK (tipo_documento IN ('FACTURA', 'CUENTA_COBRO', 'NOTA_CREDITO', 'NOTA_DEBITO', 'OTRO'))
);

CREATE INDEX IF NOT EXISTS facturas_area_idx        ON facturas (area);
CREATE INDEX IF NOT EXISTS facturas_estado_idx      ON facturas (estado);
CREATE INDEX IF NOT EXISTS facturas_mes_periodo_idx ON facturas (mes_periodo);
CREATE INDEX IF NOT EXISTS facturas_nit_idx         ON facturas (nit);
CREATE INDEX IF NOT EXISTS facturas_cbte_ok_idx     ON facturas (cbte_ok);
CREATE INDEX IF NOT EXISTS facturas_fecha_emision_idx ON facturas (fecha_emision DESC);

-- -----------------------------------------------------------------------------
-- auditoria: traza inmutable de cada cambio. Reemplaza al historial de
-- versiones de Excel: usuario, fecha/hora exacta, campo, valor anterior/nuevo.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id       UUID REFERENCES facturas(id) ON DELETE SET NULL,
  id_unico_ref     TEXT,
  tercero          TEXT,
  area             TEXT,
  usuario          TEXT,
  fecha_cambio     TIMESTAMPTZ NOT NULL DEFAULT now(),
  campo_modificado TEXT,
  valor_anterior   TEXT,
  valor_nuevo      TEXT
);

CREATE INDEX IF NOT EXISTS auditoria_factura_idx ON auditoria (factura_id);
CREATE INDEX IF NOT EXISTS auditoria_fecha_idx   ON auditoria (fecha_cambio DESC);
CREATE INDEX IF NOT EXISTS auditoria_usuario_idx ON auditoria (usuario);

-- -----------------------------------------------------------------------------
-- aprobadores: quien puede ver y aprobar cada area. El correo debe coincidir
-- con la cuenta corporativa de Microsoft 365 con la que inicia sesion.
-- Un mismo correo puede tener varias filas (varias areas a cargo).
-- rol: APROBADOR (jefe de area) | CONTABILIDAD (importa y contabiliza) | ADMIN
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aprobadores (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area     TEXT NOT NULL,
  nombre   TEXT NOT NULL,
  correo   TEXT NOT NULL,
  rol      TEXT NOT NULL DEFAULT 'APROBADOR',
  activo   BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT aprobadores_rol_chk CHECK (rol IN ('APROBADOR', 'CONTABILIDAD', 'ADMIN'))
);

CREATE UNIQUE INDEX IF NOT EXISTS aprobadores_correo_area_uidx
  ON aprobadores (lower(correo), upper(area));
CREATE INDEX IF NOT EXISTS aprobadores_correo_idx ON aprobadores (lower(correo));

-- -----------------------------------------------------------------------------
-- areas: catalogo editable de areas de la empresa.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS areas (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre  TEXT NOT NULL,
  activo  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS areas_nombre_uidx ON areas (upper(nombre));

-- -----------------------------------------------------------------------------
-- actualizado_en automatico
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_actualizado_en() RETURNS trigger AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS facturas_set_actualizado_en ON facturas;
CREATE TRIGGER facturas_set_actualizado_en
  BEFORE UPDATE ON facturas
  FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
