# dsh-session-progress

[English](README.md) | [Tiếng Việt](README.vn.md)

---

## 1. Mô tả công dụng của Plugin

<p align="center">
  <img src="assets/preview.png" alt="Giao diện Slide-over Drawer của dsh-session-progress" width="800" />
</p>

<p align="center">
  <img src="assets/composer-button.png" alt="Nút tiến độ trên thanh Input và Tooltip tóm tắt" width="800" />
</p>

**dsh-session-progress** là plugin theo dõi tiến độ công việc và phiên làm việc theo thời gian thực dành cho **DeepSeek Harness (DSH / DSH Desktop)**.

Trong các phiên làm việc dài hoặc xử lý chuỗi tác vụ phức tạp, người dùng thường gặp khó khăn trong việc nắm bắt tiến độ tổng thể, các đầu việc đã hoàn thành hay công việc đang chạy nếu chỉ nhìn vào luồng chat dài.

**dsh-session-progress** giải quyết triệt để vấn đề này với các công dụng nổi bật:

- **Tự động tiêm hướng dẫn vào System Prompt**: Yêu cầu AI Agent duy trì song song một file Markdown tóm tắt tiến độ tại thư mục tạm của hệ điều hành (`os.tmpdir()`), đảm bảo không làm ô nhiễm thư mục mã nguồn dự án của bạn.
- **Hỗ trợ YAML Frontmatter & Tính % Đa tầng**:
  - Đọc và bóc tách dữ liệu có cấu trúc ở đầu file (`progress: XX%`, `status: in_progress`, `current_activity: "..."`).
  - Tự động fallback đếm số lượng checklist Markdown (`- [x]`, `- [/]`, `- [ ]`) để tính tỷ lệ hoàn thành % nếu Agent quên khai báo số.
