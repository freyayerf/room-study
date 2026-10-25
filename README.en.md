# Room Study

[中文](README.md) · [Use online](https://freyayerf.github.io/room-study/) · [Offline downloads](https://github.com/freyayerf/room-study/releases/latest)

A local-first 2D room measurement and furniture planner. Enter known measurements, derive missing spans, arrange furniture, and save alternatives. No sign-in, backend, API keys, or runtime dependencies. MIT licensed.

![Room Study example](docs/preview.png)

## Get started

Open the online planner, or download the standalone HTML from Releases and double-click it. The ZIP also includes documentation and synthetic example plans. Ordinary users do not need Node.js.

For development, use Node.js 22 or a newer LTS release:

```sh
git clone git@github.com:freyayerf/room-study.git
cd room-study
npm ci
npm run dev
```

Open `http://127.0.0.1:4173`. Choose Rectangle, L-shaped room, or Recess + entrance. Enter measured dimensions and leave unknown ones blank. Select furniture to edit width, depth and coordinates; drag, rotate or lock it. Bathroom and sink are optional under Features.

## Features and limits

Centimeters, meters and feet/inches share centimeter-based internal values. Unmeasured dimensions are visibly approximate. Determinable dimensions are calculated and conflicting measurements are reported. Furniture supports 90° rotation, 1 cm / 10 cm keyboard nudging, overlap and boundary warnings, and undo/redo. Save named alternatives, back up JSON, import legacy v1 files, or export complete SVG drawings independently of viewport zoom.

The current release supports three orthogonal templates. It does not support arbitrary polygons, connected rooms, diagonal walls, wall thickness, door-swing clearance, 3D or building-code checks. Display rounding does not change stored values; overlap detection uses a 1 mm tolerance. SVG output is not a certified physical print scale. Furniture positions are relative to room width/depth, while measured furniture sizes remain absolute when the room changes.

Plan content stays in the current browser's `localStorage`; there is no synchronization. Static hosts still receive normal page requests. The standalone build makes no network requests. Export JSON before clearing browser storage or moving devices. Storage denial is handled without blocking editing/export. Limits: 100 furniture pieces per plan, 1000 saved layouts, 25 MB per imported file. Only generic code and synthetic examples are published.

## Development and releases

```sh
npm test
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
npm run release:check
```

Source is split into geometry (`engine.js`), validation/units (`model.js`), storage (`layout-store.js`), UI (`app.js`) and styles. Build output is a self-contained `dist/index.html` plus help and examples, suitable for static hosting under any subpath. Playwright covers Chromium, Firefox, WebKit and a mobile viewport. CI validates pull requests; verified main-branch pushes deploy Pages; version tags produce tested HTML/ZIP artifacts and SHA-256 checksums.

Read the [release runbook](docs/RELEASING.md), [architecture](docs/ARCHITECTURE.md), [file format](docs/DATA_FORMAT.md), [contribution guide](CONTRIBUTING.md), and [MIT license](LICENSE).
