# Data Website

MVP cho hệ thống dữ liệu doanh nghiệp phục vụ research đầu tư.

## Workflow chính

Excel của analyst → Nạp Excel → Mapping → Preview → Data Pool → Dashboard time series.

Website không coi Excel là database. Excel chỉ là nguồn nhập; dữ liệu sau khi chuẩn hóa được lưu vào Data Pool của ứng dụng.

## Nạp Excel

Hỗ trợ `.xlsx`, `.xls`, `.xlsm` và hai cấu trúc phổ biến:

### Dạng ngang

```text
Date | NT1 | NT2 | Vũng Áng | Cà Mau 1
2026-01 | 100 | 200 | 300 | 150
2026-02 | 110 | 190 | 320 | 170
```

Chọn một metric, ví dụ `Sản lượng điện`. Mỗi cột còn lại trở thành một `series`.

### Dạng dọc

```text
Date | Metric | Series | Value
2026-01 | Sản lượng điện | NT1 | 100
2026-01 | Sản lượng điện | NT2 | 200
```

Hệ thống đọc Date / Metric / Series / Value rồi chuẩn hóa trực tiếp vào Data Pool.

## Schema MVP

```text
companies
- id
- ticker
- name
- sector

metrics
- id
- companyId
- name
- unit
- group
- order

observations
- companyId
- metricId
- series
- period (YYYY-MM)
- value
```

## Logic chart

- Metric chỉ có 1 series → line chart.
- Metric có nhiều series → stacked column chart.
- Ví dụ POW / `Sản lượng điện` có NT1, NT2, Vũng Áng... sẽ tự thành chart cột chồng theo tháng.

## Luồng sử dụng đề xuất

1. Vào `Cấu hình` để thêm doanh nghiệp.
2. Thêm metric cần theo dõi, ví dụ `Sản lượng điện`.
3. Vào `Nạp Excel`.
4. Chọn file và sheet.
5. Chọn dạng ngang hoặc dọc.
6. Map cột thời gian / metric / series.
7. Kiểm tra Preview.
8. Bấm `Xác nhận import`.
9. Vào `Doanh nghiệp` để xem chart.

## Phiên bản hiện tại

- Frontend tĩnh HTML/CSS/JS, chạy trên GitHub Pages.
- Đọc Excel trong trình duyệt bằng SheetJS.
- Chart dùng Chart.js.
- Data Pool hiện lưu bằng `localStorage` để kiểm thử workflow.

## Bước tiếp theo

Sau khi workflow Excel được chốt, chuyển Data Pool sang Supabase/PostgreSQL để dữ liệu tồn tại độc lập với browser, dùng trên nhiều máy, có backup và phân quyền admin.