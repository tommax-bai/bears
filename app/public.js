(function () {
  var app = window.MessageBoardApp;
  var sourceId = "public-demo-client";
  var service = app.createMessageService({ storage: app.createBrowserStorage() });
  var browserStorage = app.createBrowserStorage();
  var NICKNAME_KEY = "codex.mobile.message.board.nickname";
  var POST_TYPE_COPY = {
    image: {
      title: "发布图片帖",
      introTitle: "图片帖",
      introBody: "适合直接发相册，默认优先选择图片，支持一次最多 9 张。",
      contentLabel: "图片说明",
      placeholder: "给这组图片补一句说明也可以留空。",
      feedback: "图片帖默认先选图，再决定是否补一句说明。",
      submit: "发布图片",
      primaryRule: "图片帖至少选择 1 张图",
      showEmoji: false
    },
    text: {
      title: "发布文字帖",
      introTitle: "文字帖",
      introBody: "只发布纯文字内容，不携带图片，适合短留言或临时想法。",
      contentLabel: "文字内容",
      placeholder: "输入要公开发布的文字内容。",
      feedback: "文字帖只发布纯文字内容，不会附带图片。",
      submit: "发布文字",
      primaryRule: "文字帖必须填写内容",
      showEmoji: true
    }
  };

  service.seedInitialData();
  document.body.classList.add("gate-active");

  var summaryRoot = document.getElementById("publicSummary");
  var listRoot = document.getElementById("publicList");
  var publishDock = document.getElementById("publishDock");
  var publishMenu = document.getElementById("publishMenu");
  var publishToggle = document.getElementById("publishToggle");
  var launchImagePost = document.getElementById("launchImagePost");
  var launchTextPost = document.getElementById("launchTextPost");
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
  var chooseImagesButton = document.getElementById("chooseImages");
  var imagePreview = document.getElementById("imagePreview");
  var emojiPicker = document.getElementById("emojiPicker");
  var emojiSection = document.getElementById("emojiSection");
  var burnAfterInput = document.getElementById("burnAfter");
  var burnAfterSwitch = document.getElementById("burnAfterSwitch");
  var postTypeInput = document.getElementById("postType");
  var postTypeSwitch = document.getElementById("postTypeSwitch");
  var composerTitle = document.getElementById("composerTitle");
  var postModeIntro = document.getElementById("postModeIntro");
  var contentField = document.getElementById("contentField");
  var contentLabel = document.getElementById("contentLabel");
  var imageField = document.getElementById("imageField");
  var uploadNote = document.getElementById("uploadNote");
  var rulePrimary = document.getElementById("rulePrimary");
  var entryGate = document.getElementById("entryGate");
  var entryGrid = document.getElementById("entryGrid");
  var entryLogo = document.getElementById("entryLogo");
  var submitButton = document.getElementById("submitButton");
  var pullState = {
    startY: 0,
    active: false,
    ready: false
  };
  var IDLE_TIMEOUT_MS = 60 * 1000;
  var idleTimer = null;
  var feedRefreshTimer = null;
  var pendingImages = [];
  var currentPostType = "text";
  var publishMenuOpen = false;

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
    var usedCodes = {};
    var codes = [];

    while (codes.length < 9) {
      var code = String(Math.floor(Math.random() * 90) + 10);
      if (usedCodes[code]) {
        continue;
      }
      usedCodes[code] = true;
      codes.push(code);
    }

    entryGrid.innerHTML = shuffle(codes)
      .map(function (code) {
        return '<button class="entry-tile" type="button" data-code="' + code + '">' + code + "</button>";
      })
      .join("");
  }

  function closeEntryGate() {
    entryGate.classList.add("hidden");
    entryGate.setAttribute("aria-hidden", "true");
    document.body.classList.remove("gate-active");
    refreshFeed();
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
      '<p class="summary-inline">' +
      '<span class="summary-item"><span class="summary-label">公开中</span><strong class="summary-value">' + stats.approved + "</strong></span>" +
      '<span class="summary-separator">/</span>' +
      '<span class="summary-item"><span class="summary-label">焚烧</span><strong class="summary-value">' + stats.ephemeral + "</strong></span>" +
      '<span class="summary-separator">/</span>' +
      '<span class="summary-item"><span class="summary-label">已下线</span><strong class="summary-value">' + (stats.hidden + stats.burned) + "</strong></span>" +
      "</p>";
  }

  function formatRelativePublishedTime(value) {
    var timestamp = Number(value || 0);
    var diffMs = Math.max(0, Date.now() - timestamp);
    var seconds = Math.floor(diffMs / 1000);

    if (seconds < 10) {
      return "刚刚";
    }
    if (seconds < 60) {
      return seconds + " 秒前";
    }

    var minutes = Math.floor(seconds / 60);
    if (minutes < 10) {
      return minutes + " 分钟前";
    }
    if (minutes < 30) {
      return Math.floor(minutes / 10) * 10 + " 分钟前";
    }
    if (minutes < 60) {
      return "30 分钟前";
    }

    var hours = Math.floor(minutes / 60);
    if (hours < 6) {
      return hours + " 小时前";
    }
    if (hours < 24) {
      return Math.floor(hours / 3) * 3 + " 小时前";
    }

    var days = Math.floor(hours / 24);
    if (days < 7) {
      return days + " 天前";
    }

    var weeks = Math.floor(days / 7);
    if (weeks < 5) {
      return weeks + " 周前";
    }

    var months = Math.floor(days / 30);
    if (months < 12) {
      return months + " 个月前";
    }

    return Math.floor(days / 365) + " 年前";
  }

  function renderMessages() {
    var items = service.listReadableMessages({
      autoStartBurn: !document.body.classList.contains("gate-active"),
      operator: "viewer"
    });

    if (!items.length) {
      listRoot.innerHTML = '<div class="empty-state">暂时没有公开留言，试着提交第一条。</div>';
      return;
    }

    listRoot.innerHTML = items
      .map(function (message) {
        var hint = message.burnAfterRead ? '<span class="status-pill status-hidden">焚烧</span>' : "";
        var content = escapeHtml(message.content);
        var contentMarkup = content ? '<p class="message-content">' + content + "</p>" : "";
        var gallery = renderImageGallery(message.images || []);
        var countdown = message.burnAfterRead && message.burnAt
          ? '<div class="burn-countdown">焚烧倒计时 ' + formatCountdown(message.burnRemainingMs || 0) + " 秒</div>"
          : "";
        return (
          '<article class="message-card">' +
          '<div class="message-meta">' +
          '<strong>' +
          escapeHtml(message.displayName) +
          "</strong>" +
          hint +
          "<span>" +
          formatRelativePublishedTime(message.publishedAt || message.createdAt) +
          "</span>" +
          "</div>" +
          contentMarkup +
          gallery +
          countdown +
          '<button class="burn-icon-button" data-burn-now="' + message.id + '" aria-label="立即焚烧"><span class="pixel-flame" aria-hidden="true"></span></button>' +
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

  function updateModeFeedback() {
    setFeedback("neutral", POST_TYPE_COPY[currentPostType].feedback);
  }

  function setPublishMenuOpen(open) {
    publishMenuOpen = Boolean(open);
    publishMenu.classList.toggle("hidden", !publishMenuOpen);
    publishDock.classList.toggle("is-open", publishMenuOpen);
    publishMenu.setAttribute("aria-hidden", publishMenuOpen ? "false" : "true");
    publishToggle.setAttribute("aria-expanded", publishMenuOpen ? "true" : "false");
    publishToggle.setAttribute("aria-label", publishMenuOpen ? "关闭发布菜单" : "打开发布菜单");
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
      uploadNote.textContent = "最多上传 9 张图片。";
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
    uploadNote.textContent = "已选择 " + pendingImages.length + " / " + service.getRules().maxImageCount + " 张图片。";
  }

  function resetImages() {
    pendingImages = [];
    imageUploadInput.value = "";
    renderPendingImages();
  }

  function syncSelectedImages(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    var maxCount = service.getRules().maxImageCount;

    if (!files.length) {
      renderPendingImages();
      return;
    }

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
        setPostType("image");
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

  function setPostType(nextType) {
    var type = nextType === "image" ? "image" : "text";
    var copy = POST_TYPE_COPY[type];
    currentPostType = type;
    postTypeInput.value = type;
    composerTitle.textContent = copy.title;
    postModeIntro.innerHTML = "<strong>" + copy.introTitle + "</strong><span>" + copy.introBody + "</span>";
    contentLabel.textContent = copy.contentLabel;
    messageContentInput.placeholder = copy.placeholder;
    submitButton.textContent = copy.submit;
    rulePrimary.textContent = copy.primaryRule;
    imageField.classList.toggle("hidden", type !== "image");
    emojiSection.classList.toggle("hidden", !copy.showEmoji);
    contentField.classList.toggle("text-only", type === "text");

    Array.prototype.slice.call(postTypeSwitch.querySelectorAll(".post-type-option")).forEach(function (button) {
      var isActive = button.getAttribute("data-post-type") === type;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    updateModeFeedback();
  }

  function showComposer(nextType, options) {
    var config = options || {};
    markActivity();
    setPublishMenuOpen(false);
    composerSheet.classList.remove("hidden");
    composerSheet.setAttribute("aria-hidden", "false");
    setPostType(nextType || currentPostType);
    displayNameInput.value = loadSavedNickname();
    setTimeout(function () {
      if (config.openImagePicker && currentPostType === "image") {
        imageUploadInput.click();
      }
      if (displayNameInput.value) {
        if (currentPostType === "text") {
          messageContentInput.focus();
        }
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
    messageForm.reset();
    displayNameInput.value = loadSavedNickname();
    setBurnAfterMode("never");
    resetImages();
    setPostType(currentPostType);
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
      postType: postTypeInput.value,
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
    setBurnAfterMode("never");
    resetImages();
    setPostType(postTypeInput.value || currentPostType);
    hideComposer();
  });

  launchImagePost.addEventListener("click", function () {
    showComposer("image", { openImagePicker: true });
  });

  launchTextPost.addEventListener("click", function () {
    showComposer("text");
  });

  publishToggle.addEventListener("click", function () {
    markActivity();
    setPublishMenuOpen(!publishMenuOpen);
  });

  closeComposer.addEventListener("click", hideComposer);
  sheetBackdrop.addEventListener("click", hideComposer);
  resetComposer.addEventListener("click", resetForm);

  chooseImagesButton.addEventListener("click", function () {
    markActivity();
    imageUploadInput.click();
  });

  postTypeSwitch.addEventListener("click", function (event) {
    var target = event.target;
    if (!target.classList.contains("post-type-option")) {
      return;
    }
    markActivity();
    setPostType(target.getAttribute("data-post-type"));
  });

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

  document.addEventListener("click", function (event) {
    if (!publishMenuOpen) {
      return;
    }
    if (publishDock.contains(event.target)) {
      return;
    }
    setPublishMenuOpen(false);
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
  setPostType("text");
  setPublishMenuOpen(false);
  renderEntryGrid();
  renderPendingImages();

  listRoot.addEventListener("click", function (event) {
    var target = event.target;
    var burnNowButton = target.closest(".burn-icon-button");
    if (burnNowButton) {
      markActivity();
      var burnNowResult = service.burnMessageNow({
        id: burnNowButton.getAttribute("data-burn-now"),
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
    var burnViewButton = target.closest(".burn-button");
    if (!burnViewButton) {
      return;
    }
    markActivity();

    var result = service.viewBurnMessage({
      id: burnViewButton.getAttribute("data-id"),
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
