# Sources & analyze

**Phần:** [Graph & sources](README.md) · **Thời gian:** ~10 phút

**Mục tiêu:** Thêm nguồn và analyze vào graph.

---

## Thêm sources

Copy file vào `docs/data-source/` — `.md`, `.txt`, `.pdf` (text chọn được).

Meeting notes, user stories, BRD, API docs. Agent đọc, không sửa.

```bash
ls docs/data-source/   # ít nhất 1 file
```

---

## Analyze

```
analyze my data source
```

Trích xuất actors, use cases, features → `.ai-spector/graph/traceability.graph.json`. Thiếu gì thì bổ sung nguồn và analyze lại.

---

## Check

```
validate the graph
```

Không có lỗi critical. Warnings ở giai đoạn này OK.

---

## Tiếp theo

[Validate & explore](02-validate-index-explore.md)
