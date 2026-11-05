# Kết quả kiểm thử V4

Kiểm thử bằng Chromium và Node.js trong môi trường phát triển. Không dùng tài khoản hoặc hộp thư thật.

| Phạm vi | Kết quả cuối |
| --- | --- |
| Giao diện và chức năng chính | 12 nhóm đã đạt; bài tự lưu/tải lại chạy riêng và đạt sau một lần timeout khi chạy đồng thời |
| Auth/Supabase giả lập | 14/14 đạt |
| Các tình huống biên | 9 nhóm đạt; bài nhập TXT 10.000 dòng chạy riêng đạt |
| Microsoft Mail giả lập | Đạt kiểm tra Client ID, mã OTP, URL Graph, phản hồi đến chậm, phân trang lỗi/thử lại, đổi phiên, hủy đăng nhập |
| JavaScript và HTML | Kiểm tra cú pháp; không trùng ID trong markup; không tải tài nguyên ngoài khi khởi động chế độ local |

Bài dữ liệu lớn xác nhận nhập **TXT** 10.000 dòng trong giới hạn 8 giây của bài thử, chỉ dựng 10 dòng trên trang và lọc tìm kiếm trong giới hạn 3 giây. Thao tác `Playwright.fill` để dán cùng khối dữ liệu vào textarea hết thời gian chờ 30 giây trong môi trường này; chưa xác nhận hiệu năng dán 10.000 dòng bằng thao tác người dùng. Nên dùng Nhập tệp với danh sách lớn.

Trình duyệt quản lý chặn `file://`, nên kiểm thử giao diện dùng cùng HTML qua URL localhost do Playwright cung cấp. Microsoft/Supabase đều bị chặn hoặc giả lập trong tests. Chưa kiểm tra xác thực, RLS hoặc hộp thư thật; chưa kiểm tra toàn bộ trình duyệt.

Các report JSON lưu cả lần thử hết thời gian chờ và lần chạy lại riêng, để giữ lịch sử kiểm chứng. Source test hỗ trợ `TEST_FILTER` để chạy lại nhóm cụ thể; ví dụ `TEST_FILTER='Local auto save' node tests/browser.cjs`.
