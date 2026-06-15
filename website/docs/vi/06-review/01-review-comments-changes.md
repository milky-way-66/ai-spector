# Review, comments & thay đổi

**Phần:** [Review & thay đổi](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~15 phút

**Mục tiêu:** Sign-off tài liệu, đóng feedback threads và chỉnh sửa có mục tiêu.

---

## Document review

Sign-off chính thức sau readiness scoring:

```
review documents
```

hoặc *"review srs/01-overview"*, *"what needs review"*, *"pending client approval"*.

Flow: queue → agent đọc doc + checklists + graph impact → tóm tắt → bạn **approve** / **request changes** / **dismiss**.

Custom checklists: JSON trong `.ai-spector/.docflow/config/review-checklists/`.

---

## Comment threads

Feedback không chính thức trên từng section:

```
resolve comments
show open comments
resolve C-001
add a comment to srs.md: missing forgot-password flow
```

Lưu trong `.ai-spector/comments/` — commit cùng repo.

---

## Thay đổi tăng dần

Thêm hoặc cập nhật một feature mà không regenerate toàn bộ SRS:

```
I want to add login with Google
```

Dùng **resolve-task**: clarify → plan → approve plan → chỉnh sửa có mục tiêu → index.

---

## Phần tiếp theo

[Nâng cao](../07-advanced/README.md) *(tùy chọn)*
