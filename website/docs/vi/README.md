---
sidebar_position: 1
---

# Khóa học AI Spector

Workflow tài liệu trong **Cursor** hoặc **Claude Code**: graph, SRS, basic design, prototype. **Mô tả trong chat** là đủ.

`npx ai-spector course serve --open --lang vi` · `/course/vi/`

**Trong chat:** *"mở khóa học ai-spector"* · *"hướng dẫn tôi dùng ai-spector"*

---

## Cấu trúc

**7 phần, 13 bài** — mỗi bài ~10–15 phút, một task rõ ràng.

| Phần | Bài | Nội dung |
|------|-----|----------|
| [Bắt đầu](01-get-started/README.md) | 2 | Init, setup, skills |
| [Chat cơ bản](02-chat-basics/README.md) | 2 | Routing, workspace, tasks |
| [Graph & sources](03-graph/README.md) | 2 | Analyze, validate, index |
| [Generate](04-generate/README.md) | 2 | SRS + basic design |
| [Prototype](05-prototype/README.md) | 2 | Translations, UI mockup |
| [Review](06-review/README.md) | 1 | Approve, comments, chỉnh sửa |
| [Nâng cao](07-advanced/README.md) | 2 | Templates, search, editors |

---

## Pipeline

```text
docs/data-source/ → analyze → validate → generate SRS → basic design → prototype → review
```

Mỗi lần generate: check workspace → clarify → approve plan → waves → review specs.

---

## Lộ trình nhanh

| Mục tiêu | Lộ trình |
|----------|----------|
| Dự án đầu tiên | Bắt đầu → Chat → Graph → Generate |
| Đầy đủ | + Prototype → Review |
| Đa ngôn ngữ | [Translations](05-prototype/01-translations.md) sau SRS |
| SRS custom | [Custom templates](07-advanced/01-custom-templates.md) trước Graph |

---

## Tiếp theo

[Bắt đầu](01-get-started/README.md)
