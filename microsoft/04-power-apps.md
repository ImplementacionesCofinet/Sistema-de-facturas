# Power App

App de lienzo sobre la lista de SharePoint. Con licencia de Microsoft 365 no
hace falta nada premium, siempre que el origen de datos sea SharePoint y no
Dataverse.

## La delegación: léalo antes de escribir la primera fórmula

Power Apps no trae toda la lista al dispositivo. Trabaja sobre los primeros
**500 registros** (ampliable a 2.000 en *Configuración → General → Límite de
fila de datos*) salvo que la fórmula sea *delegable*, es decir, que SharePoint
pueda resolverla del lado del servidor.

Con 5.000 facturas en la lista, una fórmula no delegable **muestra resultados
incompletos sin avisar**: no da error, simplemente faltan filas. Es el fallo
más difícil de notar y el que más confianza destruye.

**Sobre SharePoint sí se delegan:** `=`, `<>`, `<`, `<=`, `>`, `>=`,
`StartsWith`, `And`, `Or`, `Not`, y las columnas de elección comparadas por
`.Value`.

**No se delegan:** `Search()`, `in`, `Filter` contra una colección local,
`Sort` sobre columnas sin índice, y la mayoría de operaciones sobre columnas de
tipo Persona.

Regla práctica: **todo filtro arranca por `MesPeriodo` o por `Area`**, que están
indexadas, y el resto se afina encima.

## Pantallas

### Inicio

Al abrir, resuelve quién entró y qué áreas tiene a cargo:

```powerfx
Set(gblCorreo; Lower(User().Email));

ClearCollect(
    colAprobador;
    Filter(Aprobadores; Activo = true)        // la lista es corta: no hay problema
);
ClearCollect(
    colMisAreas;
    Filter(colAprobador; Lower(Persona.Email) = gblCorreo)
);

Set(gblEsContabilidad;
    CountRows(Filter(colMisAreas; Rol.Value in ["CONTABILIDAD"; "ADMIN"])) > 0
);
Set(gblArea; First(colMisAreas).Area.Value);
Set(gblMes; Text(Now(); "yyyy-mm"))
```

La lista `Aprobadores` tiene pocas filas, así que traerla entera no choca con
la delegación. La de facturas, sí.

### Facturas

```powerfx
// Jefe de área: una sola área a la vez, elegida en un desplegable.
// Filtrar por varias con "in" NO se delega y devolvería datos incompletos.
Filter(
    Facturas;
    MesPeriodo = ddMes.Selected.Value;
    Area.Value = ddArea.Selected.Value;
    Estado.Value = ddEstado.Selected.Value
)
```

Si un jefe tiene varias áreas, el desplegable `ddArea` se llena con `colMisAreas`
y se filtra por una a la vez. Es delegable y además es como la gente trabaja.

Para Contabilidad, `ddArea` se llena con todas las áreas más una opción "Todas",
y en ese caso se omite la condición de área.

**Para buscar por tercero o NIT no use `Search()`**, que no se delega:

```powerfx
Filter(
    Facturas;
    MesPeriodo = ddMes.Selected.Value;
    StartsWith(Tercero; txtBuscar.Text) || StartsWith(NIT; txtBuscar.Text)
)
```

`StartsWith` sí se delega. Busca por el comienzo, no por cualquier parte: vale
la pena explicarlo en la etiqueta del campo.

### Detalle y aprobación

El adjunto se maneja con el control **Adjuntos** dentro de un control
**Formulario de edición** conectado a la lista. Fuera de un formulario no
funciona.

```powerfx
// Aprobar
Patch(
    Facturas;
    galFacturas.Selected;
    {
        Estado: { Value: "APROBADA" };
        Observaciones: txtObservaciones.Text;
        FechaAprobacion: Now();
        AprobadoPor: {
            '@odata.type': "#Microsoft.Azure.Connectors.SharePoint.SPListExpandedUser";
            Claims: "i:0#.f|membership|" & gblCorreo;
            DisplayName: User().FullName;
            Email: User().Email
        }
    }
);
SubmitForm(frmAdjuntos)   // guarda el documento soporte
```

```powerfx
// Rechazar: el motivo es obligatorio
If(
    IsBlank(Trim(txtObservaciones.Text));
    Notify("Para rechazar escriba el motivo en observaciones."; NotificationType.Error);
    Patch(
        Facturas;
        galFacturas.Selected;
        {
            Estado: { Value: "RECHAZADA" };
            Observaciones: txtObservaciones.Text;
            FechaAprobacion: Now();
            AprobadoPor: { /* igual que arriba */ }
        }
    )
)
```

Una vez contabilizada, la decisión no se cambia:

```powerfx
// Propiedad DisplayMode de los botones Aprobar y Rechazar
If(galFacturas.Selected.CbteOK = true; DisplayMode.Disabled; DisplayMode.Edit)
```

### Contabilizar

Solo para Contabilidad. Facturas aprobadas sin comprobante:

```powerfx
Filter(Facturas; Estado.Value = "APROBADA"; CbteOK = false)
```

Marcar OK exige número de comprobante y que esté aprobada:

```powerfx
If(
    IsBlank(Trim(txtCbte.Text));
    Notify("Para marcar OK registre el número de comprobante."; NotificationType.Error);
    Patch(
        Facturas;
        galPorContabilizar.Selected;
        {
            Cbte: txtCbte.Text;
            CbteOK: true;
            CbteOKFecha: Now();
            CbteOKUsuario: { /* igual que AprobadoPor */ }
        }
    )
)
```

### Importar

Power Apps no sube archivos a una biblioteca por sí solo. Dos caminos:

1. Contabilidad deja el archivo en la biblioteca desde Teams o el explorador, y
   el flujo se dispara solo. Es lo más simple.
2. Un botón en la app que llame al flujo con `Flujo.Run()`, si quieren tenerlo
   todo en un lugar.

La app no debería hacer la importación por su cuenta: 450 filas desde el
cliente es lento y frágil.

## Lo que se pierde frente al aplicativo web

Conviene saberlo de entrada, no descubrirlo a mitad de camino:

- **La búsqueda por cualquier parte del texto**, por la delegación. Queda
  "empieza por".
- **Las validaciones viven en la app, no en los datos.** En el aplicativo web
  ninguna escritura podía saltarse las reglas. Aquí, quien entre a la lista por
  el navegador puede cambiar un estado a mano. Se mitiga restringiendo el acceso
  directo a la lista.
- **La auditoría depende de un flujo.** Si el flujo falla, se pierde ese
  registro. Por eso el historial de versiones es la red de seguridad.
- **El límite de 5.000** obliga a archivar cada año. El aplicativo web no tenía
  techo práctico.
