# Rà soát và ký duyệt tài liệu

**Phần:** [Rà soát](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~15 phút

**Mục tiêu:** Rà soát và ký duyệt tài liệu chính thức — khác với bình luận hay phê duyệt spec.

---

## Nói đơn giản

Khi tài liệu sẵn sàng phê duyệt, bạn chạy **quy trình rà soát**. Agent đọc tài liệu, kiểm tra mức độ sẵn sàng, tóm tắt phát hiện trong chat, và chỉ sau đó mới cho bạn phê duyệt hoặc yêu cầu sửa.

Đây là **ký duyệt chính thức** — khác với *"yes, go ahead"* trên kế hoạch tạo tài liệu.

---

## Bạn nói → Agent làm → Bạn thấy

**Bạn nói:** *"review documents"*

**Agent làm:** Mở hàng đợi rà soát, cho bạn chọn tài liệu, viết tóm tắt rà soát trong chat.

**Bạn thấy:**
- Điểm sẵn sàng và kết quả checklist
- Bản rà soát viết trong chat (không phải phê duyệt im lặng)
- Menu quyết định: Approve / Request changes / Skip

Bạn cũng có thể chỉ tên tài liệu: *"review srs/01-overview"*

---

:::exercise
**Dán vào chat:**

```
review documents
```

**Bạn nên thấy:**
- Hàng đợi rà soát hoặc bộ chọn tài liệu
- Agent đọc tài liệu và viết phát hiện trước khi hỏi quyết định của bạn
:::

:::roletip
**BA / Tester** — đây là quy trình hàng ngày cốt lõi cho cổng chất lượng.
:::

## Nếu có vấn đề

| Triệu chứng | Nói trong chat |
|-------------|----------------|
| Agent phê duyệt không có bản rà soát | Nói *"write the review first"* — ký duyệt chính thức cần tóm tắt |
| Sai tài liệu | Chỉ đường dẫn: *"review srs/01-overview"* |
| Nhầm với phê duyệt SPEC | Ký duyệt tài liệu = bài học này; SPEC = sau khi generate |

---

## Tiếp theo

[Xử lý bình luận](02-resolve-comments.md)
