# Data Website

MVP cho hệ thống dữ liệu doanh nghiệp phục vụ research đầu tư.

## Mục tiêu

- Nhập dữ liệu doanh nghiệp theo tháng bằng bảng dạng spreadsheet.
- Cho phép paste trực tiếp từ Excel.
- Lưu dữ liệu và tự động trực quan hóa thành biểu đồ time series.
- Quản lý nhiều doanh nghiệp và nhiều chỉ tiêu mà không phải sửa HTML theo từng công ty.

## Phiên bản hiện tại

- Frontend tĩnh HTML/CSS/JS, tương thích GitHub Pages.
- FPT được tạo sẵn làm template chỉ tiêu, chưa có số liệu giả.
- Dữ liệu người dùng đang được lưu bằng `localStorage` của trình duyệt để kiểm thử UX.
- Chart sử dụng Chart.js qua CDN.

## Luồng sử dụng

1. Mở **Nhập dữ liệu**.
2. Chọn doanh nghiệp và năm.
3. Nhập từng ô hoặc paste cả vùng dữ liệu từ Excel.
4. Bấm **Lưu dữ liệu**.
5. Vào **Doanh nghiệp** để xem time series từng chỉ tiêu.
6. Vào **Quản lý chỉ tiêu** để thêm doanh nghiệp hoặc metric mới.

## Kiến trúc dữ liệu MVP

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
- metricId
- period (YYYY-MM)
- value
```

## Bước tiếp theo

Sau khi chốt UX, thay lớp `localStorage` bằng Supabase/PostgreSQL để:

- dữ liệu tồn tại độc lập với trình duyệt;
- dùng được trên nhiều máy;
- backup/versioning;
- đăng nhập admin;
- phân quyền nhập và xem dữ liệu;
- import/export dữ liệu thuận tiện hơn.
