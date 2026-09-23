# =============================================================================
# Exporta los certificados raiz en los que confia Windows a un archivo PEM,
# para que los contenedores de Docker puedan usarlos.
#
# Hace falta cuando la red de la empresa inspecciona el trafico HTTPS y npm
# falla dentro del contenedor con SELF_SIGNED_CERT_IN_CHAIN.
#
# Uso, desde la carpeta del proyecto:
#   powershell -ExecutionPolicy Bypass -File scripts\exportar-ca-windows.ps1
# =============================================================================

$ErrorActionPreference = 'Stop'

$carpeta = Join-Path (Split-Path $PSScriptRoot -Parent) 'certs'
$destino = Join-Path $carpeta 'ca-corporativa.crt'

New-Item -ItemType Directory -Force -Path $carpeta | Out-Null

$lineas = New-Object System.Collections.Generic.List[string]
$vistos = New-Object System.Collections.Generic.HashSet[string]
$total = 0

# Almacen de la maquina y del usuario: la CA corporativa puede estar en
# cualquiera de los dos segun como la haya desplegado Sistemas.
foreach ($tienda in @('Cert:\LocalMachine\Root', 'Cert:\CurrentUser\Root',
                      'Cert:\LocalMachine\CA',   'Cert:\CurrentUser\CA')) {
    Get-ChildItem $tienda -ErrorAction SilentlyContinue | ForEach-Object {
        if ($vistos.Add($_.Thumbprint)) {
            $lineas.Add('-----BEGIN CERTIFICATE-----')
            $lineas.Add([Convert]::ToBase64String($_.RawData, 'InsertLineBreaks'))
            $lineas.Add('-----END CERTIFICATE-----')
            $total++
        }
    }
}

if ($total -eq 0) {
    Write-Error 'No se encontro ningun certificado raiz. Ejecute PowerShell como administrador.'
    exit 1
}

# Sin BOM: OpenSSL no lee el archivo si lo lleva.
[System.IO.File]::WriteAllLines($destino, $lineas, (New-Object System.Text.UTF8Encoding $false))

Write-Host ""
Write-Host "Listo: $total certificados exportados a" -ForegroundColor Green
Write-Host "  $destino"
Write-Host ""
Write-Host "Ahora vuelva a construir la imagen:"
Write-Host "  docker compose --env-file .env.produccion up -d --build"
Write-Host ""
