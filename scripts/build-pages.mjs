import fs from 'node:fs/promises';

const output='dist-pages';

await fs.rm(output,{recursive:true,force:true});
await fs.cp('web',output,{recursive:true});

const indexPath=`${output}/index.html`;
const index=await fs.readFile(indexPath,'utf8');
const demoIndex=index.replace('<html lang="zh-CN">','<html lang="zh-CN" data-app-mode="teacher-demo">');

if(demoIndex===index)throw new Error('Unable to mark the Cloudflare build as a teacher demo.');

await fs.writeFile(indexPath,demoIndex);
console.log('Built the public teacher demo in dist-pages/.');
