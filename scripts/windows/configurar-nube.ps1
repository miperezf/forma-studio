# FORMA Studio - activar/actualizar el MODO NUBE en STAGING (datos ficticios): Google Auth (solo propietario) + Firestore.
# Uso: doble clic en CONFIGURAR_NUBE.cmd  (en la misma carpeta que app-web-3d-<version>.zip; usa la version mas alta)
# Pasos: descomprime el ZIP mas reciente, npm install, verificaciones reales, Java + pruebas de reglas en el emulador (BLOQUEANTE),
# sesion de Firebase, correo propietario, app web, base Firestore, proveedor Google (manual en la consola),
# build nube y despliegue de hosting + reglas. No guarda contrasenas ni tokens en el proyecto.
param([string]$Email = '', [string]$Location = 'southamerica-west1')
$ErrorActionPreference = 'Continue'
$Base = Split-Path -Parent $MyInvocation.MyCommand.Path
$ZipItem = Get-ChildItem $Base -Filter 'app-web-3d-*.zip' | Where-Object { $_.Name -match '^app-web-3d-\d+\.\d+\.\d+\.zip$' } |
  Sort-Object { [version]($_.Name -replace '^app-web-3d-(.+)\.zip$', '$1') } | Select-Object -Last 1
$ZipVersion = if ($ZipItem) { $ZipItem.Name -replace '^app-web-3d-(.+)\.zip$', '$1' } else { '' }
$Zip = if ($ZipItem) { $ZipItem.FullName } else { Join-Path $Base 'app-web-3d-X.Y.Z.zip' }
$Repo = Join-Path $Base 'app-web-3d'
$Out  = Join-Path $Base 'resultados-nube'
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$Resumen = Join-Path $Out 'resumen.txt'
"FORMA Studio $ZipVersion - modo nube staging - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Set-Content -Encoding UTF8 $Resumen
Start-Transcript -Path (Join-Path $Out 'configuracion.log') -Append | Out-Null

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
# Ejecuta un comando de Firebase con --json y devuelve el objeto (o $null). stdout y stderr van a archivos separados.
function FirebaseJson([string]$nombre, [string]$argumentos) {
  $o = Join-Path $Out "log-fb_$nombre.json"; $e = Join-Path $Out "log-fb_$nombre.err.txt"
  cmd /c "$fb $argumentos --json > `"$o`" 2> `"$e`""
  $texto = Get-Content $o -Raw -ErrorAction SilentlyContinue
  if (-not $texto) { return $null }
  $i = $texto.IndexOf('{'); if ($i -lt 0) { return $null }
  try { return ($texto.Substring($i) | ConvertFrom-Json) } catch { return $null }
}
function RefrescarPath() {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function VersionJava() {
  $salida = cmd /c "java -version 2>&1"
  if ($LASTEXITCODE -ne 0 -or -not $salida) { return 0 }
  $m = [regex]::Match(($salida -join ' '), 'version "(\d+)')
  if ($m.Success) { return [int]$m.Groups[1].Value } else { return 0 }
}

Paso '1/12 Node.js'
$major = 0
if (Get-Command node -ErrorAction SilentlyContinue) { $major = [int]((& node -v).TrimStart('v').Split('.')[0]) }
if ($major -lt 22) { Anotar "FALLO  se necesita Node.js 22+ (detectado: $major). Ejecuta antes PUBLICAR_STAGING.cmd."; Fin 2 }
Anotar "OK     Node $(& node -v)"

Paso "2/12 Proyecto $ZipVersion"
if (-not (Test-Path (Join-Path $Repo 'package.json'))) {
  Anotar 'FALLO: falta el codigo fuente local; no se extraera ningun ZIP.'
  Fin 1
}
Set-Location $Repo
$version = (Get-Content (Join-Path $Repo 'package.json') -Raw | ConvertFrom-Json).version
$ZipVersion = $version
$IdsSeguros = (Get-Content (Join-Path $Repo '.firebaserc') -Raw | ConvertFrom-Json).projects
if ($IdsSeguros.production -ne 'forma-studio-prd-7bink' -or $IdsSeguros.staging -ne 'forma-studio-stg-wyp3i') {
  Anotar 'FALLO: identificadores de Firebase distintos de los autorizados.'
  Fin 1
}
Anotar "OK     proyecto $version en $Repo"

Paso '3/12 Dependencias (npm install)'
cmd /c "npm install --no-audit --no-fund > `"$Out\log-npm_install.txt`" 2>&1"
if ($LASTEXITCODE -ne 0) {
  cmd /c "npm install --no-audit --no-fund --legacy-peer-deps > `"$Out\log-npm_install_legacy.txt`" 2>&1"
  if ($LASTEXITCODE -ne 0) { Anotar "FALLO  npm install (ver $Out)"; Fin 1 }
  Anotar 'OK     npm install (--legacy-peer-deps)'
} else { Anotar 'OK     npm install' }

