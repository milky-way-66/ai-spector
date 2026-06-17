# Tạo SRS

**Phần:** [Viết tài liệu](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~15 phút

**Học xong sẽ biết:** Chạy quy trình SRS — hỏi đáp, kế hoạch, đồng ý, rồi mới viết.

---

## Tóm lại

Viết SRS là **chat có hướng dẫn**. AI kiểm tra dự án, hỏi thông tin còn thiếu, cho biết nguồn nào dùng để viết, đưa kế hoạch, rồi **chờ bạn đồng ý** trước khi tạo file trong `docs/srs/`.

---

## Các bước (đơn giản)

1. **Kiểm tra** — dự án sẵn sàng chưa
2. **Hỏi thêm** — AI hỏi, câu trả lời được lưu lại
3. **Giải thích nguồn** — tài liệu / chủ đề nào ảnh hưởng SRS
4. **Kế hoạch** — bảng chương / đợt viết
5. **Bạn OK** — *"yes, go ahead"* (đồng ý **kế hoạch**, chưa phải duyệt tài liệu)
6. **Viết** — file xuất hiện từng đợt
7. **Duyệt SPEC** (nếu có) — chấp nhận hoặc từ chối từng SPEC

---

## Ví dụ thực tế

**Bạn nhắn:** *"generate the SRS"*

**AI làm:** Tạo task và chạy các bước trên.

**Bạn thấy:** Chưa có file `docs/srs/` cho đến khi bạn đồng ý kế hoạch.

---

:::exercise
**Copy câu này vào chat (tiếng Anh):**

```
generate the SRS
```

**Kết quả mong đợi:**
- AI kiểm tra dự án và hỏi thêm
- Có bảng kế hoạch — AI **dừng chờ** bạn
- (Khi chạy thật và bạn OK) file trong `docs/srs/`
:::

:::roletip
**BA** — trả lời câu hỏi của AI cho đúng; AI dùng lại câu trả lời các lần sau.
:::

## Gặp lỗi?

| Tình huống | Nhắn trong chat |
|------------|-----------------|
| File đã có trước khi bạn OK kế hoạch | *"pause task"* |
| Nhiều mục trống | *"analyze my data source"* rồi thử lại |
| Nhầm SPEC với duyệt tài liệu | SPEC: *"approve SPEC-001"* · Duyệt tài liệu: *"review documents"* |

---

## Bài tiếp

[Duyệt tài liệu](../06-review/01-document-review.md)
