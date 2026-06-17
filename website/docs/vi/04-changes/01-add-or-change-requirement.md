# Thêm hoặc sửa yêu cầu

**Phần:** [Sửa yêu cầu](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~10 phút

**Học xong sẽ biết:** Thêm / sửa một phần nhỏ mà không phải tạo lại toàn bộ SRS.

---

## Tóm lại

Chỉ cần sửa **một mảng nhỏ** — thêm đăng nhập Google, sửa một màn hình, bổ sung một yêu cầu — thì nói thẳng ra. AI lên kế hoạch, chờ bạn OK, rồi chỉ sửa chỗ cần.

Đây **không** phải lệnh “viết lại cả bộ tài liệu”.

---

## Ví dụ thực tế

**Bạn nhắn:** *"I want to add login with Google"*

**AI làm:** Hỏi rõ phạm vi → đưa kế hoạch → chờ đồng ý → sửa đúng file.

**Bạn thấy:**
- Vài câu hỏi (lần sau AI nhớ câu trả lời)
- Bảng kế hoạch — trả lời *"yes, go ahead"* mới bắt đầu sửa
- File chỉ đổi **sau** khi bạn đồng ý

---

:::exercise
**Copy câu này vào chat (tiếng Anh):**

```
I want to add login with Google
```

**Kết quả mong đợi:**
- AI coi đây là sửa nhỏ (không chạy generate SRS cả cục)
- Có bảng kế hoạch trước khi ghi file
:::

:::roletip
**BA** — cách này dùng hằng ngày khi cập nhật yêu cầu.
:::

## Gặp lỗi?

| Tình huống | Nhắn trong chat |
|------------|-----------------|
| AI đòi tạo lại cả SRS | *"one feature only"* hoặc *"incremental change"* |
| File đã sửa trước khi bạn OK | *"pause task"* |

---

## Bài tiếp

[Tạo SRS](../05-generate/01-generate-srs.md)