Paso '4/12 Verificaciones reales'
Ejecutar 'typecheck (tsc estricto)'  'npm run typecheck'  $true
Ejecutar 'arquitectura R1-R11'       'npm run arch'       $true
Ejecutar 'tests Beta (node:test)'    'npm run test:beta'  $true
Ejecutar 'Vitest real'               'npx vitest run'     $true
Ejecutar 'ESLint'                    'npm run lint'       $false
Ejecutar 'dependency-cruiser'        'npm run depcruise'  $false

Paso '5/12 Java (requerido por el emulador de Firestore)'
$jv = VersionJava
if ($jv -lt 21) {
  Write-Host "Java 21+ no encontrado (detectado: $jv). Se instalara Microsoft OpenJDK 21 con winget." -ForegroundColor Green
  cmd /c "winget install --id Microsoft.OpenJDK.21 -e --accept-source-agreements --accept-package-agreements > `"$Out\log-winget_java.txt`" 2>&1"
  RefrescarPath
  $jv = VersionJava
  if ($jv -lt 21) {
    $jdk = Get-ChildItem 'C:\Program Files\Microsoft' -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($jdk) { $env:JAVA_HOME = $jdk.FullName; $env:Path = (Join-Path $jdk.FullName 'bin') + ';' + $env:Path; $jv = VersionJava }
  }
  if ($jv -lt 21) { Anotar "FALLO  no se pudo instalar Java 21 (ver $Out\log-winget_java.txt)"; Fin 1 }
}
Anotar "OK     Java $jv"

$fb = 'npx --yes firebase-tools@15'
Paso '6/12 Pruebas de reglas en el emulador (bloqueante: sin esto no se despliega)'
Ejecutar 'reglas Firestore (emulador)' "$fb --config firebase.emulator.json emulators:exec --only firestore --project demo-forma-rules `"node --test tests/rules/firestore.rules.test.mjs`"" $true

Paso '7/12 Firebase: sesion'
cmd /c "$fb projects:list > `"$Out\log-firebase_projects.txt`" 2>&1"
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Se abrira el navegador para iniciar sesion en Firebase CLI con tu cuenta de Google.' -ForegroundColor Green
  cmd /c "$fb login --reauth"
  cmd /c "$fb projects:list > `"$Out\log-firebase_projects.txt`" 2>&1"
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Plan B: abre el enlace, inicia sesion y pega el codigo AQUI (nunca en el chat).' -ForegroundColor Green
    cmd /c "$fb login --reauth --no-localhost"
    cmd /c "$fb projects:list > `"$Out\log-firebase_projects.txt`" 2>&1"
    if ($LASTEXITCODE -ne 0) { Anotar 'FALLO  sesion de Firebase'; Fin 1 }
  }
}
$rc = Join-Path $Repo '.firebaserc'
if (-not (Test-Path $rc)) { Anotar 'FALLO  no existe .firebaserc (ejecuta antes PUBLICAR_STAGING.cmd)'; Fin 1 }
$ProjectId = (Get-Content $rc -Raw | ConvertFrom-Json).projects.staging
if (-not $ProjectId) { Anotar 'FALLO  .firebaserc sin proyecto staging'; Fin 1 }
Anotar "OK     sesion de Firebase; proyecto staging = $ProjectId"

Paso '8/12 Correo propietario (unica cuenta que podra entrar)'
$envLocal = Join-Path $Repo '.env.local'
$actual = ''
if (Test-Path $envLocal) { $m = Select-String -Path $envLocal -Pattern '^FORMA_OWNER_EMAILS=(.+)$' | Select-Object -First 1; if ($m) { $actual = $m.Matches[0].Groups[1].Value.Trim() } }
if (-not $Email -and $actual) { $Email = $actual; Write-Host "Propietario ya configurado (.env.local); se mantiene." }
if (-not $Email) {
  $sugerido = $actual
  if (-not $sugerido) {
    $lista = cmd /c "$fb login:list 2>&1"
    $mm = [regex]::Match(($lista -join ' '), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
    if ($mm.Success) { $sugerido = $mm.Value }
  }
  $resp = Read-Host "Correo(s) de Google del propietario, separados por coma [Enter = $sugerido]"
  $Email = if ($resp) { $resp } else { $sugerido }
}
$Email = ($Email -split ',' | ForEach-Object { $_.Trim().ToLower() } | Where-Object { $_ -match '^[^@\s]+@[^@\s]+\.[^@\s]+$' }) -join ','
if (-not $Email) { Anotar 'FALLO  correo propietario invalido'; Fin 1 }
$lineas = @(); if (Test-Path $envLocal) { $lineas = @(Get-Content $envLocal | Where-Object { $_ -notmatch '^FORMA_OWNER_EMAILS=' }) }
($lineas + "FORMA_OWNER_EMAILS=$Email") | Set-Content -Encoding ASCII $envLocal
Anotar "OK     propietario(s) configurado(s) en .env.local ($(($Email -split ',').Count))"

Paso '9/12 App web de Firebase y su configuracion publica'
$apps = FirebaseJson 'apps_list' "apps:list WEB --project $ProjectId"
$appId = $null
if ($apps -and $apps.result) { $appId = ($apps.result | Select-Object -First 1).appId }
if (-not $appId) {
  $creada = FirebaseJson 'apps_create' "apps:create WEB `"FORMA Studio Staging`" --project $ProjectId"
  if ($creada -and $creada.result) { $appId = $creada.result.appId }
}
if (-not $appId) { Anotar "FALLO  no se pudo obtener/crear la app web (ver $Out\log-fb_apps_*.txt)"; Fin 1 }
$sdk = FirebaseJson 'sdkconfig' "apps:sdkconfig WEB $appId --project $ProjectId"
$cfg = $null
if ($sdk -and $sdk.result) {
  if ($sdk.result.sdkConfig) { $cfg = $sdk.result.sdkConfig }
  elseif ($sdk.result.fileContents) { $t = $sdk.result.fileContents; $a = $t.IndexOf('{'); $b = $t.LastIndexOf('}'); if ($a -ge 0) { $cfg = $t.Substring($a, $b - $a + 1) | ConvertFrom-Json } }
  elseif ($sdk.result.apiKey) { $cfg = $sdk.result }
}
if (-not $cfg -or -not $cfg.apiKey) { Anotar "FALLO  configuracion web incompleta (ver $Out\log-fb_sdkconfig.json)"; Fin 1 }
$cfg | ConvertTo-Json | Set-Content -Encoding ASCII (Join-Path $Repo 'firebase\web-config.staging.json')
Anotar "OK     app web $appId -> firebase\web-config.staging.json"

