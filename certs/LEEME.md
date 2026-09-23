# Certificado de la CA corporativa

Si la red de la empresa inspecciona el tráfico HTTPS (cortafuegos tipo Fortinet,
Palo Alto, Sophos, Zscaler…), las conexiones desde dentro de los contenedores
fallan con `SELF_SIGNED_CERT_IN_CHAIN`: Windows confía en la CA de la empresa
porque está en su almacén de certificados, pero el contenedor no la conoce.

Para resolverlo, coloque aquí el certificado de esa CA con el nombre exacto:

    certs/ca-corporativa.crt

En formato PEM (texto que empieza por `-----BEGIN CERTIFICATE-----`). Puede
contener varios certificados, uno tras otro.

La forma más simple de generarlo en Windows es ejecutar, desde la carpeta del
proyecto y en PowerShell:

    powershell -ExecutionPolicy Bypass -File scripts\exportar-ca-windows.ps1

Eso exporta los certificados raíz en los que ya confía Windows —incluida la CA
de la empresa— al archivo que la construcción espera.

El archivo `.crt` no se sube al repositorio: cada empresa tiene el suyo, y en
una instalación sin inspección de tráfico no hace falta ninguno. Si el archivo
no existe, la construcción funciona igual.
