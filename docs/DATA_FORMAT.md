# Plan data format

See `plan.schema.json` for the version-1 shape. Use **Import a plan** to load a plan or a library bundle; export JSON for backups. Examples are synthetic and use centimeters regardless of their selected display unit.

| Field              | Meaning                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `version`          | `1`                                                                                                              |
| `shape`            | `rectangle`, `l`, `study`; absent means legacy `study`                                                           |
| `unit`             | Display/input unit: `cm`, `m`, `ft`                                                                              |
| `known`            | Positive finite wall dimensions in centimeters, up to 1,000,000; only keys in the selected template are retained |
| `fixtures`         | Optional nonnegative legacy feature lengths or left-wall window offset `WO` and length `WL`                      |
| `bathroom`, `sink` | Optional feature records; `enabled: false` hides them; old files are migrated when missing                       |
| `items`            | At most 100 furniture records, with unique IDs                                                                   |

Furniture has `id`, `name`, `type`, six-digit hex `color`, normalized `x`/`y`, positive fallback `bw`/`bd`, measured `w`/`d` or `null`, rotation `0/90/180/270`, and a `locked` flag. Generic furniture types are `bed`, `table`, `sofa`, `wardrobe`, `tv`. Feature records use `bathroom` or `sink`. Coordinates outside the room are permitted within bounded numeric limits, because out-of-bounds placement is a warning rather than a destructive automatic correction.

Legacy mappings: `TW`/`TD` → bathroom width/depth; `SW`/`SD`/`SY` → sink size/offset. New exports include explicit feature records. Unknown extra properties are discarded during import. Invalid furniture records, duplicate IDs and unknown versions are rejected before replacing the current draft.

A library bundle is `{ "format": "room-study-library", "version": 1, "plans": [...] }`. Each entry has `id`, `name`, ISO `createdAt`, and plan `data`. Imports merge, skip identical entries, and assign new IDs to conflicting entries. The library has a limit of 1000 entries. Draft and library files are limited to 25 MB by the UI.