Paso "10/12 Base de datos Firestore ($Location)"
$dbs = FirebaseJson 'db_list' "firestore:databases:list --project $ProjectId"
$existe = $false
if ($dbs) { $existe = (($dbs | ConvertTo-Json -Depth 8) -match 'databases/\(default\)') }
if (-not $existe) {
  cmd /c "$fb firestore:databases:create `"(default)`" --location $Location --project $ProjectId > `"$Out\log-firestore_create.txt`" 2>&1"
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'No se pudo crear la base por CLI. Se abrira la consola: pulsa "Crear base de datos", modo PRODUCCION,' -ForegroundColor Green
    Write-Host "ubicacion $Location (Santiago). Luego vuelve aqui." -ForegroundColor Green
    Start-Process "https://console.firebase.google.com/project/$ProjectId/firestore"
    Read-Host 'Pulsa Enter cuando la base de datos este creada'
  }
  Anotar "OK     Firestore creado ($Location)"
} else { Anotar 'OK     Firestore ya existia' }

Paso '11/12 Proveedor de acceso Google (manual, 1 minuto)'
$authOk = (Test-Path $envLocal) -and (Select-String -Path $envLocal -Pattern '^FORMA_NUBE_GOOGLE_OK=1' -Quiet)
if ($authOk) { Anotar 'OK     proveedor Google (confirmado en una ejecucion anterior)' } else {
Write-Host 'Se abrira la consola de Firebase > Authentication.' -ForegroundColor Green
Write-Host '  1) Si aparece "Comenzar", pulsalo.' -ForegroundColor Green
Write-Host '  2) Pestana "Metodo de acceso" > Agregar proveedor > Google > Habilitar.' -ForegroundColor Green
Write-Host '  3) Elige tu correo como "correo de asistencia" y pulsa Guardar.' -ForegroundColor Green
Start-Process "https://console.firebase.google.com/project/$ProjectId/authentication/providers"
Read-Host 'Pulsa Enter cuando Google aparezca como "Habilitado"'
Add-Content -Encoding ASCII $envLocal 'FORMA_NUBE_GOOGLE_OK=1'
Anotar 'OK     proveedor Google confirmado por el usuario'
}

Paso '12/12 Build nube y despliegue (hosting + reglas + indices)'
Ejecutar 'build nube staging' 'node scripts/build-cloud.mjs staging' $true
$reglas = Get-Content (Join-Path $Repo 'firestore.rules') -Raw
if ($reglas -match '__OWNER_EMAILS__') { Anotar 'FALLO  firestore.rules con marcador sin reemplazar'; Fin 1 }
Ejecutar 'firebase deploy' "$fb deploy --only hosting,firestore:rules,firestore:indexes --project $ProjectId --message `"staging $ZipVersion nube`"" $true
$url = "https://$ProjectId.web.app"
$url | Set-Content -Encoding ASCII (Join-Path $Out 'URL_STAGING.txt')
Anotar "URL    $url"
Write-Host "`nListo. Staging en modo nube: $url" -ForegroundColor Green
Write-Host 'Avisa en el chat: Claude verificara el acceso y los flujos.' -ForegroundColor Green
Fin 0
