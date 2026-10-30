/* Gym Light Show engine: shared by the student page, the big screen and the setup page.
   Everything here is pure timing maths; every phone computes the same picture from its own clock. */
'use strict';
var LS={get:function(k,d){try{var v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set:function(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
var DEFAULT_COLORS=['#f2b33d','#1f5bff','#ffffff','#e0182d'];
var PALETTES={
  custom:{name:'School colours',c:null},
  rainbow:{name:'Rainbow',c:['#ff3b5c','#ff9f1c','#ffe14d','#3ddc84','#2ec5ff','#7a5cff','#ff4fd8']},
  fire:{name:'Fire',c:['#ff2a00','#ff7a00','#ffc400','#ff4d6d']},
  ice:{name:'Ice',c:['#00e5ff','#3d7bff','#b8f2ff','#7a5cff']}
};
var MODES={mix:'Mix it up',all:'All together',wave:'Wave',bounce:'Bounce',pairs:'Call and response',stack:'Stack up',spin:'Colour spin'};
var MODE_INFO={
  mix:'Switches pattern every 8 beats: all together, wave, call and response, colour spin, bounce, stack up.',
  all:'Every section flashes on each hit in its own colour, so the gym shows four colour blocks.',
  wave:'A wave rolls across the gym from A to D on every beat.',
  bounce:'The light bounces between sections: A, B, C, D, C, B and back.',
  pairs:'A and C flash on one hit, then B and D answer on the next.',
  stack:'A lights up, then A and B, then A, B and C, then the whole gym, and it starts again.',
  spin:'Everyone flashes on each hit while the four colours rotate around the gym.'};
var MIX=['all','wave','pairs','spin','bounce','stack'];
var PHASE_NAME={drop:'Explosion',build:'Build-up',quiet:'Quiet',hit:'Big hit',calm:'Calm'};
function normMode(m){return MODES[m]?m:'mix'}
var SECTIONS=['A','B','C','D'];
var MIN_GAP=334; /* never more than 3 flashes a second on any phone */
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function hex2rgb(x){x=String(x).replace('#','');if(x.length===3)x=x.split('').map(function(c){return c+c}).join('');var n=parseInt(x,16)||0;return[(n>>16)&255,(n>>8)&255,n&255]}
function colorsOf(s){var c=(s.colors||[]).slice(0,4);while(c.length<4)c.push(DEFAULT_COLORS[c.length]);return c}
function hexList(s){var p=s.palette||'custom';return p==='custom'?colorsOf(s):(PALETTES[p]||PALETTES.rainbow).c}
function songTitle(x){try{return decodeURIComponent(String(x||''))}catch(e){return String(x||'')}}
function sectionHex(s){var l=hexList(s);return[0,1,2,3].map(function(i){return l[i%l.length]})}
function fmtClock(ms){return new Date(ms).toLocaleString([], {weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
function fmtLen(ms){var s=Math.max(0,Math.round(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function fmtCount(ms){var s=Math.ceil(ms/1000);if(s>=3600){var hh=Math.floor(s/3600);return hh+'h '+Math.floor((s%3600)/60)+'m'}return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function lastAtOrBefore(arr,t){var lo=0,hi=arr.length-1,r=-1;while(lo<=hi){var m=(lo+hi)>>1;if(arr[m]<=t){r=m;lo=m+1}else hi=m-1}return r}
function mix(a,b,f){return[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f]}
function scale(a,f){return[a[0]*f,a[1]*f,a[2]*f]}
var WHITE=[255,255,255];

/* ---------- the light engine (identical on every phone) ----------
   sec per beat: 'h' = heavy (bass in), '0'-'9' = build-up and how far along, 'q' = quiet.
   drops: the exact moments (ms) the song slams back in after a build. kicks: the song's own hard hits. */
var prepMap=new WeakMap();
function prep(s){
  var pk=s.palette+(s.colors||[]).join()+'|'+s.mode,cache=prepMap.get(s);
  if(cache&&cache.pk===pk)return cache;
  var rs=[],st=0,sq=s.sec||'';
  for(var i=0;i<s.beats.length;i++){if(sq[i]==='h'&&(i===0||sq[i-1]!=='h'))st=i;rs.push(st)}
  cache={s:s,pk:pk,sc:sectionHex(s).map(hex2rgb),rs:rs,dropT:s.drops||[],kicks:s.kicks||[],kst:s.kst||[]};
  prepMap.set(s,cache);
  return cache;
}
function live(rgb,pat){return{phase:'live',rgb:rgb,pat:pat}}
/* every section has its own colour (A = colour 1 ... D = colour 4); patterns decide which sections flash when */
function frame(s,t,section,calm){
  if(!s||!s.beats||!s.beats.length)return{phase:'none',rgb:[0,0,0]};
  var c=prep(s),B=s.beats,sc=c.sc,own=sc[section],per=s.period||600;
  if(t<0)return{phase:'pre',rgb:scale(own,0.22)};
  if(t>s.dur)return{phase:'post',rgb:[0,0,0]};
  var b=lastAtOrBefore(B,t);
  if(b<0)return live(scale(own,0.1),'quiet');
  var sq=s.sec?s.sec[b]:'h',lvl=(s.lvl[b]||0)/9;
  var step=per<MIN_GAP?Math.ceil(MIN_GAP/per):1;   /* keep every phone at 3 flashes a second or fewer */
  var bq=b-(b%step),idx=bq/step,dtq=t-B[bq],perq=per*step;

  if(calm){ /* no flashing: a slow colour wave rolls across the sections */
    var wv=0.5+0.5*Math.sin(t/1400-section*1.2);
    var br=(sq==='h'?0.32:sq==='q'?0.16:0.14+0.2*(+sq/9))+0.22*wv,base=own;
    var di=lastAtOrBefore(c.dropT,t);
    if(di>=0&&t-c.dropT[di]<3000){var e=1-(t-c.dropT[di])/3000;base=mix(own,WHITE,0.5*e);br=Math.max(br,0.45+0.35*e)}
    return live(scale(base,br),'calm');
  }

  /* the explosion: black, then white rolling A to D, then each section bursts into its own colour */
  var d=lastAtOrBefore(c.dropT,t+400);
  if(d>=0){
    var te=t-c.dropT[d]-section*120;
    if(te<0&&te>-400)return live([0,0,0],'drop');
    if(te>=0&&te<2600){
      if(te<170)return live(WHITE,'drop');
      var k=(te-170)/2430,glow=mix(WHITE,own,Math.min(1,k*4)),ex=0.35+0.65*Math.pow(1-k,1.6);
      var kick=kickBright(c,t);if(kick.br>ex)return live(scale(kick.hit?WHITE:own,kick.br),'drop');
      return live(scale(glow,ex),'drop');
    }
  }

  if(sq==='q')return live(scale(own,0.08+0.2*Math.exp(-(t-B[b])/(per*1.5))),'quiet');

  if(sq!=='h'){ /* build-up: the light chases A-B-C-D, then sections trade, then everyone, brighter and whiter */
    var p=Math.min(1,(+sq+(t-B[b])/per/((s.blen&&s.blen[b])||8))/9);
    var on=p<0.35?(idx%4)===section:p<0.7?(idx%2)===(section%2):true;
    var col=mix(own,WHITE,0.55*p),fl=0.03+0.17*p,pk=0.35+0.65*p;
    return live(scale(col,on?fl+(pk-fl)*Math.exp(-dtq/(perq*0.35)):fl),'build');
  }

  /* heavy part */
  var pat=normMode(s.mode),phT=-1e9;
  if(pat==='mix'){var ph=Math.floor((b-c.rs[b])/(8*step));pat=MIX[ph%MIX.length];phT=B[c.rs[b]+ph*8*step]}
  var hk=kickBright(c,t-section*80); /* the hardest hits are mini explosions that ripple A to D */
  if(hk.hit)return live(scale(mix(WHITE,own,Math.min(1,hk.dt/140)),Math.max(0.1,hk.br)),'hit');
  var kb=kickBright(c,t);
  if(c.kst[kb.k]===9&&kb.dt<section*80)return live(scale(own,0.07),pat); /* the big-hit ripple hasn't reached this section yet */
  var useKick=kb.dt<1e9&&B[bq]-c.kicks[kb.k]<=perq*1.5;
  var evK=useKick?kb.k:idx,dt=useKick?kb.dt:dtq,str=useKick?kb.str:lvl,decay=200;
  if(!useKick){var nk=c.kicks[kb.k+1];if(nk!=null&&nk-B[bq]<MIN_GAP)dt=1e9} /* a kick is about to land: wait for it */
  else if(kb.dt>perq*1.5)dt=1e9;
  on=true;col=own;
  if(pat==='spin')col=sc[(section+evK)%4];
  else if(pat==='pairs')on=(evK%2)===(section%2);
  else if(pat==='bounce'){on=[0,1,2,3,2,1][idx%6]===section;dt=dtq;str=lvl;decay=280}
  else if(pat==='stack'){on=section<=idx%4;dt=dtq;str=lvl;decay=260}
  else if(pat==='wave'){
    var off=section*perq/4,wb=lastAtOrBefore(B,t-off);
    if(wb>=0)wb-=wb%step;
    if(wb<0||c.s.sec[wb]!=='h')on=false;else{dt=t-(B[wb]+off);str=lvl;decay=190}
  }
  /* where one pattern hands over to the next, skip a flash that would land too soon after the last one */
  var evT=t-dt,lk=lastAtOrBefore(c.kicks,evT-1);
  if(lk>=0&&evT-c.kicks[lk]<MIN_GAP){
    var kT=c.kicks[lk],dk=lastAtOrBefore(c.dropT,kT);
    var kickFlashed=kT<phT||c.kst[lk]===9||(dk>=0&&kT-c.dropT[dk]<2600+section*120)||(pat!=='bounce'&&pat!=='stack'&&pat!=='wave');
    if(kickFlashed&&evT!==kT)on=false;
  }
  var gl=0.07;
  return live(scale(col,on?Math.max(gl,Math.exp(-dt/decay)*(0.6+0.4*str)):gl),pat);
}
function kickBright(c,t){
  var k=lastAtOrBefore(c.kicks,t);
  if(k<0)return{br:0,dt:1e9,hit:false,str:0,k:0};
  var dt=t-c.kicks[k],st=(c.kst[k]||0)/9,hit=c.kst[k]===9;
  return{br:Math.exp(-dt/(hit?420:200)),dt:dt,hit:hit&&dt<700&&dt>=0,str:st,k:k};
}
function rgbStr(a){return'rgb('+Math.round(a[0])+','+Math.round(a[1])+','+Math.round(a[2])+')'}
function quadHTML(id,cap){return'<div class="quad" id="'+id+'">'+SECTIONS.map(function(x){return'<div>'+x+'</div>'}).join('')+'</div><div class="pvcap"><span id="'+id+'-pat">'+cap+'</span><span id="'+id+'-t"></span></div>'}
function paintQuad(id,s,t,label){
  var el=document.getElementById(id);if(!el)return false;
  var tiles=el.children,pat='';
  for(var i=0;i<4;i++){var fr=frame(s,t,i,false);tiles[i].style.background=rgbStr(fr.rgb);if(i===0)pat=fr.pat||''}
  var pe=document.getElementById(id+'-pat'),te=document.getElementById(id+'-t');
  if(pe)pe.textContent=t<0?'Waiting for the music':t>s.dur?'Finished':(MODES[pat]||PHASE_NAME[pat]||'');
  if(te)te.textContent=label!=null?label:fmtLen(t);
  return true;
}
function clearQuad(id,cap){var el=document.getElementById(id);if(!el)return;for(var i=0;i<4;i++)el.children[i].style.background='#000';var pe=document.getElementById(id+'-pat');if(pe)pe.textContent=cap;var te=document.getElementById(id+'-t');if(te)te.textContent=''}

/* ---------- song analysis (runs on the host's device; the song is never uploaded) ---------- */
function decode(ctx,ab){return new Promise(function(res,rej){try{var p=ctx.decodeAudioData(ab,res,rej);if(p&&p.then)p.then(res,rej)}catch(e){rej(e)}})}
function pct(arr,q){var a=Array.prototype.slice.call(arr).sort(function(x,y){return x-y});return a.length?a[Math.min(a.length-1,Math.floor(q*a.length))]:0}
function yieldUI(){return new Promise(function(r){setTimeout(r,0)})}
async function analyze(buf,onProgress){
  var sr=buf.sampleRate,c0=buf.getChannelData(0),c1=buf.numberOfChannels>1?buf.getChannelData(1):null;
  var hop=Math.round(sr*0.01),F=Math.floor(buf.length/hop),fms=hop/sr*1000;
  var eF=new Float32Array(F),eL=new Float32Array(F),a=1-Math.exp(-2*Math.PI*150/sr),y=0,maxE=0;
  for(var f=0;f<F;f++){
    var sf=0,sl=0,s0=f*hop;
    for(var i=s0;i<s0+hop;i++){var x=c1?(c0[i]+c1[i])*0.5:c0[i];y+=a*(x-y);sf+=x*x;sl+=y*y}
    eF[f]=sf/hop;eL[f]=sl/hop;if(eF[f]>maxE)maxE=eF[f];
    if((f&2047)===0){onProgress(f/F*0.7);await yieldUI()}
  }
  var gate=maxE*1e-4,odf=new Float32Array(F),kd=new Float32Array(F);
  for(f=1;f<F;f++){
    if(eF[f]<gate)continue;
    var dl=Math.log(eL[f]+1e-9)-Math.log(eL[f-1]+1e-9),df=Math.log(eF[f]+1e-9)-Math.log(eF[f-1]+1e-9);
    odf[f]=Math.max(0,dl)+0.6*Math.max(0,df);
    kd[f]=Math.max(0,dl)*Math.sqrt(eL[f]/maxE);
  }
  var W=25,pre=new Float64Array(F+1),o=new Float32Array(F);
  for(f=0;f<F;f++)pre[f+1]=pre[f]+odf[f];
  for(f=0;f<F;f++){var l0=Math.max(0,f-W),h0=Math.min(F,f+W+1);o[f]=Math.max(0,odf[f]-(pre[h0]-pre[l0])/(h0-l0))}
  onProgress(0.75);await yieldUI();

  /* tempo: favour the beat length whose 1-bar and 2-bar repeats are strongest
     (stops syncopated drum patterns from fooling it into a faster tempo) */
  var acMemo={};
  function ac(L){L=Math.round(L);if(acMemo[L]!=null)return acMemo[L];var s=0;for(var z=0;z+L<F;z++)s+=o[z]*o[z+L];return acMemo[L]=s/Math.max(1,F-L)}
  var best=-1,bestL=60,Lmin=Math.round(60000/180/fms),Lmax=Math.round(60000/70/fms);
  for(var L=Lmin;L<=Lmax;L++){
    var bpm=60000/(L*fms),w=Math.exp(-0.5*Math.pow(Math.log2(bpm/110)/1.1,2));
    var sc=(ac(L)+ac(2*L)+3*ac(4*L)+ac(8*L))*w;
    if(sc>best){best=sc;bestL=L}
    if((L&7)===0)await yieldUI();
  }
  var P=bestL,A=ac(bestL-1),Bv=ac(bestL),C=ac(bestL+1),dd=A-2*Bv+C;
  if(dd<0)P=bestL+Math.max(-0.5,Math.min(0.5,0.5*(A-C)/dd));
  onProgress(0.85);await yieldUI();

  /* beat phase, then follow the beat through the song */
  var bestPh=0,bs=-1;
  for(var ph=0;ph<P;ph++){var s2=0;for(var t=ph;t<F;t+=P)s2+=o[Math.round(t)]||0;if(s2>bs){bs=s2;bestPh=ph}}
  var nz=[];for(f=0;f<F;f++)if(o[f]>0)nz.push(o[f]);
  var thr=pct(nz,0.75),tol=Math.max(3,Math.round(P*0.18)),bt=[],tt=bestPh;
  while(tt<F){
    var cc=Math.round(tt),mi=cc,mv=o[cc]||0;
    for(var q=cc-tol;q<=cc+tol;q++){if(q>=0&&q<F&&o[q]>mv){mv=o[q];mi=q}}
    var nb=mv>thr?tt+0.7*(mi-tt):tt;bt.push(nb);tt=nb+P;
  }
  var nB=bt.length;
  function avg(arr,b){var lo=Math.max(0,Math.round(b-P/2)),hi=Math.min(F,Math.round(b+P/2)),s3=0;for(var z=lo;z<hi;z++)s3+=arr[z];return s3/Math.max(1,hi-lo)}
  var rms=bt.map(function(b){return Math.sqrt(avg(eF,b))});
  var r95=pct(rms,0.95)||1;
  var lvl=rms.map(function(r){return Math.max(0,Math.min(9,Math.round(Math.pow(Math.min(1,r/r95),0.8)*9)))});

  /* sections: where the bass is in (heavy) versus out (build-ups) */
  var lowDb=bt.map(function(b){return 10*Math.log10(avg(eL,b)+1e-12)});
  var thrL=(pct(lowDb,0.2)+pct(lowDb,0.8))/2;
  var heavy=lowDb.map(function(v){return v>thrL});
  var sec=new Array(nB),blen=new Array(nB),drops=[];
  var i0=0;
  while(i0<nB){
    var j=i0;while(j<nB&&heavy[j]===heavy[i0])j++;
    var len=j-i0;
    if(heavy[i0]){for(var k=i0;k<j;k++){sec[k]='h';blen[k]=0}}
    else if(len<6&&i0>0&&j<nB){for(k=i0;k<j;k++){sec[k]='h';blen[k]=0}}
    else if(j<nB){for(k=i0;k<j;k++){sec[k]=String(Math.min(9,Math.floor((k-i0)/len*10)));blen[k]=Math.max(1,len/10)}drops.push(j)}
    else{for(k=i0;k<j;k++){sec[k]='q';blen[k]=0}}
    i0=j;
  }
  /* pin each drop to the biggest jump in bass near the end of its build (the shout or hit, not just the next beat) */
  var preL=new Float64Array(F+1);for(f=0;f<F;f++)preL[f+1]=preL[f]+eL[f];
  function mL(lo,hi){lo=Math.max(0,lo);hi=Math.min(F,hi);return hi>lo?(preL[hi]-preL[lo])/(hi-lo):0}
  drops=drops.map(function(j){
    var from=Math.round(bt[j]-3*P),to=Math.round(bt[j]+P*0.5),bf=Math.round(bt[j]),br=-1e9;
    for(var z=Math.max(30,from);z<Math.min(F-6,to);z++){var rise=10*Math.log10(mL(z,z+5)+1e-12)-10*Math.log10(mL(z-30,z)+1e-12);if(rise>br){br=rise;bf=z}}
    return Math.round(bf*fms);
  });

  /* kicks: the hard low hits inside heavy parts, at most 3 a second */
  var cand=[];
  for(f=3;f<F-3;f++){
    if(kd[f]<=0)continue;
    var isMax=true;for(q=f-3;q<=f+3;q++)if(kd[q]>kd[f]){isMax=false;break}
    if(isMax)cand.push(f);
  }
  function beatAt(fr){var lo=0,hi=nB-1,r=-1;while(lo<=hi){var m=(lo+hi)>>1;if(bt[m]<=fr+P*0.25){r=m;lo=m+1}else hi=m-1}return r}
  cand=cand.filter(function(fr){var bi=beatAt(fr);return bi>=0&&sec[bi]==='h'});
  var kthr=pct(cand.map(function(fr){return kd[fr]}),0.55);
  cand=cand.filter(function(fr){return kd[fr]>=kthr}).sort(function(x,y){return kd[y]-kd[x]});
  var gapF=MIN_GAP/fms,taken=[];
  cand.forEach(function(fr){for(var z=0;z<taken.length;z++)if(Math.abs(taken[z]-fr)<gapF)return;taken.push(fr)});
  taken.sort(function(x,y){return x-y});
  var k95=pct(taken.map(function(fr){return kd[fr]}),0.95)||1,k90=pct(taken.map(function(fr){return kd[fr]}),0.9);
  var kicks=[],kst=[],lastHit=-1e9;
  taken.forEach(function(fr){
    var v=kd[fr],st=Math.min(8,Math.round(Math.min(1,v/k95)*8));
    if(v>=k90&&fr-lastHit>P*4){st=9;lastHit=fr}
    kicks.push(Math.round(fr*fms));kst.push(st);
  });
  onProgress(1);
  return{dur:Math.round(buf.duration*1000),bpm:60000/(P*fms),period:P*fms,beats:bt.map(function(b){return Math.round(b*fms)}),lvl:lvl,sec:sec.join(''),blen:blen.map(function(v){return Math.round(v*10)/10}),drops:drops,kicks:kicks,kst:kst};
}
function retime(base,mul,nudge){
  var B=base.beats,beats=[],lvl=[],sec=[],blen=[],map={};
  for(var i=0;i<B.length;i++){
    if(mul===0.5&&i%2)continue;
    map[i]=beats.length;beats.push(B[i]);lvl.push(base.lvl[i]);sec.push(base.sec[i]);blen.push(base.blen[i]/(mul===2?0.5:mul===0.5?2:1));
    if(mul===2&&i+1<B.length){beats.push(Math.round((B[i]+B[i+1])/2));lvl.push(base.lvl[i]);sec.push(base.sec[i]);blen.push(base.blen[i]*2)}
  }
  var sh=function(v){return Math.max(0,v+nudge)};
  return{dur:base.dur,bpm:base.bpm*mul,period:base.period/mul,beats:beats.map(sh),lvl:lvl,sec:sec.join(''),blen:blen,drops:base.drops.map(sh),kicks:base.kicks.map(sh),kst:base.kst.slice()};
}


/* ---------- the library: several shows, each at its own time or chained after another ---------- */
var CHAIN_GAP=3000; /* pause between back-to-back songs */
function resolveStarts(lib){
  var shows=(lib&&lib.shows)||[],byId={},out=[];
  shows.forEach(function(s){byId[s.id]=s});
  function startOf(s,depth){
    if(depth>50)return null;
    if(s.after&&byId[s.after]){var p=byId[s.after],ps=startOf(p,depth+1);return ps==null?null:ps+p.dur+CHAIN_GAP}
    return s.start||null;
  }
  shows.forEach(function(s){if(!s.beats||!s.sec)return;var st=startOf(s,0);if(st!=null)out.push({show:s,start:st,end:st+s.dur})});
  out.sort(function(a,b){return a.start-b.start});
  return out;
}
/* what should be on screen at time now: the show that is playing, else the next one, else the last one */
function pickShow(sched,now){
  for(var i=0;i<sched.length;i++){if(now>=sched[i].start&&now<=sched[i].end)return{cur:sched[i],next:sched[i+1]||null,state:'live'}}
  for(i=0;i<sched.length;i++){if(sched[i].start>now)return{cur:sched[i],next:sched[i+1]||null,state:'waiting',prev:sched[i-1]||null}}
  return{cur:sched[sched.length-1]||null,next:null,state:sched.length?'done':'none'};
}
function fetchLibrary(){
  return fetch('shows.json?t='+Date.now(),{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('http '+r.status);return r.json()});
}
