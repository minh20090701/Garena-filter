# Kiểm thử V5 — 06/11/2026

- **Build HTML:** đạt (`python3 build.py`).
- **Kiểm tra tĩnh GitHub Pages:** đạt (`python3 tests/static.test.py`); 245 HTML ID không trùng, có entry `index.html`, nạp `config.js` tương đối, không có Project URL/key nhúng trực tiếp trong HTML; dùng `config.js` riêng.
- **Auth/storage mocks (đã chạy lại trên bản tương thích Supabase):** đạt **15/15** (bản V5 với Supabase public hiện có) (`node --test tests/auth.test.cjs`). Không gọi Supabase thật.
- **Browser Chromium (render nội dung trực tiếp, không có kết nối mạng):** khởi chạy chế độ local, 21 trang, nhập và lọc 3 dòng còn 2 dòng trùng lặp đã loại, bộ lọc từ khóa, đổi theme, tải JSON backup, mở trang ghép cột, menu mobile và trang công cụ đều chạy; không có lỗi JavaScript không bắt được.
- **Cú pháp JavaScript:** cả hai script inline trong `index.html` được `node --check` chấp nhận.

**Chưa xác minh:** đăng nhập/đồng bộ thật với Supabase, GitHub Pages live sau khi đưa lên repo, tính năng đăng nhập/đồng bộ Supabase với dự án thật, Microsoft Graph với hộp thư thật. Các test browser/mail/edge Node.js cần cài `npm install` (Playwright) nên chưa chạy lại trên V5. Môi trường Chromium này chặn truy cập HTTP ngay cả localhost, nên kiểm thử browser dùng `set_content` thay vì điều hướng tới URL thật. Các kết quả này không thay thế cho kiểm tra trên URL GitHub Pages sau khi deploy.

## Bản vá Supabase V4 → V5

- Đối chiếu URL/key public trong `config.js` với `src/core.js` V4: trùng nhau.
- Không xác minh được sign-in và đồng bộ thực tế với project thật do không có phiên xác thực người dùng.
- Có thể deploy cùng một bản `index.html` + `config.js` trên Netlify và GitHub Pages.
