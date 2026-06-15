# Document review & sign-off

**Phần:** [Review](README.md) · **Thời gian:** ~15 phút

**Mục tiêu:** Sign-off document sau readiness — không phải comments hay specs.

Skill: **`ai-spector-review`**

---

## Bắt đầu

```
review documents
```

hoặc *"review srs/01-overview"*, *"what needs review"*.

---

## Flow

1. **Queue** — bảng doc chờ review; bạn chọn.
2. **Readiness** — scan + checklist + custom checklists.
3. **Graph impact** — doc downstream có thể cần cập nhật.
4. **Tóm tắt review** trong chat.
5. Bạn quyết định: Approve / Request changes / Dismiss.
6. Chỉ khi **Approve** → `review_approve`.

---

## Bạn sẽ thấy gì

- Bảng `review_queue` với path (`srs/01-overview`, …).
- Điểm readiness và checklist trong summary.
- Agent **không** `review_approve` trước khi bạn đọc summary và approve.
- Sau approve: status cập nhật trong `.ai-spector/.docflow/review-queue/`.

**Custom checklist:** JSON trong `.ai-spector/.docflow/config/review-checklists/`.

---

## Không phải document review

| Ý bạn | Dùng |
|-------|------|
| Approve SPEC-001 | *"approve SPEC-001"* |
| Đồng ý plan | *"yes, go ahead"* |
| Đóng comment C-012 | [Comment threads](02-comment-threads.md) |

---

## Troubleshooting

| Triệu chứng | Cách xử lý |
|-------------|------------|
| Approve không qua summary | Nhắc chạy đủ runbook |
| *"continue"* sai workflow | Review session đang active — nói rõ doc |
| Nhầm với comments | Sign-off = path + readiness; comments = C-NNN |

---

## Tiếp theo

[Comment threads](02-comment-threads.md)
