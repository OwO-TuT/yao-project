import http from 'node:http';
import worker from '../dist/server/index.js';
import {TestBucket} from '../tests/bucket.mjs';
const env={BUCKET:new TestBucket()};
http.createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const h=new Headers(req.headers);h.set('oai-authenticated-user-id','local-preview-only');h.set('oai-authenticated-user-email','local-preview@example.test');const method=req.method;const request=new Request('http://127.0.0.1:4173'+req.url,{method,headers:h,...(!['GET','HEAD'].includes(method)?{body:Buffer.concat(chunks)}:{})});const result=await worker.fetch(request,env);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));}catch{res.writeHead(500);res.end('Preview error')}}).listen(4173,'127.0.0.1',()=>console.log('Local preview: http://127.0.0.1:4173 (test account, temporary test storage)'));
