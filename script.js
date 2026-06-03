/* ══ STATE ══════════════════════════════════════════════════ */
let subjects = [];   // [{id,name,total,attended}]
let logs     = [];   // [{id,date:'YYYY-MM-DD',subjectId,type:'present'|'absent'}]
let target   = 75;
let dark     = true;
let calYear, calMonth;       // currently viewed month
let calSelected = null;      // 'YYYY-MM-DD' string

/* ══ INIT ════════════════════════════════════════════════════ */
function init(){
  load();
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();
  const el = document.getElementById('dateBadge');
  if(el) el.textContent = now.toLocaleDateString('en-IN',
    {weekday:'short',day:'numeric',month:'long',year:'numeric'});
  wireTarget('targetInput');
  wireTarget('targetMobile');
  refreshUI();
  renderCalendar();
  renderAnalytics();
}

/* ══ ROUTING / NAVIGATION ════════════════════════════════════ */
const PAGE_META = {
  dashboard: {title:'Attendance Dashboard',   sub:'Track your academic attendance intelligently'},
  subjects:  {title:'All Subjects',           sub:'Manage and view all your subjects'},
  calendar:  {title:'Attendance Calendar',    sub:'Log and review daily attendance'},
  analytics: {title:'Analytics',              sub:'Insights into your attendance patterns'},
};

function navigate(page, sidebarEl, fromMobile){
  // hide all pages
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');

  // desktop sidebar highlight
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  if(sidebarEl) sidebarEl.classList.add('active');
  else{
    // find sidebar item by text
    document.querySelectorAll('.nav-item').forEach(n=>{
      if(n.textContent.toLowerCase().includes(page.split('')[0])) {}
    });
    // match by onclick
    document.querySelectorAll('.nav-item').forEach(n=>{
      if(n.getAttribute('onclick')&&n.getAttribute('onclick').includes("'"+page+"'"))
        n.classList.add('active');
    });
  }

  // mobile bottom nav highlight
  document.querySelectorAll('.bnav-item').forEach(b=>b.classList.remove('active'));
  const bn=document.getElementById('bnav-'+page);
  if(bn) bn.classList.add('active');

  // update page header
  const m=PAGE_META[page];
  setText('pageTitle', m.title); setText('pageSub', m.sub);

  // page-specific refresh
  if(page==='subjects')   renderSubjectsPage();
  if(page==='calendar')   {renderCalendar(); refreshLogPanel();}
  if(page==='analytics')  renderAnalytics();
  if(page==='dashboard')  refreshUI();

  if(fromMobile) window.scrollTo({top:0,behavior:'smooth'});
}

/* ══ STORAGE ═════════════════════════════════════════════════ */
function save(){
  localStorage.setItem('aiq3_s', JSON.stringify(subjects));
  localStorage.setItem('aiq3_l', JSON.stringify(logs));
  localStorage.setItem('aiq3_t', JSON.stringify(target));
  localStorage.setItem('aiq3_d', JSON.stringify(dark));
}
function load(){
  try{
    subjects = JSON.parse(localStorage.getItem('aiq3_s'))||[];
    logs     = JSON.parse(localStorage.getItem('aiq3_l'))||[];
    target   = JSON.parse(localStorage.getItem('aiq3_t'))||75;
    const sd = localStorage.getItem('aiq3_d');
    dark = sd!==null ? JSON.parse(sd) : true;
  }catch(e){ subjects=[]; logs=[]; target=75; dark=true; }
  applyTheme();
}

/* ══ THEME ════════════════════════════════════════════════════ */
function applyTheme(){
  document.body.dataset.theme = dark?'dark':'light';
  const ic=dark?'🌙':'☀️', lb=dark?'Dark Mode':'Light Mode';
  setText('themeIcon',ic); setText('themeLabel',lb);
  setText('mobileThemeBtn',ic);
  setText('dIcon',ic); setText('dLabel',lb);
  cls('themeSwitch','on',dark); cls('dSwitch','on',dark);
}
function toggleTheme(){ dark=!dark; applyTheme(); save(); }

