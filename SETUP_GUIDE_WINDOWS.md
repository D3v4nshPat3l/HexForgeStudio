# HexForge Studio Pro 2.1 — Complete Windows Setup

## 1. Required folder

Create this folder:

```text
D:\Hex Forge Studio
```

Extract every file from the ZIP directly into that folder. `package.json`, `src`, `public`, and `index.html` must be directly inside `D:\Hex Forge Studio`.

Correct structure:

```text
D:\Hex Forge Studio
├── package.json
├── package-lock.json
├── index.html
├── START_HEXFORGE.bat
├── src
├── public
└── dist
```

## 2. Install Node.js

Install the current Node.js LTS or a newer supported release. During installation keep npm and Add to PATH enabled.

Close every Command Prompt window after installation, then open a new one.

Verify:

```bat
node --version
npm --version
where node
where npm
```

## 3. Open the project folder

```bat
cd /d "D:\Hex Forge Studio"
dir package.json
```

`dir package.json` must show the file.

## 4. Force the public npm registry

```bat
npm config set registry https://registry.npmjs.org/
npm config delete proxy
npm config delete https-proxy
npm config get registry
npm ping
```

The registry command should print:

```text
https://registry.npmjs.org/
```

`npm ping` should finish with `PONG`.

## 5. Install dependencies

```bat
npm install --no-audit --no-fund
```

The first installation downloads the required packages and creates `node_modules`.

## 6. Start the application

```bat
npm run dev
```

Open the Local address shown by Vite, normally:

```text
http://localhost:5173
```

Keep the Command Prompt window open while using the application.

## 7. Stop it

In the Command Prompt window press:

```text
Ctrl+C
```

## 8. Start it later

```bat
cd /d "D:\Hex Forge Studio"
npm run dev
```

You normally do not need to run `npm install` again.

## 9. One-click start

Double-click:

```text
D:\Hex Forge Studio\START_HEXFORGE.bat
```

The batch file checks for Node.js, installs dependencies when missing, and starts the development server.

## 10. Verify and build

```bat
cd /d "D:\Hex Forge Studio"
npm run typecheck
npm test
npm run build
npm run preview
```

The compiled production website is placed in:

```text
D:\Hex Forge Studio\dist
```

## 11. Common problems

### npm is not recognized

Install Node.js, close Command Prompt, open a new Command Prompt, and verify `node --version` and `npm --version`.

### npm tries an internal or unavailable registry

Run:

```bat
cd /d "D:\Hex Forge Studio"
del package-lock.json
if exist node_modules rmdir /s /q node_modules
npm config set registry https://registry.npmjs.org/
npm install --no-audit --no-fund
```

The provided ZIP already contains a public-registry lock file, so this should only be necessary if another file replaced it.

### ETIMEDOUT

Check the connection:

```bat
npm ping --registry=https://registry.npmjs.org/
npm config get proxy
npm config get https-proxy
```

Disable a blocking VPN/proxy or allow Node.js through the firewall, then retry:

```bat
npm install --registry=https://registry.npmjs.org/ --no-audit --no-fund
```

### Blank browser page

Do not double-click `index.html`. Use `npm run dev` and open the URL shown by Vite.

### Port 5173 is busy

```bat
npm run dev -- --port 5180
```

Then open `http://localhost:5180`.


## 12. Hex editor scrolling in version 2.1

After opening a file, use the vertical scrollbar on the right edge of the central hex grid to move through the entire file continuously. The thin high-contrast horizontal scrollbar immediately below the OFFSET/byte/TEXT header moves the byte columns left and right. OFFSET remains pinned on the left and TEXT remains pinned on the right.

The left-side Previous and Next buttons are jump controls. They are not required to reach the rest of the file.
