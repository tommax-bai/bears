(function () {
  var app = window.MessageBoardApp;
  var service = app.createMessageService({ storage: app.createBrowserStorage() });
  service.seedInitialData();

  var summaryRoot = document.getElementById("adminSummary");
  var listRoot = document.getElementById("adminList");
  var detailRoot = document.getElementById("detailCard");
  var statusFilter = document.getElementById("statusFilter");
  var searchInput = document.getElementById("searchInput");
  var actionNote = document.getElementById("actionNote");
  var selectionCount = document.getElementById("selectionCount");
  var visibleCount = document.getElementById("visibleCount");
  var adminFeedback = document.getElementById("adminFeedback");
  var selectVisible = document.getElementById("selectVisible");
  var refreshAdmin = document.getElementById("refreshAdmin");
  var toggleFilters = document.getElementById("toggleFilters");
  var filterPanel = document.getElementById("filterPanel");

  var state = {
    selectedIds: [],
    focusedId: null
  };

  function currentFilters() {
    return {
      status: statusFilter.value,
      query: searchInput.value
    };
  }

  function visibleMessages() {
    return service.listMessages(currentFilters());
  }

  function renderSummary() {
    var stats = service.getStats();
    summaryRoot.innerHTML = [
      summaryCard("公开中", stats.approved, "会出现在前台留言板"),
      summaryCard("焚烧", stats.ephemeral, "开启后首次查看会销毁"),
      summaryCard("已隐藏", stats.hidden, "从公开页下架"),
      summaryCard("已焚毁", stats.burned, "查看后已自动销毁")
    ].join("");
  }

  function renderList() {
    var items = visibleMessages();
    var selectedLookup = {};
    state.selectedIds.forEach(function (id) {
      selectedLookup[id] = true;
    });

    visibleCount.textContent = "当前结果 " + items.length + " 条";
    selectionCount.textContent = "已选 " + state.selectedIds.length + " 条";
    selectVisible.checked = items.length > 0 && items.every(function (item) {
      return selectedLookup[item.id];
    });

    if (!items.length) {
      listRoot.innerHTML = '<div class="empty-state">当前筛选条件下没有匹配留言。</div>';
      return;
    }

    listRoot.innerHTML = items
      .map(function (message) {
        return (
          '<article class="queue-card' +
          (state.focusedId === message.id ? " selected" : "") +
          '" data-id="' +
          message.id +
          '">' +
          '<div class="queue-head">' +
          '<label class="checkbox-label">' +
          '<input class="row-select" type="checkbox" data-id="' +
          message.id +
          '"' +
          (selectedLookup[message.id] ? " checked" : "") +
          " />" +
          "<span>" +
          escapeHtml(message.displayName) +
          "</span>" +
          "</label>" +
          '<span class="status-pill status-' +
          message.status +
          '">' +
          service.statusLabels[message.status] +
          "</span>" +
          "</div>" +
          '<div class="queue-main">' +
          '<div class="queue-meta">' +
          "<span>ID " +
          message.id +
          "</span>" +
          "<span>提交 " +
          app.formatTimestamp(message.createdAt) +
          "</span>" +
          (message.publishedAt ? "<span>发布 " + app.formatTimestamp(message.publishedAt) + "</span>" : "") +
          "</div>" +
          '<p class="message-content">' +
          escapeHtml(message.content) +
          "</p>" +
          "</div>" +
          '<div class="queue-actions">' +
          quickActions(message) +
          '<button class="text-button inspect-button" data-id="' +
          message.id +
          '">查看详情</button>' +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderDetail() {
    if (!state.focusedId) {
      detailRoot.className = "detail-empty";
      detailRoot.textContent = "选择一条留言后，可查看完整内容、当前状态和审计记录。";
      return;
    }

    var message = service.getMessageById(state.focusedId);
    if (!message) {
      state.focusedId = null;
      renderDetail();
      return;
    }

    var auditTrail = service.getAuditTrail(message.id);
    detailRoot.className = "detail-card";
    detailRoot.innerHTML =
      '<div class="detail-stack">' +
      "<div>" +
      '<div class="queue-meta">' +
      '<span class="status-pill status-' +
      message.status +
      '">' +
      service.statusLabels[message.status] +
      "</span>" +
      "<span>" +
      message.id +
      "</span>" +
      "</div>" +
      '<h3 style="margin-top:12px;">' +
      escapeHtml(message.displayName) +
      "</h3>" +
      '<p class="detail-content">' +
      escapeHtml(message.content) +
      "</p>" +
      "</div>" +
      '<div class="detail-grid">' +
      "<div>创建时间<strong>" +
      app.formatTimestamp(message.createdAt) +
      "</strong></div>" +
      "<div>发布时间<strong>" +
      (message.publishedAt ? app.formatTimestamp(message.publishedAt) : "尚未发布") +
      "</strong></div>" +
      "<div>来源<strong>" +
      escapeHtml(message.sourceId) +
      "</strong></div>" +
      "<div>焚毁模式<strong>" +
      (message.burnAfterRead ? "焚烧" : "长期可见") +
      "</strong></div>" +
      "<div>审计条数<strong>" +
      auditTrail.length +
      "</strong></div>" +
      "</div>" +
      "<div>" +
      '<p class="eyebrow">Audit Trail</p>' +
      '<div class="audit-list">' +
      auditTrail.map(renderAuditRow).join("") +
      "</div>" +
      "</div>" +
      "</div>";
  }

  function renderAuditRow(entry) {
    return (
      '<div class="audit-row">' +
      "<strong>" +
      escapeHtml(entry.operator) +
      " / " +
      escapeHtml(entry.action) +
      "</strong>" +
      "<span>" +
      app.formatTimestamp(entry.timestamp) +
      "</span>" +
      "<span>状态: " +
      (entry.fromStatus ? service.statusLabels[entry.fromStatus] : "无") +
      " → " +
      (entry.toStatus ? service.statusLabels[entry.toStatus] : "无") +
      "</span>" +
      "<span>备注: " +
      escapeHtml(entry.note || "无") +
      "</span>" +
      "</div>"
    );
  }

  function summaryCard(title, value, note) {
    return (
      '<article class="summary-card">' +
      "<span>" +
      title +
      "</span>" +
      "<strong>" +
      value +
      "</strong>" +
      "<span>" +
      note +
      "</span>" +
      "</article>"
    );
  }

  function quickActions(message) {
    var actions = [];
    if (message.status === "approved") {
      actions.push(buttonForAction("hide", "隐藏", message.id));
      actions.push(buttonForAction("reject", "撤下", message.id));
    }
    if (message.status === "rejected" || message.status === "hidden") {
      actions.push(buttonForAction("restore", "恢复", message.id));
    }
    return actions.join("");
  }

  function buttonForAction(action, label, id) {
    return (
      '<button class="chip-button row-action" data-action="' +
      action +
      '" data-id="' +
      id +
      '">' +
      label +
      "</button>"
    );
  }

  function setFeedback(type, text) {
    adminFeedback.className = "feedback " + type;
    adminFeedback.textContent = text;
  }

  function syncSelection() {
    var visibleIds = visibleMessages().map(function (message) {
      return message.id;
    });
    state.selectedIds = state.selectedIds.filter(function (id) {
      return visibleIds.indexOf(id) >= 0;
    });
  }

  function rerender() {
    syncSelection();
    renderSummary();
    renderList();
    renderDetail();
  }

  function updateSingle(id, action) {
    var result = service.updateMessageStatus({
      id: id,
      action: action,
      note: actionNote.value,
      operator: "Admin"
    });
    if (!result.ok) {
      setFeedback("error", result.message);
      return;
    }
    state.focusedId = id;
      setFeedback("success", result.message);
      rerender();
  }

  function runBatch(action) {
    var result = service.batchUpdate({
      ids: state.selectedIds.slice(),
      action: action,
      note: actionNote.value,
      operator: "Admin"
    });
    if (!result.ok) {
      setFeedback(result.type === "transition" ? "warning" : "error", result.message);
      return;
    }
    state.focusedId = state.selectedIds[0] || state.focusedId;
    state.selectedIds = [];
    setFeedback("success", result.message);
    rerender();
  }

  function toggleSelection(id, checked) {
    var next = state.selectedIds.slice();
    if (checked && next.indexOf(id) < 0) {
      next.push(id);
    }
    if (!checked) {
      next = next.filter(function (currentId) {
        return currentId !== id;
      });
    }
    state.selectedIds = next;
    renderList();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  statusFilter.addEventListener("change", rerender);
  searchInput.addEventListener("input", rerender);
  refreshAdmin.addEventListener("click", rerender);

  toggleFilters.addEventListener("click", function () {
    filterPanel.classList.toggle("open");
  });

  selectVisible.addEventListener("change", function (event) {
    if (!event.target.checked) {
      state.selectedIds = [];
      renderList();
      return;
    }
    state.selectedIds = visibleMessages().map(function (message) {
      return message.id;
    });
    renderList();
  });

  listRoot.addEventListener("click", function (event) {
    var target = event.target;
    if (target.classList.contains("inspect-button")) {
      state.focusedId = target.getAttribute("data-id");
      renderList();
      renderDetail();
      return;
    }
    if (target.classList.contains("row-action")) {
      updateSingle(target.getAttribute("data-id"), target.getAttribute("data-action"));
      return;
    }
    var card = target.closest(".queue-card");
    if (card) {
      state.focusedId = card.getAttribute("data-id");
      renderList();
      renderDetail();
    }
  });

  listRoot.addEventListener("change", function (event) {
    var target = event.target;
    if (target.classList.contains("row-select")) {
      toggleSelection(target.getAttribute("data-id"), target.checked);
    }
  });

  Array.prototype.slice
    .call(document.querySelectorAll("[data-batch-action]"))
    .forEach(function (button) {
      button.addEventListener("click", function () {
        runBatch(button.getAttribute("data-batch-action"));
      });
    });

  rerender();
})();
