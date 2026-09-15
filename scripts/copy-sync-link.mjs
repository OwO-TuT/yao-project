import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const key=(await readFile(new URL('../work/secrets/sync-key.txt',import.meta.url),'utf8')).trim();
if(!/^[A-Za-z0-9_-]{43}$/.test(key))throw new Error('没有找到有效的私人同步钥匙');
const result=spawnSync('pbcopy',{input:`https://shiyi-memory.yao7121j.workers.dev/#sync=${key}`,encoding:'utf8'});
if(result.status!==0)throw new Error('复制失败，请检查系统剪贴板');
console.log('私人同步链接已复制到剪贴板（链接内容未显示）。');
