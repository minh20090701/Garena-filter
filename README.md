# Garena Filter Pro V4

Bản nâng cấp từ source HTML được cung cấp, giữ các công cụ hiện có và xuất thành **một file HTML độc lập**.

## Dùng ngay

Mở `Garena_Filter_Pro_V4.html` bằng Chrome hoặc Edge hiện đại. Ứng dụng vào chế độ trên máy, không cần tài khoản. Nhấn **Thử dữ liệu mẫu**, sau đó **Xử lý dữ liệu** để thử nhanh.

Nếu trình duyệt của bạn chặn mở file hoặc lưu dữ liệu qua `file://`, chạy trong thư mục này:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Mở `http://localhost:8080/Garena_Filter_Pro_V4.html`.

## Những thay đổi chính

- Giao diện sáng/tối mới, menu tìm công cụ, bố cục điện thoại, nhãn bàn phím, hướng dẫn trong ứng dụng.
- Dùng offline cho quản lý dữ liệu và công cụ văn bản. Thư viện đăng nhập chỉ được tải khi cần kết nối.
- Nhập thay thế hoặc nối tiếp; tùy chọn loại trùng; giữ nguyên nội dung đang nhập; báo số dòng không hợp lệ.
- CSV có dấu phẩy, nháy kép, xuống dòng trong ô và BOM; nhận tên cột; giữ trạng thái và cột phụ của bản V3.
- Không nhận nhầm UID thành điện thoại. Nhận đúng dữ liệu chỉ có nhãn `Status`.
- Lọc skin/không có skin được giữ sau phân trang, chọn dòng, đổi hiển thị mật khẩu; đặt lại bộ lọc đầy đủ.
- Hoàn tác nhập, xóa, mở/lưu/xóa bộ dữ liệu và khôi phục JSON, tối đa 10 bước tùy dung lượng. Lịch sử hoàn tác nằm trong phiên hiện tại.
- Kiểm tra toàn bộ JSON trước khi khôi phục, chuẩn hóa ID bị trùng và hiển thị dữ liệu dưới dạng văn bản.
- Tự lưu hoạt động đúng khi bật/tắt; lưu bộ dữ liệu là thao tác lưu rõ ràng, kể cả khi tắt tự lưu. Có thông báo khi bộ nhớ trình duyệt đầy.
- Clipboard có phương án dự phòng và báo đúng kết quả. CSV có BOM cho tiếng Việt và bảo vệ ô công thức.
- Ghép cột giữ dòng trống, ghép Authen báo nguồn mâu thuẫn, thay thế coi `$&` là văn bản, kiểm tra giới hạn đầu vào/kết quả.
- TOTP kiểm tra Base32, mã SHA-1 sáu số/30 giây, xóa mã cũ khi sửa secret và tránh phản hồi bất đồng bộ cũ.
- Đăng nhập/đồng bộ và Microsoft Mail có bảo vệ khi chuyển tài khoản, đăng xuất hoặc phản hồi đến chậm.

## Dữ liệu và định dạng

Dạng ngắn: `TK|MK`, `TK|MK|Tên`, hoặc `TK|MK|Tên|LV`.

Dạng cột đầy đủ:

```text
TK|MK|UID|NAME|LV|SKIN|SS|SSS|SKIN_HIEM|MYSTIC|MAIL|PHONE
```

Dạng có nhãn:

```text
user01|matkhau|UID: 123456789|NAME: Tên mẫu|LEVEL: 30|SKIN: 12|Status: ACC FULL
```

CSV có tiêu đề hỗ trợ các cột trên, thêm `STATUS` và `EXTRA`, có thể đổi thứ tự. Khi không có tiêu đề, dữ liệu từ 5 cột dùng bố cục đầy đủ. Dòng cần có tên tài khoản và ít nhất hai cột; mật khẩu trống được giữ để bạn kiểm tra.

CSV dành cho bảng tính: ô bắt đầu bằng `=`, `+`, `-`, `@` được thêm dấu nháy đơn. **Dùng JSON để sao lưu/khôi phục nguyên vẹn**, đặc biệt với mật khẩu có các ký tự này. Sao chép đầy đủ có thêm trạng thái/cột phụ và đặt nháy kép cho ô chứa dấu `|`, nháy kép hoặc xuống dòng.

