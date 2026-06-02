/* ── STATE ─────────────────────────────────── */
let subjects = [];  // [{id,name,total,attended}]
let target   = 75;  // attendance target %
let darkMode = true;

/* ── INIT ─────────────────────────────────── */
function init(){
  loadData();
  document.getElementById('dateBadge').textContent =
    new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'long',year:'numeric'});
  document.getElementById('targetInput').value = target;
  document.getElementById('targetInput').addEventListener('input', e=>{
    target = Math.min(100,Math.max(1,+e.target.value||75));
    saveData(); refreshUI();
  });
  refreshUI();
}

/* ── STORAGE ──────────────────────────────── */
function saveData(){
  localStorage.setItem('attendiq_subjects', JSON.stringify(subjects));
  localStorage.setItem('attendiq_target',   JSON.stringify(target));
  localStorage.setItem('attendiq_theme',    JSON.stringify(darkMode));
}
function loadData(){
  try{
    subjects = JSON.parse(localStorage.getItem('attendiq_subjects')) || [];
    target   = JSON.parse(localStorage.getItem('attendiq_target'))   || 75;
    darkMode = localStorage.getItem('attendiq_theme') !== null
               ? JSON.parse(localStorage.getItem('attendiq_theme')) : true;
  }catch(e){ subjects=[]; target=75; darkMode=true; }
  applyTheme();
}

/* ── THEME ────────────────────────────────── */
function applyTheme(){
  document.body.dataset.theme = darkMode ? 'dark' : 'light';
  document.getElementById('themeIcon').textContent  = darkMode ? '🌙' : '☀️';
  document.getElementById('themeLabel').textContent = darkMode ? 'Dark Mode' : 'Light Mode';
  const sw = document.getElementById('themeSwitch');
  darkMode ? sw.classList.add('on') : sw.classList.remove('on');
}
function toggleTheme(){
  darkMode = !darkMode;
  applyTheme(); saveData();
}

/* ── SMART MATHS ─────────────────────────── */
function pct(att,tot){ return tot===0 ? 0 : (att/tot*100); }

// How many more classes needed to reach target?
// (att+x)/(tot+x) >= target/100  =>  x >= (target*tot - 100*att)/(100-target)
function classesNeeded(att,tot,tgt){
  if(tgt>=100) return att<tot ? Infinity : 0;
  const needed = (tgt*tot - 100*att)/(100-tgt);
  return Math.max(0, Math.ceil(needed));
}

// How many classes can be skipped and still stay at target?
// (att)/(tot+x) >= target/100  =>  x <= (100*att/target) - tot
function canSkip(att,tot,tgt){
  if(tgt<=0) return Infinity;
  const maxTot = Math.floor(att*100/tgt);
  return Math.max(0, maxTot-tot);
}

function colorClass(p,tgt){
  if(p>=tgt)       return 'green';
  if(p>=tgt-10)    return 'amber';
  return 'red';
}

/* ── ADD SUBJECT ─────────────────────────── */
function addSubject(){
  const name  = document.getElementById('subjectName').value.trim();
  const total = parseInt(document.getElementById('totalClasses').value)||0;
  const att   = parseInt(document.getElementById('attendedClasses').value)||0;

  if(!name){ toast('⚠️ Please enter a subject name.'); return; }
  if(att>total){ toast('⚠️ Attended cannot exceed total classes.'); return; }

  subjects.push({ id:Date.now(), name, total, attended:att });
  document.getElementById('subjectName').value='';
  document.getElementById('totalClasses').value='';
  document.getElementById('attendedClasses').value='';
  saveData(); refreshUI();
  toast(`✅ "${name}" added successfully!`);
}

/* ── MODIFY SUBJECT ─────────────────────── */
function markPresent(id){
  const s=subjects.find(x=>x.id===id); if(!s) return;
  s.total++; s.attended++;
  saveData(); refreshUI();
}
function markAbsent(id){
  const s=subjects.find(x=>x.id===id); if(!s) return;
  s.total++;
  saveData(); refreshUI();
}
function undoClass(id){
  const s=subjects.find(x=>x.id===id); if(!s) return;
  if(s.total<=0) return;
  s.total--;
  if(s.attended>s.total) s.attended=s.total;
  saveData(); refreshUI();
}
function deleteSubject(id){
  const s=subjects.find(x=>x.id===id);
  subjects=subjects.filter(x=>x.id!==id);
  saveData(); refreshUI();
  if(s) toast(`🗑️ "${s.name}" deleted.`);
}

