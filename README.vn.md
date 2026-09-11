# dsh-session-progress

[English](README.md) | [Tiếng Việt](README.vn.md)

---

## 1. Mô tả công dụng của Plugin

<p align="center">
  <img src="assets/preview.png" alt="Giao diện Slide-over Drawer của dsh-session-progress" width="800" />
</p>

**dsh-session-progress** là plugin theo dõi tiến độ công việc và phiên làm việc theo thời gian thực dành cho **DeepSeek Harness (DSH / DSH Desktop)**.

Trong các phiên làm việc dài hoặc xử lý chuỗi tác vụ phức tạp, người dùng thường gặp khó khăn trong việc nắm bắt tiến độ tổng thể, các đầu việc đã hoàn thành hay công việc đang chạy nếu chỉ nhìn vào luồng chat dài.

**dsh-session-progress** giải quyết triệt để vấn đề này với các công dụng nổi bật:

- **Tự động tiêm hướng dẫn vào System Prompt**: Yêu cầu AI Agent duy trì song song một file Markdown tóm tắt tiến độ tại thư mục tạm của hệ điều hành (`os.tmpdir()`), đảm bảo không làm ô nhiễm thư mục mã nguồn dự án của bạn.
- **Hỗ trợ YAML Frontmatter & Tính % Đa tầng**:
  - Đọc và bóc tách dữ liệu có cấu trúc ở đầu file (`progress: XX%`, `status: in_progress`, `current_activity: "..."`).
  - Tự động fallback đếm số lượng checklist Markdown (`- [x]`, `- [/]`, `- [ ]`) để tính tỷ lệ hoàn thành % nếu Agent quên khai báo số.
- **Tự động thích ứng ngôn ngữ (Language Alignment)**: Nếu bạn giao tiếp bằng tiếng Việt, Agent sẽ tự động viết toàn bộ tiêu đề (Tổng quan, Checklist, Hoạt động hiện tại, v.v.) và nội dung công việc bằng tiếng Việt; nếu chat bằng tiếng Anh sẽ tự động viết bằng tiếng Anh.
- **Nút tiến độ trực quan trên Top Header**: Tích hợp trực tiếp vào thanh điều hướng trên cùng, nằm ngay phía trước nút *Session log*, hiển thị số `%` và đổi sang màu xanh lá khi đạt 100%.
- **Ngăn kéo trượt Slide-over Side Drawer**: Click vào nút trên Header sẽ trượt ra một bảng thông tin 440px từ cạnh phải:
  - Thanh tiến độ đồ họa trực quan (Progress bar).
  - Trình đọc Markdown tích hợp sẵn định dạng checkbox, đầu việc rõ ràng.
  - Các nút thao tác nhanh: Mở file trên ứng dụng hệ điều hành (VS Code, Notepad) ở thanh chân trang (Footer), làm mới dữ liệu và đóng bảng trượt.

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

## 3. Cấu trúc file Markdown mẫu

```markdown
---
progress: 65%
status: in_progress
current_activity: "Đang chạy bộ kiểm thử wave 3"
---

# Tiến độ phiên làm việc: <Tiêu đề mục tiêu>

## Tổng quan
<Tóm tắt ngắn gọn mục tiêu phiên làm việc và trạng thái>

## Checklist
- [x] Bước 1 đã hoàn thành
- [/] Bước 2 đang xử lý
- [ ] Bước 3 đang chờ

## Hoạt động hiện tại
<Chi tiết công việc đang thực thi ngay lúc này>

## Các bước tiếp theo
<Các công việc dự kiến tiếp theo>

## Ghi chú quan trọng
<Các phát hiện, kết quả hoặc cảnh báo quan trọng>
```

---

## Giấy phép (License)

MIT © [nguyenduclong-ict](https://github.com/nguyenduclong-ict)
