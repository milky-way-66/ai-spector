# Validate & explore

**Phần:** [Graph & sources](README.md) · **Trước:** [Sources & analyze](01-sources-and-analyze.md)  
**Thời gian:** ~10 phút

**Mục tiêu:** Fix graph, refresh index, xem impact.

---

## Validate

```
validate the graph
```

Fix hết **errors** trước khi generate. **Warnings** = phần cần xem lại.

| Vấn đề | Fix |
|--------|-----|
| Thiếu actors | Bổ sung nguồn → re-analyze |
| Sai dự án | Xóa file thừa trong `docs/data-source/` |

---

## Index

Sau khi sửa doc hoặc graph:

```
refresh the index
```

---

## Explore *(tùy chọn)*

```
show the graph
what's impacted by my changes
```

CLI: `npx ai-spector graph visualize --open`

---

## Tiếp theo

[Generate](../04-generate/README.md)