- **Tự động thích ứng ngôn ngữ (Language Alignment)**: Nếu bạn giao tiếp bằng tiếng Việt, Agent sẽ tự động viết toàn bộ tiêu đề (Tổng quan, Checklist, Hoạt động hiện tại, v.v.) và nội dung công việc bằng tiếng Việt; nếu chat bằng tiếng Anh sẽ tự động viết bằng tiếng Anh.
- **Một mục tiêu duy nhất – Viết lại toàn bộ khi có việc mới**: Prompt được tiêm quy định rõ mỗi file tiến độ chỉ theo dõi **đúng MỘT mục tiêu đang hoạt động**. Khi yêu cầu mới là một công việc khác và công việc cũ đã xong (đã bàn giao, đạt `100%`, `status: completed`, người dùng xác nhận đã xong, hoặc đã bỏ dở), Agent **bắt buộc ghi lại (rewrite) toàn bộ nội dung file** cho công việc mới thay vì giữ checklist cũ và thêm vài mục mới vào. Chỉ khi yêu cầu là bổ sung/tiếp nối chính mục tiêu đang có thì mới cập nhật tại chỗ.
- **Tool ghi đè toàn bộ file (`session_progress_write`)**: Plugin đăng ký một tool **luôn thay thế toàn bộ file tiến độ** — không có neo, không sửa từng phần, không nối thêm — và **từ chối** mọi tài liệu bị lặp tiêu đề cấp 1 hoặc lặp heading section, nhờ đó bản cũ không thể tồn tại sót lại bên dưới bản mới. Mỗi lần gọi trả về số byte, phần trăm đã parse, số lượng checklist và các cảnh báo để Agent kiểm chứng ngay mà không cần đọc lại file. Cơ chế này khắc phục triệt để lỗi trước đây: dùng `edit` với neo chỉ phủ khối frontmatter khiến toàn bộ tài liệu cũ bị giữ lại phía dưới tài liệu mới.
- **Tool đọc nguyên văn (`session_progress_read`) + ẩn đường dẫn file**: Agent đọc tài liệu qua một tool trả về **nguyên văn** nội dung file, kèm phần trăm, status, số lượng checklist, tên các section và cờ `corrupted` (phát hiện lặp tiêu đề/section). **Đường dẫn file không còn được inject vào system prompt và không tool nào trả về**, nên model không có cách nào trỏ `read` / `write` / `edit` thông thường vào file ⇒ lỗi nhân đôi bị loại bỏ về mặt cấu trúc, chứ không chỉ bị cấm bằng lời. Nếu service `tools` không khả dụng, prompt tự chuyển sang chế độ dự phòng: nêu đường dẫn và buộc ghi đè toàn file.
- **Nút tiến độ trực quan trên thanh Input & Tooltip tóm tắt**: Tích hợp trực tiếp vào thanh công cụ của ô nhập liệu (cạnh nút chọn Model và Context Meter), với vòng tròn SVG tiến độ, nhãn phần trăm thời gian thực và tooltip tóm tắt công việc đang chạy.
- **Bật / Tắt theo dõi tiến độ theo từng phiên (Per-Session Toggle)**: Cho phép linh hoạt bật/tắt tiến độ cho từng session riêng biệt bằng công tắc Toggle Switch trực quan trong hover popover hoặc side panel. Khi tắt, plugin tự động ngừng tiêm System Prompt để tiết kiệm token và hiển thị nút ở trạng thái mờ (`OFF`). Cấu hình được ghi nhớ bền vững qua các lần khởi động lại.
- **Hiển thị thích ứng Hybrid Responsive (Split View & Modal Drawer)**: Tự động thích ứng linh hoạt theo kích thước cửa sổ:
  - **Màn hình lớn (≥ 960px)**: Hoạt động dưới dạng **Split View song song** (tự động co lề khung làm việc 420px và tắt lớp phủ tối nền), cho phép bạn vừa đọc nội dung session, vừa nhập liệu/gửi lệnh trong ô Composer, vừa theo dõi tiến độ công việc cạnh phải.
  - **Màn hình hẹp (< 960px)**: Tự động chuyển sang chế độ **Modal Drawer trượt phủ lên trên** có làm mờ nền để tối ưu không gian cho màn hình nhỏ.
  - Các nút thao tác nhanh: Mở file trên ứng dụng hệ điều hành (VS Code, Notepad) ở thanh chân trang (Footer), làm mới dữ liệu và đóng bảng linh hoạt qua `✕`, phím `Esc`, hoặc click lại nút Progress trên toolbar.

---

## 2. Hướng dẫn cài đặt

### Dành cho DSH Desktop

#### Trên Windows (PowerShell)
```powershell
cd "$env:APPDATA\dsh-desktop\harness\profiles\web"
& "$env:APPDATA\dsh-desktop\harness\.desktop-bin\pnpm.cmd" add https://github.com/nguyenduclong-ict/dsh-session-progress
```

#### Trên macOS (Terminal)
```bash
cd "$HOME/Library/Application Support/dsh-desktop/harness/profiles/web"
"$HOME/Library/Application Support/dsh-desktop/harness/.desktop-bin/pnpm" add https://github.com/nguyenduclong-ict/dsh-session-progress
```

#### Trên Linux (Terminal)
```bash
cd "$HOME/.config/dsh-desktop/harness/profiles/web"
"$HOME/.config/dsh-desktop/harness/.desktop-bin/pnpm" add https://github.com/nguyenduclong-ict/dsh-session-progress
```

> **Lưu ý**: Sau khi cài đặt xong, hãy khởi động lại ứng dụng **DSH Desktop** để plugin bắt đầu hoạt động.

---

### Dành cho DSH CLI (Standalone)

Nếu bạn sử dụng giao diện dòng lệnh `dsh`:

```bash
dsh plugin --profile web add https://github.com/nguyenduclong-ict/dsh-session-progress
```

Hoặc cài đặt trực tiếp qua `pnpm` trong thư mục profile Cordis:

```bash
pnpm add https://github.com/nguyenduclong-ict/dsh-session-progress
```

---

## Giấy phép (License)

MIT © [nguyenduclong-ict](https://github.com/nguyenduclong-ict)
