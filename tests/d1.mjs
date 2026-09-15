export class TestD1 {
  rows=new Map();
  prepare(sql){
    return {bind:(...args)=>({
      first:async()=>this.first(sql,args),
      all:async()=>this.all(sql,args),
      run:async()=>this.run(sql,args)
    })};
  }
  key(owner,id){return owner+'\u0000'+id}
  async first(sql,args){
    if(sql.startsWith('SELECT data, updated_at')){const row=this.rows.get(this.key(args[0],args[1]));return row?{data:row.data,updated_at:row.updated_at}:null}
    if(sql.startsWith('SELECT COUNT(*)'))return{total:[...this.rows.values()].filter(row=>row.owner===args[0]).length};
    throw new Error('Unsupported D1 first query: '+sql);
  }
  async all(sql,args){
    if(sql.startsWith('SELECT data FROM memories'))return{results:[...this.rows.values()].filter(row=>row.owner===args[0]).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,500).map(row=>({data:row.data}))};
    throw new Error('Unsupported D1 all query: '+sql);
  }
  async run(sql,args){
    if(sql.startsWith('INSERT INTO memories')){const [owner,id,data,created_at,updated_at]=args,key=this.key(owner,id);if(this.rows.has(key))throw new Error('duplicate');this.rows.set(key,{owner,id,data,created_at,updated_at});return{meta:{changes:1}}}
    if(sql.startsWith('UPDATE memories')){const [data,updated_at,created_at,owner,id,expected]=args,key=this.key(owner,id),row=this.rows.get(key);if(!row||row.updated_at!==expected)return{meta:{changes:0}};this.rows.set(key,{owner,id,data,created_at,updated_at});return{meta:{changes:1}}}
    throw new Error('Unsupported D1 run query: '+sql);
  }
}
