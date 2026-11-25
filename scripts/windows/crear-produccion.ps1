# FORMA Studio - crear y publicar PRODUCCION (proyecto Firebase SEPARADO de staging; datos reales, taller vacio).
# Uso: doble clic en CREAR_PRODUCCION.cmd, DESPUES de CONFIGURAR_NUBE.cmd con la misma version y verificada en staging.
# Pasos: confirmacion escrita, verificaciones reales + reglas en el emulador (bloqueantes), proyecto Firebase de
# produccion (se crea si no existe), app web, Firestore (southamerica-west1), proveedor Google (manual), build y deploy.
# Plan gratuito Spark. Respaldo: manual desde Configuracion > Respaldo (decision del propietario).
param([string]$Location = 'southamerica-west1')
$ErrorActionPreference = 'Continue'
$Base = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo = Join-Path $Base 'app-web-3d'
$Out  = Join-Path $Base 'resultados-produccion'
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$Resumen = Join-Path $Out 'resumen.txt'
"FORMA Studio - produccion - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Set-Content -Encoding UTF8 $Resumen
Start-Transcript -Path (Join-Path $Out 'produccion.log') -Append | Out-Null

function Paso($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Anotar($t) { Write-Host $t; Add-Content -Encoding UTF8 $Resumen $t }
function Fin($codigo) { Stop-Transcript | Out-Null; exit $codigo }
function Ejecutar([string]$nombre, [string]$comando, [bool]$bloqueante) {
  Write-Host "`n--- $nombre ($comando)" -ForegroundColor Yellow
  $archivo = Join-Path $Out ("log-" + ($nombre -replace '[^a-zA-Z0-9]', '_') + ".txt")
  cmd /c "$comando > `"$archivo`" 2>&1"
  $codigo = $LASTEXITCODE
  Get-Content $archivo -Tail 25
  if ($codigo -eq 0) { Anotar "OK     $nombre" }
  elseif ($bloqueante) { Anotar "FALLO  $nombre (bloqueante, codigo $codigo) -> ver $archivo"; Fin 1 }
  else { Anotar "FALLO  $nombre (no bloqueante, codigo $codigo) -> ver $archivo" }
}
function FirebaseJson([string]$nombre, [string]$argumentos) {
  $o = Join-Path $Out "log-fb_$nombre.json"; $e = Join-Path $Out "log-fb_$nombre.err.txt"
  cmd /c "$fb $argumentos --json > `"$o`" 2> `"$e`""
  $texto = Get-Content $o -Raw -ErrorAction SilentlyContinue
  if (-not $texto) { return $null }
  $i = $texto.IndexOf('{'); if ($i -lt 0) { return $null }
  try { return ($texto.Substring($i) | ConvertFrom-Json) } catch { return $null }
}

Paso '1/9 Confirmacion'
if (-not (Test-Path (Join-Path $Repo 'package.json'))) { Anotar 'FALLO  falta el proyecto: ejecuta antes CONFIGURAR_NUBE.cmd'; Fin 1 }
Set-Location $Repo
$version = (Get-Content (Join-Path $Repo 'package.json') -Raw | ConvertFrom-Json).version
$envLocal = Join-Path $Repo '.env.local'
$owners = ''
if (Test-Path $envLocal) { $m = Select-String -Path $envLocal -Pattern '^FORMA_OWNER_EMAILS=(.+)$' | Select-Object -First 1; if ($m) { $owners = $m.Matches[0].Groups[1].Value.Trim() } }
if (-not $owners) { Anotar 'FALLO  falta el correo propietario (.env.local): ejecuta antes CONFIGURAR_NUBE.cmd'; Fin 1 }
Write-Host "Se publicara FORMA Studio $version en PRODUCCION (proyecto separado, taller vacio, datos reales)." -ForegroundColor Green
Write-Host "Solo podra entrar: $owners" -ForegroundColor Green
$ok = Read-Host 'Escribe PRODUCCION para continuar'
if ($ok -ne 'PRODUCCION') { Anotar 'CANCELADO por el usuario'; Fin 2 }
Anotar "OK     confirmado: produccion $version"

Paso '2/9 Verificaciones reales (todas bloqueantes)'
Ejecutar 'typecheck (tsc estricto)'  'npm run typecheck'  $true
Ejecutar 'arquitectura R1-R11'       'npm run arch'       $true
Ejecutar 'tests Beta (node:test)'    'npm run test:beta'  $true
Ejecutar 'Vitest real'               'npx vitest run'     $true
Ejecutar 'ESLint'                    'npm run lint'       $true
Ejecutar 'dependency-cruiser'        'npm run depcruise'  $true

$fb = 'npx --yes firebase-tools@15'
Paso '3/9 Reglas en el emulador (bloqueante)'
Ejecutar 'reglas Firestore (emulador)' "$fb --config firebase.emulator.json emulators:exec --only firestore --project demo-forma-rules `"node --test tests/rules/firestore.rules.test.mjs`"" $true

Paso '4/9 Sesion de Firebase'
cmd /c "$fb projects:list > `"$Out\log-firebase_projects.txt`" 2>&1"
if ($LASTEXITCODE -ne 0) {
  cmd /c "$fb login --reauth"
  cmd /c "$fb projects:list > `"$Out\log-firebase_projects.txt`" 2>&1"
  if ($LASTEXITCODE -ne 0) { Anotar 'FALLO  sesion de Firebase'; Fin 1 }
}
Anotar 'OK     sesion de Firebase'

Paso '5/9 Proyecto de produccion (separado de staging)'
$rc = Join-Path $Repo '.firebaserc'
$rcData = if (Test-Path $rc) { Get-Content $rc -Raw | ConvertFrom-Json } else { [pscustomobject]@{ projects = [pscustomobject]@{} } }
$ProjectId = $rcData.projects.production
if (-not $ProjectId) {
  $sufijo = -join ((48..57) + (97..122) | Get-Random -Count 5 | ForEach-Object { [char]$_ })
  $ProjectId = "forma-studio-prd-$sufijo"
  Write-Host "Creando proyecto Firebase $ProjectId (plan gratuito Spark)..." -ForegroundColor Green
  cmd /c "$fb projects:create $ProjectId --display-name `"FORMA Studio`" > `"$Out\log-firebase_create.txt`" 2>&1"
  if ($LASTEXITCODE -ne 0) { Anotar "FALLO  crear proyecto $ProjectId (ver $Out\log-firebase_create.txt)"; Fin 1 }
  $rcData.projects | Add-Member -NotePropertyName production -NotePropertyValue $ProjectId -Force
  $rcData | ConvertTo-Json -Depth 5 | Set-Content -Encoding ASCII $rc
  Anotar "OK     proyecto creado: $ProjectId"
} else { Anotar "OK     proyecto existente: $ProjectId" }
if ($ProjectId -eq $rcData.projects.staging) { Anotar 'FALLO  produccion y staging no pueden ser el mismo proyecto'; Fin 1 }

Paso '6/9 App web y configuracion publica'
$apps = FirebaseJson 'apps_list' "apps:list WEB --project $ProjectId"
$appId = $null
if ($apps -and $apps.result) { $appId = ($apps.result | Select-Object -First 1).appId }
if (-not $appId) { $c = FirebaseJson 'apps_create' "apps:create WEB `"FORMA Studio`" --project $ProjectId"; if ($c -and $c.result) { $appId = $c.result.appId } }
if (-not $appId) { Anotar 'FALLO  no se pudo obtener/crear la app web'; Fin 1 }
$sdk = FirebaseJson 'sdkconfig' "apps:sdkconfig WEB $appId --project $ProjectId"
$cfg = $null
if ($sdk -and $sdk.result) {
  if ($sdk.result.sdkConfig) { $cfg = $sdk.result.sdkConfig }
  elseif ($sdk.result.fileContents) { $t = $sdk.result.fileContents; $a = $t.IndexOf('{'); $b = $t.LastIndexOf('}'); if ($a -ge 0) { $cfg = $t.Substring($a, $b - $a + 1) | ConvertFrom-Json } }
}
if (-not $cfg -or -not $cfg.apiKey) { Anotar 'FALLO  configuracion web incompleta'; Fin 1 }
$cfg | ConvertTo-Json | Set-Content -Encoding ASCII (Join-Path $Repo 'firebase\web-config.production.json')
Anotar "OK     app web $appId"

Paso "7/9 Firestore ($Location) y acceso con Google"
$dbs = FirebaseJson 'db_list' "firestore:databases:list --project $ProjectId"
$existe = $false
if ($dbs -and $dbs.status -eq 'success') { $existe = (($dbs | ConvertTo-Json -Depth 8) -match 'databases/\(default\)') }
if (-not $existe) {
  cmd /c "$fb firestore:databases:create `"(default)`" --location $Location --project $ProjectId > `"$Out\log-firestore_create.txt`" 2>&1"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Se abrira la consola: pulsa 'Crear base de datos', modo PRODUCCION, ubicacion $Location (Santiago)." -ForegroundColor Green
    Start-Process "https://console.firebase.google.com/project/$ProjectId/firestore"
    Read-Host 'Pulsa Enter cuando la base de datos este creada'
  }
}
Anotar "OK     Firestore ($Location)"
Write-Host 'Se abrira Authentication: Comenzar > Metodo de acceso > Google > Habilitar > correo de asistencia > Guardar.' -ForegroundColor Green
Start-Process "https://console.firebase.google.com/project/$ProjectId/authentication/providers"
Read-Host 'Pulsa Enter cuando Google aparezca como "Habilitado"'
Anotar 'OK     proveedor Google confirmado por el usuario'

Paso '8/9 Build de produccion'
Ejecutar 'build nube produccion' 'node scripts/build-cloud.mjs production' $true
if ((Get-Content (Join-Path $Repo 'firestore.rules') -Raw) -match '__OWNER_EMAILS__') { Anotar 'FALLO  reglas con marcador'; Fin 1 }

Paso '9/9 Despliegue de produccion'
Ejecutar 'firebase deploy produccion' "$fb deploy --only hosting,firestore:rules,firestore:indexes --project $ProjectId --message `"produccion $version`"" $true
$url = "https://$ProjectId.web.app"
$url | Set-Content -Encoding ASCII (Join-Path $Out 'URL_PRODUCCION.txt')
Anotar "URL    $url"
Write-Host "`nListo. Produccion: $url" -ForegroundColor Green
Write-Host 'Avisa en el chat: Claude verificara la publicacion antes de que cargues datos reales.' -ForegroundColor Green
Fin 0
