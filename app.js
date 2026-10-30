/* ===== HASH ROUTING ===== */
const hash = window.location.hash.slice(1) || 'test1';
const validTabs = ['test1','test2','slowmo'];

function showTab(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#tabNav a').forEach(a => a.classList.remove('active'));
  const t = document.getElementById('page-' + name); if (t) t.classList.add('active');
  const l = document.querySelector('#tabNav a[data-tab="'+name+'"]'); if (l) l.classList.add('active');
  history.replaceState(null,'','#'+name);
  const titles = {test1:'MyPWA – Test 1',test2:'MyPWA – Test 2',slowmo:'Slow-Mo GO!'};
  document.title = titles[name]||'MyPWA';
  if (window.updateManifestTitle) window.updateManifestTitle('DynApp '+name);
}
window.addEventListener('hashchange',()=>{const n=location.hash.slice(1)||'test1';if(validTabs.includes(n))showTab(n);});
document.querySelectorAll('#tabNav a').forEach(a=>{a.addEventListener('click',e=>{e.preventDefault();const n=a.getAttribute('data-tab');if(validTabs.includes(n)){location.hash=n;showTab(n);}});});
showTab(hash);
document.getElementById('display1').textContent='Hash: '+location.hash;
document.getElementById('display2').textContent='Hash: '+location.hash;

/* ===== DYNAMIC MANIFEST + ICONS ===== */
window.addEventListener('beforeinstallprompt',e=>console.log('Install prompt available!'));
const iconSize=192; let currentManifestTitle='DynApp '+hash;

window.updateManifestTitle=function(t){
  currentManifestTitle=t;
  setManifest({name:t,display:'standalone',theme_color:'#B3BBBF',background_color:'#263238',start_url:location.href,icons:window._manifest?.icons||[]});
};
function setManifest(m){
  const ex=document.querySelector('link[rel="manifest"]'); if(ex)ex.remove();
  const l=document.createElement('link'); l.rel='manifest';
  l.href='data:application/json;base64,'+btoa(JSON.stringify(m));
  document.head.appendChild(l);
}
function setIcon(q,u,s){const el=document.querySelector(q);if(el){el.href=u;el.type='image/png';if(s)el.setAttribute('sizes',`${s}x${s}`);}}
function svgToPng(url,size){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=c.height=size;c.getContext('2d').drawImage(img,0,0,size,size);res(c.toDataURL('image/png'));};img.onerror=rej;img.src=url;});}
function createStartupImage(url,bg){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>{const d=window.devicePixelRatio||1,c=document.createElement('canvas');c.width=screen.width*d;c.height=screen.height*d;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,c.width,c.height);const s=c.width*.25;x.drawImage(img,(c.width-s)/2,(c.height-s)/2,s,s);res(c.toDataURL('image/png'));};img.onerror=rej;img.src=url;});}

(async function(){
  const svgLink=document.querySelector('link[rel="icon"]');
  const png=await svgToPng(svgLink.href,iconSize);
  setIcon("link[rel='icon']",png,iconSize);
  setIcon("link[rel='apple-touch-icon']",png);
  const startup=await createStartupImage(svgLink.href,'#263238');
  const sl=document.createElement('link');sl.rel='apple-touch-startup-image';sl.href=startup;document.head.appendChild(sl);
  const manifest={name:currentManifestTitle,display:'standalone',theme_color:'#B3BBBF',background_color:'#263238',start_url:location.href,icons:[{src:png,sizes:`${iconSize}x${iconSize}`,type:'image/png'}]};
  setManifest(manifest); window._manifest=manifest;
})();

/* ===== SERVICE WORKER REGISTRATION ===== */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(reg => console.log('SW registered:', reg.scope))
    .catch(err => console.warn('SW registration failed:', err));
}

/* ===== SLOW-MO GO! LOGIC ===== */
let audioContext;
function playBeep(){
  if(!audioContext)return;
  const o=audioContext.createOscillator(),g=audioContext.createGain();
  o.connect(g);g.connect(audioContext.destination);
  o.type='sine';o.frequency.setValueAtTime(800,audioContext.currentTime);
  g.gain.setValueAtTime(1,audioContext.currentTime);
  o.start();g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.1);
  o.stop(audioContext.currentTime+.1);
}

const v=document.getElementById('v'),msg=document.getElementById('msg'),recordBtn=document.getElementById('recordBtn'),
playbackControls=document.getElementById('playbackControls'),back3Btn=document.getElementById('back3Btn'),
playPauseBtn=document.getElementById('playPauseBtn'),forward1Btn=document.getElementById('forward1Btn'),
review=document.getElementById('review'),reviewInfo=document.getElementById('reviewInfo'),
saveBtn=document.getElementById('saveBtn'),shareBtn=document.getElementById('shareBtn'),
replayBtn=document.getElementById('replayBtn'),continueBtn=document.getElementById('continueBtn'),
shareHint=document.getElementById('shareHint');

let stream,rec,blobs=[],lastBlob=null,lastUrl=null,lastFilename=null,allowListening=true,recordedFrameDuration=1/240;

v.addEventListener('play',()=>{if(playPauseBtn)playPauseBtn.innerText='⏸';});
v.addEventListener('pause',()=>{if(playPauseBtn)playPauseBtn.innerText='▶';});
if(playPauseBtn)playPauseBtn.onclick=()=>v.paused?v.play():v.pause();

