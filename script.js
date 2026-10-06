const STORAGE_KEY = "deadline-tracker-items-v1";

const form = document.querySelector("#deadline-form");
const titleInput = document.querySelector("#deadline-title");
const dateInput = document.querySelector("#deadline-date");
const formMessage = document.querySelector("#form-message");
const deadlineList = document.querySelector("#deadline-list");
const emptyState = document.querySelector("#empty-state");
const deadlineCount = document.querySelector("#deadline-count");
const storageMessage = document.querySelector("#storage-message");

let deadlines = [];
let storageAvailable = true;

// Build task IDs without depending on a library.
function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isValidDeadline(item) {
  return (
    item &&
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    Number.isFinite(Date.parse(item.createdAt)) &&
    Number.isFinite(Date.parse(item.deadlineAt)) &&
    Array.isArray(item.tasks) &&
    item.tasks.every(
      (task) =>
        task &&
        typeof task.id === "string" &&
        typeof task.text === "string" &&
        typeof task.completed === "boolean",
    ) &&
    typeof item.completed === "boolean" &&
    (item.completedAt === null || Number.isFinite(Date.parse(item.completedAt)))
  );
}

// Read saved data once; malformed data is reported instead of being silently replaced.
function loadDeadlines() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || !parsed.every(isValidDeadline)) {
      throw new Error("Dữ liệu deadline đã lưu không đúng định dạng.");
    }
    return parsed;
  } catch (error) {
    storageAvailable = false;
    showStorageError(
      error instanceof Error
        ? `Không thể đọc dữ liệu đã lưu (${error.message}). Hãy kiểm tra quyền truy cập bộ nhớ trình duyệt.`
        : "Không thể đọc dữ liệu đã lưu trong trình duyệt.",
    );
    return [];
  }
}

function showStorageError(message) {
  storageMessage.textContent = message;
  storageMessage.hidden = false;
  form.querySelectorAll("input, button").forEach((control) => {
    control.disabled = true;
  });
}

function saveDeadlines() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deadlines));
    return true;
  } catch (error) {
    showStorageError(
      error instanceof Error
        ? `Không thể lưu thay đổi (${error.message}). Dữ liệu hiện tại có thể chưa được lưu.`
        : "Không thể lưu thay đổi vào bộ nhớ trình duyệt.",
    );
    return false;
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(dateString));
}

function getTaskProgress(item) {
  if (item.completed) return { complete: item.tasks.length, total: item.tasks.length, percent: 100 };
  const complete = item.tasks.filter((task) => task.completed).length;
  const total = item.tasks.length;
  return { complete, total, percent: total === 0 ? 0 : Math.round((complete / total) * 100) };
}

function getTimeProgress(item, now) {
  const start = Date.parse(item.createdAt);
  const end = Date.parse(item.deadlineAt);
  const stop = item.completed && item.completedAt ? Date.parse(item.completedAt) : now;
  if (end <= start) return 100;
  return Math.round(Math.max(0, Math.min(1, (stop - start) / (end - start))) * 100);
}

function getStatus(item, now) {
  if (item.completed) return { className: "tone-completed", label: "Completed", icon: "✓" };
  const remaining = Date.parse(item.deadlineAt) - now;
  if (remaining <= 0) return { className: "tone-expired", label: "Đã hết hạn", icon: "●" };
  if (remaining <= 24 * 60 * 60 * 1000) {
    return { className: "tone-urgent", label: "Rất gần", icon: "!" };
  }
  if (remaining <= 3 * 24 * 60 * 60 * 1000) {
    return { className: "tone-soon", label: "Sắp đến", icon: "◷" };
  }
  return { className: "tone-safe", label: "Còn thời gian", icon: "◷" };
}

function formatCountdown(item, now) {
  if (item.completed) return { text: "Đã hoàn thành 🎉", className: "completed-text" };

  let remaining = Date.parse(item.deadlineAt) - now;
  if (remaining <= 0) return { text: "Đã hết hạn", className: "expired-text" };

  const day = Math.floor(remaining / 86_400_000);
  remaining %= 86_400_000;
  const hour = Math.floor(remaining / 3_600_000);
  remaining %= 3_600_000;
  const minute = Math.floor(remaining / 60_000);
  const second = Math.floor((remaining % 60_000) / 1000);
  return {
    text: `${String(day).padStart(2, "0")} ngày ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`,
    className: "",
  };
}

