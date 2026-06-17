# Bốn kiểu “đồng ý”

**Phần:** [Dùng chat](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~10 phút

**Học xong sẽ biết:** Phân biệt đồng ý kế hoạch, duyệt tài liệu, duyệt spec và đóng góp ý.

---

## Vì sao cần biết?

*"Ổn rồi"* hay *"approve"* có thể hiểu theo **4 cách khác nhau**. Nhầm thì dễ bỏ sót bước hoặc duyệt nhầm.

---

## Bốn kiểu

| Ý bạn | Nhắn (ví dụ) | Chuyện gì xảy ra |
|-------|--------------|------------------|
| **Duyệt tài liệu chính thức** | *"review documents"*, *"approve srs/01-overview"* | Quy trình review; có thể cần đủ số người duyệt |
| **Duyệt mục SPEC** | *"approve SPEC-001"* | Sau khi tạo SRS; đưa spec vào dự án |
| **Cho phép AI làm theo kế hoạch** | *"yes, go ahead"* (sau bảng kế hoạch) | AI bắt đầu viết / sửa file |
| **Đóng một góp ý** | *"resolve C-012"*, *"resolve comments"* | Đánh dấu góp ý đã xử lý xong |

---

## Ví dụ thực tế

**Bạn nhắn:** *"help me approve"*

**AI làm:** Hiện 4 lựa chọn (hoặc hỏi bạn chọn kiểu nào).

**Bạn thấy:** Chưa có tài liệu nào được duyệt cho đến khi bạn chọn đúng.

---

:::exercise
**Copy câu này vào chat (tiếng Anh):**

```
help me approve
```

**Kết quả mong đợi:**
- Menu 4 lựa chọn, **hoặc**
- AI liệt kê 4 kiểu và hỏi bạn muốn kiểu nào
:::

:::roletip
**BA / Kiểm thử** — thường dùng **duyệt tài liệu** và **resolve comments** nhất.
:::

## Gặp lỗi?

| Tình huống | Nhắn trong chat |
|------------|-----------------|
| AI duyệt quá sớm | Dừng lại, nói rõ kiểu bạn muốn; duyệt tài liệu phải có bản tóm tắt review trước |
| Nhầm SPEC với duyệt tài liệu | SPEC = sau khi generate; duyệt tài liệu = *"review documents"* |

---

## Bài tiếp

[Thêm hoặc sửa yêu cầu](../04-changes/01-add-or-change-requirement.md)
