# Thay đổi V5 (so với V3 + V4)

- Giữ đầy đủ ID/trang từ V3 qua V4 và hiện đại hóa trình bày V5.
- Đổi đầu vào GitHub Pages thành `index.html` ở thư mục gốc.
- Cấu hình Supabase tách ra `config.js` (public-only); **giữ project Supabase V4** để dùng trên cả Netlify và GitHub Pages.
- Không hardcode dự án Supabase trong HTML chính, nhưng giữ public config V4 trong tệp `config.js` riêng.
- Thêm workflow Actions để build/deploy, `.nojekyll`, `.gitignore`, hướng dẫn đầy đủ và SQL RLS tùy chọn.
- Giữ định dạng lưu V4 để tránh mất dữ liệu khi cập nhật cùng origin.
- Cảnh báo lưu mật khẩu dạng rõ và điều kiện sử dụng Microsoft Graph.
- Thêm smoke/static test và giữ các regression tests V4.

## V5 cập nhật tương thích Supabase cũ

- Khôi phục Project URL và publishable key của V4 trong `config.js`, không dùng service-role key.
- Nếu được cấu hình Supabase, trên host mới ưu tiên hiện đăng nhập; vẫn có nút Dùng trên máy.
- Bổ sung hướng dẫn deploy Netlify và dùng chung project giữa Netlify/GitHub Pages.
