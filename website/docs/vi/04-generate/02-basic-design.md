# Basic design

**Phần:** [Tạo tài liệu](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~10 phút · **Trước đó:** [Tạo SRS](01-generate-srs.md)

**Mục tiêu:** Tạo kiến trúc cấp cao từ SRS + graph.

---

## Generate

```
generate basic design
```

Cùng gated flow như SRS: check → clarify → plan → approve → waves.

Output trong `docs/basic-design/`: modules, tổng quan data model, API surface.

Đưa feedback trong chat thay vì sửa file trực tiếp khi có thể:

```
the basic design should separate notification from user module
```

---

## Sau khi hoàn tất

```
refresh the index
```

---

## Kiểm tra

Phần architecture ánh xạ modules với use cases trong SRS.

---

## Phần tiếp theo

[Thiết kế & prototype](../05-prototype/README.md)
