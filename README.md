# Garena Filter Pro V5 — Netlify + GitHub Pages (Supabase V4)

V5 là bản nâng cấp từ **V3 HTML** và **V4 full source**. Giữ 21 trang/công cụ, thiết kế đáp ứng điện thoại, import TXT/CSV/JSON, lọc/dedupe, xuất tệp, Backup/Restore, Save Set, hoàn tác, theme, chế độ offline.

**Chạy ngay:** dùng GitHub Pages **hoặc Netlify**. Bản V5 đã điền Project URL và public publishable key của Supabase **từ source V4 bạn cung cấp** vào `config.js`. Trên địa chỉ mới, người dùng được mời đăng nhập trước; vẫn có thể chọn **Dùng trên máy** để xử lý cục bộ. Dữ liệu cloud dùng lại project V4, không cần tạo Supabase mới.

## Đưa lên GitHub Pages

1. Tạo repository mới trên GitHub (nên để **Private** khi chỉnh sửa, Public khi chủ động xuất bản).
2. Giải nén toàn bộ thư mục V5 và **upload các file bên trong vào gốc repository**, đặc biệt `index.html`, `config.js`, `src/`, `build.py`, `.github/` (nếu upload bằng GitHub Web, các file ẩn có thể khó chọn; dùng Git hoặc GitHub Desktop sẽ chuẩn hơn).
3. Tại `Settings → Pages → Build and deployment → Source`, chọn `GitHub Actions`.
4. Push lên nhánh `main`. Workflow `Deploy Garena Filter Pro V5 to GitHub Pages` sẽ build file `index.html` từ `src` rồi xuất bản trang.
5. Mở URL mà GitHub hiển thị, thường là `https://<username>.github.io/<repository>/`.

**Cách đơn giản không dùng Actions:** chọn `Settings → Pages → Deploy from a branch → main / (root)`, rồi Save. `index.html` đã có sẵn, sẽ chạy ngay. Khi sửa các tệp trong `src`, chạy `python3 build.py` và commit lại `index.html`; nếu dùng Actions thì workflow tự build.

Có thể thử tại máy: `python3 -m http.server 8000` rồi mở `http://localhost:8000/`.

## Dùng lại Supabase V4 — không tạo project mới

- **Đã được cấu hình:** `config.js` chứa **Project URL** và **publishable key** từ V4. Đây là khóa công khai dùng cho browser, không phải service-role key. GitHub Pages và Netlify có thể dùng **cùng một Supabase project** và bảng `user_data` hiện tại.
- **Không chạy lại** `supabase_schema.sql` trên project đang hoạt động khi chưa kiểm tra schema và RLS. File SQL chỉ để tham khảo hoặc thiết lập trên project trống.
- **Netlify URL hiện tại:** `https://garenafilterpro.netlify.app/`. Upload tệp `index.html` và `config.js` (nằm cùng thư mục gốc) để nâng cấp trang hiện tại.
- **GitHub Pages URL:** ví dụ `https://<username>.github.io/<repository>/`. Chuyển host cần đăng nhập lại do browser session khác origin; nhưng **dữ liệu đã lưu trên Supabase của cùng user vẫn dùng chung** nếu RLS và đồng bộ hoạt động.
- Trong Supabase Dashboard → Authentication → URL Configuration, giữ Site URL hiện có và thêm địa chỉ GitHub Pages chính xác vào **Redirect URLs** để email xác nhận/đặt lại mật khẩu quay về đúng trang. Đối với Netlify trên cùng domain, URL thường không đổi.
- Các bản lưu trong `localStorage` **không** tự chuyển giữa `netlify.app` và `github.io`; nếu dữ liệu chưa đồng bộ đám mây, hãy xuất Backup JSON ở trang cũ rồi tự khôi phục tại trang mới.
- **Bảo mật:** đảm bảo bảng `user_data` bật RLS theo `auth.uid() = user_id`. Chỉ commit publishable key; tuyệt đối không commit secret key, service-role key, session token, mật khẩu, dữ liệu tài khoản hoặc seed 2FA.
- Chỉ xác nhận mã nguồn được cấu hình giống V4; không thể xác nhận quyền truy cập RLS và đăng nhập tài khoản thật mà không có phiên xác thực của bạn.

