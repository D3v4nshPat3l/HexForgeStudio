# Contributing to HexForge Studio Pro

Thank you for helping improve the project.

## Development setup

```bash
npm ci
npm run dev
```

Before opening a pull request, run:

```bash
npm run typecheck
npm test
npm run build
```

## Contribution guidelines

1. Keep file analysis local-first and privacy-preserving.
2. Avoid copying proprietary signature databases or code from commercial tools.
3. Add tests for parsers, search algorithms, byte editing, and report generation.
4. Use bounded, chunked processing for large files; avoid spreading large byte arrays into function arguments.
5. Preserve accessible keyboard navigation and visible scrollbars.
6. Do not commit confidential binary samples. Use small synthetic fixtures where possible.
7. Explain forensic limitations and confidence rather than presenting guesses as facts.

## Pull requests

Keep pull requests focused. Include reproduction steps, tests, and screenshots for interface changes. Breaking behavior should be documented in `CHANGELOG.md`.
