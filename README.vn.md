# dsh-session-progress

[English](README.md) | [Tiếng Việt](README.vn.md)

---

## 1. Mô tả công dụng của Plugin

**Biết chính xác phiên làm việc dài của agent đã đi tới đâu — không cần lục lại log.** `dsh-session-progress` là plugin theo dõi tiến độ công việc theo thời gian thực cho **DeepSeek Harness (DSH / DSH Desktop)**: agent giữ một checklist sống của công việc, phần trăm hoàn thành được tính từ các ô đã tick, và mỗi session lưu tất cả trong một file JSON.

<sub>Từ khoá: plugin DSH · DeepSeek Harness · tiến độ session · checklist có trọng số · theo dõi task · file tiến độ JSON</sub>

<p align="center">
  <img src="assets/preview.png" alt="Panel Session Progress hiển thị dưới dạng tab native của right sidebar" width="800" />
</p>

<p align="center">
  <img src="assets/composer-button.png" alt="Nút tiến độ và popover trong hàng dock dưới ô nhập liệu" width="800" />
</p>

<p align="center"><sub>Cả hai ảnh được render từ chính HTML/CSS của plugin bằng <code>npm run shots</code>.</sub></p>

Trong các phiên làm việc dài hoặc chuỗi tác vụ phức tạp, rất khó để biết tiến độ tổng thể, đầu việc đang chạy hay bước tiếp theo nếu chỉ nhìn vào luồng chat dài. Plugin này giữ câu trả lời trong một cú click:

- **Checklist sống thay vì phỏng đoán** — agent ghi lại việc đang làm thành các task có trọng số, lồng nhau từ cả một giai đoạn xuống một bước nhỏ, và tick dần khi làm xong.
- **Phần trăm luôn khớp thực tế** — vòng tròn và pill `%` ở hàng dock dưới ô nhập liệu được tính từ các ô checkbox (done `1` · running `½` · pending `0`), nên không ai phải tự cộng và agent không bao giờ phải ghi số %.
- **Một panel, không phải log** — tab **Session Progress** trong right sidebar của DSH hiển thị mục tiêu, checklist có trọng số kèm % từng item, hoạt động hiện tại, bước tiếp theo và ghi chú.
- **Một bản ghi khi phiên kết thúc** — chính file đó là bản tóm tắt rõ ràng những gì đã làm, và file Markdown của v0.10.x được migrate sang JSON tự động ở lần đọc đầu tiên.

### Vị trí hiển thị

Plugin render **ngay trong right sidebar của DSH** — không tự vẽ lớp phủ riêng nên không tranh chỗ với layout của app:

| Thành phần | Vị trí |
| --- | --- |
| Vòng tròn tiến độ + pill `%` | Hàng dock dưới ô nhập liệu, kế bên context meter (ẩn khi chưa có session) |
| Panel tiến độ | Tab native của right sidebar, tên **Session Progress** |

Bấm nút trên thanh nhập liệu (hoặc dòng *Click to open the progress panel* trong popover) sẽ mở tab đó và mở rộng cột phải. Vì là tab thật của sidebar, nó dock/float/split và bám theo session giống tab Files hay Document Preview.

> **Yêu cầu**: bản DSH phải có slot tab của right sidebar (`rightbar.session`, `sidebar.right.pane.tab`) — tức DSH Desktop 0.9.0 trở lên.
>
> **Ghi chú tương thích (v0.11.1)**: tiến độ giờ được lưu bằng **file JSON** thay vì Markdown, và checklist là **cây phân cấp có trọng số**. Mỗi item khai báo `weight`, nên % trên vòng tròn được **tự tính** từ các ô checkbox — agent không bao giờ phải ghi số % nữa. File Markdown của v0.10.x sẽ tự động được migrate sang JSON ở lần đọc đầu tiên, giữ nguyên checklist. Nút tiến độ trên thanh nhập liệu được ẩn ở màn tạo conversation mới (chưa có gì để báo cáo), và các section trong panel dùng lại kiểu tiêu đề có thanh accent của bản cũ.
>
> **Ghi chú tương thích (v0.10.6)**: DSH Desktop 0.10.0 (harness 0.1.7) đổi nguồn session id hiện tại và thêm tiền tố `session-` cho session id. Client giờ lấy session hiện tại qua `uiSession`, host chấp nhận cả hai cách viết id, đồng thời vẫn hỗ trợ hình dạng dữ liệu của 0.9.x/0.10.0.

---

## 2. File tiến độ (JSON)

Mỗi session có một file JSON (`dsh-progress-<session>-<uuid>.json`, nằm trong thư mục temp của hệ thống) chứa toàn bộ tài liệu:

