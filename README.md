# dsh-session-progress

[English](#english) | [Tiếng Việt](#tiếng-việt)

---

<a name="english"></a>
## English

### 1. Purpose & Overview

**dsh-session-progress** is a real-time session progress and task tracking plugin for **DeepSeek Harness (DSH / DSH Desktop)**.

In long-running or complex agentic sessions, it is often challenging for users to quickly determine the overall completion status, active subtasks, or upcoming milestones without sifting through extensive conversation logs. 

**dsh-session-progress** solves this by:
- **System Prompt Injection**: Automatically injects prompt instructions that direct the AI Agent to maintain a structured Markdown progress file in the OS temporary directory (`os.tmpdir()`).
- **Structured YAML Frontmatter & Dual-Engine % Calculation**:
  - Automatically extracts progress percentage, execution status (`starting`, `in_progress`, `blocked`, `completed`), and the active step from the file's YAML frontmatter.
  - Automatically falls back to parsing standard Markdown task checklists (`- [x]`, `- [/]`, `- [ ]`) if frontmatter is omitted.
- **Adaptive Language Alignment**: Instructs the Agent to match the conversation language (e.g., Vietnamese, English) for all section headers, checklists, and task summaries while maintaining English YAML keys.
- **Top Header Live Button**: Mounts directly into DSH's native header slot (`conversation.session.header.utilities`) adjacent to the *Session log* button, showing a live percentage pill badge (`📋 Progress XX%`).
- **Slide-over Side Drawer**: Opens a smooth 440px right-side panel featuring:
  - A visual gradient progress bar and active status indicators.
  - Formatted Markdown viewer with rendered checkboxes and highlighted sections.
  - Quick action buttons to open the raw file in the OS default editor (VS Code, Notepad), copy markdown, or trigger instant refresh.

---

### 2. Installation Guide

#### For DSH Desktop

##### Windows (PowerShell)
```powershell
cd "$env:APPDATA\dsh-desktop\harness\profiles\web"
& "$env:APPDATA\dsh-desktop\harness\.desktop-bin\pnpm.cmd" add https://github.com/nguyenduclong-ict/dsh-session-progress
```

##### macOS (Terminal)
```bash
cd "$HOME/Library/Application Support/dsh-desktop/harness/profiles/web"
"$HOME/Library/Application Support/dsh-desktop/harness/.desktop-bin/pnpm" add https://github.com/nguyenduclong-ict/dsh-session-progress
```

##### Linux (Terminal)
```bash
cd "$HOME/.config/dsh-desktop/harness/profiles/web"
"$HOME/.config/dsh-desktop/harness/.desktop-bin/pnpm" add https://github.com/nguyenduclong-ict/dsh-session-progress
```

> **Note**: Restart **DSH Desktop** after installation to activate the plugin.

---

#### For DSH CLI (Standalone)

Run the following command in your terminal:

```bash
dsh plugin --profile web add https://github.com/nguyenduclong-ict/dsh-session-progress
```

Or install directly within your Cordis workspace profile:

```bash
pnpm add https://github.com/nguyenduclong-ict/dsh-session-progress
```

---

<a name="tiếng-việt"></a>
## Tiếng Việt

### 1. Công dụng của Plugin

**dsh-session-progress** là plugin theo dõi tiến độ công việc và phiên làm việc theo thời gian thực dành cho **DeepSeek Harness (DSH / DSH Desktop)**.

Trong các phiên làm việc dài hoặc xử lý nhiều tác vụ phức tạp, người dùng thường gặp khó khăn trong việc nắm bắt tiến độ tổng thể, các đầu việc đã hoàn thành hay công việc đang chạy nếu chỉ nhìn vào luồng chat dài.

**dsh-session-progress** giải quyết triệt để vấn đề này với các công dụng nổi bật:
- **Tự động tiêm hướng dẫn vào System Prompt**: Yêu cầu AI Agent duy trì song song một file Markdown tóm tắt tiến độ tại thư mục tạm của hệ điều hành (`os.tmpdir()`), đảm bảo không làm ô nhiễm thư mục code dự án của bạn.
- **Hỗ trợ YAML Frontmatter & Tính % Đa tầng**:
  - Đọc và bóc tách dữ liệu có cấu trúc ở đầu file (`progress: XX%`, `status: in_progress`, `current_activity: "..."`).
  - Tự động fallback đếm số lượng checklist Markdown (`- [x]`, `- [/]`, `- [ ]`) để tính tỷ lệ hoàn thành % nếu Agent quên khai báo số.
- **Tự động thích ứng ngôn ngữ (Language Alignment)**: Nếu bạn giao tiếp bằng tiếng Việt, Agent sẽ tự động viết toàn bộ tiêu đề, checklist và nội dung công việc bằng tiếng Việt; nếu chat tiếng Anh sẽ viết bằng tiếng Anh.
- **Nút tiến độ trực quan trên Top Header**: Tích hợp trực tiếp vào thanh điều hướng trên cùng, nằm ngay trước nút *Session log*, hiển thị số `%` và đổi màu xanh lá khi đạt 100%.
- **Ngăn kéo trượt Slide-over Side Drawer**: Click vào nút trên Header sẽ trượt ra một bảng thông tin 440px từ cạnh phải:
  - Thanh tiến độ đồ họa trực quan (Progress bar).
  - Trình đọc Markdown tích hợp sẵn định dạng checkbox, đầu việc rõ ràng.
  - Các nút thao tác nhanh: Mở file trên ứng dụng hệ điều hành (VS Code, Notepad), sao chép nội dung Markdown, làm mới dữ liệu.

---

### 2. Hướng dẫn cài đặt

#### Dành cho DSH Desktop

##### Trên Windows (PowerShell)
```powershell
cd "$env:APPDATA\dsh-desktop\harness\profiles\web"
& "$env:APPDATA\dsh-desktop\harness\.desktop-bin\pnpm.cmd" add https://github.com/nguyenduclong-ict/dsh-session-progress
```

##### Trên macOS (Terminal)
```bash
cd "$HOME/Library/Application Support/dsh-desktop/harness/profiles/web"
"$HOME/Library/Application Support/dsh-desktop/harness/.desktop-bin/pnpm" add https://github.com/nguyenduclong-ict/dsh-session-progress
```

##### Trên Linux (Terminal)
```bash
cd "$HOME/.config/dsh-desktop/harness/profiles/web"
"$HOME/.config/dsh-desktop/harness/.desktop-bin/pnpm" add https://github.com/nguyenduclong-ict/dsh-session-progress
```

> **Lưu ý**: Sau khi lệnh cài đặt hoàn tất, hãy khởi động lại ứng dụng **DSH Desktop** để plugin bắt đầu hoạt động.

---

#### Dành cho DSH CLI

Nếu bạn sử dụng giao diện dòng lệnh `dsh`:

```bash
dsh plugin --profile web add https://github.com/nguyenduclong-ict/dsh-session-progress
```

Hoặc cài đặt trực tiếp qua `pnpm` trong thư mục profile Cordis:

```bash
pnpm add https://github.com/nguyenduclong-ict/dsh-session-progress
```

---

## License

MIT © [nguyenduclong-ict](https://github.com/nguyenduclong-ict)
