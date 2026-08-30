(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))l(o);new MutationObserver(o=>{for(const c of o)if(c.type==="childList")for(const n of c.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&l(n)}).observe(document,{childList:!0,subtree:!0});function s(o){const c={};return o.integrity&&(c.integrity=o.integrity),o.referrerPolicy&&(c.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?c.credentials="include":o.crossOrigin==="anonymous"?c.credentials="omit":c.credentials="same-origin",c}function l(o){if(o.ep)return;o.ep=!0;const c=s(o);fetch(o.href,c)}})();const K="modulepreload",U=function(e,t){return new URL(e,t).href},N={},O=function(t,s,l){let o=Promise.resolve();if(s&&s.length>0){let f=function(i){return Promise.all(i.map(p=>Promise.resolve(p).then(h=>({status:"fulfilled",value:h}),h=>({status:"rejected",reason:h}))))};const n=document.getElementsByTagName("link"),a=document.querySelector("meta[property=csp-nonce]"),d=a?.nonce||a?.getAttribute("nonce");o=f(s.map(i=>{if(i=U(i,l),i in N)return;N[i]=!0;const p=i.endsWith(".css"),h=p?'[rel="stylesheet"]':"";if(l)for(let y=n.length-1;y>=0;y--){const g=n[y];if(g.href===i&&(!p||g.rel==="stylesheet"))return}else if(document.querySelector(`link[href="${i}"]${h}`))return;const v=document.createElement("link");if(v.rel=p?"stylesheet":K,p||(v.as="script"),v.crossOrigin="",v.href=i,d&&v.setAttribute("nonce",d),document.head.appendChild(v),p)return new Promise((y,g)=>{v.addEventListener("load",y),v.addEventListener("error",()=>g(new Error(`Unable to preload CSS for ${i}`)))})}))}function c(n){const a=new Event("vite:preloadError",{cancelable:!0});if(a.payload=n,window.dispatchEvent(a),!a.defaultPrevented)throw n}return o.then(n=>{for(const a of n||[])a.status==="rejected"&&c(a.reason);return t().catch(c)})},Y=`
<svg viewBox="0 0 128 128" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="hfCore" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="#7ee787"/>
      <stop offset="0.42" stop-color="#3fb950"/>
      <stop offset="1" stop-color="#1a5c2a"/>
    </linearGradient>
    <linearGradient id="hfRim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8ff0a4"/>
      <stop offset="0.5" stop-color="#3fb950"/>
      <stop offset="1" stop-color="#17431f"/>
    </linearGradient>
    <linearGradient id="hfScan" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8ff0a4" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#8ff0a4" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#8ff0a4" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="hfGlow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#3fb950" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#3fb950" stop-opacity="0"/>
    </radialGradient>
    <filter id="hfBloom" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="2.6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <circle cx="64" cy="64" r="60" fill="url(#hfGlow)"/>

  <!-- Outer hex shell -->
  <path d="M64 6 111 33v62L64 122 17 95V33Z" fill="#080a08"/>
  <path d="M64 6 111 33v62L64 122 17 95V33Z" fill="none" stroke="url(#hfRim)" stroke-width="3.2" stroke-linejoin="round"/>

  <!-- Inner circuit hex -->
  <path d="M64 20 98 39.5v49L64 108 30 88.5v-49Z" fill="none" stroke="#1c3b22" stroke-width="1.4"/>

  <!-- Circuit traces -->
  <g stroke="#2a5c33" stroke-width="1.6" stroke-linecap="round" fill="none">
    <path d="M30 52h-11M30 76h-11M98 52h11M98 76h11M64 20V9M64 108v11"/>
  </g>
  <g fill="#3fb950">
    <circle cx="17" cy="52" r="2.3"/><circle cx="17" cy="76" r="2.3"/>
    <circle cx="111" cy="52" r="2.3"/><circle cx="111" cy="76" r="2.3"/>
  </g>

  <!-- Byte grid backdrop -->
  <g fill="#122" opacity="0"/>
  <g font-family="monospace" font-size="7.5" fill="#2c5c34" opacity="0.85">
    <text x="40" y="46">4F</text><text x="58" y="46">2A</text><text x="76" y="46">FF</text>
    <text x="40" y="88">1C</text><text x="58" y="88">B7</text><text x="76" y="88">3E</text>
  </g>

  <!-- H monogram forged from hex columns -->
  <g filter="url(#hfBloom)">
    <rect x="41" y="42" width="9" height="44" rx="4.5" fill="url(#hfCore)"/>
    <rect x="78" y="42" width="9" height="44" rx="4.5" fill="url(#hfCore)"/>
    <rect x="41" y="59.5" width="46" height="9" rx="4.5" fill="url(#hfCore)"/>
  </g>

  <!-- Scan sweep -->
  <rect x="17" y="58" width="94" height="12" fill="url(#hfScan)" opacity="0.5"/>

  <!-- Core node -->
  <circle cx="64" cy="64" r="5.4" fill="#080a08"/>
  <circle cx="64" cy="64" r="2.6" fill="#8ff0a4" filter="url(#hfBloom)"/>
</svg>`,X=[{glyph:"<",target:100,suffix:"%",decimals:0,label:"Processed Locally"},{glyph:"#",target:100,suffix:"+",decimals:0,label:"Formats Identified"},{glyph:"*",target:14,suffix:"",decimals:0,label:"Behaviour Classes"},{glyph:"%",target:0,suffix:"",decimals:0,label:"Bytes Uploaded"}],Z=[{label:"Home",href:"#/",active:!0},{label:"Workstation",href:"#/app"},{label:"Capabilities",panel:"capabilities"},{label:"Privacy",panel:"privacy"}];function T(e){return Z.map(t=>{const s=`${e}${t.active?" active":""}`;return t.panel?`<button type="button" class="${s}" data-panel="${t.panel}">${t.label}</button>`:`<a class="${s}" href="${t.href??"#/"}">${t.label}</a>`}).join("")}const J=[{icon:"◈",title:"Hex editing",items:["Virtualized view over multi-gigabyte files","Direct nibble-by-nibble byte editing","Non-destructive sparse patches with full undo","Bit editor, base converter, source export"]},{icon:"◉",title:"Identification",items:["100+ formats by content, not extension","Extension-mismatch detection","Embedded signature carving at every offset","Stated confidence and evidence per match"]},{icon:"⬡",title:"Threat intelligence",items:["14 behaviour classes tagged from strings","Indicators with byte offsets, CSV export","XOR key recovery and packer fingerprinting","Capped weighted score across six bands"]},{icon:"▦",title:"Forensics",items:["MD5, SHA-1/256/512, BLAKE3, CRC-32","Adaptive-window entropy and byte histogram","Strings across four encodings","Byte-accurate file comparison"]},{icon:"⬢",title:"Executables",items:["PE/COFF headers and section table","Per-section entropy with packing flags","Writable-and-executable section warnings","Image preview for decodable formats"]},{icon:"▧",title:"Reporting",items:["Paginated PDF dossier with risk gauge","Vector entropy and section charts","Findings register with analyst guidance","Chain-of-custody continuation block"]}];function Q(){return`
  <div class="panel-scrim" id="panelScrim" hidden></div>

  <section class="panel" id="panel-capabilities" role="dialog" aria-modal="true" aria-labelledby="capTitle" hidden>
    <header class="panel-head">
      <div>
        <span class="panel-eyebrow">Capabilities</span>
        <h2 id="capTitle">One workspace, six subsystems</h2>
      </div>
      <button type="button" class="panel-close" data-panel-close aria-label="Close">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 8l8 8M16 8l-8 8"/></svg>
      </button>
    </header>
    <div class="panel-body">
      <div class="cap-grid">
        ${J.map(e=>`
          <article class="cap-card">
            <span class="cap-icon">${e.icon}</span>
            <h3>${e.title}</h3>
            <ul>${e.items.map(t=>`<li>${t}</li>`).join("")}</ul>
          </article>`).join("")}
      </div>
    </div>
    <footer class="panel-foot">
      <span>Every capability runs on your own machine.</span>
      <a class="panel-cta" href="#/app">Launch Workstation</a>
    </footer>
  </section>

  <section class="panel" id="panel-privacy" role="dialog" aria-modal="true" aria-labelledby="privTitle" hidden>
    <header class="panel-head">
      <div>
        <span class="panel-eyebrow">Privacy</span>
        <h2 id="privTitle">There is no upload endpoint</h2>
      </div>
      <button type="button" class="panel-close" data-panel-close aria-label="Close">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 8l8 8M16 8l-8 8"/></svg>
      </button>
    </header>
    <div class="panel-body">
      <p class="panel-lede">
        This is an architectural property, not a policy promise. Files are read through
        <code>Blob.slice()</code> range requests and analysed in a Web Worker inside your own
        browser process. No server component exists to receive them.
      </p>
      <div class="privacy-grid">
        <div><b>No transmission</b><span>Nothing is sent anywhere. Load the page once, then disconnect your network — everything still works.</span></div>
        <div><b>No account</b><span>No sign-up, no licence key, no identity. Open a file and start.</span></div>
        <div><b>No telemetry</b><span>The application ships no analytics, no crash reporting, and no usage tracking.</span></div>
        <div><b>No retention</b><span>Nothing is stored server-side because there is no server-side. Closing the tab ends it.</span></div>
      </div>
      <div class="panel-note">
        <b>Why it matters.</b> Evidence under chain of custody, client data, and malware you
        are not licensed to redistribute all fail the moment a tool asks you to upload. Removing
        the upload removes the question.
      </div>
    </div>
    <footer class="panel-foot">
      <span>The local Python server transmits nothing and stores nothing.</span>
      <a class="panel-cta" href="#/app">Launch Workstation</a>
    </footer>
  </section>`}function ee(){return`
  <div class="landing">
    <div class="bg" aria-hidden="true">
      <canvas class="bg-field"></canvas>
      <div class="bg-veil"></div>
    </div>
    <div class="cursor-spotlight" aria-hidden="true"></div>

    <div class="page">
      <header class="site-header">
        <a class="logo" href="#/" aria-label="HexForge Studio">${Y}</a>
        <nav class="nav-pill" aria-label="Primary">${T("nav-link")}</nav>
        <a class="sign-in" href="#/app">Launch</a>
        <button type="button" class="burger" id="burger" aria-label="Open menu" aria-expanded="false" aria-controls="mobileMenu">
          <span></span><span></span><span></span>
        </button>
      </header>

      <main class="hero">
        <div class="trust anim" style="--d:.05s">
          <span class="avatar a1"><span class="avatar-symbol" aria-hidden="true">◆</span></span>
          <span class="avatar a2"><span class="avatar-symbol" aria-hidden="true">◎</span></span>
          <span class="avatar a3"><span class="avatar-symbol" aria-hidden="true">▣</span></span>
          <span class="trust-pill">Evidence never leaves your machine</span>
        </div>

        <h1 class="headline">
          <span style="--d:.12s">Every Byte</span>
          <span style="--d:.30s">Under Scrutiny</span>
        </h1>

        <p class="subhead anim" style="--d:.28s">
          A complete binary forensics workstation — hex editing, threat intelligence and
          court-ready reporting — running entirely on your own machine.
        </p>

        <a class="cta anim-pulse" style="--d:.4s" href="#/app">Launch Workstation</a>
      </main>

      <footer class="stats" id="stats">
        ${X.map((e,t)=>`
          <div class="stat anim" style="--d:${(.5+t*.08).toFixed(2)}s">
            <span class="stat-glyph">${e.glyph}</span>
            <span class="stat-value" data-target="${e.target}" data-suffix="${e.suffix}" data-decimals="${e.decimals}">0${e.suffix}</span>
            <span class="stat-label">${e.label}</span>
          </div>`).join("")}
      </footer>
    </div>

    <div class="menu-overlay" id="menuOverlay" hidden></div>
    <div class="menu-sheet" id="mobileMenu" hidden>
      ${T("menu-link")}
      <a class="menu-signin" href="#/app">Launch Workstation</a>
    </div>

    ${Q()}
  </div>`}const q="0123456789ABCDEF",M=window.matchMedia("(prefers-reduced-motion: reduce)");function te(e,t=1){const s=e.querySelector(".bg-field"),l=e.querySelector(".cursor-spotlight");if(!s)return()=>{};const o=s.getContext("2d",{alpha:!1});if(!o)return()=>{};const c=s,n=o;let a=0,d=0,f=[],i=0,p=!1,h=18;const v=()=>Math.min(window.devicePixelRatio||1,2);function y(){const u=e.getBoundingClientRect();a=Math.max(1,u.width),d=Math.max(1,u.height);const r=v();c.width=Math.floor(a*r),c.height=Math.floor(d*r),n.setTransform(r,0,0,r,0,0),h=a>2200?24:a>1400?20:16;const m=Math.ceil(a/h);f=Array.from({length:m},(w,x)=>g(x,!0))}function g(u,r=!1){const m=6+Math.floor(Math.random()*16);return{x:u*h,y:r?Math.random()*d:-m*h,speed:.35+Math.random()*1.15,length:m,glyphs:Array.from({length:m},()=>q[Math.floor(Math.random()*16)]??"0")}}function k(){const u=n.createLinearGradient(0,0,a,d);u.addColorStop(0,"#070907"),u.addColorStop(.5,"#000000"),u.addColorStop(1,"#080b08"),n.fillStyle=u,n.fillRect(0,0,a,d);const r=performance.now()/9e3,m=(w,x,z,j)=>{const E=n.createRadialGradient(w,x,0,w,x,z);E.addColorStop(0,j),E.addColorStop(1,"rgba(0,0,0,0)"),n.fillStyle=E,n.fillRect(0,0,a,d)};m(a*(.3+Math.sin(r)*.08),d*(.28+Math.cos(r*.8)*.07),Math.max(a,d)*.42,"rgba(35, 134, 54, 0.20)"),m(a*(.74+Math.cos(r*.7)*.07),d*(.66+Math.sin(r*.9)*.06),Math.max(a,d)*.34,"rgba(22, 90, 40, 0.18)")}function $(){if(p){k(),n.textBaseline="top",n.font=`600 ${Math.round(h*.72)}px ui-monospace, Consolas, monospace`;for(let u=0;u<f.length;u+=1){const r=f[u];if(r){if(r.y+=r.speed,r.y-r.length*h>d){f[u]=g(u);continue}for(let m=0;m<r.length;m+=1){const w=r.y-m*h;if(w<-h||w>d)continue;const x=1-m/r.length;m===0?n.fillStyle=`rgba(190, 255, 200, ${((.85*x+.15)*t).toFixed(3)})`:n.fillStyle=`rgba(63, 185, 80, ${(x*.5*t).toFixed(3)})`,n.fillText(r.glyphs[m]??"0",r.x,w)}if(Math.random()<.03){const m=Math.floor(Math.random()*r.length);r.glyphs[m]=q[Math.floor(Math.random()*16)]??"0"}}}i=window.requestAnimationFrame($)}}function C(){p||M.matches||(p=!0,i=window.requestAnimationFrame($))}function P(){p=!1,window.cancelAnimationFrame(i)}function A(){document.hidden?P():C()}function F(u){l&&(l.style.setProperty("--mx",`${u.clientX}px`),l.style.setProperty("--my",`${u.clientY}px`),l.style.setProperty("--on","1"))}function B(){l?.style.setProperty("--on","0")}const R=new ResizeObserver(y);if(R.observe(e),y(),window.addEventListener("pointermove",F,{passive:!0}),window.addEventListener("pointerleave",B,{passive:!0}),document.addEventListener("visibilitychange",A),M.matches){k(),n.font=`600 ${Math.round(h*.72)}px ui-monospace, Consolas, monospace`,n.textBaseline="top";for(const u of f)for(let r=0;r<u.length;r+=1)n.fillStyle=`rgba(63, 185, 80, ${((1-r/u.length)*.35*t).toFixed(3)})`,n.fillText(u.glyphs[r]??"0",u.x,u.y-r*h)}else C();return()=>{P(),R.disconnect(),window.removeEventListener("pointermove",F),window.removeEventListener("pointerleave",B),document.removeEventListener("visibilitychange",A)}}function ne(e){const t=[...e.querySelectorAll(".stat-value")];if(t.length===0)return()=>{};const s=n=>1-Math.pow(1-n,3);let l=!1;const o=()=>{l||(l=!0,t.forEach((n,a)=>{const d=Number(n.dataset.target??0),f=n.dataset.suffix??"",i=Number(n.dataset.decimals??0),p=1500+a*80,h=performance.now()+480+a*90,v=y=>{if(y<h){window.requestAnimationFrame(v);return}const g=Math.min(1,(y-h)/p),k=d*s(g);n.textContent=`${k.toFixed(i)}${f}`,g<1?window.requestAnimationFrame(v):n.textContent=`${d.toFixed(i)}${f}`};window.requestAnimationFrame(v)}))};if(M.matches){for(const n of t){const a=Number(n.dataset.target??0);n.textContent=`${a.toFixed(Number(n.dataset.decimals??0))}${n.dataset.suffix??""}`}return()=>{}}const c=new IntersectionObserver(n=>{n.some(a=>a.isIntersecting)&&(o(),c.disconnect())},{threshold:.25});return c.observe(e),()=>c.disconnect()}function oe(e){const t=e.querySelector("#burger"),s=e.querySelector("#menuOverlay"),l=e.querySelector("#mobileMenu");if(!t||!s||!l)return()=>{};const o=i=>{t.setAttribute("aria-expanded",String(i)),s.hidden=!i,l.hidden=!i,document.body.classList.toggle("menu-open",i)},c=()=>o(t.getAttribute("aria-expanded")!=="true"),n=()=>o(!1),a=i=>{i.key==="Escape"&&o(!1)},d=i=>{i.target.closest(".menu-link, .menu-signin")&&o(!1)},f=()=>{window.innerWidth>720&&o(!1)};return t.addEventListener("click",c),s.addEventListener("click",n),document.addEventListener("keydown",a),l.addEventListener("click",d),window.addEventListener("resize",f),()=>{t.removeEventListener("click",c),s.removeEventListener("click",n),document.removeEventListener("keydown",a),l.removeEventListener("click",d),window.removeEventListener("resize",f),document.body.classList.remove("menu-open")}}function ae(e){const t=e.querySelector("#panelScrim");if(!t)return()=>{};let s=null,l=null;const o=()=>{s&&(s.hidden=!0,t.hidden=!0,s=null,document.body.classList.remove("panel-open"),l?.focus())},c=(f,i)=>{const p=e.querySelector(`#panel-${CSS.escape(f)}`);p&&(o(),l=i,p.hidden=!1,t.hidden=!1,s=p,document.body.classList.add("panel-open"),p.querySelector(".panel-close")?.focus())},n=f=>{const i=f.target,p=i.closest("[data-panel]");if(p){f.preventDefault(),c(p.dataset.panel??"",p);return}if(i.closest("[data-panel-close]")){f.preventDefault(),o();return}i.closest(".panel-cta")&&o()},a=()=>o(),d=f=>{f.key==="Escape"&&o()};return e.addEventListener("click",n),t.addEventListener("click",a),document.addEventListener("keydown",d),()=>{e.removeEventListener("click",n),t.removeEventListener("click",a),document.removeEventListener("keydown",d),document.body.classList.remove("panel-open")}}function se(e){const t=l=>{e.style.setProperty("--mx",`${l.clientX}px`),e.style.setProperty("--my",`${l.clientY}px`),e.style.setProperty("--on","1")},s=()=>e.style.setProperty("--on","0");return window.addEventListener("pointermove",t,{passive:!0}),window.addEventListener("pointerleave",s,{passive:!0}),()=>{window.removeEventListener("pointermove",t),window.removeEventListener("pointerleave",s)}}const I="hexforge.theme";function ie(){try{const e=localStorage.getItem(I);if(e==="dark"||e==="light")return e}catch{}return typeof matchMedia=="function"&&matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}function D(e){document.documentElement.dataset.theme=e,document.documentElement.style.colorScheme=e;try{localStorage.setItem(I,e)}catch{}}function re(e){const t=e==="dark"?"light":"dark";return D(t),t}const H=document.querySelector("#app");if(!H)throw new Error("Application root is missing.");const b=H;let S=ie();D(S);let W=!1,G="";function le(){return window.location.hash.replace(/^#/,"").startsWith("/app")}function ce(){const e=window.location.hash;return e===""||e==="#"||e.startsWith("#/")}let L=null;function de(){document.body.classList.remove("app-mode"),L?.(),b.innerHTML=ee(),document.title="HexForge Studio Pro — Local-first binary forensics",window.scrollTo(0,0),pe();const e=b.querySelector(".landing"),t=b.querySelector("#stats");if(e){const s=te(e),l=oe(e),o=ae(e),c=t?ne(t):()=>{};L=()=>{s(),l(),o(),c()}}}async function ue(){if(document.body.classList.add("app-mode"),L?.(),L=null,document.title="HexForge Studio Pro — Workstation",W){const{remountWorkstation:t}=await O(async()=>{const{remountWorkstation:s}=await import("./main-DN9pv3Sx.js").then(l=>l.m);return{remountWorkstation:s}},[],import.meta.url);t(b),_();return}b.innerHTML='<div class="boot-screen"><div class="boot-mark"></div><p>Loading workstation…</p></div>';const{mountWorkstation:e}=await O(async()=>{const{mountWorkstation:t}=await import("./main-DN9pv3Sx.js").then(s=>s.m);return{mountWorkstation:t}},[],import.meta.url);W=!0,e(b),_()}function pe(){b.querySelector("[data-action='toggle-theme']")?.addEventListener("click",()=>{S=re(S)})}function V(){if(!ce())return;const e=le()?"app":"landing";e!==G&&(G=e,e==="app"?ue():de())}window.addEventListener("hashchange",V);V();function _(){if(b.querySelector(".app-spotlight"))return;const e=document.createElement("div");e.className="cursor-spotlight app-spotlight",e.setAttribute("aria-hidden","true"),b.append(e);const t=se(e);L=()=>{t(),e.remove()}}export{Y as B,O as _,ie as r,re as t};