/* ══ TARGET INPUT WIRING ════════════════════════════════════ */
function wireTarget(id){
  const el=document.getElementById(id); if(!el) return;
  el.value=target;
  el.addEventListener('input',e=>{
    target=Math.min(100,Math.max(1,+e.target.value||75));
    ['targetInput','targetMobile'].forEach(oid=>{
      if(oid!==id){const o=document.getElementById(oid);if(o)o.value=target;}
    });
    save(); refreshUI(); renderSubjectsPage(); renderAnalytics();
  });
}

/* ══ MATHS ════════════════════════════════════════════════════ */
function pct(a,t){return t===0?0:a/t*100;}
function needed(a,t,tg){
  if(tg>=100) return a<t?Infinity:0;
  return Math.max(0,Math.ceil((tg*t-100*a)/(100-tg)));
}
function canSkip(a,t,tg){
  if(tg<=0) return Infinity;
  return Math.max(0,Math.floor(a*100/tg)-t);
}
function col(p,tg){return p>=tg?'green':p>=tg-10?'amber':'red';}
function grad(c){
  return c==='green'?'linear-gradient(90deg,var(--green),#86efac)':
         c==='amber'?'linear-gradient(90deg,var(--amber),#fcd34d)':
                     'linear-gradient(90deg,var(--red),#fca5a5)';
}

/* ══ ADD SUBJECT ═════════════════════════════════════════════ */
function addSubjectCore(name,total,att){
  if(!name)    {toast('⚠️ Enter a subject name'); return false;}
  if(att>total){toast('⚠️ Attended can\'t exceed total'); return false;}
  subjects.push({id:Date.now(),name,total,attended:att});
  save(); return true;
}
function addSubject(){
  const n=val('subjectName'), t=int('totalClasses'), a=int('attendedClasses');
  if(!addSubjectCore(n,t,a)) return;
  clear('subjectName'); clear('totalClasses'); clear('attendedClasses');
  refreshUI(); toast(`✅ "${n}" added!`);
}
function addSubject2(){
  const n=val('subjectName2'), t=int('totalClasses2'), a=int('attendedClasses2');
  if(!addSubjectCore(n,t,a)) return;
  clear('subjectName2'); clear('totalClasses2'); clear('attendedClasses2');
  renderSubjectsPage(); refreshUI(); toast(`✅ "${n}" added!`);
}

/* ══ MODIFY SUBJECTS ═════════════════════════════════════════ */
function markPresent(id){const s=get(id);if(!s)return;s.total++;s.attended++;save();refreshAll();}
function markAbsent(id) {const s=get(id);if(!s)return;s.total++;            save();refreshAll();}
function undoClass(id)  {
  const s=get(id);if(!s||s.total<=0)return;
  s.total--;if(s.attended>s.total)s.attended=s.total;
  save();refreshAll();
}
function deleteSubject(id){
  const s=get(id);
  subjects=subjects.filter(x=>x.id!==id);
  logs=logs.filter(x=>x.subjectId!==id);
  save();refreshAll();
  if(s)toast(`🗑️ "${s.name}" removed`);
}
function refreshAll(){ refreshUI(); renderSubjectsPage(); renderAnalytics(); }

