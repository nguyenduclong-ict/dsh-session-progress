# dsh-session-progress

[English](README.md) | [Tiếng Việt](README.vn.md)

---

## 1. Tools

Plugin cung cấp cho Agent **hai tool** để quản lý file tiến độ của session — một tài liệu Markdown được giữ trong thư mục tạm của hệ điều hành trong suốt quá trình làm việc. Prompt được tiêm yêu cầu mọi thao tác tạo mới, cập nhật hay viết lại đều phải đi qua hai tool này.

### `session_progress_write`

Thay thế **toàn bộ** tài liệu tiến độ bằng `content`.

- `content` (bắt buộc, string) — **toàn bộ** tài liệu Markdown: YAML frontmatter (`progress`, `status`, `current_activity`) + 5 section chuẩn (Tổng quan, Checklist, Hoạt động hiện tại, Các bước tiếp theo, Ghi chú quan trọng), viết theo ngôn ngữ của cuộc hội thoại.
- Không có neo, không sửa từng phần, không nối thêm: cả file được thay **atomic** (file tạm + rename), nên bản cũ không thể tồn tại sót lại bên dưới và không bao giờ có tài liệu bị ghi dở.
- Tài liệu bị **từ chối** (không ghi gì cả) khi lặp tiêu đề cấp 1 hoặc lặp bất kỳ heading `##` nào — đúng dạng của một tài liệu bị nhân đôi/nối liền.
- **Cảnh báo mềm** (vẫn ghi thành công) khi thiếu khối frontmatter hoặc thiếu key, thiếu tiêu đề cấp 1, ít hơn 5 section, hoặc % ở frontmatter lệch xa giá trị tính từ checklist.
- **Kết quả trả về** — `fileName`, `bytes`, `replaced`, `repaired` (file trước đó bị nhân đôi và đã được thay bằng bản sạch), `percent`, `status`, `currentActivity`, số lượng checklist, danh sách section nhận diện được và `warnings`.

### `session_progress_read`

Trả về nội dung file hiện tại **nguyên văn**.

- Không có tham số. Trả về `content` kèm `exists`, `fileName`, `bytes`, `percent`, `status`, `currentActivity`, số lượng checklist, `sections`, `warnings` và `corrupted`.
- `corrupted: true` nghĩa là file đang lặp tiêu đề cấp 1 hoặc lặp heading section; khi đó kết quả sẽ yêu cầu Agent ghi lại file bằng `session_progress_write` với tài liệu đầy đủ nhất.
- Khi chưa có file, tool trả `exists: false` (không báo lỗi) và **không** tạo file như tác dụng phụ.

### Vì sao ẩn đường dẫn file

Không tool nào trả về đường dẫn file và prompt cũng không bao giờ nêu nó, nên Agent không có "tay nắm" nào để dùng `read` / `write` / `edit` thông thường lên file tiến độ — lỗi trước đây (dùng `edit` với neo ngắn khiến file chứa hai tài liệu nối nhau) trở thành **bất khả thi về mặt cấu trúc**, chứ không chỉ bị cấm bằng lời. Người dùng vẫn thấy đường dẫn trong drawer của UI, kèm nút mở file bằng editor. Nếu service tool không khả dụng, prompt tự chuyển sang chế độ dự phòng: nêu đường dẫn và buộc ghi đè toàn file.

---

## 2. Cách cài đặt (Installation)

### DSH Desktop

**Windows (PowerShell)**
```powershell
cd "$env:APPDATA\dsh-desktop\harness\profiles\web"
& "$env:APPDATA\dsh-desktop\harness\.desktop-bin\pnpm.cmd" add https://github.com/nguyenduclong-ict/dsh-session-progress
```

**macOS (Terminal)**
```bash
cd "$HOME/Library/Application Support/dsh-desktop/harness/profiles/web"
"$HOME/Library/Application Support/dsh-desktop/harness/.desktop-bin/pnpm" add https://github.com/nguyenduclong-ict/dsh-session-progress
```

**Linux (Terminal)**
```bash
cd "$HOME/.config/dsh-desktop/harness/profiles/web"
"$HOME/.config/dsh-desktop/harness/.desktop-bin/pnpm" add https://github.com/nguyenduclong-ict/dsh-session-progress
```

> **Lưu ý**: khởi động lại **DSH Desktop** sau khi cài để plugin được nạp.

### DSH CLI

```bash
dsh plugin --profile web add https://github.com/nguyenduclong-ict/dsh-session-progress
```

Hoặc cài trực tiếp trong profile Cordis workspace:

```bash
pnpm add https://github.com/nguyenduclong-ict/dsh-session-progress
```

---

## Giấy phép (License)

MIT © [nguyenduclong-ict](https://github.com/nguyenduclong-ict)
