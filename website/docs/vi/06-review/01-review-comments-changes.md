# Review, comments & changes

**Phần:** [Review](README.md) · **Thời gian:** ~15 phút

**Mục tiêu:** Approve docs, đóng comments, chỉnh sửa có mục tiêu.

---

## Document review

```
review documents
```

Hoặc *"review srs/01-overview"*, *"what needs review"*.

Flow: queue → agent đọc doc + checklist + impact → bạn **approve** / **request changes**.

Checklist custom: `.ai-spector/.docflow/config/review-checklists/`

---

## Comments

```
resolve comments
show open comments
resolve C-001
add a comment to srs.md: missing forgot-password flow
```

Lưu tại `.ai-spector/comments/`

---

## Incremental changes

Thêm feature không regenerate cả SRS:

```
I want to add login with Google
```

Dùng **resolve-task**: clarify → plan → approve → edit → index.

---

## Tiếp theo

[Nâng cao](../07-advanced/README.md)
