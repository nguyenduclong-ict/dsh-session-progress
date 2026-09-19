# dsh-session-progress

[English](README.md) | [Tiếng Việt](README.vn.md)

---

## 1. Mô tả công dụng của Plugin

<p align="center">
  <img src="assets/preview.png" alt="Panel Session Progress hiển thị dưới dạng tab native của right sidebar" width="800" />
</p>

<p align="center">
  <img src="assets/composer-button.png" alt="Nút tiến độ trên thanh Input và Tooltip tóm tắt" width="800" />
</p>

**dsh-session-progress** là plugin theo dõi tiến độ công việc và phiên làm việc theo thời gian thực dành cho **DeepSeek Harness (DSH / DSH Desktop)**.

Trong các phiên làm việc dài hoặc xử lý chuỗi tác vụ phức tạp, người dùng thường gặp khó khăn trong việc nắm bắt tiến độ tổng thể, các đầu việc đã hoàn thành hay công việc đang chạy nếu chỉ nhìn vào luồng chat dài.

### Vị trí hiển thị

Plugin render **ngay trong right sidebar của DSH** — không tự vẽ lớp phủ riêng nên không tranh chỗ với layout của app:

| Thành phần | Vị trí |
| --- | --- |
| Vòng tròn tiến độ + pill `%` | Thanh công cụ cạnh ô nhập liệu, kế bên context meter |
| Panel tiến độ | Tab native của right sidebar, tên **Session Progress** |

Bấm nút trên thanh nhập liệu (hoặc dòng *Click to open the progress panel* trong popover) sẽ mở tab đó và mở rộng cột phải. Vì là tab thật của sidebar, nó dock/float/split và bám theo session giống tab Files hay Document Preview.

> **Yêu cầu**: bản DSH phải có slot tab của right sidebar (`rightbar.session`, `sidebar.right.pane.tab`) — tức DSH Desktop 0.9.0 trở lên.

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
