# Architecture

Room Study uses browser-native HTML, CSS, SVG and JavaScript. No framework or production library is required. Classic deferred scripts support direct `file://` use after building; the engine, model and store also expose CommonJS exports for Node's built-in test runner.

## Modules

- `engine.js`: template definitions, Gaussian elimination for measurement constraints, illustrative geometry completion, orthogonal polygons, concavity-aware containment and axis-aligned overlaps.
- `model.js`: fresh independent state, legacy migration, bounded import normalization, centimeters/meters/feet formatting and parsing.
- `layout-store.js`: injected storage interface, canonical signatures, saved layout validation, deduplicating imports and pre-restore backups. A failed `setItem` propagates to UI error handling.
- `app.js`: one draft state, bounded undo snapshots, SVG rendering, pointer and keyboard handling, inspector, browser storage and download flows.
- `styles.css`: desktop panels, stacked mobile layout, focus indicators and SVG drawing styles. System font fallback enables offline use.

## Coordinate contract

Every stored length (`known`, `fixtures`, item `w`/`d`) is centimeters, independent of displayed units. Item `x` and `y` are ratios of main room width and depth. `bw`/`bd` are fallback sketch proportions relative to a 600-unit-wide room. Rotation swaps bounding width/depth at 90°/270°; dimensions always refer to the original orientation. Moving/resizing a room therefore changes relative furniture coordinates but not measured sizes.

The renderer uses a 600-unit normalized drawing width and SVG viewBox fitting. Pointer deltas are converted back through the SVG screen matrix and room scale. Export resets the viewBox to the entire outline, so zooming the UI cannot crop the output.

## Measurement contract

Solver values contain only known and uniquely determined dimensions. The separate `geometry` function supplies proportional placeholders for display, never promotes them to measured state, and preserves template closure when possible. Conflicts suppress derived values. Exact area is shown only when its required measurements are known and valid. Numeric floating point is retained in storage; display rounds to two decimals or tenths of an inch. Overlap ignores at most 0.1 cm, allowing edge contact.

## Persistence and recovery

`room-study-plan-v1` stores the draft, and `room-study-layouts-v1` stores named copies. Plan `version` remains 1; absent `shape` means the legacy study shape. Optional features omitted by old files are migrated from legacy fixture measurements. Disabled browser storage is accessed through a lazy adapter, so reading `localStorage` cannot break initialization. Switching named plans stores an unsaved draft first if no identical copy exists. JSON export is the cross-browser backup mechanism.

Limits apply on reads and writes. Storage quotas can still be lower than the structural limits. No server, syncing or multi-tab draft conflict resolution is provided; library changes in other tabs refresh status, but simultaneous draft writes use last-writer-wins behavior.

## Build and test

The dependency-free build inlines all source and styles into one HTML document and copies distributable help/examples. The ZIP writer uses stored ZIP entries with CRC-32 and stable timestamps; SHA-256 checksums identify release artifacts. Source remains readable and formatted. Tests exercise calculations and legacy data separately from browser workflows; Playwright runs against the actual built artifact, including a direct disk-open test.
