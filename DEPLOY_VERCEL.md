# Deploying HexForge Studio to Vercel

The application is a static client-side bundle. Vercel runs `npm run build` and serves
`dist/` — there is no server, no database, and no environment variables to configure.

Everything Vercel needs is already committed: `vercel.json`, `.vercelignore`, and a
build that outputs to `dist/`.

---

## Option A — GitHub import (recommended)

Automatic redeploys on every push.

1. Go to **https://vercel.com/new**
2. Sign in with GitHub and authorise Vercel if prompted
3. Find **`D3v4nshPat3l/HexForgeStudio`** and click **Import**
4. Leave every setting at its default. Vercel reads `vercel.json` and detects Vite:

   | Setting | Value (auto-filled) |
   |---|---|
   | Framework Preset | Vite |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Install Command | `npm install` |
   | Root Directory | `./` |

5. Click **Deploy**

First build takes roughly 40–60 seconds. You get a URL like
`https://hexforgestudio.vercel.app`.

Every later `git push` to `main` redeploys automatically. Pull requests get their own
preview URLs.

---

## Option B — Vercel CLI

Deploy straight from this folder, no GitHub involved.

```bash
npm i -g vercel
```

```bash
vercel login
```

Then from the project root:

```bash
vercel
```

Answer the prompts (accept the defaults — it detects Vite). That publishes a preview.
When it looks right, publish to production:

```bash
vercel --prod
```

---

## Verifying the deployment

Once it is live, check these four things. The first two have broken before.

1. **Open the URL** — the landing page appears with the animated background.
2. **Click "Launch Workstation"** — the URL becomes `…/#/app` and the workstation loads.
3. **Open any file and wait for analysis to finish.** If it hangs on
   "Preparing analysis 0%", the Web Worker failed to load. Check the browser console
   for a MIME-type error. Vercel serves `.js` correctly, so this should not recur.
4. **Click a byte in the hex view** — the inline editor opens beneath the row.

---

## Custom domain

**Project → Settings → Domains → Add**, then point your registrar at Vercel:

- Apex domain (`example.com`): `A` record → `76.76.21.21`
- Subdomain (`hex.example.com`): `CNAME` → `cname.vercel-dns.com`

DNS usually propagates within minutes. TLS is issued automatically.

---

## What is not deployed

`.vercelignore` excludes the Python launcher (`run.py`, `launcher/`, `start.bat`,
`start.sh`, `requirements.txt`). Those exist so the project runs offline on a local
machine; Vercel serves the built output directly and does not need them.

The repository keeps a prebuilt `dist/` tracked so anyone who downloads the source can
run it with Python alone, without a Node toolchain. Vercel rebuilds from source
regardless, so the tracked copy never goes stale on the deployed site.

---

## Source maps

Disabled by default. They would publish the complete TypeScript source of an
all-rights-reserved project. To build with them locally for debugging:

```bash
SOURCEMAP=1 npm run build
```

Never set `SOURCEMAP` as an environment variable in the Vercel project unless you
intend the source to be public.

---

## Cost

This project fits comfortably in Vercel's free Hobby tier: static output, no
serverless functions, no bandwidth-heavy assets. The largest chunk is about 500 KB.

Note that the Hobby tier is for non-commercial use. If you sell access or use it
commercially, Vercel requires a Pro plan.