/* ══ DASHBOARD REFRESH ═══════════════════════════════════════ */
function refreshUI(){
  const totT=subjects.reduce((a,s)=>a+s.total,0);
  const totA=subjects.reduce((a,s)=>a+s.attended,0);
  const ovP =pct(totA,totT);
  const c   =col(ovP,target);
  setText('sumTotal',totT); setText('sumAttended',totA);
  setText('sumAbsent',totT-totA); setText('sumSubjects',subjects.length);
  const pEl=document.getElementById('overallPct');
  pEl.textContent=totT===0?'—%':ovP.toFixed(1)+'%';
  pEl.style.color=c==='green'?'var(--green)':c==='amber'?'var(--amber)':'var(--red)';
  const bar=document.getElementById('overallBar');
  bar.style.width=Math.min(100,ovP)+'%';
  bar.style.background=grad(c);
  const rEl=document.getElementById('reqMsg');
  const piEl=document.getElementById('progInfo');
  if(totT===0){
    rEl.textContent='Add subjects below to get started.'; piEl.innerHTML='';
  } else if(ovP>=target){
    const sk=canSkip(totA,totT,target);
    rEl.textContent=sk>0?`You can skip ${sk} more class${sk>1?'es':''}!`:`Right at target — don't miss any!`;
    piEl.innerHTML=bdg('✅ On Track','var(--green-dim)','var(--green)')+bdg(`${target}% Target`,'var(--blue-dim)','var(--blue)');
  } else {
    const nd=needed(totA,totT,target);
    rEl.textContent=isFinite(nd)?`Attend ${nd} consecutive class${nd>1?'es':''} to reach ${target}%.`:'Cannot reach target.';
    piEl.innerHTML=bdg('⚠️ Below Target','var(--red-dim)','var(--red)')+bdg(`Need ${nd} more`,'var(--amber-dim)','var(--amber)');
  }
  setText('subjectCount',subjects.length?`${subjects.length} subject${subjects.length>1?'s':''}`: '');
  renderCards('subjectsGrid', true);
}

/* ══ RENDER SUBJECT CARDS ════════════════════════════════════ */
function renderCards(gridId, showActions){
  const grid=document.getElementById(gridId);
  if(!grid) return;
  if(!subjects.length){
    grid.innerHTML=`<div class="empty"><div class="empty-icon">📋</div>
      <div class="empty-text">No subjects yet.<br>Add one above to get started!</div></div>`;
    return;
  }
  grid.innerHTML=subjects.map(s=>{
    const p=pct(s.attended,s.total), c=col(p,target);
    const nd=needed(s.attended,s.total,target);
    const sk=canSkip(s.attended,s.total,target);
    const info=p>=target
      ?(sk>0?`Can skip <span>${sk}</span> class${sk>1?'es':''} safely.`:`Right at target. Don't miss any!`)
      :(isFinite(nd)?`Need <span>${nd}</span> more class${nd>1?'es':''} for ${target}%.`:`Cannot reach ${target}%.`);
    const actions=showActions?`<div class="card-actions">
      <button class="btn-action present" onclick="markPresent(${s.id})">✅ Present</button>
      <button class="btn-action absent"  onclick="markAbsent(${s.id})">❌ Absent</button>
      <button class="btn-action undo"    onclick="undoClass(${s.id})">↩ Undo</button>
      <button class="btn-action del"     onclick="deleteSubject(${s.id})">🗑 Delete</button>
    </div>`:'';
    return `<div class="subject-card">
      <div class="card-stripe ${c}"></div>
      <div class="card-top">
        <div class="card-name">${esc(s.name)}</div>
        <div class="card-pct ${c}">${s.total===0?'—':p.toFixed(1)+'%'}</div>
      </div>
      <div class="card-stats">
        <div class="mini-stat"><div class="mini-val">${s.attended}</div><div class="mini-key">Attended</div></div>
        <div class="mini-stat"><div class="mini-val">${s.total}</div><div class="mini-key">Total</div></div>
      </div>
      <div class="card-bar-track"><div class="card-bar-fill" style="width:${Math.min(100,p)}%;background:${grad(c)};"></div></div>
      <div class="card-info">${info}</div>
      ${actions}
    </div>`;
  }).join('');
}

