# Graph → Detail Design feature list

```bash
npx ai-spector graph query doc.srs.4-system-features --direction both --depth 2 --json
npx ai-spector graph query F-01 --direction both --depth 2 --json   # repeat per feature
```

| Template section | Graph source |
|------------------|--------------|
| §1 List of Features table | All `F-xx` domain nodes + titles from SRS feature detail or list chapter |
| Feature ID column | Stable `F-01`, `F-02`, … from graph |
| SRS Reference | `satisfies` / `tracesTo` from F-xx to SRS sections |
| Detail doc link | `features/f-{nn}-{slug}.md` — slug from feature title |

**After writing:** run `npx ai-spector index` before wave 2 (`dd.feature-details`). Wave 2 expands rows from this table.

**Rule:** Every `F-xx` in the graph with approved SRS detail should appear in §1 unless explicitly out of scope (document in clarify).
