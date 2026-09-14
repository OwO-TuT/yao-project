export class TestBucket {
  objects=new Map();
  async put(key,value,options={}){if(options.onlyIf&&this.objects.get(key)?.etag!==options.onlyIf.etagMatches)return null;const bytes=typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(await new Response(value).arrayBuffer());const etag=crypto.randomUUID();this.objects.set(key,{bytes,etag});return{etag};}
  async get(key){const obj=this.objects.get(key);if(!obj)return null;return {etag:obj.etag,body:obj.bytes,arrayBuffer:async()=>obj.bytes.buffer,json:async()=>JSON.parse(new TextDecoder().decode(obj.bytes))};}
  async list({prefix,limit=100,cursor}){const keys=[...this.objects.keys()].filter(k=>k.startsWith(prefix)).sort();const start=Number(cursor||0),end=start+limit;return {objects:keys.slice(start,end).map(key=>({key})),truncated:end<keys.length,cursor:String(end)};}
  async delete(key){this.objects.delete(key);}
}
