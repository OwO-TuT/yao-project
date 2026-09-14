import fs from 'node:fs/promises';
const assets={};
for(const [path,type] of [['index.html','text/html; charset=utf-8'],['style.css','text/css; charset=utf-8'],['app.js','text/javascript; charset=utf-8']])assets['/'+path]={type,body:await fs.readFile('web/'+path,'utf8')};
assets['/assets/demo-scenic-recreation.jpg']={type:'image/jpeg',encoding:'base64',body:(await fs.readFile('web/assets/demo-scenic-recreation.jpg')).toString('base64')};
await fs.mkdir('dist/server',{recursive:true});
await fs.mkdir('dist/.openai',{recursive:true});
await fs.writeFile('dist/server/index.js',`const ASSETS=${JSON.stringify(assets)};\n`+await fs.readFile('src/worker.js','utf8'));
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built Worker with embedded interface assets.');
