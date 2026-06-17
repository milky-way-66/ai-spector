# Tạo SRS

**Phần:** [Tạo tài liệu](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~15 phút

**Mục tiêu:** Chạy quy trình SRS đầy đủ — câu hỏi, kế hoạch, phê duyệt, rồi tài liệu.

---

## Nói đơn giản

Tạo SRS là **cuộc trò chuyện có hướng dẫn**. Agent kiểm tra workspace, hỏi thông tin còn thiếu, cho biết nguồn nào định hình tài liệu, trình bày kế hoạch, và **chờ bạn đồng ý** trước khi ghi bất cứ thứ gì trong `docs/srs/`.

---

## Quy trình (đơn giản)

1. **Kiểm tra** — workspace sẵn sàng
2. **Làm rõ** — agent hỏi; câu trả lời được lưu
3. **Tóm tắt nguồn** — nguồn và chủ đề nào định hình SRS
4. **Kế hoạch** — bảng chương/lượt
5. **Bạn đồng ý** — *"yes, go ahead"* (đây là phê duyệt kế hoạch, không phải ký duyệt tài liệu)
6. **Viết** — tài liệu xuất hiện theo từng lượt
7. **Rà soát spec** — các mục SPEC tùy chọn để phê duyệt hoặc từ chối

---

## Bạn nói → Agent làm → Bạn thấy

**Bạn nói:** *"generate the SRS"*

**Agent làm:** Tạo tác vụ và chạy quy trình có kiểm soát ở trên.

**Bạn thấy:** Không có file `docs/srs/` cho đến khi bạn phê duyệt kế hoạch.

---

:::exercise
**Dán vào chat:**

```
generate the SRS
```

**Bạn nên thấy:**
- Kiểm tra workspace và câu hỏi làm rõ
- Bảng kế hoạch — agent **chờ** ở bước kế hoạch
- (Sau khi bạn phê duyệt trong lần chạy thật) file trong `docs/srs/`
:::

:::roletip
**BA** — tập trung trả lời câu hỏi làm rõ chính xác; agent dùng câu trả lời của bạn qua nhiều phiên.
:::

## Nếu có vấn đề

| Triệu chứng | Nói trong chat |
|-------------|----------------|
| File được ghi trước khi đồng ý kế hoạch | Dừng lại; nói *"pause task"* |
| Mục trống | *"analyze my data source"* trước, rồi thử lại |
| Nhầm SPEC với rà soát tài liệu | SPEC = *"approve SPEC-001"*; ký duyệt chính thức = *"review documents"* |

---

## Tiếp theo

[Rà soát tài liệu](../06-review/01-document-review.md)
