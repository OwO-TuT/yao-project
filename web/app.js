const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const intents=['必做','想买','想学','想做','想试试','留作参考','备用','只是好笑','重要凭证'];
const legacyIntents=['只收藏','稍后看或试','学习','待行动'];
const actionable=new Set(['必做','想买','想学','想做','想试试','待行动','学习','稍后看或试']);
const icons={text:'文',link:'链',image:'图',audio:'音'};
const types={text:'文字',link:'链接',image:'图片',audio:'录音'};
const weekNames=['周日','周一','周二','周三','周四','周五','周六'];
let records=[],me=null,mode='text',selectedIntent='留作参考',intentTouched=false,attachment=null,attachmentURL=null,view='library',filter='全部',panelQuery='',recorder=null,stream=null,recordTimer=null,recordClock=null,saving=false,tickerTimer=null,tickerIndex=0,demoMode=false;
const syncStorageKey='shiyi-private-sync-key-v1';
const incomingSyncKey=location.hash.match(/^#sync=([A-Za-z0-9_-]{43})$/)?.[1]||'';
if(incomingSyncKey){localStorage.setItem(syncStorageKey,incomingSyncKey);history.replaceState(null,'',location.pathname+location.search)}
let syncKey=incomingSyncKey||localStorage.getItem(syncStorageKey)||'';
const hostedTeacherDemo=document.documentElement.dataset.appMode==='teacher-demo';
const explicitTeacherDemo=new URLSearchParams(location.search).get('demo')==='teacher';
const forceTeacherDemo=explicitTeacherDemo||(hostedTeacherDemo&&!syncKey);
const demoObjectUrls=[];
const storedFileUrls=new Map();

const demo=[
  {id:'demo-scenic',kind:'image',title:'大理洱海旁的观景位',text:'这个地方在大理洱海附近。我喜欢前景栏杆、湖面和远山的层次，下次傍晚去时想复刻相似构图。',summary:'画面由木质栏杆、平静湖面和远山组成，适合在日落前从观景台拍摄。',scene:'湖泊、山脉、树林与木质观景栏杆，画面有清楚的前中后景。',photoTips:'傍晚提前到达；使用横向构图；让栏杆保留在画面下方作为前景。',topic:'旅行计划',intent:'想做',source:'社交媒体 / 小红书',clue:'大理 风景 湖边 同款照片',place:'大理洱海附近',photoPlan:'傍晚去，保留栏杆前景，拍湖面与远山的同款层次。',tags:['旅行','风景复刻'],status:'识别示例',createdAt:'2026-09-14',demo:true,demoImage:'/assets/demo-scenic-recreation.jpg'},
  {id:'demo-song',kind:'image',title:'直播弹幕里推荐的几首歌',text:'当时在直播间看到弹幕推荐，先记下歌名，晚上戴耳机听。',summary:'保存的是直播弹幕中的歌单线索。',topic:'音乐清单',intent:'想试试',source:'直播',clue:'直播 弹幕 歌名 好听',tags:['音乐','歌单'],status:'演示',createdAt:'2026-09-13',demo:true},
  {id:'demo-japanese',kind:'image',title:'日语成对自他动词口诀',text:'最近在学日语，想把这组成对动词做成复习卡。',summary:'按第1、3、7、14、30天重新出现。',topic:'日语学习',intent:'想学',source:'社交媒体 / 小红书',clue:'日语 自他动词 口诀',tags:['日语','自他动词'],status:'遗忘曲线示例',createdAt:'2026-09-12',demo:true}
];

function teacherSeed(){
  const tomorrow=new Date(Date.now()+86400000);tomorrow.setHours(9,0,0,0);
  const learning=new Date(Date.now()+86400000);learning.setHours(20,0,0,0);
  const schedule=[1,3,7,14,30].map(days=>{const d=new Date();d.setDate(d.getDate()+days);d.setHours(20,0,0,0);return localValue(d)});
  return demo.map(item=>{
    const record={...item,tags:[...(item.tags||[])],demo:false,teacherDemo:true,status:'演示资料'};
    if(item.id==='demo-scenic')record.reminder={when:localValue(tomorrow),priority:'普通',frequency:'仅一次',mode:'once',status:'进行中'};
    if(item.id==='demo-japanese')record.reminder={when:localValue(learning),priority:'重要',frequency:'遗忘曲线 1·3·7·14·30 天',mode:'curve',schedule,currentStep:0,status:'进行中'};
    return record;
  });
}

function activateTeacherDemo(){
  demoMode=true;
  me={email:'老师演示空间',aiEnabled:false,storageReady:false,auth:'demo',demo:true};
  records=teacherSeed();
  $('connection').textContent='免登录演示 · 刷新后重置';
  $('banner').textContent='现在是老师演示空间：可以保存、编辑、搜索、安排提醒和删除恢复；所有操作只留在当前页面，刷新后自动重置。';
  $('savehint').textContent='演示操作只保留在当前页面，刷新后重置。';
  updateTicker();
}

function notify(text){$('toast').textContent=text;$('toast').style.display='block';clearTimeout(window.toasting);window.toasting=setTimeout(()=>$('toast').style.display='none',3600)}
const pageViews=new Set(['panel','detail']);
function show(id){const node=$(id);if(node.open)return;pageViews.has(id)?node.show():node.showModal()}
function setActiveNav(next){document.querySelectorAll('.navButton').forEach(button=>{if(button.dataset.view===next)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')})}
function setRoute(next){const url=next?`${location.pathname}${location.search}#${next}`:`${location.pathname}${location.search}`;history.replaceState(null,'',url)}
function closeView(id){const node=$(id);if(node?.open)node.close();if(id==='panel'){setActiveNav(null);setRoute('')}if(id==='detail'&&$('panel').open){document.querySelector(`.navButton[data-view="${view}"]`)?.focus()}}
function zoomImage(src,alt='保存的图片'){$('lightboxImage').src=src;$('lightboxImage').alt=alt;$('lightboxCaption').textContent=alt;show('imageLightbox')}
function localValue(date){const d=new Date(date);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)}
function formatWhen(value){if(!value||!Number.isFinite(Date.parse(value)))return '尚未安排';const d=new Date(value);return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
function intentOf(r){return r.intentDetail||({'只收藏':'留作参考','稍后看或试':'想试试','学习':'想学','待行动':'想做'}[r.intent]||r.intent||'留作参考')}
function topicOf(r){return !r.topic||r.topic==='未分类'?'日常收藏':r.topic}
async function api(path,options={}){const headers=new Headers(options.headers||{});if(syncKey)headers.set('authorization','Bearer '+syncKey);const res=await fetch('/api/'+path,{...options,headers});let data;try{data=await res.json()}catch{throw new Error('服务暂时不可用，请稍后重试')}if(!res.ok){const error=new Error(data.error||'操作失败，请重试');error.status=res.status;throw error}return data}
async function storedFileUrl(id,retry=false){
  if(retry&&storedFileUrls.has(id)){URL.revokeObjectURL(storedFileUrls.get(id));storedFileUrls.delete(id)}
  if(storedFileUrls.has(id))return storedFileUrls.get(id);
  const headers=new Headers();if(syncKey)headers.set('authorization','Bearer '+syncKey);
  const res=await fetch(`/api/memories/${encodeURIComponent(id)}/file`,{credentials:'include',cache:'no-store',headers});
  if(!res.ok){let message='原始文件暂时无法读取，请稍后重试';try{message=(await res.json()).error||message}catch{}if(res.status===401)message='登录状态已失效，请重新登录后读取原始文件';if(res.status===404)message='没有找到原始文件，请重新上传这份资料';throw new Error(message)}
  const blob=await res.blob();if(!blob.size||!blob.type.match(/^(image|audio|video)\//))throw new Error('读取到的文件格式不正确，请重新上传');
  const url=URL.createObjectURL(blob);storedFileUrls.set(id,url);return url;
}
function mediaMarkup(r,url){return r.kind==='image'?`<button type="button" class="mediaZoom" data-zoom="${esc(url)}" data-zoom-alt="${esc(r.title)}" aria-label="放大查看 ${esc(r.title)}"><img class="media" src="${esc(url)}" alt="${esc(r.title)}"></button>`:`<audio controls src="${esc(url)}"></audio>`}
async function loadStoredMedia(r,retry=false){const mount=$(`media-${r.id}`);if(!mount)return;mount.className='mediaStatus';mount.setAttribute('role','status');mount.innerHTML=`<span class="mediaSpinner" aria-hidden="true"></span><p>正在安全读取${r.kind==='image'?'原始图片':'原始录音'}…</p>`;try{const url=await storedFileUrl(r.id,retry);const current=$(`media-${r.id}`);if(current)current.outerHTML=mediaMarkup(r,url)}catch(e){const current=$(`media-${r.id}`);if(current){current.className='mediaStatus mediaError';current.setAttribute('role','alert');current.innerHTML=`<strong>原始文件没有加载出来</strong><p>${esc(e.message)}</p><button class="smallbtn" data-retry-media="${esc(r.id)}">重新读取</button>`}}}
async function refresh(){if(demoMode){updateTicker();if($('panel').open)renderPanel();return}const data=await api('memories');records=data.items;updateTicker();if($('panel').open)renderPanel()}
function updateCapabilityControls(){
  const fileUnavailable=me?.auth==='sync'&&!me.fileStorageReady;
  const labels={image:fileUnavailable?'图片 / 截图 · 未开通':'图片 / 截图',audio:fileUnavailable?'声音 · 未开通':'声音'};
  document.querySelectorAll('[data-mode="image"],[data-mode="audio"]').forEach(button=>{button.disabled=fileUnavailable;button.textContent=labels[button.dataset.mode]});
  $('uploadAvailability').hidden=!fileUnavailable;
  if(fileUnavailable&&mode!=='text')switchMode('text');
  if(fileUnavailable){$('savehint').textContent='文字、链接和行动计划会云端同步。图片与录音暂未启用。';$('privacyLine').textContent='文字、链接和行动计划已云端同步 · 图片与录音暂未启用 · 关键词找回不调用 AI'}
  else if(demoMode)$('privacyLine').textContent='当前为免登录演示 · 操作刷新后重置 · 不调用真实 AI';
}
async function init(){
  if(forceTeacherDemo)activateTeacherDemo();
  else try{me=await api('me');$('connection').textContent=me.auth==='sync'?'私人同步 · 已连接':'私人空间 · 已登录';$('banner').textContent=me.auth==='sync'?'这是一份云端同步资料：在电脑保存后，手机刷新即可看到。':'输入一句话即可保存；拾忆会尝试理解任务和时间，你也可以手动修改。';await refresh()}catch(e){if(e.status===401&&hostedTeacherDemo){localStorage.removeItem(syncStorageKey);syncKey='';activateTeacherDemo();$('banner').textContent='私人同步链接已失效，已返回老师演示空间。'}else if(e.status===401)activateTeacherDemo();else{$('connection').textContent='空间暂时不可用';$('banner').textContent=e.message;updateTicker()}}
  updateCapabilityControls();tickerTimer=setInterval(updateTicker,5000);updateReminderInputs()
}

function inferIntent(text){if(/必须|一定要|务必|提醒我|取快递|交作业|截止|别忘|记得去/.test(text))return '必做';if(/备用|备份|以防|电子版|找不到/.test(text))return '备用';if(/学习|复习|背诵|日语|口诀|考试/.test(text))return '想学';if(/购买|下单|想买|商品|比价/.test(text))return '想买';if(/复刻|下次想|想去|计划去/.test(text))return '想做';if(/好笑|搞笑|哈哈/.test(text))return '只是好笑';if(/试试|体验|听听|看看/.test(text))return '想试试';return null}
function inferSource(text){const m=text.match(/小红书|抖音|B站|b站|哔哩哔哩|微博/);if(m)return '社交媒体 / '+(m[0]==='b站'||m[0]==='哔哩哔哩'?'B站':m[0]);if(/微信/.test(text))return '聊天 / 微信';if(/直播|弹幕/.test(text))return '直播';if(/游戏/.test(text))return '游戏';return ''}
function parseTime(text){
  if(!text.trim())return null;
  const now=new Date(),d=new Date(now);let found=false;
  d.setSeconds(0,0);
  const after=text.match(/(\d{1,3})天后/);
  if(after){d.setDate(d.getDate()+Number(after[1]));found=true}
  else if(/大后天/.test(text)){d.setDate(d.getDate()+3);found=true}
  else if(/后天/.test(text)){d.setDate(d.getDate()+2);found=true}
  else if(/明天/.test(text)){d.setDate(d.getDate()+1);found=true}
  else if(/今晚/.test(text)){found=true}
  const nextWeek=text.match(/下周([一二三四五六日天])?/);
  if(nextWeek){const target=nextWeek[1]?'一二三四五六日'.indexOf(nextWeek[1])+1:1;const weekday=target===7?0:target;let add=(7-d.getDay()+weekday)%7;if(add<7)add+=7;d.setDate(d.getDate()+add);found=true}
  const clock=text.match(/(\d{1,2})\s*[点时](?:(\d{1,2})分?|半)?/);
  let hour=9,minute=0;
  if(/中午/.test(text))hour=12;else if(/下午/.test(text))hour=15;else if(/晚上|今晚/.test(text))hour=20;else if(/凌晨/.test(text))hour=1;
  if(clock){hour=Number(clock[1]);minute=clock[2]?Number(clock[2]):text.includes('半')?30:0;if(/下午|晚上/.test(text)&&hour<12)hour+=12;if(/凌晨/.test(text)&&hour===12)hour=0;found=true}
  d.setHours(hour,minute,0,0);
  if(found&&d<=now&&!/明天|后天|大后天|天后|下周/.test(text))d.setDate(d.getDate()+1);
  return found?d:null;
}
function setIntent(value,manual=false){if(!intents.includes(value))return;selectedIntent=value;if(manual)intentTouched=true;document.querySelectorAll('[data-intent]').forEach(x=>x.classList.toggle('active',x.dataset.intent===value));if(value==='想学'&&$('revisit').value==='none'){$('revisit').value='curve';updateReminderInputs()}}
function updateUnderstanding(){
  const text=$('thought').value.trim(),inferred=inferIntent(text),source=inferSource(text),when=parseTime(text);
  if(inferred&&!intentTouched)setIntent(inferred);
  if(source&&!$('source').value)$('source').value=source;
  if(when&&$('revisit').value==='none'){$('revisit').value='once';$('manualWhen').value=localValue(when);updateReminderInputs()}
  const parts=[];if(inferred||intentTouched)parts.push($('intentDetail').value.trim()||selectedIntent);if(when)parts.push(formatWhen(when)+'提醒');if(source)parts.push(source);
  $('understood').innerHTML=parts.length?`<span>已理解</span><strong>${parts.map(esc).join(' · ')}</strong>`:'<span>拾忆会从你的话里识别任务和时间</span><strong>例如“明天早上提醒我取快递”</strong>';
}
function updateReminderInputs(){const type=$('revisit').value;$('manualWhenWrap').hidden=type==='none'||type==='weekly';$('intervalWrap').hidden=type!=='interval';$('weekdayWrap').hidden=type!=='weekly';$('weeklyTimeWrap').hidden=type!=='weekly';$('curveHint').hidden=type!=='curve';if(type!=='none'&&type!=='weekly'&&!$('manualWhen').value){const d=new Date();d.setDate(d.getDate()+1);d.setHours(9,0,0,0);$('manualWhen').value=localValue(d)}}
function nextWeekday(day,time){const now=new Date(),d=new Date(now),[h,m]=time.split(':').map(Number);let add=(Number(day)-d.getDay()+7)%7;d.setDate(d.getDate()+add);d.setHours(h,m,0,0);if(d<=now)d.setDate(d.getDate()+7);return d}
function buildReminder(type,whenValue,intervalDays,weekday,weeklyTime){
  if(type==='none')return null;
  if(type==='weekly'){const when=nextWeekday(weekday,weeklyTime);return{when:localValue(when),priority:selectedIntent==='必做'?'优先处理':'普通',frequency:`每${weekNames[Number(weekday)]} ${weeklyTime}`,mode:'weekly',weekday:Number(weekday),time:weeklyTime,status:'进行中'}}
  const base=whenValue?new Date(whenValue):parseTime($('thought').value)||new Date(Date.now()+86400000);if(!Number.isFinite(base.getTime())||base<=new Date())return null;
  if(type==='interval')return{when:localValue(base),priority:selectedIntent==='必做'?'优先处理':'普通',frequency:`每 ${Number(intervalDays)||3} 天`,mode:'interval',intervalDays:Number(intervalDays)||3,status:'进行中'};
  if(type==='curve'){const start=new Date(),days=[1,3,7,14,30],schedule=days.map(n=>{const d=new Date(start);d.setDate(d.getDate()+n);d.setHours(base.getHours()||9,base.getMinutes(),0,0);return localValue(d)});return{when:schedule[0],priority:'重要',frequency:'遗忘曲线 1·3·7·14·30 天',mode:'curve',schedule,currentStep:0,status:'进行中'}}
  return{when:localValue(base),priority:selectedIntent==='必做'?'优先处理':'普通',frequency:'仅一次',mode:'once',status:'进行中'};
}

function match(r,q){return !q||[r.title,r.text,r.extractedText,r.transcript,r.summary,topicOf(r),r.clue,r.source,r.place,r.photoPlan,r.scene,r.photoTips,intentOf(r),...(r.tags||[]),...(r.links||[])].join(' ').toLowerCase().includes(q.trim().toLowerCase())}
function row(r,{trash=false}={}){const meta=[types[r.kind],intentOf(r),r.source,r.place,topicOf(r)].filter(Boolean).join(' · ');return `<div class="itemrow">${trash?`<input class="trashCheck" type="checkbox" data-trash-select="${r.id}" aria-label="选择 ${esc(r.title)}">`:''}<span class="itemicon">${icons[r.kind]||'≡'}</span><button class="rowopen" data-open="${esc(r.id)}"><strong>${esc(r.title)}</strong><p>${esc(meta)}</p></button>${r.deletedAt?`<button class="smallbtn" data-restore="${r.id}">恢复</button>`:`<button class="smallbtn" data-delete="${r.id}" aria-label="移入回收站 ${esc(r.title)}">移入回收站</button>`}</div>`}
function get(id){return records.find(r=>r.id===id)||demo.find(r=>r.id===id)}
async function patch(id,body){
  if(demoMode){
    const current=records.find(r=>r.id===id);if(!current)throw new Error('没有找到这份演示资料');
    const next={...current,...body,updatedAt:new Date().toISOString()};
    if(Object.prototype.hasOwnProperty.call(body,'deleted')){next.deletedAt=body.deleted?new Date().toISOString():null;delete next.deleted}
    records=records.map(x=>x.id===id?next:x);updateTicker();if($('panel').open)renderPanel();return next;
  }
  const r=await api('memories/'+id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)});records=records.map(x=>x.id===id?r:x);updateTicker();if($('panel').open)renderPanel();return r
}

function openPanel(v){if($('detail').open)$('detail').close();view=v;filter='全部';panelQuery='';renderPanel();show('panel');setActiveNav(v);setRoute(v);$('paneltitle').focus()}
function renderPanel(){
  const names={library:'全部记忆',recall:'凭印象找回',tasks:'行动',resurface:'再看一眼',trash:'回收站'};
  $('paneltitle').textContent=names[view]||'记忆';const active=records.filter(r=>!r.deletedAt);
  if(view==='recall'){renderRecall(active);return}
  if(view==='tasks'){
    const tasks=active.filter(r=>r.reminder||actionable.has(r.intent));const todo=tasks.filter(r=>r.lifeStatus!=='已完成'&&r.reminder?.status!=='已完成'),done=tasks.filter(r=>r.lifeStatus==='已完成'||r.reminder?.status==='已完成');
    $('panelbody').innerHTML='<p class="panelIntro">到时间后，拾忆会问你是否完成。完成的进入记录，没完成的继续留在待做。</p><h3 class="sectionTitle">待做</h3>'+(todo.length?todo.map(taskCard).join(''):'<div class="empty compact"><strong>现在没有待做任务</strong></div>')+'<h3 class="sectionTitle">已完成</h3>'+(done.length?done.map(taskCard).join(''):'<p class="muted">完成过的事情会留在这里。</p>');return;
  }
  if(view==='resurface'){const chosen=chooseResurface(active),list=chosen.length?chosen:demo;$('panelbody').innerHTML='<div class="reviewHead"><span>本次只看 3 条</span><p>不制造新的信息压力，只把值得处理的内容轻轻送回来。</p></div>'+list.slice(0,3).map(resurfaceCard).join('');return}
  const list=records.filter(r=>view==='trash'?!!r.deletedAt:!r.deletedAt).filter(r=>match(r,panelQuery)&&(filter==='全部'||r.kind===filter));
  if(view==='trash'){
    $('panelbody').innerHTML='<p class="panelIntro">选择一条或多条旧记录，可以一起恢复到记忆库。</p><div class="trashTools"><label><input id="selectAllTrash" type="checkbox"> 全选</label><button id="restoreSelected" disabled>恢复所选</button></div><div id="rows">'+(list.length?list.map(r=>row(r,{trash:true})).join(''):'<div class="empty"><strong>回收站是空的</strong><p>移入这里的资料会保留，直到你决定恢复。</p></div>')+'</div>';
    if($('selectAllTrash'))$('selectAllTrash').onchange=e=>{document.querySelectorAll('[data-trash-select]').forEach(x=>x.checked=e.target.checked);updateTrashButton()};return;
  }
  $('panelbody').innerHTML=`<input class="panelsearch" id="panelSearch" aria-label="搜索资料库" placeholder="输入关键词、地点或备注" value="${esc(panelQuery)}"><div class="filters">${[['全部','全部'],['text','文字'],['image','图片'],['link','链接'],['audio','录音']].map(([v,n])=>`<button class="${filter===v?'active':''}" data-filter="${v}">${n}</button>`).join('')}</div><div id="rows">${list.length?list.map(row).join(''):'<div class="empty"><strong>这里还很安静</strong><p>从首页保存第一段记忆，或换个关键词。</p></div>'}</div>`;
  $('panelSearch').oninput=e=>{panelQuery=e.target.value;const found=records.filter(r=>!r.deletedAt&&match(r,panelQuery)&&(filter==='全部'||r.kind===filter));$('rows').innerHTML=found.map(row).join('')||'<p class="muted">没有匹配内容</p>'};
}
function updateTrashButton(){if($('restoreSelected'))$('restoreSelected').disabled=!document.querySelector('[data-trash-select]:checked')}

function renderRecall(active){
  const sources=[...new Set(active.map(r=>r.source).filter(Boolean))];
  $('panelbody').innerHTML=`<p class="panelIntro">不用记得完整内容。把还记得的词、来源和大概时间告诉拾忆。</p><div class="recallBox"><label>还记得哪个词？<input id="recallQuery" placeholder="例如：歌名、栏杆、自他动词"></label><div class="recallGrid"><label>来源<select id="recallSource"><option value="">全部来源</option>${sources.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><label>保存目的<select id="recallIntent"><option value="">全部目的</option>${intents.map(x=>`<option>${x}</option>`).join('')}</select></label><label>内容形式<select id="recallKind"><option value="">全部形式</option><option value="image">图片</option><option value="text">文字</option><option value="link">链接</option><option value="audio">录音</option></select></label><label>大概时间<select id="recallTime"><option value="">不限时间</option><option value="7">最近一周</option><option value="30">最近一个月</option><option value="365">今年</option></select></label></div></div><div id="recallResult"></div>`;
  const update=()=>{const q=$('recallQuery').value,source=$('recallSource').value,intent=$('recallIntent').value,kind=$('recallKind').value,days=Number($('recallTime').value||0),cutoff=days?Date.now()-days*86400000:0;const found=active.filter(r=>match(r,q)&&(!source||r.source===source)&&(!intent||intentOf(r)===intent)&&(!kind||r.kind===kind)&&(!cutoff||Date.parse(r.createdAt)>=cutoff));$('recallResult').innerHTML=found.length?`<p class="resultCount">找到 ${found.length} 条可能的记忆</p>`+found.map(row).join(''):'<div class="empty"><strong>换一条线索试试</strong><p>可以只选来源或大概时间，不必填写所有条件。</p></div>'};
  ['recallQuery','recallSource','recallIntent','recallKind','recallTime'].forEach(id=>$(id).addEventListener(id==='recallQuery'?'input':'change',update));update();
}

function chooseResurface(active){return [...active].filter(r=>r.lifeStatus!=='已完成').sort((a,b)=>{const ar=a.reminder&&a.reminder.status!=='已完成'?0:actionable.has(a.intent)?1:2,br=b.reminder&&b.reminder.status!=='已完成'?0:actionable.has(b.intent)?1:2;return ar-br||Date.parse(a.createdAt)-Date.parse(b.createdAt)}).slice(0,3)}
function taskCard(r){const rem=r.reminder,done=r.lifeStatus==='已完成'||rem?.status==='已完成',due=rem&&!done&&Date.parse(rem.when)<=Date.now();return `<article class="task"><div class="cardTop"><span class="intentBadge">${esc(intentOf(r))}</span><span class="stateBadge">${done?'已完成':due?'等待确认':rem?'已安排':'待做'}</span></div><h3>${esc(r.title)}</h3><p>${rem?`${esc(formatWhen(rem.when))} · ${esc(rem.frequency||'仅一次')} · ${esc(rem.priority)}`:'还没有安排时间'}</p><div class="taskActions"><button data-open="${r.id}">查看</button>${!done&&rem?`<button data-task="${r.id}" data-status="complete">${due?'完成了':'提前完成'}</button><button data-task="${r.id}" data-status="notdone">${due?'还没做':'延后一天'}</button>`:''}</div></article>`}
function resurfaceCard(r){const image=r.demoImage?`<img src="${r.demoImage}" alt="${esc(r.title)}" loading="lazy">`:'';return `<article class="resurfaceCard">${image}<div class="cardTop"><span class="intentBadge">${esc(intentOf(r))}</span><span>${esc(r.source||types[r.kind])}</span></div><h3>${esc(r.title)}</h3><p>${esc(r.summary||r.text||r.clue||'重新看一眼这段记忆。')}</p><div class="taskActions"><button data-open="${r.id}">打开</button>${r.demo?'<button data-demo-choice="later">下周再看</button>':`<button data-resurface="keep" data-id="${r.id}">继续保留</button>${actionable.has(r.intent)?`<button data-resurface="done" data-id="${r.id}">已经完成</button>`:''}`}</div></article>`}

function openDetail(id){
  const r=get(id);if(!r)return;if(r.deletedAt){notify('请先从回收站恢复这份资料');return}
  const related=(r.demo?demo:records).filter(x=>x.id!==r.id&&!x.deletedAt&&topicOf(r)!=='日常收藏'&&topicOf(x)===topicOf(r)).slice(0,4);
  const media=r.demoImage?mediaMarkup(r,r.demoImage):r.demoAudio?mediaMarkup(r,r.demoAudio):r.hasFile?`<div id="media-${esc(r.id)}" class="mediaStatus" role="status"><span class="mediaSpinner" aria-hidden="true"></span><p>正在安全读取${r.kind==='image'?'原始图片':'原始录音'}…</p></div>`:'';
  const recognition=r.scene||r.photoTips?`<div class="recognition"><p class="recognitionLabel">${r.demo||r.teacherDemo?'演示识别结果':'照片内容'}</p>${r.scene?`<strong>画面</strong><p>${esc(r.scene)}</p>`:''}${r.photoTips?`<strong>复刻建议</strong><p>${esc(r.photoTips)}</p>`:''}</div>`:'';
  $('detailbody').innerHTML=`${r.demo?'<p class="demoLabel">演示数据，不会混入你的真实资料</p>':''}${media}<div class="memoryMeta"><span class="intentBadge">${esc(intentOf(r))}</span>${r.source?`<span>${esc(r.source)}</span>`:''}${r.place?`<span>${esc(r.place)}</span>`:''}</div><label class="field">内容标题<input id="editTitle" maxlength="100" value="${esc(r.title)}" ${r.demo?'disabled':''}></label>${r.summary?`<div class="summary">${esc(r.summary)}</div>`:''}${recognition}<label class="field">原始内容 / 我的说明<textarea id="editText" maxlength="20000" ${r.demo?'disabled':''}>${esc(r.text)}</textarea></label>${(r.links||[]).map((link,i)=>`<div class="linkrow"><a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(link)} ↗</a><button class="smallbtn" data-copy="${i}" data-record="${r.id}">复制</button></div>`).join('')}<div class="detailGrid"><label class="field">记忆线索<input id="editClue" maxlength="120" value="${esc(r.clue||'')}" ${r.demo?'disabled':''}></label><label class="field">具体来源<input id="editSource" maxlength="100" value="${esc(r.source||'')}" ${r.demo?'disabled':''}></label><label class="field">地点<input id="editPlace" maxlength="100" value="${esc(r.place||'')}" ${r.demo?'disabled':''}></label><label class="field">主题<input id="editTopic" maxlength="60" value="${esc(topicOf(r))}" ${r.demo?'disabled':''}></label></div><label class="field">想怎么复刻 / 下一步<textarea id="editPhotoPlan" maxlength="500" ${r.demo?'disabled':''}>${esc(r.photoPlan||'')}</textarea></label><label class="field">保存目的<select id="editIntent" ${r.demo?'disabled':''}>${intents.map(m=>`<option ${intentOf(r)===m?'selected':''}>${m}</option>`).join('')}</select></label><label class="field">补充原因<input id="editIntentDetail" maxlength="120" value="${esc(r.intentDetail||'')}" ${r.demo?'disabled':''}></label>${r.reminder?`<div class="scheduled"><strong>回访计划</strong><p>${esc(formatWhen(r.reminder.when))} · ${esc(r.reminder.frequency||'仅一次')}</p></div>`:''}${related.length?'<div class="divider"></div><p class="muted">同一主题的记忆</p>'+related.map(x=>`<button class="related" data-open="${x.id}">${esc(x.title)} ↗</button>`).join(''):''}${!r.demo?`<div class="actions"><button data-delete="${r.id}" class="danger">移入回收站</button><button id="saveEdits" class="primary">保存修改</button></div>${r.kind==='image'||r.kind==='audio'?`<div class="divider"></div><p class="capabilityTitle">${r.kind==='image'?'可选：识别这张照片':'可选：转写这段录音'}</p><p class="muted">${r.kind==='image'?'识别画面内容与构图，但地点仍以你填写的信息为准。':'把录音转成可检索的文字。'}</p><label class="check"><input type="checkbox" id="aiConsent">只将这一份资料发送给识别服务。</label><button id="analyze" class="full" ${!me?.aiEnabled?'disabled':''}>${r.kind==='image'?'识别照片内容':'转写录音'}${!me?.aiEnabled?' · 演示版暂未接入':''}</button>`:''}<button id="newReminder" class="full">${r.reminder?'修改回访计划':'安排回访计划'}</button><p id="detailError" class="error" role="status"></p>`:'<p class="muted">真实保存时，你可以修改这些信息并安排回访。</p>'}`;
  if(!r.demo){
    $('saveEdits').onclick=async()=>{const b=$('saveEdits');b.disabled=true;b.textContent='保存中…';try{await patch(id,{title:$('editTitle').value,text:$('editText').value,topic:$('editTopic').value,intent:$('editIntent').value,intentDetail:$('editIntentDetail').value,clue:$('editClue').value,source:$('editSource').value,place:$('editPlace').value,photoPlan:$('editPhotoPlan').value});closeView('detail');notify('修改已保存，已返回上一页')}catch(e){$('detailError').textContent=e.message;b.disabled=false;b.textContent='保存修改'}};
    if($('analyze'))$('analyze').onclick=async()=>{if(!$('aiConsent').checked){$('detailError').textContent='请先确认只发送这一份资料。';return}const b=$('analyze');b.disabled=true;b.textContent='正在处理…';try{await api('memories/'+id+'/analyze',{method:'POST'});await refresh();openDetail(id);notify('识别完成，请核对结果')}catch(e){$('detailError').textContent=e.message;b.disabled=false;b.textContent='重试'}};
    $('newReminder').onclick=()=>reminder(r);
  }
  show('detail');$('detailTitle').focus();if(r.hasFile&&!r.demoImage&&!r.demoAudio)loadStoredMedia(r);
}

function reminder(r){
  const tomorrow=new Date(Date.now()+86400000);tomorrow.setHours(9,0,0,0);
  $('detailbody').innerHTML=`<h3>${esc(r.title)}</h3><form id="reminderform"><label class="field">提醒方式<select id="frequency"><option value="once">仅一次</option><option value="interval">每隔几天</option><option value="weekly">每周固定</option><option value="curve">学习遗忘曲线</option></select></label><label class="field" id="formWhenWrap">首次提醒时间<input required id="when" type="datetime-local" value="${r.reminder?.when||localValue(tomorrow)}"></label><label class="field" id="formIntervalWrap" hidden>每隔几天<input id="formInterval" type="number" min="1" max="365" value="3"></label><div id="formWeeklyWrap" hidden class="detailGrid"><label class="field">星期<select id="formWeekday">${weekNames.map((x,i)=>`<option value="${i}">${x}</option>`).join('')}</select></label><label class="field">时间<input id="formWeeklyTime" type="time" value="09:00"></label></div><label class="field">重要程度<select id="priority"><option>普通</option><option>重要</option><option>优先处理</option></select></label><p class="panelIntro">遗忘曲线会在第1、3、7、14、30天安排复习。网页打开时会显示提醒；系统级通知将在后续版本接入。</p><button class="primary full">保存计划</button><p id="reminderError" class="error"></p></form>`;
  const toggle=()=>{const t=$('frequency').value;$('formWhenWrap').hidden=t==='weekly';$('formIntervalWrap').hidden=t!=='interval';$('formWeeklyWrap').hidden=t!=='weekly'};$('frequency').onchange=toggle;toggle();
  $('reminderform').onsubmit=async e=>{e.preventDefault();const t=$('frequency').value,rem=buildReminder(t,$('when').value,$('formInterval').value,$('formWeekday').value,$('formWeeklyTime').value);if(!rem){$('reminderError').textContent='请选择未来时间';return}rem.priority=$('priority').value;try{await patch(r.id,{reminder:rem,lifeStatus:'保存中'});$('detail').close();openPanel('tasks');notify('回访计划已保存')}catch(err){$('reminderError').textContent=err.message}};
}
function deleteRecord(id){const r=get(id);if(!r||r.demo)return;show('confirm');$('confirmDelete').onclick=async()=>{$('confirmDelete').disabled=true;try{await patch(id,{deleted:true});$('confirm').close();$('detail').close();notify('已移到回收站，可随时恢复')}catch(e){notify(e.message)}finally{$('confirmDelete').disabled=false}}}

function switchMode(next){if(next!=='text'&&me?.auth==='sync'&&!me.fileStorageReady){notify('图片与录音云端空间尚未开通，本阶段请先保存文字或链接');return}if(recorder?.state==='recording'){notify('先停止录音，再切换输入方式');return}mode=next;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));$('attachmentArea').hidden=mode==='text';$('recordArea').hidden=mode!=='audio';$('photoFields').hidden=mode!=='image';$('file').accept=mode==='image'?'image/png,image/jpeg,image/webp':'audio/*';$('filelabel').textContent=mode==='image'?'选择图片，或拖到这里':'选择已有录音，也可以直接录制';$('thought').placeholder=mode==='text'?'直接说清楚内容和要求，例如：明天早上提醒我取快递…':mode==='image'?'说明这张图是什么、在哪里看到、为什么想留下…':'给这段声音补充一句说明…';$('savehint').textContent=demoMode?'演示操作只保留在当前页面，刷新后重置。':me?.auth==='sync'&&!me.fileStorageReady?'文字、链接和行动计划会云端同步。图片与录音暂未启用。':'只需点击一次，内容、目的和提醒会一起保存。';clearAttachment()}
function clearAttachment(){attachment=null;if(attachmentURL)URL.revokeObjectURL(attachmentURL);attachmentURL=null;$('attachmentPreview').innerHTML='';$('file').value=''}
function setAttachment(file){if(file.size>10*1024*1024){notify('文件需小于 10 MB');return}const image=['image/png','image/jpeg','image/webp'].includes(file.type),audio=/^(audio\/|video\/webm)/.test(file.type);if(!image&&!audio){notify('请选择 PNG、JPG、WebP 图片或音频');return}if(recorder?.state==='recording'){notify('请先停止录音');return}if(mode!==(image?'image':'audio'))switchMode(image?'image':'audio');clearAttachment();attachment=file;attachmentURL=URL.createObjectURL(file);$('attachmentPreview').innerHTML=(image?`<button type="button" class="previewZoom" data-zoom-preview aria-label="放大查看待保存图片"><img src="${attachmentURL}" alt="待保存图片"></button>`:`<audio controls src="${attachmentURL}"></audio>`)+`<button id="removeFile" class="smallbtn">移除附件</button>`;$('removeFile').onclick=clearAttachment}

function linksFrom(text){return[...new Set((text.match(/https?:\/\/[^\s<>"']+/g)||[]).map(link=>link.replace(/[，。！？、；：）)]+$/,'')))]}
function demoTopic(){if(selectedIntent==='想学')return '学习成长';if(selectedIntent==='想买')return '购物清单';if($('place').value.trim()||selectedIntent==='想做')return '旅行计划';if(selectedIntent==='只是好笑')return '快乐收藏';return '日常收藏'}
function resetComposer(){$('thought').value='';$('intentDetail').value='';$('clue').value='';$('place').value='';$('photoPlan').value='';$('source').value='';$('revisit').value='none';$('manualWhen').value='';intentTouched=false;setIntent('留作参考');updateReminderInputs();updateUnderstanding();clearAttachment()}

async function save(){
  if(saving)return;if(recorder?.state==='recording'){notify('请先停止录音并试听');return}const text=$('thought').value.trim();if(!text&&!attachment){notify('先写点内容，或添加图片、录音');return}if(!me){openAccount();return}
  const reminderData=buildReminder($('revisit').value,$('manualWhen').value,$('intervalDays').value,$('weekday').value,$('weeklyTime').value);if($('revisit').value!=='none'&&!reminderData){notify('提醒时间需要晚于现在');return}
  if(demoMode){
    const localUrl=attachmentURL,kind=attachment?(attachment.type.startsWith('image/')?'image':'audio'):linksFrom(text).length?'link':'text',place=$('place').value.trim(),firstLine=text.split('\n').find(Boolean)?.trim();
    const title=place&&kind==='image'?`${place} · 风景复刻`:firstLine?.slice(0,36)||({image:'新保存的图片',audio:'新保存的录音'}[kind]||'新记忆');
    const r={id:`teacher-${Date.now()}`,kind,title,text,summary:'',extractedText:'',transcript:'',topic:demoTopic(),intent:selectedIntent,intentDetail:$('intentDetail').value.trim(),clue:$('clue').value.trim(),source:$('source').value.trim(),place,photoPlan:$('photoPlan').value.trim(),tags:[],links:linksFrom(text),reminder:reminderData,lifeStatus:reminderData?'保存中':'',status:'演示资料',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),deletedAt:null,demo:false,teacherDemo:true};
    if(localUrl){if(kind==='image')r.demoImage=localUrl;else r.demoAudio=localUrl;demoObjectUrls.push(localUrl);attachmentURL=null}
    records.unshift(r);resetComposer();updateTicker();notify(r.reminder?'演示资料已收好，并安排了回访':'演示资料已收好；刷新页面后会重置');openDetail(r.id);return;
  }
  saving=true;$('save').disabled=true;$('save').textContent='保存中…';const form=new FormData();form.set('text',text);form.set('intent',selectedIntent);form.set('intentDetail',$('intentDetail').value.trim());form.set('clue',$('clue').value.trim());form.set('source',$('source').value.trim());form.set('place',$('place').value.trim());form.set('photoPlan',$('photoPlan').value.trim());form.set('revisit',$('revisit').value);if(reminderData)form.set('reminder',JSON.stringify(reminderData));if(attachment)form.set('file',attachment);
  try{const r=await api('memories',{method:'POST',body:form});resetComposer();records.unshift(r);updateTicker();notify(r.reminder?'已收好，并安排了回访':'已收好：内容、目的和线索都已保存');openDetail(r.id)}catch(e){notify(e.message)}finally{saving=false;$('save').disabled=false;$('save').textContent='收好'}
}

async function record(){if(recorder?.state==='recording'){recorder.stop();return}if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){notify('当前浏览器不支持录音，可以上传已有音频文件');return}try{stream=await navigator.mediaDevices.getUserMedia({audio:true});const mime=['audio/webm','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});const parts=[];let seconds=0;recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};recorder.onstop=()=>{clearTimeout(recordTimer);clearInterval(recordClock);stream.getTracks().forEach(t=>t.stop());const type=recorder.mimeType,file=new File(parts,'录音.'+(type.includes('mp4')?'m4a':'webm'),{type});recorder=null;$('record').textContent='● 重新录音';$('recordState').textContent='录音已停止，可试听后保存';setAttachment(file)};recorder.start();$('record').textContent='■ 停止录音';$('recordState').textContent='正在录音 0:00';recordClock=setInterval(()=>{seconds++;$('recordState').textContent=`正在录音 ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`},1000);recordTimer=setTimeout(()=>{if(recorder?.state==='recording')recorder.stop()},120000)}catch{stream?.getTracks().forEach(t=>t.stop());notify('未获得麦克风权限，可以上传已有录音')}}

function updateTicker(){const tasks=records.filter(r=>!r.deletedAt&&r.reminder&&r.reminder.status!=='已完成').sort((a,b)=>Date.parse(a.reminder.when)-Date.parse(b.reminder.when));if(!tasks.length){$('tickerText').textContent=demoMode?'演示空间 · 试着保存一条带时间的任务':'演示：明早 09:00 · 去驿站取快递';return}const r=tasks[tickerIndex%tasks.length];tickerIndex++;$('tickerText').textContent=`${Date.parse(r.reminder.when)<=Date.now()?'等待确认':formatWhen(r.reminder.when)} · ${r.title}`}
function advanceReminder(r){const rem={...r.reminder};if(rem.mode==='interval'){const d=new Date(rem.when);d.setDate(d.getDate()+(Number(rem.intervalDays)||1));rem.when=localValue(d);return{reminder:rem,lifeStatus:'保存中'}}if(rem.mode==='weekly'){const d=new Date(rem.when);d.setDate(d.getDate()+7);rem.when=localValue(d);return{reminder:rem,lifeStatus:'保存中'}}if(rem.mode==='curve'&&Array.isArray(rem.schedule)){const next=(Number(rem.currentStep)||0)+1;if(next<rem.schedule.length){rem.currentStep=next;rem.when=rem.schedule[next];return{reminder:rem,lifeStatus:'保存中'}}}rem.status='已完成';return{reminder:rem,lifeStatus:'已完成'}}
function openAccount(){
  let identity;
  if(me?.auth==='sync'){
    identity=`<div class="accountcard syncCard"><div class="accountStatus"><span aria-hidden="true"></span><b>个人云端同步已连接</b></div><p>你在电脑保存的文字、链接和行动计划，手机刷新后就能看到。</p><button id="copySyncLink" class="signin full">复制手机同步链接</button><p class="syncWarning">这个链接相当于你的私人钥匙。只发给自己的设备，不要交给老师或分享到群里。</p><button id="leaveSync" class="full">仅退出这台设备</button></div>`;
  }else if(demoMode){
    const personalHint=hostedTeacherDemo?'<p>私人同步空间通过一条只属于你的邀请链接进入；老师打开公开网址时仍只会看到演示资料。</p>':'<a class="signin" href="/signin-with-chatgpt?return_to=%2F" target="_top">登录正式私人空间</a>';
    identity=`<div class="accountcard"><b>免登录演示空间</b><p>示例资料和本次操作只保留在当前页面，刷新后自动重置，不会读取或混入任何人的私人资料。</p>${personalHint}</div>`;
  }else{
    identity=`<div class="accountcard"><b>${me?'已登录 · 私人空间':'登录 / 首次使用'}</b><p>${me?esc(me.email):'首次通过 ChatGPT 登录后，即可使用账号空间。'}</p>${me?'<a href="/signout-with-chatgpt?return_to=%2F" target="_top">退出登录</a>':'<a class="signin" href="/signin-with-chatgpt?return_to=%2F" target="_top">使用 ChatGPT 登录</a>'}<p>文字、图片与行动计划按账号隔离保存。</p></div>`;
  }
  const storageText=me?.auth==='sync'?(me.fileStorageReady?'文字、图片和录音都可以在设备间同步。':'文字、链接和行动计划已经云端同步；图片与录音空间稍后再开，不影响作业演示。'):'删除先进入回收站，也可以批量选择恢复。';
  $('accountbody').innerHTML=`${identity}<div class="accountcard"><b>输入理解与提醒</b><p>“明天、后天、三天后、下周”等常用时间由网页规则识别，不使用 AI。支持仅一次、每隔几天、每周固定和学习遗忘曲线。</p><p>当前提醒显示在网页内，暂不发送手机系统通知。</p></div><div class="accountcard"><b>单张照片识别 · ${me?.aiEnabled?'可以使用':'作业版暂未接入'}</b><p>后续可以接入低成本识图；目前地点和复刻计划由你填写，演示结果会清楚标为示例。</p></div><div class="accountcard"><b>存储状态与导出</b><p>${storageText}</p><button id="export" ${!me?'disabled':''}>${demoMode?'导出演示资料':'导出文字资料'}</button></div>`;
  if($('copySyncLink'))$('copySyncLink').onclick=async()=>{const url=`${location.origin}${location.pathname}#sync=${syncKey}`;await navigator.clipboard.writeText(url);notify('私人同步链接已复制，可以发到自己的手机打开')};
  if($('leaveSync'))$('leaveSync').onclick=()=>{localStorage.removeItem(syncStorageKey);syncKey='';location.assign(location.origin+location.pathname)};
  if($('export'))$('export').onclick=()=>{const blob=new Blob([JSON.stringify(records,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=demoMode?'拾忆-演示资料.json':'拾忆-文字资料.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);notify('文字资料已导出')};
  show('accountDialog');
}

document.addEventListener('change',e=>{if(e.target.matches('[data-trash-select]'))updateTrashButton()});
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  try{
    if(b.dataset.view)openPanel(b.dataset.view);if(b.dataset.close)closeView(b.dataset.close);if(b.dataset.zoom)zoomImage(b.dataset.zoom,b.dataset.zoomAlt);if('zoomPreview' in b.dataset&&attachmentURL)zoomImage(attachmentURL,'待保存图片');if(b.dataset.retryMedia){const mediaRecord=get(b.dataset.retryMedia);if(mediaRecord)await loadStoredMedia(mediaRecord,true)}if(b.dataset.open)openDetail(b.dataset.open);if(b.dataset.delete)deleteRecord(b.dataset.delete);if(b.dataset.restore){await patch(b.dataset.restore,{deleted:false});notify('已恢复资料')}
    if(b.dataset.mode)switchMode(b.dataset.mode);if(b.dataset.intent)setIntent(b.dataset.intent,true);if(b.dataset.filter){filter=b.dataset.filter;renderPanel()}
    if('copy' in b.dataset){await navigator.clipboard.writeText(get(b.dataset.record).links[Number(b.dataset.copy)]);notify('链接已复制')}
    if(b.dataset.task){const r=get(b.dataset.task);if(b.dataset.status==='complete'){await patch(r.id,advanceReminder(r));notify(r.reminder.mode&&r.reminder.mode!=='once'?'本次已完成，下一次回访已安排':'已放入已完成')}else{const d=new Date();d.setDate(d.getDate()+1);d.setHours(9,0,0,0);await patch(r.id,{reminder:{...r.reminder,when:localValue(d),status:'进行中'},lifeStatus:'保存中'});notify('继续留在待做，明早再问你')}}
    if(b.dataset.resurface==='done'){const r=get(b.dataset.id);await patch(r.id,{lifeStatus:'已完成',reminder:r.reminder?{...r.reminder,status:'已完成'}:null});notify('已放入已完成')}
    if(b.dataset.resurface==='keep')notify('继续为你保留');if(b.dataset.demoChoice)notify('演示：它会在下周再次出现');
    if(b.id==='restoreSelected'){const ids=[...document.querySelectorAll('[data-trash-select]:checked')].map(x=>x.dataset.trashSelect);for(const id of ids)await patch(id,{deleted:false});notify(`已恢复 ${ids.length} 条记录`)}
    if('focusCapture' in b.dataset){document.querySelectorAll('dialog[open]').forEach(d=>d.close());$('composer').scrollIntoView({behavior:'smooth',block:'center'});$('thought').focus()}
  }catch(err){notify(err.message)}
});

$('save').onclick=save;$('file').onchange=e=>{if(e.target.files[0])setAttachment(e.target.files[0])};$('filepick').ondragover=e=>e.preventDefault();$('filepick').ondrop=e=>{e.preventDefault();if(e.dataTransfer.files[0])setAttachment(e.dataTransfer.files[0])};$('thought').onpaste=e=>{if(e.clipboardData.files.length){e.preventDefault();setAttachment(e.clipboardData.files[0])}};$('thought').addEventListener('input',updateUnderstanding);$('intentDetail').addEventListener('input',updateUnderstanding);$('revisit').addEventListener('change',updateReminderInputs);$('record').onclick=record;$('account').onclick=openAccount;$('aboutPhoto').onclick=openAccount;$('openScenicDemo').onclick=()=>openDetail('demo-scenic');$('home').onclick=()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());setActiveNav(null);setRoute('');$('composer').scrollIntoView({behavior:'smooth',block:'start'});$('thought').focus()};document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPanel('recall');setTimeout(()=>$('recallQuery')?.focus(),0)}});window.addEventListener('pagehide',()=>{stream?.getTracks().forEach(t=>t.stop());clearTimeout(recordTimer);clearInterval(recordClock);clearInterval(tickerTimer);demoObjectUrls.forEach(url=>URL.revokeObjectURL(url));storedFileUrls.forEach(url=>URL.revokeObjectURL(url));storedFileUrls.clear()});init().then(()=>{const requested=location.hash.slice(1);if(['library','recall','tasks','resurface','trash'].includes(requested))openPanel(requested)});

if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'find_saved_memory',description:'Find saved memories using exact keywords and user-provided context. Does not call AI.',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false},annotations:{readOnlyHint:true},execute(input){if(typeof input?.query!=='string')throw new Error('query must be a string');openPanel('recall');setTimeout(()=>{if($('recallQuery')){$('recallQuery').value=input.query;$('recallQuery').dispatchEvent(new Event('input'))}},0);return{items:records.filter(r=>!r.deletedAt&&match(r,input.query)).map(r=>({id:r.id,title:r.title}))}}})).catch(()=>{})}catch{}}