/* ══ SUBJECTS PAGE ═══════════════════════════════════════════ */
function renderSubjectsPage(){
  setText('subjectCount2', subjects.length?`${subjects.length} subject${subjects.length>1?'s':''}`: '');
  const grid=document.getElementById('subjectsGrid2'); if(!grid) return;
  if(!subjects.length){
    grid.innerHTML=`<div class="empty"><div class="empty-icon">📚</div>
      <div class="empty-text">No subjects yet.</div></div>`;
    return;
  }
  // sorted by attendance %
  const sorted=[...subjects].sort((a,b)=>pct(b.attended,b.total)-pct(a.attended,a.total));
  grid.innerHTML=sorted.map((s,i)=>{
    const p=pct(s.attended,s.total), c=col(p,target);
    const nd=needed(s.attended,s.total,target);
    return `<div class="subj-list-card">
      <div class="subj-rank">#${i+1}</div>
      <div class="subj-info">
        <div class="subj-name">${esc(s.name)}</div>
        <div class="subj-meta">${s.attended}/${s.total} classes · ${isFinite(nd)&&nd>0?`need ${nd} more`:'✅ safe'}</div>
        <div class="subj-bar"><div class="subj-bar-fill" style="width:${Math.min(100,p)}%;background:${grad(c)};height:4px;border-radius:99px;"></div></div>
      </div>
      <div class="subj-pct-badge card-pct ${c}">${s.total===0?'—':p.toFixed(1)+'%'}</div>
    </div>`;
  }).join('');
}

/* ══ CALENDAR ════════════════════════════════════════════════ */
function dateKey(y,m,d){
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function renderCalendar(){
  const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const now=new Date(), todayKey=dateKey(now.getFullYear(),now.getMonth(),now.getDate());
  const months=['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  setText('calMonthLabel',`${months[calMonth]} ${calYear}`);
  // build log map for this subject filter (show all subjects)
  const logMap={};
  logs.forEach(l=>{ if(!logMap[l.date]) logMap[l.date]={}; logMap[l.date][l.subjectId]=l.type; });
  // day presence summary per date: if any present → present; if any absent → absent
  const dayStatus={};
  logs.forEach(l=>{
    if(!dayStatus[l.date]) dayStatus[l.date]={p:0,a:0};
    if(l.type==='present') dayStatus[l.date].p++;
    else dayStatus[l.date].a++;
  });
  const firstDay=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const daysInPrev=new Date(calYear,calMonth,0).getDate();
  let html=DAYS.map(d=>`<div class="cal-day-label">${d}</div>`).join('');
  // prev month filler
  for(let i=0;i<firstDay;i++){
    const d=daysInPrev-firstDay+1+i;
    html+=`<div class="cal-day other-month">${d}</div>`;
  }
  // this month
  for(let d=1;d<=daysInMonth;d++){
    const k=dateKey(calYear,calMonth,d);
    const st=dayStatus[k];
    let cls2='cal-day';
    if(k===todayKey) cls2+=' today';
    else if(st){ cls2+=st.p>0?' present':' absent'; }
    if(k===calSelected) cls2+=' selected';
    html+=`<div class="${cls2}" onclick="calSelectDay('${k}')">${d}</div>`;
  }
  document.getElementById('calGrid').innerHTML=html;
  // populate subject selector
  const sel=document.getElementById('logSubjectSel');
  const cur=sel.value;
  sel.innerHTML='<option value="">— Select Subject —</option>'+
    subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
  if(cur) sel.value=cur;
  refreshLogPanel();
}
function calMove(dir){ calMonth+=dir; if(calMonth>11){calMonth=0;calYear++;}else if(calMonth<0){calMonth=11;calYear--;} renderCalendar(); }
function calSelectDay(k){
  calSelected=k;
  const parts=k.split('-');
  const d=new Date(+parts[0],+parts[1]-1,+parts[2]);
  setText('logSelectedDate',d.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}));
  renderCalendar();
}