Giới hạn nhập: 20 MB/tệp, 100.000 dòng trong bảng. Các công cụ văn bản có giới hạn riêng để tránh tạo kết quả quá lớn. Bộ dữ liệu lớn có thể vượt dung lượng localStorage; khi đó hãy tải JSON.

## Lưu trên máy và đồng bộ

Chế độ trên máy lưu bảng và bộ dữ liệu trong trình duyệt khi **Tự động lưu** bật. Đổi trình duyệt, đổi địa chỉ mở file hoặc xóa dữ liệu trình duyệt có thể làm bản lưu này không còn truy cập được. Bản JSON dùng để chuyển máy hoặc giữ lâu dài.

Dữ liệu bảng, gồm mật khẩu, được lưu nguyên văn khi bật tự lưu hoặc bấm lưu bộ dữ liệu; nút ẩn mật khẩu chỉ che trên màn hình. Nội dung các công cụ, secret TOTP và hộp thư không được đưa vào backup/dữ liệu bảng.

Đăng nhập đám mây dùng cấu hình Supabase từ source gốc trong `src/core.js`. Cần project đang hoạt động, xác thực email/password, bảng `user_data` với `user_id` (UUID, khóa chính), `payload` (JSONB), `updated_at` (timestamptz), và RLS chỉ cho phép người dùng đọc/ghi dòng của chính mình (`auth.uid() = user_id`). Dùng publishable/anon key ở frontend; không dùng service-role key. Khôi phục mật khẩu cần URL HTTP/HTTPS đã đăng ký trong Supabase. Bản V4 không tự thay đổi cấu hình hoặc dữ liệu máy chủ.

Dữ liệu đám mây là nguồn được tải khi đăng nhập; bản lưu local theo người dùng dùng khi chưa có dòng đám mây. Nếu báo lỗi đồng bộ, hãy tải JSON trước khi đăng xuất/tải lại để giữ chắc các thay đổi chưa lên máy chủ. Đồng bộ nhiều tab/thiết bị đồng thời chưa có cơ chế hợp nhất xung đột.

Microsoft Mail cần HTTPS hoặc localhost, Application Client ID hợp lệ, redirect URI khớp chính xác và quyền Delegated `Mail.Read`. Các bước cấu hình có trong trang **Đọc thư Microsoft**. Mã email chỉ là gợi ý nhận dạng; kiểm tra nội dung thư khi cần.

## Chỉnh sửa source

```bash
python3 build.py
```

Lệnh này ghép source trong `src/` thành `Garena_Filter_Pro_V4.html`; không cần bundler hoặc CDN cho phần offline.

- `template.html`, `upgrade.css`: giao diện.
- `core.js`, `events.js`: parser, bảng, bộ lọc, sao lưu, thao tác.
- `auth.js`, `sdk.js`: lưu trữ, xác thực, tải SDK theo nhu cầu.
- `tools.js`: công cụ văn bản và TOTP.
- `mail.js`: Microsoft Graph và tìm mã trong email.

## Kiểm thử

Cần Node.js, Playwright và Chromium. Các script mặc định dùng `/usr/bin/chromium`; có thể đặt biến `CHROMIUM_PATH` để chỉ định trình duyệt khác.

```bash
npm install
npm test
```

`auth.test.cjs` dùng mock và không cần trình duyệt. Các bài browser/mail/edge chạy tại localhost được Playwright phục vụ nội dung, chặn hoặc giả lập truy cập dịch vụ ngoài; không dùng tài khoản thật.

Đã kiểm tra parser, filter, undo, backup, công cụ văn bản, TOTP RFC, mobile, theme, clipboard, escape HTML, dữ liệu V3, thao tác auth/mail bất đồng bộ. **Chưa xác nhận đăng nhập, đồng bộ hoặc đọc thư với tài khoản thật**. Trong môi trường kiểm thử, trình duyệt quản lý chặn URL `file://`, nên các bài giao diện chạy cùng HTML qua localhost. Không tuyên bố kiểm thử thực tế mọi trình duyệt.
