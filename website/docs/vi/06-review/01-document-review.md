# Duyệt tài liệu

**Phần:** [Kiểm tra & phê duyệt](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~15 phút

**Học xong sẽ biết:** Review và phê duyệt tài liệu — khác với xử lý comment hay duyệt SPEC.

---

## Tóm lại

Tài liệu sẵn sàng duyệt thì chạy **quy trình review**. AI đọc bài, chấm mức độ đạt, tóm tắt nhận xét trong chat, rồi mới hỏi bạn: duyệt, yêu cầu sửa, hay bỏ qua.

Đây là **phê duyệt chính thức** — khác với *"yes, go ahead"* lúc đồng ý kế hoạch viết.

---

## Ví dụ thực tế

**Bạn nhắn:** *"review documents"*

**AI làm:** Mở danh sách chờ duyệt → bạn chọn bài → viết nhận xét trong chat.

**Bạn thấy:**
- Điểm / checklist đạt hay chưa
- Bản tóm tắt review (không im lặng bấm duyệt)
- Menu: Duyệt / Yêu cầu sửa / Bỏ qua

Chỉ định thẳng một file: *"review srs/01-overview"*

---

:::exercise
**Copy câu này vào chat (tiếng Anh):**

```
review documents
```

**Kết quả mong đợi:**
- Danh sách tài liệu chờ duyệt
- AI đọc và viết nhận xét **trước** khi hỏi quyết định
:::

:::roletip
**BA / Kiểm thử** — việc này làm hằng ngày để chốt chất lượng tài liệu.
:::

## Gặp lỗi?

| Tình huống | Nhắn trong chat |
|------------|-----------------|
| AI duyệt mà chưa review | *"write the review first"* |
| Sai tài liệu | *"review srs/01-overview"* |
| Nhầm với duyệt SPEC | Duyệt tài liệu = bài này · SPEC = sau khi generate |

---

## Bài tiếp

[Xử lý góp ý](02-resolve-comments.md)