```json
{
  "version": 2,
  "title": "Chuyển tiến độ sang JSON có trọng số",
  "status": "in_progress",
  "currentActivity": "Viết lại host",
  "overview": "Chuyển lưu trữ từ Markdown sang JSON.",
  "checklist": [
    { "text": "Thiết kế schema",   "weight": 20, "state": "done",    "children": [] },
    { "text": "Viết lại host",     "weight": 30, "state": "running", "children": [] },
    { "text": "Hoàn thiện panel",  "weight": 50, "state": "pending", "children": [
      { "text": "Render cây",       "weight": 25, "state": "pending", "children": [] },
      { "text": "Hiện trọng số",    "weight": 25, "state": "pending", "children": [] }
    ] }
  ],
  "nextSteps": "1. Cập nhật README",
  "notes": "schema = v2"
}
```

### Cách tính % 

`weight` là tỉ lệ của item **so với các item cùng cấp**, được chuẩn hoá để mỗi nhóm luôn là 100%:

```
share(item) = share(parent) × weight(item) / Σ weight(các item cùng cấp)
```

Nhờ vậy cả hai cách viết ở ví dụ trên đều cho cùng kết quả: ba trọng số cấp 1 (`20 / 30 / 50`, tức % của toàn bộ công việc) và hai trọng số con (`25 / 25`, cộng lại bằng `50` của item cha). Item không khai báo trọng số được tính là `1`; một nhóm không được trộn lẫn item có trọng số và item mặc định.

Tiến độ của một node: item lá được `1` khi `done`, `½` khi `running`, `0` khi `pending`; item nhóm là trung bình có trọng số của các con và `state` của nó được suy ra — tick một nhóm sẽ cascade `done` xuống toàn bộ cây con. `status` cũng được suy ra (mọi lá xong ⇒ `completed`, có tiến độ ⇒ `in_progress`, chưa bắt đầu ⇒ `starting`); `blocked` là status duy nhất do người/agent tự đặt.

### Các tool dành cho agent

| Tool | Công dụng |
| --- | --- |
| `session_progress_status` | Cách rẻ nhất để nhìn đầu mỗi lượt: hoạt động hiện tại, bước đang làm, các bước kế tiếp và kế hoạch. |
| `session_progress_check_done` | Kết thúc bước đang làm: tick bước đó, đưa bước `[ ]` kế tiếp sang running và tự tính lại %. |
| `session_progress_write` | Tạo tài liệu (`content`) hoặc patch (`checklist` + `checklist_mode`, `add`, `update`, `check`, `start`, `uncheck`, `remove`, và các trường văn bản). |
| `session_progress_read` | Đọc toàn bộ tài liệu, hoặc chỉ các section được chỉ định. |

Không tool nào nhận tham số % — con số luôn đi theo các ô checkbox.

### Lưu ý

- Vì trọng số được chuẩn hoá, đổi trọng số một item sẽ đổi tỉ lệ của các item cùng cấp. Hãy đọc lại `weightPercent` từ `session_progress_read` / `session_progress_status` khi cần tỉ lệ chính xác.
- Một item lồng tối đa 6 cấp; tài liệu tối đa 400 item và nên dưới ~40 KB.
- Matcher (`#3` = dòng hiển thị, `#2.1` = đường dẫn, hoặc một đoạn text) phải khớp đúng một item. Matcher không tồn tại hoặc mơ hồ sẽ bị từ chối kèm danh sách item, và không có gì bị ghi.
- Panel hiển thị tỉ lệ đã tính của từng item dưới dạng badge `%`, nên trọng số khai báo và con số trên màn hình không thể lệch nhau.

---

## 3. Hướng dẫn cài đặt

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

## Câu hỏi thường gặp (FAQ)

**Agent có phải tự ghi phần trăm không?**
Không. Không có tool call nào truyền số % — phần trăm đi theo các ô checkbox, nên đổi trọng số hay tick thêm một ô là vòng tròn cập nhật ngay.

**Dữ liệu tiến độ được lưu ở đâu?**
Mỗi session một file JSON trong thư mục temp của hệ thống. Không ghi gì vào repository của bạn, và chính file đó là thứ panel đọc lại.

**File Markdown của v0.10.x thì sao?**
Được migrate sang schema JSON ngay lần đầu session đó được đọc — giữ nguyên checklist, trọng số và các ô đã tick.

**Cần bản DSH nào?**
Bản DSH phải có slot tab của right sidebar (`rightbar.session`, `sidebar.right.pane.tab`): DSH Desktop 0.9.0 trở lên, hoặc bản DSH CLI/web có right sidebar. Nút trên composer tự ẩn khi chưa có session nào để báo cáo.

---

## Giấy phép (License)

MIT © [nguyenduclong-ict](https://github.com/nguyenduclong-ict)