## Triển khai lên Netlify

1. Dùng file `Garena_Filter_Pro_V5_Supabase_Website.zip` (giải nén nếu upload qua giao diện chọn thư mục) hoặc chọn hai file `index.html` và `config.js`.
2. Trong dashboard Netlify, mở site **garenafilterpro.netlify.app**, dùng **Deploys → Deploy manually** để thả thư mục website hoặc kết nối repository GitHub đang chứa bộ source V5.
3. Khi triển khai bằng repo GitHub, chọn Publish directory là `.` và không cần build command nếu `index.html` đã được commit; nếu muốn build từ `src`, dùng `python3 build.py`.
4. Mở lại site và đăng nhập bằng tài khoản Supabase hiện tại. Nếu trình duyệt đã có phiên từ V4, có thể tự khôi phục.

## Microsoft Mail (tùy chọn)

Microsoft Mail Reader chỉ sử dụng được nếu bạn đăng nhập tài khoản Microsoft của mình và cấp quyền `Mail.Read` qua Microsoft Graph. Đăng ký ứng dụng loại SPA trong Microsoft Entra, điền Application Client ID ở trang Mail Reader, và đăng ký Redirect URI do trang hiển thị. GitHub Pages hỗ trợ HTTPS. Không lưu Client Secret trong repo. **Chưa xác minh thực tế với Microsoft trong môi trường kiểm thử.**

## Sử dụng và quyền riêng tư

- Các thao tác lọc, ghép cột, import và xuất file chạy trên thiết bị; dữ liệu nhập **không được tự tải lên GitHub**. GitHub Pages chỉ phân phát tệp website.
- Nếu bật **Tự động lưu**, bảng (kể cả mật khẩu) được lưu **nguyên văn** trong `localStorage`. Khi bật đồng bộ, nội dung bảng được gửi đến project Supabase đã cấu hình; không có mã hóa end-to-end. Dùng dữ liệu thử, không dùng như kho lưu mật khẩu hoặc 2FA.
- `Backup JSON`, `CSV` và clipboard là các dạng chứa thông tin bạn nhập. Tránh chia sẻ các bản sao nhạy cảm.
- Bản V5 tiếp tục dùng các khóa bộ nhớ V4 nhằm giữ dữ liệu V4 trên **cùng origin**; nếu chuyển từ file:// hoặc URL cũ sang GitHub Pages thì cần Backup JSON từ nơi cũ và Restore tại địa chỉ mới.
- Browser localStorage khác theo origin, đường dẫn GitHub Pages dùng cùng origin (`https://<username>.github.io`), nên không nên dùng chung trình duyệt và tài khoản máy cho dữ liệu nhạy cảm.

## Chỉnh sửa, build, kiểm thử

```bash
python3 build.py
python3 tests/static.test.py
# Tuỳ chọn: cần Node + Chromium + Playwright
npm install
npm test
```

`src/template.html` (markup), `src/upgrade.css` (giao diện), `src/core.js` (parser & bảng), `src/auth.js` (lưu trữ/auth), `src/events.js` (sự kiện), `src/tools.js` (tiện ích), `src/mail.js` (Microsoft Graph), `src/sdk.js` (tải SDK theo nhu cầu).

## Điểm mới V5

- URL GitHub Pages chạy ngay ở gốc repo hoặc project subpath với `index.html` và tài nguyên tương đối.
- Tự động build/deploy qua GitHub Actions, hoặc deploy trực tiếp theo branch.
- Tách cấu hình Supabase sang `config.js` và **khôi phục project/key public từ bản V4** để giữ đăng nhập và dữ liệu đám mây cũ.
- Loại đường dẫn logs gắn project cũ; hướng dẫn bảo mật dữ liệu công khai chính xác hơn.
- Thêm nhãn phiên bản V5, cải thiện điểm focus và breakpoint nhỏ.
- Giữ quy trình xử lý của V4; script build và bài kiểm tra static có thể chạy không cần package manager.

**Giới hạn:** chưa kiểm chứng đăng nhập/đồng bộ Supabase trên tài khoản thật, Microsoft Graph hoặc deploy trực tiếp lên Netlify/GitHub Pages. Các tính năng online cần Internet và RLS phù hợp.