/* ── REFRESH UI ──────────────────────────── */
function refreshUI(){
  // Summary stats
  const totTotal = subjects.reduce((a,s)=>a+s.total,0);
  const totAtt   = subjects.reduce((a,s)=>a+s.attended,0);
  const totAbs   = totTotal-totAtt;
  const ovPct    = pct(totAtt,totTotal);
  const col      = colorClass(ovPct,target);

  document.getElementById('sumTotal').textContent    = totTotal;
  document.getElementById('sumAttended').textContent = totAtt;
  document.getElementById('sumAbsent').textContent   = totAbs;
  document.getElementById('sumSubjects').textContent = subjects.length;
  document.getElementById('overallPct').textContent  = totTotal===0 ? '—%' : ovPct.toFixed(1)+'%';
  document.getElementById('overallPct').style.color  =
    col==='green'?'var(--green)':col==='amber'?'var(--amber)':'var(--red)';

  // Overall bar
  const bar=document.getElementById('overallBar');
  bar.style.width=(Math.min(100,ovPct))+'%';
  bar.style.background=col==='green'?'linear-gradient(90deg,var(--green),#86efac)':
                        col==='amber'?'linear-gradient(90deg,var(--amber),#fcd34d)':
                                      'linear-gradient(90deg,var(--red),#fca5a5)';

  // Req / can-skip message
  const reqEl=document.getElementById('reqMsg');
  const piEl =document.getElementById('progInfo');
  if(totTotal===0){
    reqEl.textContent='No data yet. Add subjects to begin.';
    piEl.innerHTML='';
  } else if(ovPct>=target){
    const skip=canSkip(totAtt,totTotal,target);
    reqEl.textContent = skip>0
      ? `You can afford to skip ${skip} more class${skip>1?'es':''}!`
      : `You're right at the target — don't miss any more!`;
    piEl.innerHTML=`<span class="prog-badge" style="background:var(--green-dim);color:var(--green)">✅ On Track</span>
                    <span class="prog-badge" style="background:var(--blue-dim);color:var(--blue)">${target}% Target</span>`;
  } else {
    const need=classesNeeded(totAtt,totTotal,target);
    reqEl.textContent=isFinite(need)
      ? `Attend ${need} consecutive class${need>1?'es':''} to reach ${target}% target.`
      : 'Attendance cannot reach target — consult your institution.';
    piEl.innerHTML=`<span class="prog-badge" style="background:var(--red-dim);color:var(--red)">⚠️ Below Target</span>
                    <span class="prog-badge" style="background:var(--amber-dim);color:var(--amber)">Need ${need} more</span>`;
  }

  // Subject count
  document.getElementById('subjectCount').textContent=
    subjects.length ? `${subjects.length} subject${subjects.length>1?'s':''}` : '';

  // Cards
  const grid=document.getElementById('subjectsGrid');
  if(subjects.length===0){
    grid.innerHTML=`<div class="empty">
      <div class="empty-icon">📋</div>
      <div class="empty-text">No subjects yet. Add one above to get started.</div>
    </div>`;
    return;
  }
  grid.innerHTML=subjects.map(s=>{
    const p     = pct(s.attended,s.total);
    const col   = colorClass(p,target);
    const need  = classesNeeded(s.attended,s.total,target);
    const skip  = canSkip(s.attended,s.total,target);
    const info  = p>=target
      ? (skip>0 ? `Can skip <span>${skip}</span> class${skip>1?'es':''} & stay safe.` : `Right at target. Don't miss any!`)
      : (isFinite(need) ? `Need <span>${need}</span> consecutive class${need>1?'es':''} to reach ${target}%.` : `Cannot reach ${target}% target.`);
    return `
    <div class="subject-card" id="card-${s.id}">
      <div class="card-stripe ${col}"></div>
      <div class="card-top">
        <div class="card-name">${escHtml(s.name)}</div>
        <div class="card-pct ${col}">${s.total===0?'—':p.toFixed(1)+'%'}</div>
      </div>
      <div class="card-stats">
        <div class="mini-stat">
          <div class="mini-val">${s.attended}</div>
          <div class="mini-key">Attended</div>
        </div>
        <div class="mini-stat">
          <div class="mini-val">${s.total}</div>
          <div class="mini-key">Total</div>
        </div>
      </div>
      <div class="card-bar-track">
        <div class="card-bar-fill" style="width:${Math.min(100,p)}%;
          background:${col==='green'?'linear-gradient(90deg,var(--green),#86efac)':
                       col==='amber'?'linear-gradient(90deg,var(--amber),#fcd34d)':
                                     'linear-gradient(90deg,var(--red),#fca5a5)'}">
        </div>
      </div>
      <div class="card-info">${info}</div>
      <div class="card-actions">
        <button class="btn-circle plus" onclick="markPresent(${s.id})" title="Present (Total+1, Attended+1)">✅ Present</button>
        <button class="btn-circle minus" onclick="markAbsent(${s.id})"  title="Absent (Total+1 only)">❌ Absent</button>
        <button class="btn-circle skip"  onclick="undoClass(${s.id})"   title="Undo last class">↩</button>
        <button class="btn-circle del"   onclick="deleteSubject(${s.id})" title="Delete subject">🗑</button>
      </div>
    </div>`;
  }).join('');
}

/* ── TOAST ───────────────────────────────── */
function toast(msg,duration=3000){
  const wrap=document.getElementById('toastWrap');
  const el=document.createElement('div');
  el.className='toast'; el.textContent=msg;
  wrap.appendChild(el);
  setTimeout(()=>{
    el.style.animation='toastOut .3s ease forwards';
    setTimeout(()=>el.remove(),300);
  },duration);
}

/* ── UTILS ───────────────────────────────── */
function escHtml(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ── KEYBOARD SHORTCUT ───────────────────── */
document.addEventListener('keydown',e=>{
  if(e.key==='Enter' && document.activeElement.id==='subjectName') addSubject();
});

/* ── KICK OFF ────────────────────────────── */
init();
