# Comment threads

**Phần:** [Review](README.md) · **Thời gian:** ~10 phút · **Trước:** [Document review](01-document-review.md)

**Mục tiêu:** Xử lý feedback thread — không phải sign-off document.

Skill: **`ai-spector-resolve-comments`**

---

## Bắt đầu

```
resolve comments
```

hoặc *"show open comments"*, *"resolve C-012"*.

---

## Flow

1. `git pull`
2. **Inbox** — bảng thread (C-NNN, file, đoạn trích).
3. Chọn thread → agent lên plan.
4. Sửa doc → **một commit**: doc + comment meta.
5. `comments_resolve` — đóng thread.

---

## Bạn sẽ thấy gì

- Bảng inbox với **C-001**, **C-012**, …
- Plan trước khi sửa.
- Commit gồm doc + `.ai-spector/comments/`.
- Thread biến mất sau resolve.

**Thêm comment:**

```
add a comment to srs.md: missing forgot-password flow
```

---

## Không phải comments

| Ý bạn | Dùng |
|-------|------|
| Approve srs/01-overview | [Document review](01-document-review.md) |
| Thêm feature SRS | [Incremental changes](../02-chat-basics/03-incremental-changes.md) |

---

## Troubleshooting

| Triệu chứng | Cách xử lý |
|-------------|------------|
| Resolve không kèm sửa doc | Commit phải có doc + meta |
| Không thấy thread | `git pull`; kiểm tra `.ai-spector/comments/` |

---

## Tiếp theo

[Nâng cao](../07-advanced/README.md)
