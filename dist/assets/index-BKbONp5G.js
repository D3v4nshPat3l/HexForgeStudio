(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))s(o);new MutationObserver(o=>{for(const r of o)if(r.type==="childList")for(const n of r.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&s(n)}).observe(document,{childList:!0,subtree:!0});function a(o){const r={};return o.integrity&&(r.integrity=o.integrity),o.referrerPolicy&&(r.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?r.credentials="include":o.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function s(o){if(o.ep)return;o.ep=!0;const r=a(o);fetch(o.href,r)}})();const Y="modulepreload",K=function(e,t){return new URL(e,t).href},O={},R=function(t,a,s){let o=Promise.resolve();if(a&&a.length>0){let p=function(l){return Promise.all(l.map(h=>Promise.resolve(h).then(f=>({status:"fulfilled",value:f}),f=>({status:"rejected",reason:f}))))};const n=document.getElementsByTagName("link"),i=document.querySelector("meta[property=csp-nonce]"),d=i?.nonce||i?.getAttribute("nonce");o=p(a.map(l=>{if(l=K(l,s),l in O)return;O[l]=!0;const h=l.endsWith(".css"),f=h?'[rel="stylesheet"]':"";if(s)for(let y=n.length-1;y>=0;y--){const g=n[y];if(g.href===l&&(!h||g.rel==="stylesheet"))return}else if(document.querySelector(`link[href="${l}"]${f}`))return;const v=document.createElement("link");if(v.rel=h?"stylesheet":Y,h||(v.as="script"),v.crossOrigin="",v.href=l,d&&v.setAttribute("nonce",d),document.head.appendChild(v),h)return new Promise((y,g)=>{v.addEventListener("load",y),v.addEventListener("error",()=>g(new Error(`Unable to preload CSS for ${l}`)))})}))}function r(n){const i=new Event("vite:preloadError",{cancelable:!0});if(i.payload=n,window.dispatchEvent(i),!i.defaultPrevented)throw n}return o.then(n=>{for(const i of n||[])i.status==="rejected"&&r(i.reason);return t().catch(r)})},U=`
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
</svg>`,X=[{glyph:"<",target:100,suffix:"%",decimals:0,label:"Processed Locally"},{glyph:"#",target:100,suffix:"+",decimals:0,label:"Formats Identified"},{glyph:"*",target:14,suffix:"",decimals:0,label:"Behaviour Classes"},{glyph:"%",target:0,suffix:"",decimals:0,label:"Bytes Uploaded"}],Z=[{label:"Home",href:"#/",active:!0},{label:"Workstation",href:"#/app"},{label:"Capabilities",panel:"capabilities"},{label:"Privacy",panel:"privacy"}];function N(e){return Z.map(t=>{const a=`${e}${t.active?" active":""}`;return t.panel?`<button type="button" class="${a}" data-panel="${t.panel}">${t.label}</button>`:`<a class="${a}" href="${t.href??"#/"}">${t.label}</a>`}).join("")}const J=[{icon:"◈",title:"Hex editing",items:["Virtualized view over multi-gigabyte files","Direct nibble-by-nibble byte editing","Non-destructive sparse patches with full undo","Bit editor, base converter, source export"]},{icon:"◉",title:"Identification",items:["100+ formats by content, not extension","Extension-mismatch detection","Embedded signature carving at every offset","Stated confidence and evidence per match"]},{icon:"⬡",title:"Threat intelligence",items:["14 behaviour classes tagged from strings","Indicators with byte offsets, CSV export","XOR key recovery and packer fingerprinting","Capped weighted score across six bands"]},{icon:"▦",title:"Forensics",items:["MD5, SHA-1/256/512, BLAKE3, CRC-32","Adaptive-window entropy and byte histogram","Strings across four encodings","Byte-accurate file comparison"]},{icon:"⬢",title:"Executables",items:["PE/COFF headers and section table","Per-section entropy with packing flags","Writable-and-executable section warnings","Image preview for decodable formats"]},{icon:"▧",title:"Reporting",items:["Paginated PDF dossier with risk gauge","Vector entropy and section charts","Findings register with analyst guidance","Chain-of-custody continuation block"]}];function Q(){return`
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
    <!--
      Depth stage. Layers sit at different Z distances and shift with the pointer, which
      builds parallax without scroll -- this page is a fixed viewport. Only decorative
      layers move; the headline and controls stay put, because parallaxing text hurts
      reading and can cause motion sickness.
    -->
    <div class="stage" aria-hidden="true">
      <div class="stage-layer depth-far"><canvas class="bg-field"></canvas></div>
      <div class="stage-layer depth-glow"></div>
      <div class="stage-layer depth-rays"></div>
      <div class="stage-layer depth-grid"></div>
      <div class="stage-layer depth-motes">
        ${Array.from({length:18},(e,t)=>{const a=t*53%100,s=t*37%100,o=t%4+1;return`<i style="--x:${a}%;--y:${s}%;--z:${o}" data-mote="${o}"></i>`}).join("")}
      </div>
      <div class="bg-veil"></div>
      <div class="stage-vignette"></div>
    </div>
    <div class="cursor-spotlight" aria-hidden="true"></div>

    <div class="page">
      <header class="site-header">
        <a class="logo" href="#/" aria-label="HexForge Studio">${U}</a>
        <nav class="nav-pill" aria-label="Primary">${N("nav-link")}</nav>
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

        <div class="hero-actions anim" style="--d:.4s">
          <a class="cta anim-pulse" href="#/app">Launch Workstation</a>
          <button type="button" class="cta-ghost" data-panel="capabilities">See what it does</button>
        </div>
      <!--
        A tilted glass slab carrying a real fragment of the product. Rotation follows the
        pointer through custom properties, so the browser only recomposites the layer.
      -->
      <div class="showpiece anim" style="--d:.55s" aria-hidden="true">
        <div class="showpiece-slab">
          <div class="showpiece-chrome"><i></i><i></i><i></i><span>evidence-sample.pdf</span></div>
          <div class="showpiece-body">
            <div class="showpiece-verdict">
              <div class="showpiece-dial"><b>94</b><small>OF 100</small></div>
              <div><b>Critical</b><span>Executable disguised by its extension</span></div>
            </div>
            <div class="showpiece-rows">
              ${["25 50 44 46 2D 31 2E 37","4D 5A 90 00 03 00 00 00","6B 65 72 6E 65 6C 33 32","56 69 72 74 75 61 6C 41"].map((e,t)=>`<code style="--i:${t}">${e}</code>`).join("")}
            </div>
            <div class="showpiece-bars">
              ${Array.from({length:26},(e,t)=>{const a=Math.round((Math.sin(t/2.4)*.3+.55+(t>17?.35:0))*100);return`<i style="--h:${Math.min(98,a)}%;--i:${t}"></i>`}).join("")}
            </div>
          </div>
        </div>
      </div>
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
      ${N("menu-link")}
      <a class="menu-signin" href="#/app">Launch Workstation</a>
    </div>

    ${Q()}
  </div>`}const T="0123456789ABCDEF",k=window.matchMedia("(prefers-reduced-motion: reduce)");function te(e,t=1){const a=e.querySelector(".bg-field"),s=e.querySelector(".cursor-spotlight");if(!a)return()=>{};const o=a.getContext("2d",{alpha:!1});if(!o)return()=>{};const r=a,n=o;let i=0,d=0,p=[],l=0,h=!1,f=18;const v=()=>Math.min(window.devicePixelRatio||1,2);function y(){const u=e.getBoundingClientRect();i=Math.max(1,u.width),d=Math.max(1,u.height);const c=v();r.width=Math.floor(i*c),r.height=Math.floor(d*c),n.setTransform(c,0,0,c,0,0),f=i>2200?24:i>1400?20:16;const m=Math.ceil(i/f);p=Array.from({length:m},(w,x)=>g(x,!0))}function g(u,c=!1){const m=6+Math.floor(Math.random()*16);return{x:u*f,y:c?Math.random()*d:-m*f,speed:.35+Math.random()*1.15,length:m,glyphs:Array.from({length:m},()=>T[Math.floor(Math.random()*16)]??"0")}}function E(){const u=n.createLinearGradient(0,0,i,d);u.addColorStop(0,"#070907"),u.addColorStop(.5,"#000000"),u.addColorStop(1,"#080b08"),n.fillStyle=u,n.fillRect(0,0,i,d);const c=performance.now()/9e3,m=(w,x,V,z)=>{const M=n.createRadialGradient(w,x,0,w,x,V);M.addColorStop(0,z),M.addColorStop(1,"rgba(0,0,0,0)"),n.fillStyle=M,n.fillRect(0,0,i,d)};m(i*(.3+Math.sin(c)*.08),d*(.28+Math.cos(c*.8)*.07),Math.max(i,d)*.42,"rgba(35, 134, 54, 0.20)"),m(i*(.74+Math.cos(c*.7)*.07),d*(.66+Math.sin(c*.9)*.06),Math.max(i,d)*.34,"rgba(22, 90, 40, 0.18)")}function $(){if(h){E(),n.textBaseline="top",n.font=`600 ${Math.round(f*.72)}px ui-monospace, Consolas, monospace`;for(let u=0;u<p.length;u+=1){const c=p[u];if(c){if(c.y+=c.speed,c.y-c.length*f>d){p[u]=g(u);continue}for(let m=0;m<c.length;m+=1){const w=c.y-m*f;if(w<-f||w>d)continue;const x=1-m/c.length;m===0?n.fillStyle=`rgba(190, 255, 200, ${((.85*x+.15)*t).toFixed(3)})`:n.fillStyle=`rgba(63, 185, 80, ${(x*.5*t).toFixed(3)})`,n.fillText(c.glyphs[m]??"0",c.x,w)}if(Math.random()<.03){const m=Math.floor(Math.random()*c.length);c.glyphs[m]=T[Math.floor(Math.random()*16)]??"0"}}}l=window.requestAnimationFrame($)}}function C(){h||k.matches||(h=!0,l=window.requestAnimationFrame($))}function P(){h=!1,window.cancelAnimationFrame(l)}function A(){document.hidden?P():C()}function F(u){s&&(s.style.setProperty("--mx",`${u.clientX}px`),s.style.setProperty("--my",`${u.clientY}px`),s.style.setProperty("--on","1"))}function q(){s?.style.setProperty("--on","0")}const B=new ResizeObserver(y);if(B.observe(e),y(),window.addEventListener("pointermove",F,{passive:!0}),window.addEventListener("pointerleave",q,{passive:!0}),document.addEventListener("visibilitychange",A),k.matches){E(),n.font=`600 ${Math.round(f*.72)}px ui-monospace, Consolas, monospace`,n.textBaseline="top";for(const u of p)for(let c=0;c<u.length;c+=1)n.fillStyle=`rgba(63, 185, 80, ${((1-c/u.length)*.35*t).toFixed(3)})`,n.fillText(u.glyphs[c]??"0",u.x,u.y-c*f)}else C();return()=>{P(),B.disconnect(),window.removeEventListener("pointermove",F),window.removeEventListener("pointerleave",q),document.removeEventListener("visibilitychange",A)}}function ne(e){const t=[...e.querySelectorAll(".stat-value")];if(t.length===0)return()=>{};const a=n=>1-Math.pow(1-n,3);let s=!1;const o=()=>{s||(s=!0,t.forEach((n,i)=>{const d=Number(n.dataset.target??0),p=n.dataset.suffix??"",l=Number(n.dataset.decimals??0),h=1500+i*80,f=performance.now()+480+i*90,v=y=>{if(y<f){window.requestAnimationFrame(v);return}const g=Math.min(1,(y-f)/h),E=d*a(g);n.textContent=`${E.toFixed(l)}${p}`,g<1?window.requestAnimationFrame(v):n.textContent=`${d.toFixed(l)}${p}`};window.requestAnimationFrame(v)}))};if(k.matches){for(const n of t){const i=Number(n.dataset.target??0);n.textContent=`${i.toFixed(Number(n.dataset.decimals??0))}${n.dataset.suffix??""}`}return()=>{}}const r=new IntersectionObserver(n=>{n.some(i=>i.isIntersecting)&&(o(),r.disconnect())},{threshold:.25});return r.observe(e),()=>r.disconnect()}function oe(e){const t=e.querySelector("#burger"),a=e.querySelector("#menuOverlay"),s=e.querySelector("#mobileMenu");if(!t||!a||!s)return()=>{};const o=l=>{t.setAttribute("aria-expanded",String(l)),a.hidden=!l,s.hidden=!l,document.body.classList.toggle("menu-open",l)},r=()=>o(t.getAttribute("aria-expanded")!=="true"),n=()=>o(!1),i=l=>{l.key==="Escape"&&o(!1)},d=l=>{l.target.closest(".menu-link, .menu-signin")&&o(!1)},p=()=>{window.innerWidth>720&&o(!1)};return t.addEventListener("click",r),a.addEventListener("click",n),document.addEventListener("keydown",i),s.addEventListener("click",d),window.addEventListener("resize",p),()=>{t.removeEventListener("click",r),a.removeEventListener("click",n),document.removeEventListener("keydown",i),s.removeEventListener("click",d),window.removeEventListener("resize",p),document.body.classList.remove("menu-open")}}function ae(e){const t=e.querySelector("#panelScrim");if(!t)return()=>{};let a=null,s=null;const o=()=>{a&&(a.hidden=!0,t.hidden=!0,a=null,document.body.classList.remove("panel-open"),s?.focus())},r=(p,l)=>{const h=e.querySelector(`#panel-${CSS.escape(p)}`);h&&(o(),s=l,h.hidden=!1,t.hidden=!1,a=h,document.body.classList.add("panel-open"),h.querySelector(".panel-close")?.focus())},n=p=>{const l=p.target,h=l.closest("[data-panel]");if(h){p.preventDefault(),r(h.dataset.panel??"",h);return}if(l.closest("[data-panel-close]")){p.preventDefault(),o();return}l.closest(".panel-cta")&&o()},i=()=>o(),d=p=>{p.key==="Escape"&&o()};return e.addEventListener("click",n),t.addEventListener("click",i),document.addEventListener("keydown",d),()=>{e.removeEventListener("click",n),t.removeEventListener("click",i),document.removeEventListener("keydown",d),document.body.classList.remove("panel-open")}}function ie(e){const t=s=>{e.style.setProperty("--mx",`${s.clientX}px`),e.style.setProperty("--my",`${s.clientY}px`),e.style.setProperty("--on","1")},a=()=>e.style.setProperty("--on","0");return window.addEventListener("pointermove",t,{passive:!0}),window.addEventListener("pointerleave",a,{passive:!0}),()=>{window.removeEventListener("pointermove",t),window.removeEventListener("pointerleave",a)}}function se(e){if(k.matches)return()=>{};let t=0,a=0,s=0,o=0,r=0;const n=()=>{t=0,o+=(a-o)*.12,r+=(s-r)*.12,e.style.setProperty("--px",o.toFixed(4)),e.style.setProperty("--py",r.toFixed(4)),(Math.abs(a-o)>.002||Math.abs(s-r)>.002)&&(t=window.requestAnimationFrame(n))},i=p=>{a=p.clientX/window.innerWidth*2-1,s=p.clientY/window.innerHeight*2-1,t===0&&(t=window.requestAnimationFrame(n))},d=()=>{a=0,s=0,t===0&&(t=window.requestAnimationFrame(n))};return window.addEventListener("pointermove",i,{passive:!0}),window.addEventListener("pointerleave",d,{passive:!0}),()=>{window.cancelAnimationFrame(t),window.removeEventListener("pointermove",i),window.removeEventListener("pointerleave",d),e.style.removeProperty("--px"),e.style.removeProperty("--py")}}const D="hexforge.theme";function re(){try{const e=localStorage.getItem(D);if(e==="dark"||e==="light")return e}catch{}return typeof matchMedia=="function"&&matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}function I(e){document.documentElement.dataset.theme=e,document.documentElement.style.colorScheme=e;try{localStorage.setItem(D,e)}catch{}}function le(e){const t=e==="dark"?"light":"dark";return I(t),t}const H=document.querySelector("#app");if(!H)throw new Error("Application root is missing.");const b=H;let S=re();I(S);let W=!1,_="";function ce(){return window.location.hash.replace(/^#/,"").startsWith("/app")}function de(){const e=window.location.hash;return e===""||e==="#"||e.startsWith("#/")}let L=null;function pe(){document.body.classList.remove("app-mode"),L?.(),b.innerHTML=ee(),document.title="HexForge Studio Pro — Local-first binary forensics",window.scrollTo(0,0),he();const e=b.querySelector(".landing"),t=b.querySelector("#stats");if(e){const a=te(e),s=oe(e),o=ae(e),r=se(e),n=t?ne(t):()=>{};L=()=>{a(),s(),o(),r(),n()}}}async function ue(){if(document.body.classList.add("app-mode"),L?.(),L=null,document.title="HexForge Studio Pro — Workstation",W){const{remountWorkstation:t}=await R(async()=>{const{remountWorkstation:a}=await import("./main-CSU9xfTQ.js").then(s=>s.m);return{remountWorkstation:a}},[],import.meta.url);t(b),G();return}b.innerHTML='<div class="boot-screen"><div class="boot-mark"></div><p>Loading workstation…</p></div>';const{mountWorkstation:e}=await R(async()=>{const{mountWorkstation:t}=await import("./main-CSU9xfTQ.js").then(a=>a.m);return{mountWorkstation:t}},[],import.meta.url);W=!0,e(b),G()}function he(){b.querySelector("[data-action='toggle-theme']")?.addEventListener("click",()=>{S=le(S)})}function j(){if(!de())return;const e=ce()?"app":"landing";e!==_&&(_=e,e==="app"?ue():pe())}window.addEventListener("hashchange",j);j();function G(){if(b.querySelector(".app-spotlight"))return;const e=document.createElement("div");e.className="cursor-spotlight app-spotlight",e.setAttribute("aria-hidden","true"),b.append(e);const t=ie(e);L=()=>{t(),e.remove()}}export{U as B,R as _,re as r,le as t};
