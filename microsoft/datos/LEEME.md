# Datos para cargar

Los archivos `.xlsx` de esta carpeta **no se versionan**: son facturas reales de
la compañía y no tienen por qué vivir en un repositorio de código.

Se generan en cualquier momento a partir del archivo original:

```bash
npx tsx scripts/exportar-sharepoint.mts "Reporte DIAN septiembre.xlsx"
npx tsx scripts/exportar-sharepoint.mts "Cofinet - SEPTIEMBRE 2026.xlsx"
```

Cada corrida informa cuántas filas salieron, cuáles quedaron fuera y por qué, y
los valores distintos de área, estado y tipo de documento, que son los que hay
que registrar en las columnas de elección de la lista.
