// Genera dist/FORMA_STUDIO_BETA.html: un único archivo con estilos, motor (IIFE) y UI.
// Requisito previo: `npm run build:bridge` en la raíz (genera src/vendor/forma-engine.iife.js).
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
// Uso: node scripts/build-standalone.mjs [--env=demo|staging]
//  demo    → dist/FORMA_STUDIO_BETA.html (archivo único para abrir localmente)
//  staging → dist/staging/{index.html,robots.txt} (sitio para Firebase Hosting; noindex + etiqueta de entorno)
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const vendor=resolve(root,'src/vendor/forma-engine.iife.js');
if(!existsSync(vendor)){console.error('Falta src/vendor/forma-engine.iife.js: ejecuta npm run build:bridge en la raíz.');process.exit(1);}
const files=['src/domain/printer-profiles.js','src/domain/quote-inputs.js','src/domain/crm.js','src/domain/inventory.js','src/domain/workflow.js','src/domain/today.js','src/domain/products.js','src/domain/backup.js','src/domain/bambu-3mf.js','src/data/filament-catalog.js','src/domain/materials-catalog.js','src/data/repository.js','src/ui/app.js'];
// Guardia: todo módulo local importado debe estar en la lista (si falta, el archivo único fallaría solo al usar esa función).
for(const file of files){
 for(const [,spec] of readFileSync(resolve(root,file),'utf8').matchAll(/^import [\s\S]*? from '(\.{1,2}\/[^']+)';/gm)){
  if(spec.includes('/vendor/'))continue;
  const target=resolve(dirname(resolve(root,file)),spec).slice(root.length+1).replaceAll('\\','/');
  if(!files.includes(target))throw Error(`${file} importa ${target}, que no está en la lista de build-standalone.mjs`);
 }
}
// Guardia: el archivo único junta todos los módulos en UN solo ámbito; un nombre declarado en dos módulos rompería
// toda la página («Identifier has already been declared») solo en la versión publicada.
const declared=new Map();
for(const file of files){
 for(const [,name] of readFileSync(resolve(root,file),'utf8').matchAll(/^(?:export\s+)?(?:const|let|var|function|async function|class)\s+([A-Za-z_$][\w$]*)/gm)){
  if(declared.has(name))throw Error(`«${name}» está declarado en ${declared.get(name)} y en ${file}: el archivo único fallaría. Renombra uno.`);
  declared.set(name,file);
 }
}
const vendorNames=new Set();
const code=files.map(file=>readFileSync(resolve(root,file),'utf8')
 .replace(/^import \{([^}]*)\} from '\.\.\/vendor\/forma-engine\.js';\s*$/gm,(_,names)=>{names.split(',').map(n=>n.trim()).filter(Boolean).forEach(n=>vendorNames.add(n));return '';})
 .replace(/^import .*?;\s*$/gm,'')
 .replace(/^export /gm,'')
).join('\n');
if(/^import /m.test(code))throw Error('Quedó un import multilínea sin resolver.');
const engine=readFileSync(vendor,'utf8');
let markup=readFileSync(resolve(root,'index.html'),'utf8');
const style=readFileSync(resolve(root,'src/styles.css'),'utf8');
// Reemplazos con función: el código contiene secuencias `$'` y `$`` que String.replace interpretaría como patrones.
markup=markup.replace('<link rel="stylesheet" href="./src/styles.css">',()=>`<style>${style}</style>`);
// Íconos como data URI: el archivo único y Firebase Hosting no necesitan archivos aparte (la CSP permite img-src data:).
const ICON_TYPES={svg:'image/svg+xml',png:'image/png'};
markup=markup.replace(/href="\.\/src\/assets\/([\w.-]+)\.(svg|png)"/g,(_,name,ext)=>{
 const bytes=readFileSync(resolve(root,`src/assets/${name}.${ext}`));
 return `href="data:${ICON_TYPES[ext]};base64,${bytes.toString('base64')}"`;
});
if(/src\/assets\//.test(markup))throw Error('Quedó un ícono sin incrustar en el archivo único.');
const script=`${engine}\n(() => {\nconst {${[...vendorNames].join(',')}} = FormaEngine;\n${code}\n})();`;
markup=markup.replace('<script type="module" src="./src/ui/app.js"></script>',()=>`<script>${script.replaceAll('</script>','<\\/script>')}</script>`);
mkdirSync(resolve(root,'dist'),{recursive:true});
const envArg=(process.argv.find(a=>a.startsWith('--env='))||'--env=demo').slice(6);
const ENVS={
  demo:{label:'ENTORNO DEMO',note:'Datos ficticios guardados solo en este navegador.'},
  staging:{label:'STAGING · DATOS FICTICIOS',note:'Versión de pruebas. No ingreses datos reales: no hay control de acceso ni respaldo central; los datos quedan solo en este navegador.'},
  // Vista previa publicada en claude.ai: el visor no permite imprimir y envuelve la página en su propio <html>.
  preview:{label:'VISTA PREVIA · DATOS FICTICIOS',note:'Vista previa de pruebas en claude.ai. No ingreses datos reales. Impresión no disponible en esta vista.',printUnavailable:true},
};
ENVS.production={label:'FORMA STUDIO',note:'Datos del taller en la nube. Acceso solo con cuenta autorizada.'};
const labelArg=(process.argv.find(a=>a.startsWith('--label='))||'').slice(8);
const env=ENVS[envArg]&&{...ENVS[envArg],...(labelArg?{label:labelArg}:{})};
if(!env)throw Error(`Entorno desconocido: ${envArg}`);
const version=JSON.parse(readFileSync(resolve(root,'..','..','package.json'),'utf8')).version;
const envScript=`<script>window.FORMA_ENV=${JSON.stringify({name:envArg,version,...env})};</script>`;
markup=markup.replace('<head>',()=>`<head>${envArg==='staging'||envArg==='production'?'<meta name="robots" content="noindex,nofollow">':''}${envScript}`);
if(envArg==='preview'){
  // El visor agrega doctype/html/head/body: se publica solo el contenido (título, metas, estilos, cuerpo y scripts).
  const head=/<head>([\s\S]*?)<\/head>/.exec(markup)[1].replace(/<meta charset=[^>]*>|<meta name="viewport"[^>]*>|<title>[\s\S]*?<\/title>/g,'');
  const body=/<body>([\s\S]*)<\/body>/.exec(markup)[1];
  const dir=resolve(root,'dist/preview');
  mkdirSync(dir,{recursive:true});
  writeFileSync(resolve(dir,'forma-studio-preview.html'),`<title>FORMA Studio</title>\n<meta name="robots" content="noindex,nofollow">\n${head}\n${body}\n`,'utf8');
  console.log(`Vista previa generada: ${dir}/forma-studio-preview.html`);
}else if(envArg==='staging'||envArg==='production'){
  const dir=resolve(root,`dist/${envArg}`);
  mkdirSync(dir,{recursive:true});
  writeFileSync(resolve(dir,'index.html'),markup,'utf8');
  writeFileSync(resolve(dir,'robots.txt'),'User-agent: *\nDisallow: /\n','utf8');
  console.log(`Sitio ${envArg} generado: ${dir}`);
}else{
  const output=resolve(root,'dist/FORMA_STUDIO_BETA.html');
  writeFileSync(output,markup,'utf8');
  console.log(`Standalone generado: ${output}`);
}
