import fs from 'node:fs/promises';

const output='dist-pages';

await fs.rm(output,{recursive:true,force:true});
await fs.cp('web',output,{recursive:true});

const indexPath=`${output}/index.html`;
const index=await fs.readFile(indexPath,'utf8');
const [style,app]=await Promise.all([
  fs.readFile(`${output}/style.css`,'utf8'),
  fs.readFile(`${output}/app.js`,'utf8')
]);
const demoIndex=index
  .replace('<html lang="zh-CN">','<html lang="zh-CN" data-app-mode="teacher-demo">')
  .replace('<link rel="stylesheet" href="/style.css">',`<style>\n${style.replaceAll('</style>','<\\/style>')}\n</style>`)
  .replace('<script src="/app.js"></script>',`<script>\n${app.replaceAll('</script>','<\\/script>')}\n</script>`);

if(demoIndex===index||demoIndex.includes('href="/style.css"')||demoIndex.includes('src="/app.js"'))throw new Error('Unable to create the self-contained Cloudflare demo.');

await fs.writeFile(indexPath,demoIndex);
console.log('Built the public teacher demo in dist-pages/.');
