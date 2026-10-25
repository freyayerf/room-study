# Contributing

Use issues to report bugs or discuss a proposed change. Include browser/OS, reproduction steps, expected behavior and a minimal **synthetic** plan if necessary. Never attach a real home layout without checking what it reveals.

Use Node.js 22 or a newer LTS version. Run `npm ci`, `npx playwright install chromium firefox webkit`, then `npm run dev`. Keep geometry independent of DOM/storage. Add regression tests for changed solver behavior, imported data and user-visible workflows.

Before opening a pull request:

```sh
npm run format
npm run release:check
```

All checks should pass. Explain what changes for the user and how you verified it. Do not commit generated `dist/`, `release/`, dependency folders, personal plans, tokens or keys. Examples must be fabricated. Preserve legacy version-1 imports; introduce a documented migration for incompatible changes.

Contributions are distributed under the repository's MIT license. Do not include images, fonts or code whose license is incompatible or unknown.
