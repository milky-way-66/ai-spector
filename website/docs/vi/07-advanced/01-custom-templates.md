# Custom template packs

**Phần:** [Nâng cao](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~10 phút · **Tùy chọn**

**Mục tiêu:** Dùng layout tài liệu của team thay vì builtin templates.

---

## Config & chat

`.ai-spector/docflow.config.json`:

```json
"packs": { "srs": "my-team-srs", "basicDesign": "builtin" }
```

```
set up template pack
template list
generate my-team-srs
```

Bật skill `ai-spector-template-import` để import. Tham khảo chi tiết: [Multi-template pack structure](../../../plan/multi-template-structure.md).

---

## Tiếp theo

[Semantic search & editor thứ hai](02-search-and-editors.md)
