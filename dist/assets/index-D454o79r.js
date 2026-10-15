(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))n(a);new MutationObserver(a=>{for(const i of a)if(i.type==="childList")for(const o of i.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&n(o)}).observe(document,{childList:!0,subtree:!0});function s(a){const i={};return a.integrity&&(i.integrity=a.integrity),a.referrerPolicy&&(i.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?i.credentials="include":a.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function n(a){if(a.ep)return;a.ep=!0;const i=s(a);fetch(a.href,i)}})();const W="modulepreload",$=function(e,t){return new URL(e,t).href},R={},T=function(t,s,n){let a=Promise.resolve();if(s&&s.length>0){let L=function(d){return Promise.all(d.map(u=>Promise.resolve(u).then(f=>({status:"fulfilled",value:f}),f=>({status:"rejected",reason:f}))))};const o=document.getElementsByTagName("link"),h=document.querySelector("meta[property=csp-nonce]"),v=h?.nonce||h?.getAttribute("nonce");a=L(s.map(d=>{if(d=$(d,n),d in R)return;R[d]=!0;const u=d.endsWith(".css"),f=u?'[rel="stylesheet"]':"";if(n)for(let m=o.length-1;m>=0;m--){const b=o[m];if(b.href===d&&(!u||b.rel==="stylesheet"))return}else if(document.querySelector(`link[href="${d}"]${f}`))return;const p=document.createElement("link");if(p.rel=u?"stylesheet":W,u||(p.as="script"),p.crossOrigin="",p.href=d,v&&p.setAttribute("nonce",v),document.head.appendChild(p),u)return new Promise((m,b)=>{p.addEventListener("load",m),p.addEventListener("error",()=>b(new Error(`Unable to preload CSS for ${d}`)))})}))}function i(o){const h=new Event("vite:preloadError",{cancelable:!0});if(h.payload=o,window.dispatchEvent(h),!h.defaultPrevented)throw o}return a.then(o=>{for(const h of o||[])h.status==="rejected"&&i(h.reason);return t().catch(i)})},q=`
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <path d="M32 2 59 17.5v29L32 62 5 46.5v-29Z" fill="#242620"/>
  <path d="M32 7 54 19.7v24.6L32 57 10 44.3V19.7Z" fill="none" stroke="#73776b" stroke-width="1.2"/>
  <path d="M22 17h6v30h-6zM36 17h6v30h-6zM28 29h8v6h-8z" fill="#f3f1eb"/>
  <path d="M42 41h8v8h-8z" fill="#b84322"/>
  <path d="M46 45h4M48 43v4" stroke="#f3f1eb" stroke-width="1"/>
</svg>`,H=[["01","Hex editor","Read and edit hexadecimal bytes or decoded text side by side. Search, navigate, undo, and export a copy."],["02","Signature analysis","Identify file formats by their content, check extension mismatches, and find embedded signatures."],["03","Threat intelligence","Review indicators and behaviour matches with byte offsets and an explainable risk score."],["04","Forensics lab","Calculate hashes, inspect entropy and byte distributions, and extract readable strings."],["05","File comparison","Compare two files byte for byte and navigate directly between differences."],["06","PE analysis & preview","Inspect portable executable headers and sections, or preview supported image content."],["07","Injector workbench","Browse 40,849 test payloads and 135 connect-back command templates; configure encoding and placement and preview the resulting bytes."],["08","PDF reports","Create a structured report with case details, analysis findings, charts, and a chain-of-custody continuation block."]];function U(){return H.map(([e,t,s])=>`
    <a class="feature-card reveal" href="#/app">
      <span class="feature-no">${e}</span>
      <span class="feature-copy"><span class="feature-title">${t}</span><span class="feature-description">${s}</span></span>
      <span class="feature-arrow" aria-hidden="true">↗</span>
    </a>`).join("")}function Y(){return`
  <div class="landing">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <a class="brand" href="#/" aria-label="HexForge Studio home">
        <span class="brand-mark">${q}</span><span class="brand-name">HexForge</span><span class="brand-studio">STUDIO</span>
      </a>
      <button class="mobile-menu" type="button" aria-expanded="false" aria-controls="primary-nav">Menu <span aria-hidden="true">＋</span></button>
      <nav class="primary-nav" id="primary-nav" aria-label="Main navigation">
        <a href="#capabilities">Capabilities</a>
        <a href="https://github.com/D3v4nshPat3l/HexForgeStudio" target="_blank" rel="noreferrer">Source code ↗</a>
        <a class="nav-cta" href="#/app">Open workstation <span aria-hidden="true">↗</span></a>
      </nav>
    </header>

    <main id="main">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-copy">
          <p class="eyebrow"><span class="status-dot"></span> LOCAL-FIRST BINARY FORENSICS</p>
          <h1 id="hero-title">Look closer.<br>Find what<br><em>others miss.</em></h1>
          <p class="hero-lede">A considered workspace for the details that matter. Inspect bytes, investigate files, and turn findings into clear evidence — on your machine.</p>
          <div class="hero-actions">
            <a class="button-primary" href="#/app">Open workstation <span aria-hidden="true">↗</span></a>
            <a class="button-text" href="#capabilities">Explore the toolkit ↓</a>
          </div>
          <p class="hero-note">No account. No file uploads. Just your investigation.</p>
        </div>

        <div class="hero-art" aria-label="Illustration of binary file inspection">
          <canvas class="hero-field" id="hero-field" aria-hidden="true"></canvas>
          <div class="art-label art-top"><span>FIELD NOTES / 001</span><span>BINARY INSPECTION</span></div>
          <article class="specimen">
            <div class="spec-head"><span><i class="status-dot"></i> sample.exe</span><span>READ ONLY</span></div>
            <div class="hex-label"><span>OFFSET</span><span>HEX VALUES</span><span>ASCII</span></div>
            <div class="hero-byte-row"><span class="offset">00000000</span><span class="hex-values"><b>4D</b> 5A 90 00 03 00 00 00</span><span class="ascii-value">MZ......</span></div>
            <div class="signature-note"><span class="branch">└</span><b>4D 5A</b><span>DOS executable signature</span></div>
            <div class="spec-foot"><span>PORTABLE EXECUTABLE</span><span>PE32 · x86</span></div>
          </article>
          <p class="annotation"><span></span><span>Every file has a story.<br><b>Start with the first byte.</b></span></p>
          <div class="art-label art-bottom"><span>00000000 — 000000FF</span><span>YOUR FILES STAY YOURS <i class="status-dot"></i></span></div>
        </div>
      </section>

      <div class="trust-strip" aria-label="Product facts">
        <span><b>01 /</b> Eight focused tools</span><span><b>02 /</b> 75+ file signatures</span><span><b>03 /</b> Files stay on device</span><small>BUILT FOR CAREFUL WORK.</small>
      </div>

      <section class="capabilities" id="capabilities" aria-labelledby="capabilities-title">
        <div class="section-intro reveal">
          <p class="eyebrow">THE TOOLKIT / 08 MODULES</p>
          <h2 id="capabilities-title">One file.<br>Every useful angle.</h2>
          <p>Move from byte-level inspection to a shareable report with a complete set of local analysis tools.</p>
          <a class="button-text" href="#/app">Explore the workstation ↗</a>
        </div>
        <div class="feature-grid" aria-label="Workstation modules">${U()}</div>
      </section>

      <section class="privacy-band reveal" id="privacy">
        <div><p class="eyebrow">PRIVATE BY DESIGN</p><h2>Your evidence.<br>Your machine.</h2></div>
        <div><p>Open files locally, investigate with care, and choose what you export. HexForge has no upload endpoint and sends no file data to a server.</p><a class="button-primary" href="#/app">Start an investigation <span aria-hidden="true">↗</span></a></div>
        <span class="byte-ornament" aria-hidden="true">4D 5A 00 01 · 7F 45 4C 46</span>
      </section>
    </main>

    <footer class="site-footer"><span>HexForge Studio <span>/ Independent tools. Careful work.</span></span><small>LOCAL-FIRST / 08 TOOLS</small></footer>
  </div>`}window.matchMedia("(prefers-reduced-motion: reduce)");function z(e){const t=n=>{e.style.setProperty("--mx",`${n.clientX}px`),e.style.setProperty("--my",`${n.clientY}px`),e.style.setProperty("--on","1")},s=()=>e.style.setProperty("--on","0");return window.addEventListener("pointermove",t,{passive:!0}),window.addEventListener("pointerleave",s,{passive:!0}),()=>{window.removeEventListener("pointermove",t),window.removeEventListener("pointerleave",s)}}function V(e){const t=window.matchMedia("(prefers-reduced-motion: reduce)"),s=e.querySelector("#hero-field"),n=s?.getContext("2d"),a=e.querySelector(".mobile-menu"),i=e.querySelector("#primary-nav"),o=[];if(a&&i){const r=()=>{a.setAttribute("aria-expanded","false"),i.classList.remove("is-open")},c=()=>{const l=a.getAttribute("aria-expanded")!=="true";a.setAttribute("aria-expanded",String(l)),i.classList.toggle("is-open",l)};a.addEventListener("click",c),i.addEventListener("click",l=>{l.target.closest("a")&&r()});const g=l=>{l.key==="Escape"&&r()};document.addEventListener("keydown",g),o.push(()=>{a.removeEventListener("click",c),document.removeEventListener("keydown",g)})}const h=[...e.querySelectorAll(".reveal")];let v;if(!t.matches&&"IntersectionObserver"in window&&(e.classList.add("motion-ready"),v=new IntersectionObserver(r=>{for(const c of r)c.isIntersecting&&(c.target.classList.add("is-visible"),v?.unobserve(c.target))},{threshold:.12}),h.forEach(r=>v?.observe(r)),o.push(()=>{v?.disconnect(),e.classList.remove("motion-ready")})),!s||!n)return()=>o.forEach(r=>r());const L={ink:"rgba(73,82,66,.38)",oxide:"rgba(184,67,34,.42)"},d=Array.from({length:44},(r,c)=>({x:Math.random(),y:Math.random(),drift:(Math.random()-.5)*35e-6,speed:2e-5+Math.random()*5e-5,size:c%7===0?2:1.1,accent:c%9===0}));let u=0,f=0,p=0,m=0;const b=()=>{const r=s.getBoundingClientRect(),c=Math.min(window.devicePixelRatio||1,1.5);u=r.width,f=r.height,s.width=Math.round(u*c),s.height=Math.round(f*c),n.setTransform(c,0,0,c,0,0),t.matches&&k(0,!0)},k=(r,c=!1)=>{n.clearRect(0,0,u,f);const g=d.map(l=>({x:l.x*u,y:((l.y-(c?0:r*l.speed))%1+1)%1*f}));g.forEach((l,P)=>{for(let O=P+1;O<g.length;O+=1){const S=g[O],F=Math.hypot(S.x-l.x,S.y-l.y);F<112&&(n.strokeStyle=`rgba(91,99,79,${(1-F/112)*.12})`,n.lineWidth=.65,n.beginPath(),n.moveTo(l.x,l.y),n.lineTo(S.x,S.y),n.stroke())}const w=d[P];n.fillStyle=w.accent?L.oxide:L.ink,n.beginPath(),n.arc(l.x,l.y,w.size,0,Math.PI*2),n.fill(),c||(w.x=(w.x+w.drift+1)%1)})},A=r=>{document.hidden||t.matches||(p=requestAnimationFrame(A),!(r-m<40)&&(m=r,k(r)))},x=()=>{cancelAnimationFrame(p),document.hidden||t.matches?k(0,!0):p=requestAnimationFrame(A)},M=()=>x();document.addEventListener("visibilitychange",M),t.addEventListener("change",x);const I=new ResizeObserver(b);return I.observe(s),b(),x(),o.push(()=>{cancelAnimationFrame(p),document.removeEventListener("visibilitychange",M),t.removeEventListener("change",x),I.disconnect()}),()=>o.forEach(r=>r())}function j(){document.documentElement.dataset.theme="dark",document.documentElement.style.colorScheme="dark"}const D=document.querySelector("#app");if(!D)throw new Error("Application root is missing.");const y=D;j();let C=!1,N="";function K(){return window.location.hash.replace(/^#/,"").startsWith("/app")}function X(){const e=window.location.hash;return e===""||e==="#"||e.startsWith("#/")}let E=null;function Z(){document.body.classList.remove("app-mode"),E?.(),y.innerHTML=Y(),document.title="HexForge Studio Pro — Local-first binary forensics",window.scrollTo(0,0);const e=y.querySelector(".landing");e&&(E=V(e))}async function G(){if(document.body.classList.add("app-mode"),E?.(),E=null,document.title="HexForge Studio Pro — Workstation",C){const{remountWorkstation:t}=await T(async()=>{const{remountWorkstation:s}=await import("./main-BnUHX0wX.js").then(n=>n.m);return{remountWorkstation:s}},[],import.meta.url);t(y),_();return}y.innerHTML='<div class="boot-screen"><div class="boot-mark"></div><p>Loading workstation…</p></div>';const{mountWorkstation:e}=await T(async()=>{const{mountWorkstation:t}=await import("./main-BnUHX0wX.js").then(s=>s.m);return{mountWorkstation:t}},[],import.meta.url);C=!0,e(y),_()}function B(){if(!X())return;const e=K()?"app":"landing";e!==N&&(N=e,e==="app"?G():Z())}window.addEventListener("hashchange",B);B();function _(){if(y.querySelector(".app-spotlight"))return;const e=document.createElement("div");e.className="cursor-spotlight app-spotlight",e.setAttribute("aria-hidden","true"),y.append(e);const t=z(e);E=()=>{t(),e.remove()}}export{q as B,T as _};
