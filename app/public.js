(function () {
  var app = window.MessageBoardApp;
  var sourceId = "public-demo-client";
  var service = app.createMessageService({ storage: app.createBrowserStorage() });
  var browserStorage = app.createBrowserStorage();
  var NICKNAME_KEY = "codex.mobile.message.board.nickname";
  service.seedInitialData();
  document.body.classList.add("gate-active");

  var summaryRoot = document.getElementById("publicSummary");
  var listRoot = document.getElementById("publicList");
  var openComposer = document.getElementById("openComposer");
  var floatingCompose = document.getElementById("floatingCompose");
  var composerSheet = document.getElementById("composerSheet");
  var sheetBackdrop = document.getElementById("sheetBackdrop");
  var closeComposer = document.getElementById("closeComposer");
  var resetComposer = document.getElementById("resetComposer");
  var pullHint = document.getElementById("pullHint");
  var messageForm = document.getElementById("messageForm");
  var feedback = document.getElementById("submitFeedback");
  var displayNameInput = document.getElementById("displayName");
  var messageContentInput = document.getElementById("messageContent");
  var imageUploadInput = document.getElementById("imageUpload");
  var imagePreview = document.getElementById("imagePreview");
  var emojiPicker = document.getElementById("emojiPicker");
  var burnAfterInput = document.getElementById("burnAfter");
  var burnAfterSwitch = document.getElementById("burnAfterSwitch");
  var entryGate = document.getElementById("entryGate");
  var entryGrid = document.getElementById("entryGrid");
  var entryLogo = document.getElementById("entryLogo");
  var pullState = {
    startY: 0,
    active: false,
    ready: false
  };
  var IDLE_TIMEOUT_MS = 60 * 1000;
  var idleTimer = null;
  var feedRefreshTimer = null;
  var pendingImages = [];

  function loadSavedNickname() {
    return (browserStorage.getItem(NICKNAME_KEY) || "").trim();
  }

  function saveNickname(value) {
    var nickname = String(value || "").trim();
    if (!nickname) {
      return;
    }
    browserStorage.setItem(NICKNAME_KEY, nickname);
  }

  function shuffle(values) {
    var result = values.slice();
    for (var i = result.length - 1; i > 0; i -= 1) {
      var swapIndex = Math.floor(Math.random() * (i + 1));
      var current = result[i];
      result[i] = result[swapIndex];
      result[swapIndex] = current;
    }
    return result;
  }

  function renderEntryGrid() {
    var firstDigit = String(Math.floor(Math.random() * 9) + 1);
    var secondDigits = shuffle(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    entryGrid.innerHTML = secondDigits
      .map(function (digit) {
        return '<button class="entry-tile" type="button" data-code="' + firstDigit + digit + '">' + firstDigit + digit + "</button>";
      })
      .join("");
  }

  function closeEntryGate() {
    entryGate.classList.add("hidden");
    entryGate.setAttribute("aria-hidden", "true");
    document.body.classList.remove("gate-active");
  }

  function openEntryGate() {
    hideComposer();
    renderEntryGrid();
    entryGate.classList.remove("hidden");
    entryGate.setAttribute("aria-hidden", "false");
    document.body.classList.add("gate-active");
  }

  function clearIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function scheduleIdleTimer() {
    clearIdleTimer();
    if (document.body.classList.contains("gate-active")) {
      return;
    }
    idleTimer = setTimeout(function () {
      openEntryGate();
    }, IDLE_TIMEOUT_MS);
  }

  function markActivity() {
    scheduleIdleTimer();
  }

  function enterFromTrigger(trigger) {
    if (trigger) {
      trigger.classList.add("is-pressed");
    }
    setTimeout(function () {
      closeEntryGate();
      scheduleIdleTimer();
    }, 140);
  }

  function renderSummary() {
    var stats = service.getStats();
    summaryRoot.innerHTML =
      '<p class="summary-inline">公开中 ' +
      stats.approved +
      " 条，焚烧 " +
      stats.ephemeral +
      " 条，已下线 " +
      (stats.hidden + stats.burned) +
      " 条。</p>";
  }

  function renderMessages() {
    var items = service.listReadableMessages();
    if (!items.length) {
      listRoot.innerHTML = '<div class="empty-state">暂时没有公开留言，试着提交第一条。</div>';
      return;
    }

    listRoot.innerHTML = items
      .map(function (message) {
        var action = message.burnAfterRead
          ? '<button class="chip-button burn-button" data-id="' + message.id + '">' + (message.burnAt ? "焚烧中" : "查看") + "</button>"
          : "";
        var hint = message.burnAfterRead ? '<span class="status-pill status-hidden">焚烧</span>' : "";
        var content = message.burnAfterRead
          ? message.burnAt
            ? escapeHtml(message.content)
            : "这是一条焚烧留言，点击下方按钮后会开始 60 秒焚烧倒计时。"
          : escapeHtml(message.content);
        var countdown = message.burnAfterRead && message.burnAt
          ? '<div class="burn-countdown">焚烧倒计时 ' + formatCountdown(message.burnRemainingMs || 0) + " 秒</div>"
          : "";
        return (
          '<article class="message-card">' +
          '<div class="message-meta">' +
          '<button class="burn-icon-button" data-burn-now="' + message.id + '" aria-label="立即焚烧">🔥</button>' +
          '<strong>' +
          escapeHtml(message.displayName) +
          "</strong>" +
          hint +
          "<span>" +
          app.formatTimestamp(message.publishedAt || message.createdAt) +
          "</span>" +
          "</div>" +
          '<p class="message-content">' + content + "</p>" +
          renderImageGallery(message.images || []) +
          countdown +
          action +
          "</article>"
        );
      })
      .join("");
  }

  function renderImageGallery(images) {
    if (!images.length) {
      return "";
    }
    return (
      '<div class="message-gallery">' +
      images
        .map(function (image, index) {
          return '<img class="message-image" src="' + escapeHtml(image.dataUrl) + '" alt="留言图片 ' + (index + 1) + '" loading="lazy" />';
        })
        .join("") +
      "</div>"
    );
  }

  function setFeedback(type, text) {
    feedback.className = "feedback " + type;
    feedback.textContent = text;
  }

  function refreshFeed() {
    renderSummary();
    renderMessages();
  }

  function formatCountdown(ms) {
    return Math.max(0, Math.ceil(ms / 1000));
  }

  function setPullHint(text, ready) {
    pullHint.textContent = text;
    pullHint.classList.toggle("ready", Boolean(ready));
  }

  function ensureFeedRefreshTimer() {
    if (feedRefreshTimer) {
      return;
    }
    feedRefreshTimer = setInterval(function () {
      if (document.body.classList.contains("gate-active")) {
        return;
      }
      refreshFeed();
    }, 1000);
  }

  function insertEmoji(emoji) {
    var start = messageContentInput.selectionStart || 0;
    var end = messageContentInput.selectionEnd || 0;
    var currentValue = messageContentInput.value || "";
    messageContentInput.value = currentValue.slice(0, start) + emoji + currentValue.slice(end);
    var nextPosition = start + emoji.length;
    messageContentInput.focus();
    messageContentInput.setSelectionRange(nextPosition, nextPosition);
  }

  function renderPendingImages() {
    if (!pendingImages.length) {
      imagePreview.innerHTML = "";
      return;
    }
    imagePreview.innerHTML = pendingImages
      .map(function (image, index) {
        return (
          '<div class="preview-card">' +
          '<img class="preview-image" src="' + escapeHtml(image.dataUrl) + '" alt="待上传图片 ' + (index + 1) + '" />' +
          '<button type="button" class="preview-remove" data-index="' + index + '">移除</button>' +
          "</div>"
        );
      })
      .join("");
  }

  function resetImages() {
    pendingImages = [];
    imageUploadInput.value = "";
    renderPendingImages();
  }

  function syncSelectedImages(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    var maxCount = service.getRules().maxImageCount;

    if (files.length + pendingImages.length > maxCount) {
      setFeedback("warning", "最多只能上传 " + maxCount + " 张图片。");
      imageUploadInput.value = "";
      return;
    }

    Promise.all(
      files.map(function (file) {
        return new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onload = function () {
            resolve({
              name: file.name,
              type: file.type,
              dataUrl: reader.result
            });
          };
          reader.onerror = function () {
            reject(new Error("图片读取失败"));
          };
          reader.readAsDataURL(file);
        });
      })
    )
      .then(function (images) {
        pendingImages = pendingImages.concat(images).slice(0, maxCount);
        renderPendingImages();
        imageUploadInput.value = "";
      })
      .catch(function () {
        setFeedback("error", "图片读取失败，请重试。");
      });
  }

  function setBurnAfterMode(value) {
    burnAfterInput.value = value;
    Array.prototype.slice.call(burnAfterSwitch.querySelectorAll(".mode-option")).forEach(function (button) {
      var isActive = button.getAttribute("data-value") === value;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function showComposer() {
    markActivity();
    composerSheet.classList.remove("hidden");
    composerSheet.setAttribute("aria-hidden", "false");
    displayNameInput.value = loadSavedNickname();
    setTimeout(function () {
      if (displayNameInput.value) {
        messageContentInput.focus();
        return;
      }
      displayNameInput.focus();
    }, 30);
  }

  function hideComposer() {
    composerSheet.classList.add("hidden");
    composerSheet.setAttribute("aria-hidden", "true");
  }

  function resetForm() {
    displayNameInput.value = loadSavedNickname();
    messageForm.reset();
    displayNameInput.value = loadSavedNickname();
    resetImages();
    setFeedback("neutral", "普通留言会立即公开，焚烧留言会在首次查看后自动消失。");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  messageForm.addEventListener("submit", function (event) {
    event.preventDefault();
    markActivity();
    var result = service.submitMessage({
      displayName: displayNameInput.value,
      content: messageContentInput.value,
      images: pendingImages,
      sourceId: sourceId,
      burnAfter: burnAfterInput.value
    });

    if (!result.ok) {
      if (result.type === "rate_limit") {
        setFeedback("warning", result.message);
      } else {
        setFeedback("error", result.message);
      }
      return;
    }

    saveNickname(displayNameInput.value);
    setFeedback("success", result.message);
    renderSummary();
    renderMessages();
    messageForm.reset();
    displayNameInput.value = loadSavedNickname();
    resetImages();
  });

  [openComposer, floatingCompose].forEach(function (button) {
    if (!button) {
      return;
    }
    button.addEventListener("click", showComposer);
  });

  closeComposer.addEventListener("click", hideComposer);
  sheetBackdrop.addEventListener("click", hideComposer);
  resetComposer.addEventListener("click", resetForm);

  burnAfterSwitch.addEventListener("click", function (event) {
    var target = event.target;
    if (!target.classList.contains("mode-option")) {
      return;
    }
    setBurnAfterMode(target.getAttribute("data-value"));
    markActivity();
  });

  emojiPicker.addEventListener("click", function (event) {
    var target = event.target;
    if (!target.classList.contains("emoji-option")) {
      return;
    }
    markActivity();
    insertEmoji(target.getAttribute("data-emoji") || "");
  });

  imageUploadInput.addEventListener("change", function (event) {
    markActivity();
    syncSelectedImages(event.target.files);
  });

  imagePreview.addEventListener("click", function (event) {
    var target = event.target;
    if (!target.classList.contains("preview-remove")) {
      return;
    }
    pendingImages.splice(Number(target.getAttribute("data-index")), 1);
    renderPendingImages();
  });

  entryGrid.addEventListener("click", function (event) {
    var target = event.target;
    if (!target.classList.contains("entry-tile")) {
      return;
    }
    target.classList.remove("is-pressed");
    void target.offsetWidth;
    target.classList.add("is-pressed");
    setTimeout(function () {
      target.classList.remove("is-pressed");
    }, 140);
  });

  entryLogo.addEventListener("click", function () {
    enterFromTrigger(entryLogo);
  });

  window.addEventListener(
    "touchstart",
    function (event) {
      if (document.body.classList.contains("gate-active") || !window.scrollY) {
        pullState.startY = event.touches[0].clientY;
        pullState.active = true;
        pullState.ready = false;
      }
    },
    { passive: true }
  );

  window.addEventListener(
    "touchmove",
    function (event) {
      if (!pullState.active) {
        return;
      }
      var distance = event.touches[0].clientY - pullState.startY;
      if (distance > 72) {
        pullState.ready = true;
        setPullHint("松开刷新", true);
      } else if (distance > 18) {
        setPullHint("继续下拉刷新", false);
      }
    },
    { passive: true }
  );

  window.addEventListener("touchend", function () {
    if (!pullState.active) {
      return;
    }
    if (pullState.ready) {
      setPullHint("刷新中...", true);
      refreshFeed();
      setTimeout(function () {
        setPullHint("下拉刷新", false);
      }, 500);
    } else {
      setPullHint("下拉刷新", false);
    }
    pullState.active = false;
    pullState.ready = false;
    markActivity();
  });

  ["click", "keydown", "scroll"].forEach(function (eventName) {
    window.addEventListener(
      eventName,
      function () {
        if (document.body.classList.contains("gate-active")) {
          return;
        }
        markActivity();
      },
      { passive: true }
    );
  });

  displayNameInput.value = loadSavedNickname();
  setBurnAfterMode(burnAfterInput.value || "never");
  renderEntryGrid();
  renderPendingImages();

  listRoot.addEventListener("click", function (event) {
    var target = event.target;
    if (target.classList.contains("burn-icon-button")) {
      markActivity();
      var burnNowResult = service.burnMessageNow({
        id: target.getAttribute("data-burn-now"),
        operator: "viewer"
      });
      if (burnNowResult.ok) {
        setFeedback("success", "该留言已立即焚烧。");
        refreshFeed();
        return;
      }
      setFeedback("warning", burnNowResult.message);
      return;
    }
    if (!target.classList.contains("burn-button")) {
      return;
    }
    markActivity();

    var result = service.viewBurnMessage({
      id: target.getAttribute("data-id"),
      operator: "viewer"
    });
    if (result.ok) {
      setFeedback("success", "该焚烧留言已开始倒计时。");
      refreshFeed();
      return;
    }
    setFeedback("warning", result.message);
  });

  ensureFeedRefreshTimer();
  refreshFeed();
})();