function logAttendance(type){
  if(!calSelected){toast('⚠️ Select a date first'); return;}
  const sid=document.getElementById('logSubjectSel').value;
  if(!sid){toast('⚠️ Select a subject'); return;}
  if(type==='clear'){
    logs=logs.filter(l=>!(l.date===calSelected&&l.subjectId===+sid));
    save(); renderCalendar(); refreshLogPanel(); toast('↩ Cleared');
    return;
  }
  // remove existing for same date+subject
  logs=logs.filter(l=>!(l.date===calSelected&&l.subjectId===+sid));
  logs.push({id:Date.now(),date:calSelected,subjectId:+sid,type});
  // also update total/attended counts
  // recalc from logs for this subject
  recalcFromLogs(+sid);
  save(); renderCalendar(); refreshLogPanel(); refreshAll();
  toast(type==='present'?'✅ Marked Present':'❌ Marked Absent');
}
function recalcFromLogs(sid){
  const s=get(sid); if(!s) return;
  const myLogs=logs.filter(l=>l.subjectId===sid);
  s.total    = myLogs.length;
  s.attended = myLogs.filter(l=>l.type==='present').length;
}
function refreshLogPanel(){
  const el=document.getElementById('logEntries'); if(!el) return;
  const recent=[...logs].reverse().slice(0,20);
  if(!recent.length){
    el.innerHTML='<div class="no-logs">No logs yet. Select a date and subject above.</div>';
    return;
  }
  el.innerHTML=recent.map(l=>{
    const s=subjects.find(x=>x.id===l.subjectId);
    const name=s?esc(s.name):'Deleted Subject';
    return `<div class="log-entry">
      <div class="log-dot ${l.type==='present'?'p':'a'}"></div>
      <div class="log-entry-text"><span class="log-entry-name">${name}</span> — ${l.date}</div>
      <button class="log-entry-del" onclick="removeLog(${l.id})">✕</button>
    </div>`;
  }).join('');
}
function removeLog(id){
  const l=logs.find(x=>x.id===id); if(!l) return;
  logs=logs.filter(x=>x.id!==id);
  if(l.subjectId) recalcFromLogs(l.subjectId);
  save(); renderCalendar(); refreshLogPanel(); refreshAll();
}

