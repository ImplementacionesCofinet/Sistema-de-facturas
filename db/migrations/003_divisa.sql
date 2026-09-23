-- =============================================================================
-- Migracion 003: divisa del documento
--
-- El reporte de la DIAN indica la moneda de cada factura. Sin guardarla, un
-- importe en dolares se muestra como si fueran pesos y la cifra enganna.
-- =============================================================================

ALTER TABLE facturas ADD COLUMN IF NOT EXISTS divisa TEXT;

COMMENT ON COLUMN facturas.divisa IS
  'Codigo ISO de la moneda (COP, USD, EUR). Nulo cuando el origen no la informa.';
