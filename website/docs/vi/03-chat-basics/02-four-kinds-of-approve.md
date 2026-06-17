# Bốn loại "approve"

**Phần:** [Cơ bản về chat](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~10 phút

**Mục tiêu:** Phân biệt phê duyệt kế hoạch, ký duyệt tài liệu, rà soát spec, và đóng bình luận.

---

## Vì sao quan trọng

*"Looks good"* hoặc *"approve"* có thể có bốn nghĩa khác nhau. Chọn sai gây nhầm lẫn hoặc bỏ qua bước.

---

## Bốn loại

| Bạn muốn | Nói (ví dụ) | Điều gì xảy ra |
|----------|-------------|----------------|
| **Ký duyệt tài liệu** | *"review documents"*, *"approve srs/01-overview"* | Quy trình rà soát chính thức; có thể cần đủ số người |
| **Phê duyệt spec trích xuất** | *"approve SPEC-001"* | Sau khi tạo SRS; gộp spec vào kiến thức dự án |
| **Thực hiện kế hoạch** | *"yes, go ahead"* sau bảng kế hoạch | Agent bắt đầu viết hoặc sửa file |
| **Đóng luồng bình luận** | *"resolve C-012"*, *"resolve comments"* | Đánh dấu phản hồi đã xử lý |

---

## Bạn nói → Agent làm → Bạn thấy

**Bạn nói:** *"help me approve"*

**Agent làm:** Hiện menu bốn lựa chọn (hoặc hỏi bạn muốn loại nào).

**Bạn thấy:** Không có tài liệu nào được ký duyệt và không có file nào được ghi cho đến khi bạn chọn đúng loại.

---

:::exercise
**Dán vào chat:**

```
help me approve
```

**Bạn nên thấy:**
- Menu phân biệt bốn lựa chọn, **hoặc**
- Agent liệt kê bốn loại và hỏi bạn muốn loại nào
:::

:::roletip
**BA / Tester** — bạn sẽ dùng **ký duyệt tài liệu** và **resolve comments** thường xuyên nhất.
:::

## Nếu có vấn đề

| Triệu chứng | Nói trong chat |
|-------------|----------------|
| Agent phê duyệt quá sớm | Dừng lại và nói loại bạn muốn; rà soát tài liệu chính thức cần bản tóm tắt trước |
| Nhầm SPEC với tài liệu | SPEC = sau khi generate; tài liệu = *"review documents"* |

---

## Tiếp theo

[Thêm hoặc thay đổi yêu cầu](../04-changes/01-add-or-change-requirement.md)
