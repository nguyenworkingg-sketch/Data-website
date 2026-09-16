# Data Website

Hệ thống dữ liệu doanh nghiệp phục vụ research đầu tư.

## Workflow chính

Excel model → Google Sheets Input Hub → Data Pool → Dashboard.

Excel vẫn là nơi analyst làm model. Google Sheets chỉ là lớp nhập liệu nhẹ: mỗi tháng copy dữ liệu mới từ model rồi paste vào Sheet. Website đọc Sheet và chuẩn hóa dữ liệu vào Data Pool.

## Format Google Sheets chuẩn

Sheet nên có đúng 5 cột:

```text
period | metric | series | value | unit
2026-01 | Sản lượng điện | Nhơn Trạch 2 | 371.4 | triệu kWh
2026-01 | Qc | Nhơn Trạch 2 | 328.9 | triệu kWh
2026-01 | Doanh thu theo nhà máy | Nhơn Trạch 2 | 811.3 | tỷ đồng
```

Khóa dữ liệu dùng để upsert:

```text
company + metric + series + period
```

Vì vậy đồng bộ lại cùng một tháng sẽ cập nhật số cũ thay vì tạo duplicate.

## POW

Repo có sẵn template:

`templates/pow-input-template.csv`

POW được seed sẵn các metric:

- Sản lượng điện — cột chồng theo nhà máy
- Qc — cột chồng theo nhà máy
- Doanh thu theo nhà máy — cột chồng theo nhà máy

Một metric có nhiều series sẽ tự hiển thị theo chart đã cấu hình. Metric một series có thể dùng line chart.

## Cách nối Google Sheets với website

Bản GitHub Pages hiện tại dùng phương án không cần backend:

1. Tạo Google Sheet theo template.
2. Vào `File → Share → Publish to web`.
3. Publish đúng sheet input ở dạng CSV.
4. Copy URL CSV.
5. Vào `Google Sheets Hub` trên website.
6. Chọn doanh nghiệp, dán URL và bấm `Lưu nguồn`.
7. Mỗi khi cập nhật Sheet, bấm `Đồng bộ Sheet`.

Website đọc CSV, preview 100 dòng đầu, tự tạo metric mới nếu cần và upsert observations vào Data Pool.

## Lưu ý riêng tư

`Publish to web` khiến sheet được publish qua URL. Không dùng phương án này cho dữ liệu mật hoặc dữ liệu nội bộ nhạy cảm.

Nếu cần dữ liệu private hoàn toàn, adapter Google Sheets có thể được thay bằng:

- Google Apps Script Web App có xác thực;
- Supabase/PostgreSQL làm backend;
- hoặc một backend riêng dùng Google Sheets API/OAuth.

Dashboard và schema không cần viết lại khi đổi adapter.

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
- chart
- order

observations
- companyId
- metricId
- series
- period (YYYY-MM)
- value
```

## Phiên bản hiện tại

- Frontend tĩnh HTML/CSS/JS, chạy trên GitHub Pages.
- Google Sheets CSV là nguồn nhập chính.
- Nhập tay vẫn giữ làm phương án bổ sung.
- Chart dùng Chart.js.
- Data Pool hiện lưu bằng `localStorage` để kiểm thử UX.

## Bước tiếp theo

Sau khi Google Sheets workflow được chốt, chuyển Data Pool sang Supabase/PostgreSQL để dữ liệu dùng được trên nhiều máy, có backup, login và phân quyền admin.