let scrubInterval=null;
function startScrubbing(f){
  if(scrubInterval)clearInterval(scrubInterval);
  scrubInterval=setInterval(()=>{v.currentTime=Math.max(0,Math.min(v.duration-.001,v.currentTime+f*recordedFrameDuration));},75);
}
if(back3Btn){back3Btn.onpointerdown=()=>startScrubbing(-3);back3Btn.onpointerup=back3Btn.onpointercancel=()=>{if(scrubInterval)clearInterval(scrubInterval);scrubInterval=null;};}
if(forward1Btn){forward1Btn.onpointerdown=()=>startScrubbing(1);forward1Btn.onpointerup=forward1Btn.onpointercancel=()=>{if(scrubInterval)clearInterval(scrubInterval);scrubInterval=null;};}
if(back3Btn)back3Btn.ontouchend=e=>e.preventDefault();
if(forward1Btn)forward1Btn.ontouchend=e=>e.preventDefault();

function initializeApp(){
  if(!audioContext)audioContext=new(window.AudioContext||window.webkitAudioContext)();
  if(audioContext.state==='suspended')audioContext.resume();
  navigator.mediaDevices.getUserMedia({
    video:{facingMode:"environment",width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:240}},
    audio:true
  }).then(s=>{stream=s;v.srcObject=stream;startListening();})
    .catch(()=>{msg.innerHTML="📷 Camera/mic error<br>Allow permissions and try again";});
}

if(msg){msg.addEventListener('click',function f(){initializeApp();msg.removeEventListener('click',f);});}

const recognition=new(window.SpeechRecognition||window.webkitSpeechRecognition)();
recognition.lang='en-US';recognition.continuous=false;

function startListening(){
  if(!allowListening)return;
  if(!document.getElementById('page-slowmo').classList.contains('active'))return;
  msg.innerHTML='Listening...<br>Say <b>"GO"</b> to start';
  if(recordBtn)recordBtn.style.display='block';
  try{recognition.start();}catch(e){}
}

function triggerRecording(){
  if(!allowListening||
!stream)return;
  playBeep();
  msg.innerHTML="RECORDING 240fps...<br>9 seconds";
  if(recordBtn)recordBtn.style.display='none';
  recordSlowMo();
}

let countdownTimer=null;
const RECORD_DELAY_SECONDS=7;
function startDelayedRecording(){
  if(!allowListening||!stream||countdownTimer)return;
  allowListening=false;
  try{recognition.abort();}catch(e){}
  if(recordBtn)recordBtn.style.display='none';
  let remaining=RECORD_DELAY_SECONDS;
  msg.innerHTML=`Recording starts in<br>${remaining}`;
  countdownTimer=setInterval(()=>{
    remaining--;
    if(remaining>0){msg.innerHTML=`Recording starts in<br>${remaining}`;}
    else{clearInterval(countdownTimer);countdownTimer=null;allowListening=true;triggerRecording();}
  },1000);
}
if(recordBtn)recordBtn.onclick=startDelayedRecording;

recognition.onresult=e=>{
  const said=e.results[0][0].transcript.toLowerCase();
  if(said.includes('go')){triggerRecording();}else{setTimeout(startListening,200);}
};
recognition.onerror=recognition.onend=()=>{if(allowListening)setTimeout(startListening,300);};

function makeFilename(){return `slowmo_${new Date().toISOString().replace(/[:.]/g,'-')}.mp4`;}

function showReviewUI(){
  const s=stream?.getVideoTracks()?.[0]?.getSettings()||{};
  reviewInfo.innerHTML=`Got track: ${s.frameRate?Math.round(s.frameRate):'?'} fps @ ${s.width||'?'}×${s.height||'?'}<br>File: ${lastFilename}<br>Size: ${(lastBlob?.size/1024/1024).toFixed(1)} MB`;
  const canShare=navigator.share&&window.File;
  if(shareBtn)shareBtn.style.display=canShare?'inline-block':'none';
  if(shareHint)shareHint.style.display=canShare?'block':'none';
  review.style.display='block';
}

async function recordSlowMo(){
  blobs=[];allowListening=false;
  try{recognition.abort();}catch(e){}
  const vt=stream.getVideoTracks()[0];
  if(vt){const s=vt.getSettings();if(s.frameRate)recordedFrameDuration=1/s.frameRate;}
  rec=new MediaRecorder(stream,{mimeType:'video/mp4'});
  rec.ondataavailable=e=>e.data.size&&blobs.push(e.data);
  rec.start();
  await new Promise(r=>setTimeout(r,9000));
  rec.stop();
  rec.onstop=()=>{
    lastBlob=new Blob(blobs,{type:'video/mp4'});
    if(lastUrl)URL.revokeObjectURL(lastUrl);
    lastUrl=URL.createObjectURL(lastBlob);
    lastFilename=makeFilename();
    v.srcObject=null;v.src=lastUrl;v.playbackRate=.25;v.play();
    msg.innerHTML="";playbackControls.style.display='flex';
    v.onended=()=>{playbackControls.style.display='none';showReviewUI();};
  };
}

if(saveBtn)saveBtn.onclick=()=>lastBlob&&downloadBlob(lastBlob,lastFilename);
async function shareBlob(blob,name){
  try{
    const file=new File([blob],name,{type:'video/mp4'});
    if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'Slow-Mo Clip'});
    else throw 0;
  }catch{if(lastUrl)window.open(lastUrl,'_blank');}
}
if(shareBtn)shareBtn.onclick=()=>lastBlob&&shareBlob(lastBlob,lastFilename);
if(replayBtn)replayBtn.onclick=()=>{
  review.style.display='none';v.src=lastUrl;v.playbackRate=.25;v.play();
  playbackControls.style.display='flex';
  v.onended=()=>{playbackControls.style.display='none';showReviewUI();};
};
if(continueBtn)continueBtn.onclick=()=>{
  review.style.display='none';playbackControls.style.display='none';
  v.onended=null;v.srcObject=stream;v.play();allowListening=true;startListening();
};

function downloadBlob(b,n){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(b);a.download=n;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}