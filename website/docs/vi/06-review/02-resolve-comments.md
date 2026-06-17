# Xử lý bình luận

**Phần:** [Rà soát](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~10 phút

**Mục tiêu:** Xử lý các luồng bình luận phản hồi trên tài liệu.

---

## Nói đơn giản

Người rà soát để lại **luồng bình luận** (ví dụ C-001) trên tài liệu. Khi bạn đã xử lý phản hồi, nhờ agent resolve comments. Đây **không** phải ký duyệt tài liệu chính thức.

---

## Bạn nói → Agent làm → Bạn thấy

**Bạn nói:** *"resolve comments"*

**Agent làm:** Hiện luồng bình luận đang mở, lập kế hoạch sửa, chỉnh tài liệu, đánh dấu luồng đã xong.

**Bạn thấy:**
- Hộp thư bình luận đang mở
- Đề xuất chỉnh sửa trước khi commit
- Luồng được đánh dấu đã resolve khi hoàn tất

---

:::exercise
**Dán vào chat:**

```
resolve comments
```

**Bạn nên thấy:**
- Danh sách luồng bình luận đang mở, **hoặc**
- Agent báo không có bình luận mở nếu hộp thư trống
:::

:::roletip
**Tester** — dùng sau vòng rà soát kiểm thử; **BA** — sau phản hồi stakeholder.
:::

## Nếu có vấn đề

| Triệu chứng | Nói trong chat |
|-------------|----------------|
| Luồng không đóng | Đảm bảo tài liệu và metadata bình luận được cập nhật cùng nhau |
| Nhầm với phê duyệt tài liệu | Bình luận = *"resolve C-012"*; ký duyệt = *"review documents"* |

---

## Tiếp theo

[Tác vụ và workspace](../07-everyday/01-tasks-and-workspace.md)
