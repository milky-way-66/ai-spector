# Thêm nguồn & analyze

**Phần:** [Graph & nguồn dữ liệu](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~10 phút

**Mục tiêu:** Đặt yêu cầu đúng chỗ và trích xuất vào traceability graph.

---

## Thêm tài liệu nguồn

Thả file vào `docs/data-source/` — `.md`, `.txt`, hoặc `.pdf` (text phải chọn được).

Gồm meeting notes, user stories, BRD, mô tả API. Agent đọc nhưng không sửa các file này.

```bash
ls docs/data-source/   # ít nhất một file trước khi analyze
```

---

## Analyze

```
analyze my data source
```

Agent trích xuất actors, use cases và features vào `.ai-spector/graph/traceability.graph.json`. Xem lại tóm tắt; bổ sung chi tiết vào nguồn và chạy lại nếu thiếu.

---

## Kiểm tra

```
validate the graph
```

Không có lỗi critical (warnings ở giai đoạn này là OK).

---

## Tiếp theo

[Validate, index & explore](02-validate-index-explore.md)