/* ══ ANALYTICS ═══════════════════════════════════════════════ */
function renderAnalytics(){
  const totT=subjects.reduce((a,s)=>a+s.total,0);
  const totA=subjects.reduce((a,s)=>a+s.attended,0);

  // ── bar chart
  const bc=document.getElementById('barChart'); if(!bc) return;
  if(!subjects.length){
    bc.innerHTML='<div style="color:var(--muted);font-size:13px;margin:auto;">No subjects yet.</div>';
  } else {
    const maxP=100;
    bc.innerHTML=subjects.map(s=>{
      const p=pct(s.attended,s.total), c=col(p,target);
      const h=Math.max(4,Math.round(p/maxP*110));
      const color=c==='green'?'var(--green)':c==='amber'?'var(--amber)':'var(--red)';
      return `<div class="bar-wrap">
        <div class="bar-val">${s.total===0?'—':p.toFixed(0)+'%'}</div>
        <div class="bar" style="height:${h}px;background:${color};"></div>
        <div class="bar-label">${esc(s.name)}</div>
      </div>`;
    }).join('');
  }

  // ── best & worst
  const sorted=[...subjects].sort((a,b)=>pct(b.attended,b.total)-pct(a.attended,a.total));
  const medals=['🥇','🥈','🥉','4️⃣','5️⃣'];
  const mkRank=(list)=>list.map((s,i)=>{
    const p=pct(s.attended,s.total),c=col(p,target);
    const color=c==='green'?'var(--green)':c==='amber'?'var(--amber)':'var(--red)';
    return `<div class="rank-item">
      <div class="rank-medal">${medals[i]||'•'}</div>
      <div class="rank-info">
        <div class="rank-name">${esc(s.name)}</div>
        <div class="rank-pct">${s.attended}/${s.total} classes</div>
        <div class="rank-bar"><div class="rank-bar-fill" style="width:${Math.min(100,p)}%;background:${color};"></div></div>
      </div>
      <div class="card-pct ${c}" style="font-size:13px;padding:2px 8px;">${s.total===0?'—':p.toFixed(1)+'%'}</div>
    </div>`;
  }).join('');
  const bestEl=document.getElementById('bestList');
  const worstEl=document.getElementById('worstList');
  if(bestEl) bestEl.innerHTML=sorted.length?mkRank(sorted.slice(0,3)):'<div style="color:var(--muted);font-size:13px;padding:12px 0;">No subjects yet.</div>';
  if(worstEl) worstEl.innerHTML=sorted.length?mkRank([...sorted].reverse().slice(0,3)):'<div style="color:var(--muted);font-size:13px;padding:12px 0;">No subjects yet.</div>';

  // ── donut
  const arc=document.getElementById('donutArc');
  if(arc && totT>0){
    const circ=2*Math.PI*28; // 175.9
    const fill=circ*(totA/totT);
    arc.setAttribute('stroke-dasharray',`${fill} ${circ-fill}`);
    arc.setAttribute('stroke',totA/totT*100>=target?'var(--green)':totA/totT*100>=target-10?'var(--amber)':'var(--red)');
  }
  setText('donutAtt',`${totA} Attended`);
  setText('donutAbs',`${totT-totA} Absent`);

  // ── quick stats
  const sb=document.getElementById('streakBox'); if(!sb) return;
  const safe=subjects.filter(s=>pct(s.attended,s.total)>=target).length;
  const danger=subjects.filter(s=>pct(s.attended,s.total)<target).length;
  const avgPct=subjects.length?subjects.reduce((a,s)=>a+pct(s.attended,s.total),0)/subjects.length:0;
  sb.innerHTML=`
    <div class="streak-row">
      <div><div class="streak-name">✅ Safe Subjects</div><div class="streak-label">Above ${target}%</div></div>
      <div class="streak-num" style="color:var(--green)">${safe}</div>
    </div>
    <div class="streak-row">
      <div><div class="streak-name">⚠️ At Risk</div><div class="streak-label">Below ${target}%</div></div>
      <div class="streak-num" style="color:var(--red)">${danger}</div>
    </div>
    <div class="streak-row">
      <div><div class="streak-name">📊 Avg Attendance</div><div class="streak-label">Across all subjects</div></div>
      <div class="streak-num" style="color:var(--accent)">${subjects.length?avgPct.toFixed(1)+'%':'—'}</div>
    </div>
    <div class="streak-row">
      <div><div class="streak-name">📅 Total Days Logged</div><div class="streak-label">Via calendar</div></div>
      <div class="streak-num">${logs.length}</div>
    </div>`;
}

/* ══ DRAWER (mobile settings) ════════════════════════════════ */
function openSettings(){
  document.getElementById('drawerOverlay').classList.add('open');
  document.getElementById('settingsDrawer').classList.add('open');
}
function closeSettings(){
  document.getElementById('drawerOverlay').classList.remove('open');
  document.getElementById('settingsDrawer').classList.remove('open');
}

/* ══ TOAST ════════════════════════════════════════════════════ */
function toast(msg,ms=2600){
  const w=document.getElementById('toastWrap');
  const el=document.createElement('div'); el.className='toast'; el.textContent=msg;
  w.appendChild(el);
  setTimeout(()=>{ el.style.animation='toastOut .3s ease forwards'; setTimeout(()=>el.remove(),300); },ms);
}

/* ══ UTILS ════════════════════════════════════════════════════ */
function get(id){return subjects.find(x=>x.id===id);}
function setText(id,v){const e=document.getElementById(id);if(e)e.textContent=v;}
function cls(id,c,on){const e=document.getElementById(id);if(!e)return;on?e.classList.add(c):e.classList.remove(c);}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function bdg(t,bg,color){return `<span class="prog-badge" style="background:${bg};color:${color}">${t}</span>`;}
function val(id){return (document.getElementById(id)||{}).value?.trim()||'';}
function int(id){return parseInt((document.getElementById(id)||{}).value)||0;}
function clear(id){const e=document.getElementById(id);if(e)e.value='';}

/* keyboard shortcut */
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    if(document.activeElement.id==='subjectName')  addSubject();
    if(document.activeElement.id==='subjectName2') addSubject2();
  }
});

init();
