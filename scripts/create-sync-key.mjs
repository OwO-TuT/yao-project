import {createHash, randomBytes} from 'node:crypto';
import {chmod, mkdir, readFile, writeFile} from 'node:fs/promises';

const directory=new URL('../work/secrets/',import.meta.url);
const keyFile=new URL('sync-key.txt',directory);
const hashFile=new URL('sync-key-hash.txt',directory);
await mkdir(directory,{recursive:true});
let key;
try{key=(await readFile(keyFile,'utf8')).trim()}catch{key=randomBytes(32).toString('base64url');await writeFile(keyFile,key+'\n',{mode:0o600})}
if(!/^[A-Za-z0-9_-]{43}$/.test(key))throw new Error('本地同步钥匙格式不正确，请人工检查 work/secrets/sync-key.txt');
const hash=createHash('sha256').update(key).digest('hex');
await writeFile(hashFile,hash+'\n',{mode:0o600});
await chmod(keyFile,0o600);await chmod(hashFile,0o600);
console.log('私人同步钥匙已安全准备好（内容未显示）。');