function renderDeadline(item, now) {
  const status = getStatus(item, now);
  const countdown = formatCountdown(item, now);
  const timePercent = getTimeProgress(item, now);
  const taskProgress = getTaskProgress(item);
  const isRunning = !item.completed && Date.parse(item.deadlineAt) > now;
  const tasksMarkup = item.tasks
    .map(
      (task) => `
        <li class="task-row${task.completed ? " is-complete" : ""}">
          <input
            class="task-checkbox"
            type="checkbox"
            data-action="toggle-task"
            data-task-id="${escapeHtml(task.id)}"
            aria-label="Đánh dấu ${escapeHtml(task.text)} ${task.completed ? "chưa hoàn thành" : "hoàn thành"}"
            ${task.completed ? "checked" : ""}
            ${item.completed ? "disabled" : ""}
          />
          <span class="task-text">${escapeHtml(task.text)}</span>
          <button
            class="task-delete"
            type="button"
            data-action="delete-task"
            data-task-id="${escapeHtml(task.id)}"
            aria-label="Xóa công việc ${escapeHtml(task.text)}"
            ${item.completed ? "disabled" : ""}
          >×</button>
        </li>`,
    )
    .join("");

  return `
    <article class="deadline-card ${status.className}${isRunning ? " is-running" : ""}" data-id="${escapeHtml(item.id)}">
      <div class="card-heading">
        <div class="card-title-wrap">
          <h3 class="card-title"><span aria-hidden="true">📌</span> ${escapeHtml(item.title)}</h3>
          <p class="card-meta">Deadline: <strong>${escapeHtml(formatDate(item.deadlineAt))}</strong></p>
        </div>
        <span class="status-pill"><span aria-hidden="true">${status.icon}</span> ${status.label}</span>
      </div>

      <div class="countdown-panel">
        <span class="hourglass" aria-hidden="true">⏳</span>
        <div class="countdown-copy">
          <div class="countdown-label">Thời gian còn lại</div>
          <div class="countdown ${countdown.className}" aria-live="off">${countdown.text}</div>
        </div>
      </div>

      <div class="progress-block">
        <div class="progress-heading"><span>⏳ Thời gian đã trôi</span><span class="progress-value">${timePercent}%</span></div>
        <div class="progress-track" role="progressbar" aria-label="Thời gian đã trôi" aria-valuenow="${timePercent}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-fill" style="width: ${timePercent}%"></div>
        </div>
      </div>
      <div class="progress-block">
        <div class="progress-heading">
          <span>✅ Tiến độ công việc <span class="task-count">(${taskProgress.complete}/${taskProgress.total})</span></span>
          <span class="progress-value">${taskProgress.percent}%</span>
        </div>
        <div class="progress-track" role="progressbar" aria-label="Tiến độ công việc" aria-valuenow="${taskProgress.percent}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-fill" style="width: ${taskProgress.percent}%"></div>
        </div>
      </div>

      <section class="tasks-section" aria-label="Công việc nhỏ">
        <div class="tasks-heading"><span>Danh sách công việc</span><span>${item.tasks.length} task</span></div>
        <ul class="task-list">${tasksMarkup || '<li class="task-row"><span class="task-text">Chưa có task nhỏ nào.</span></li>'}</ul>
        <form class="add-task-form" data-action="add-task">
          <input class="add-task-input" type="text" name="task" maxlength="120" placeholder="Thêm một việc nhỏ..." aria-label="Tên task mới" ${item.completed ? "disabled" : ""} />
          <button class="add-task-button" type="submit" aria-label="Thêm task" ${item.completed ? "disabled" : ""}>＋</button>
        </form>
      </section>

      <div class="card-actions">
        <button class="button complete-button" type="button" data-action="complete" ${item.completed ? "disabled" : ""}>
          ${item.completed ? "✓ Đã hoàn thành" : "✓ Hoàn thành tất cả"}
        </button>
        <button class="button delete-button" type="button" data-action="delete">🗑 Xóa</button>
      </div>
    </article>`;
}

// Redraw cards from persisted state so task actions and countdowns stay in sync.
function render() {
  const now = Date.now();
  deadlineList.innerHTML = deadlines.map((item) => renderDeadline(item, now)).join("");
  if (!storageAvailable) {
    deadlineList.querySelectorAll("input, button").forEach((control) => {
      control.disabled = true;
    });
  }
  emptyState.hidden = deadlines.length > 0;
  deadlineCount.textContent = `${deadlines.length} deadline${deadlines.length === 1 ? "" : "s"}`;
  form.querySelectorAll("input, button").forEach((control) => {
    control.disabled = !storageAvailable;
  });
}

function updateCountdowns() {
  const now = Date.now();
  deadlines.forEach((item) => {
    const card = deadlineList.querySelector(`[data-id="${CSS.escape(item.id)}"]`);
    if (!card) return;

    const status = getStatus(item, now);
    const countdown = formatCountdown(item, now);
    const timePercent = getTimeProgress(item, now);
    const countdownElement = card.querySelector(".countdown");
    const statusElement = card.querySelector(".status-pill");
    const timeProgress = card.querySelector('[aria-label="Thời gian đã trôi"]');
    const timeValue = card.querySelector(".progress-block .progress-value");
    const timeFill = card.querySelector(".progress-fill");
    const wasRunning = card.classList.contains("is-running");
    const isRunning = !item.completed && Date.parse(item.deadlineAt) > now;

    card.className = `deadline-card ${status.className}${isRunning ? " is-running" : ""}`;
    countdownElement.textContent = countdown.text;
    countdownElement.className = `countdown ${countdown.className}`;
    statusElement.innerHTML = `<span aria-hidden="true">${status.icon}</span> ${status.label}`;
    timeProgress.setAttribute("aria-valuenow", String(timePercent));
    timeValue.textContent = `${timePercent}%`;
    timeFill.style.width = `${timePercent}%`;

    if (wasRunning !== isRunning) {
      const completeButton = card.querySelector('[data-action="complete"]');
      if (completeButton && !item.completed) completeButton.disabled = false;
    }
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  formMessage.textContent = "";

  const title = titleInput.value.trim();
  const deadlineDate = new Date(dateInput.value);
  if (!title || Number.isNaN(deadlineDate.getTime())) {
    formMessage.textContent = "Vui lòng nhập tên và chọn ngày giờ deadline hợp lệ.";
    return;
  }

  const item = {
    id: createId(),
    title,
    createdAt: new Date().toISOString(),
    deadlineAt: deadlineDate.toISOString(),
    tasks: [],
    completed: false,
    completedAt: null,
  };
  deadlines.push(item);
  if (!saveDeadlines()) {
    deadlines.pop();
    return;
  }

  form.reset();
  render();
  titleInput.focus();
});

deadlineList.addEventListener("change", (event) => {
  const checkbox = event.target.closest('[data-action="toggle-task"]');
  if (!checkbox) return;

  const card = checkbox.closest(".deadline-card");
  const item = deadlines.find((deadline) => deadline.id === card.dataset.id);
  const task = item?.tasks.find((entry) => entry.id === checkbox.dataset.taskId);
  if (!item || !task || item.completed) return;

  task.completed = checkbox.checked;
  if (!saveDeadlines()) task.completed = !checkbox.checked;
  render();
});

deadlineList.addEventListener("submit", (event) => {
  const taskForm = event.target.closest('[data-action="add-task"]');
  if (!taskForm) return;
  event.preventDefault();

  const item = deadlines.find((deadline) => deadline.id === taskForm.closest(".deadline-card").dataset.id);
  const input = taskForm.elements.task;
  const text = input.value.trim();
  if (!item || item.completed || !text) return;

  const task = { id: createId(), text, completed: false };
  item.tasks.push(task);
  if (!saveDeadlines()) item.tasks.pop();
  render();
});

deadlineList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const card = button.closest(".deadline-card");
  const item = deadlines.find((deadline) => deadline.id === card?.dataset.id);
  if (!item) return;

  if (button.dataset.action === "complete") {
    if (item.completed) return;
    const previousTaskStates = item.tasks.map((task) => task.completed);
    item.tasks.forEach((task) => {
      task.completed = true;
    });
    item.completed = true;
    item.completedAt = new Date().toISOString();
    if (!saveDeadlines()) {
      item.completed = false;
      item.completedAt = null;
      item.tasks.forEach((task, index) => {
        task.completed = previousTaskStates[index];
      });
      render();
      return;
    }
    render();
  } else if (button.dataset.action === "delete-task") {
    if (item.completed) return;
    const taskIndex = item.tasks.findIndex((task) => task.id === button.dataset.taskId);
    if (taskIndex < 0) return;
    const [removedTask] = item.tasks.splice(taskIndex, 1);
    if (!saveDeadlines()) item.tasks.splice(taskIndex, 0, removedTask);
    render();
  } else if (button.dataset.action === "delete") {
    if (!window.confirm(`Bạn có chắc muốn xóa deadline "${item.title}" không?`)) return;
    const itemIndex = deadlines.findIndex((deadline) => deadline.id === item.id);
    const [removedItem] = deadlines.splice(itemIndex, 1);
    if (!saveDeadlines()) deadlines.splice(itemIndex, 0, removedItem);
    render();
  }
});

deadlines = loadDeadlines();
render();
window.setInterval(updateCountdowns, 1000);
