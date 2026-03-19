(function (globalScope) {
  var STORAGE_KEY = "codex.mobile.message.board.state";
  var MAX_NAME_LENGTH = 24;
  var MAX_CONTENT_LENGTH = 280;
  var MAX_IMAGE_COUNT = 9;
  var RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
  var RATE_LIMIT_MAX = 3;
  var BURN_COUNTDOWN_MS = 60 * 1000;
  var BLOCKED_KEYWORDS = ["spam", "博彩", "广告", "贷款", "辱骂"];
  var BURN_AFTER_OPTIONS = [
    { value: "never", label: "长期可见", burnAfterRead: false },
    { value: "after_read", label: "焚烧", burnAfterRead: true }
  ];
  var STATUS_LABELS = {
    approved: "已发布",
    rejected: "已拒绝",
    hidden: "已隐藏",
    burned: "已焚毁"
  };
  var SEED_IMAGE_SET = [
    {
      name: "sunrise-window.svg",
      type: "image/svg+xml",
      dataUrl:
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480">' +
            '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="#f7d8b3"/><stop offset="100%" stop-color="#d8efe7"/>' +
            '</linearGradient></defs>' +
            '<rect width="480" height="480" rx="48" fill="url(#bg)"/>' +
            '<circle cx="336" cy="132" r="54" fill="#f4b56a"/>' +
            '<rect x="74" y="286" width="332" height="88" rx="22" fill="#f8f3ea"/>' +
            '<rect x="110" y="188" width="118" height="138" rx="18" fill="#fff8ef"/>' +
            '<rect x="250" y="156" width="120" height="170" rx="18" fill="#fff8ef"/>' +
            '<path d="M0 320 C98 282 168 314 252 278 C326 246 394 264 480 232 V480 H0 Z" fill="#7bb7a6"/>' +
            '<path d="M0 352 C88 334 154 346 236 326 C326 304 390 324 480 302 V480 H0 Z" fill="#4f8b7d"/>' +
          "</svg>"
        )
    },
    {
      name: "tea-table.svg",
      type: "image/svg+xml",
      dataUrl:
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480">' +
            '<rect width="480" height="480" rx="48" fill="#efe6db"/>' +
            '<rect x="62" y="82" width="356" height="316" rx="34" fill="#f9f4ed"/>' +
            '<ellipse cx="240" cy="290" rx="132" ry="54" fill="#d9b68a"/>' +
            '<circle cx="182" cy="230" r="46" fill="#ffffff"/>' +
            '<circle cx="182" cy="230" r="22" fill="#b67a4b"/>' +
            '<rect x="230" y="190" width="110" height="86" rx="20" fill="#9ebfa8"/>' +
            '<rect x="252" y="210" width="68" height="44" rx="14" fill="#f4efe6"/>' +
            '<circle cx="332" cy="176" r="18" fill="#f3c476"/>' +
            '<circle cx="356" cy="208" r="14" fill="#e8a96b"/>' +
          "</svg>"
        )
    },
    {
      name: "night-corner.svg",
      type: "image/svg+xml",
      dataUrl:
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480">' +
            '<defs><linearGradient id="night" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="#2d4c56"/><stop offset="100%" stop-color="#16252f"/>' +
            '</linearGradient></defs>' +
            '<rect width="480" height="480" rx="48" fill="url(#night)"/>' +
            '<circle cx="346" cy="116" r="40" fill="#f5e9bf"/>' +
            '<rect x="92" y="110" width="296" height="240" rx="28" fill="#27424d"/>' +
            '<rect x="120" y="138" width="100" height="184" rx="18" fill="#395d68"/>' +
            '<rect x="244" y="138" width="116" height="92" rx="18" fill="#5c8e82"/>' +
            '<rect x="244" y="246" width="116" height="76" rx="18" fill="#d7a877"/>' +
            '<circle cx="166" cy="200" r="22" fill="#f0c27c"/>' +
          "</svg>"
        )
    }
  ];

  function createMemoryStorage(seed) {
    var data = Object.assign({}, seed || {});
    return {
      getItem: function (key) {
        return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
      },
      setItem: function (key, value) {
        data[key] = String(value);
      },
      removeItem: function (key) {
        delete data[key];
      }
    };
  }

  function createBrowserStorage() {
    if (typeof globalScope.localStorage !== "undefined") {
      return globalScope.localStorage;
    }
    return createMemoryStorage();
  }

  function createId(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 10);
  }

  function normalizeText(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function normalizeKey(value) {
    return normalizeText(value).toLowerCase();
  }

  function formatTimestamp(value) {
    return new Date(value).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function buildAuditEvent(options) {
    return {
      id: createId("audit"),
      action: options.action,
      operator: options.operator,
      note: options.note || "",
      timestamp: options.timestamp,
      fromStatus: options.fromStatus || null,
      toStatus: options.toStatus || null
    };
  }

  function buildSeedMessages(nowValue) {
    var now = Number(nowValue);
    return [
      {
        id: "msg-seed-1",
        displayName: "早班访客",
        content: "手机上也很好看，发布入口很好找。",
        postType: "text",
        status: "approved",
        createdAt: now - 1000 * 60 * 80,
        publishedAt: now - 1000 * 60 * 72,
        images: [],
        burnAfterRead: false,
        burnViewedAt: null,
        burnAt: null,
        burnedAt: null,
        sourceId: "seed",
        auditTrail: [
          buildAuditEvent({
            action: "submitted",
            operator: "system",
            note: "seeded message",
            timestamp: now - 1000 * 60 * 80,
            toStatus: "approved"
          })
        ]
      },
      {
        id: "msg-seed-2",
        displayName: "夜间巡检",
        content: "发布即公开会更顺畅，后台主要负责隐藏异常内容。",
        postType: "text",
        status: "approved",
        createdAt: now - 1000 * 60 * 24,
        publishedAt: now - 1000 * 60 * 24,
        images: [],
        burnAfterRead: false,
        burnViewedAt: null,
        burnAt: null,
        burnedAt: null,
        sourceId: "seed",
        auditTrail: [
          buildAuditEvent({
            action: "submitted",
            operator: "system",
            note: "seeded message",
            timestamp: now - 1000 * 60 * 24,
            toStatus: "approved"
          })
        ]
      },
      {
        id: "msg-seed-4",
        displayName: "窗边来信",
        content: "今早的光线很好，顺手传两张。",
        postType: "image",
        status: "approved",
        createdAt: now - 1000 * 60 * 16,
        publishedAt: now - 1000 * 60 * 12,
        images: [SEED_IMAGE_SET[0], SEED_IMAGE_SET[1]],
        burnAfterRead: false,
        burnViewedAt: null,
        burnAt: null,
        burnedAt: null,
        sourceId: "seed",
        auditTrail: [
          buildAuditEvent({
            action: "submitted",
            operator: "system",
            note: "seeded image post",
            timestamp: now - 1000 * 60 * 16,
            toStatus: "approved"
          })
        ]
      },
      {
        id: "msg-seed-5",
        displayName: "晚安相册",
        content: "",
        postType: "image",
        status: "approved",
        createdAt: now - 1000 * 60 * 8,
        publishedAt: now - 1000 * 60 * 6,
        images: [SEED_IMAGE_SET[2]],
        burnAfterRead: false,
        burnViewedAt: null,
        burnAt: null,
        burnedAt: null,
        sourceId: "seed",
        auditTrail: [
          buildAuditEvent({
            action: "submitted",
            operator: "system",
            note: "seeded image post",
            timestamp: now - 1000 * 60 * 8,
            toStatus: "approved"
          })
        ]
      },
      {
        id: "msg-seed-3",
        displayName: "闪现留言",
        content: "这是一条焚烧示例，点开查看后会自动消失。",
        postType: "text",
        status: "approved",
        createdAt: now - 1000 * 60 * 180,
        publishedAt: now - 1000 * 60 * 170,
        images: [],
        burnAfterRead: true,
        burnViewedAt: null,
        burnAt: null,
        burnedAt: null,
        sourceId: "seed",
        auditTrail: [
          buildAuditEvent({
            action: "submitted",
            operator: "system",
            note: "seeded message",
            timestamp: now - 1000 * 60 * 180,
            toStatus: "approved"
          })
        ]
      }
    ];
  }

  function createInitialState(nowProvider) {
    var now = nowProvider();
    return {
      messages: buildSeedMessages(now),
      meta: {
        createdAt: now,
        updatedAt: now
      },
      rules: {
        maxNameLength: MAX_NAME_LENGTH,
        maxContentLength: MAX_CONTENT_LENGTH,
        maxImageCount: MAX_IMAGE_COUNT,
        rateLimitWindowMs: RATE_LIMIT_WINDOW_MS,
        rateLimitMax: RATE_LIMIT_MAX,
        burnCountdownMs: BURN_COUNTDOWN_MS,
        blockedKeywords: BLOCKED_KEYWORDS.slice(),
        burnAfterOptions: BURN_AFTER_OPTIONS.slice()
      }
    };
  }

  function parseState(rawValue) {
    if (!rawValue) {
      return null;
    }
    try {
      return JSON.parse(rawValue);
    } catch (error) {
      return null;
    }
  }

  function sortByCreated(messages) {
    return messages.slice().sort(function (left, right) {
      return right.createdAt - left.createdAt;
    });
  }

  function sortByPublished(messages) {
    return messages.slice().sort(function (left, right) {
      return (right.publishedAt || 0) - (left.publishedAt || 0);
    });
  }

  function migrateState(state) {
    if (!state || !Array.isArray(state.messages)) {
      return createInitialState(Date.now);
    }

    state.messages = state.messages.map(function (message) {
      if (message.status === "pending") {
        message.status = "approved";
        message.publishedAt = message.publishedAt || message.createdAt;
      }
      if (typeof message.burnAfterRead !== "boolean") {
        message.burnAfterRead = false;
      }
      if (!Array.isArray(message.images)) {
        message.images = [];
      }
      if (!message.postType) {
        message.postType = message.images.length ? "image" : "text";
      }
      if (typeof message.burnViewedAt === "undefined") {
        message.burnViewedAt = null;
      }
      if (typeof message.burnAt === "undefined") {
        message.burnAt = null;
      }
      if (message.burnAfterRead && message.burnViewedAt && !message.burnAt) {
        message.burnAt = message.burnViewedAt + BURN_COUNTDOWN_MS;
      }
      if (typeof message.burnedAt === "undefined") {
        message.burnedAt = null;
      }
      return message;
    });
    state.rules = state.rules || {};
    state.rules.maxNameLength = state.rules.maxNameLength || MAX_NAME_LENGTH;
    state.rules.maxContentLength = state.rules.maxContentLength || MAX_CONTENT_LENGTH;
    state.rules.maxImageCount = state.rules.maxImageCount || MAX_IMAGE_COUNT;
    state.rules.rateLimitWindowMs = state.rules.rateLimitWindowMs || RATE_LIMIT_WINDOW_MS;
    state.rules.rateLimitMax = state.rules.rateLimitMax || RATE_LIMIT_MAX;
    state.rules.burnCountdownMs = state.rules.burnCountdownMs || BURN_COUNTDOWN_MS;
    state.rules.blockedKeywords = state.rules.blockedKeywords || BLOCKED_KEYWORDS.slice();
    state.rules.burnAfterOptions = BURN_AFTER_OPTIONS.slice();
    state.meta = state.meta || { createdAt: Date.now(), updatedAt: Date.now() };
    return state;
  }

  function createMessageService(options) {
    var storage = options && options.storage ? options.storage : createBrowserStorage();
    var nowProvider = options && options.now ? options.now : Date.now;

    function startBurnCountdown(message, payload) {
      var timestamp = payload && payload.timestamp ? payload.timestamp : nowProvider();

      if (!message.burnViewedAt) {
        message.burnViewedAt = timestamp;
      }
      if (!message.burnAt) {
        message.burnAt = message.burnViewedAt + getRules().burnCountdownMs;
      }
      if (!message.auditTrail.some(function (entry) { return entry.action === "view"; })) {
        message.auditTrail.push(
          buildAuditEvent({
            action: "view",
            operator: payload && payload.operator ? payload.operator : "viewer",
            note: normalizeText(payload && payload.note) || "Burn countdown started",
            timestamp: message.burnViewedAt,
            fromStatus: "approved",
            toStatus: "approved"
          })
        );
      }
    }

    function expireBurnedMessages(state) {
      var changed = false;

      state.messages.forEach(function (message) {
        if (message.status !== "approved" || !message.burnAfterRead || !message.burnAt) {
          return;
        }
        if (nowProvider() < message.burnAt) {
          return;
        }
        message.status = "burned";
        message.burnedAt = message.burnAt;
        message.auditTrail.push(
          buildAuditEvent({
            action: "burn",
            operator: "system",
            note: "Burn countdown completed",
            timestamp: message.burnAt,
            fromStatus: "approved",
            toStatus: "burned"
          })
        );
        changed = true;
      });

      return changed;
    }

    function readState() {
      var current = parseState(storage.getItem(STORAGE_KEY));
      if (current) {
        current = migrateState(current);
        if (expireBurnedMessages(current)) {
          current.meta.updatedAt = nowProvider();
        }
        storage.setItem(STORAGE_KEY, JSON.stringify(current));
        return current;
      }
      var next = createInitialState(nowProvider);
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    }

    function writeState(state) {
      state.meta.updatedAt = nowProvider();
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function seedInitialData() {
      readState();
    }

    function resetState() {
      storage.removeItem(STORAGE_KEY);
      seedInitialData();
    }

    function getRules() {
      return readState().rules;
    }

    function getStats() {
      var messages = readState().messages;
      var counts = {
        total: messages.length,
        approved: 0,
        rejected: 0,
        hidden: 0,
        burned: 0,
        ephemeral: 0
      };

      messages.forEach(function (message) {
        if (typeof counts[message.status] === "number") {
          counts[message.status] += 1;
        }
        if (message.burnAfterRead) {
          counts.ephemeral += 1;
        }
      });

      return counts;
    }

    function listApprovedMessages() {
      var messages = readState().messages.filter(function (message) {
        return message.status === "approved";
      });
      return sortByPublished(messages);
    }

    function autoStartBurns(options) {
      var settings = options || {};
      var state = readState();
      var changed = false;

      state.messages.forEach(function (message) {
        if (message.status !== "approved" || !message.burnAfterRead || (message.burnViewedAt && message.burnAt)) {
          return;
        }
        startBurnCountdown(message, {
          operator: settings.operator || "viewer",
          note: settings.note || "Burn countdown started on public render"
        });
        changed = true;
      });

      if (changed) {
        writeState(state);
      }
    }

    function ensureBurnCountdownStarted(id, options) {
      var settings = options || {};
      var state = readState();
      var message = state.messages.find(function (item) {
        return item.id === id;
      });

      if (!message) {
        return null;
      }
      if (message.status !== "approved" || !message.burnAfterRead) {
        return Object.assign({}, message);
      }
      if (!message.burnAt) {
        startBurnCountdown(message, {
          operator: settings.operator || "viewer",
          note: settings.note || "Burn countdown started on public render"
        });
        writeState(state);
      }

      return Object.assign({}, message, {
        burnRemainingMs: message.burnAt ? Math.max(0, message.burnAt - nowProvider()) : null
      });
    }

    function listReadableMessages(options) {
      var settings = options || {};
      if (settings.autoStartBurn) {
        autoStartBurns(settings);
      }
      var state = readState();
      return sortByPublished(
        state.messages.filter(function (message) {
          return message.status === "approved";
        })
      ).map(function (message) {
        return Object.assign({}, message, {
          burnRemainingMs: message.burnAt ? Math.max(0, message.burnAt - nowProvider()) : null
        });
      });
    }

    function listMessages(filters) {
      var settings = filters || {};
      var query = normalizeKey(settings.query);
      var status = settings.status || "all";
      var messages = sortByCreated(readState().messages).filter(function (message) {
        var matchesStatus = status === "all" || message.status === status;
        if (!matchesStatus) {
          return false;
        }
        if (!query) {
          return true;
        }
        return [
          message.id,
          message.displayName,
          message.content,
          STATUS_LABELS[message.status] || message.status
        ].some(function (segment) {
          return normalizeKey(segment).indexOf(query) >= 0;
        });
      });
      return messages;
    }

    function getMessageById(id) {
      var messages = readState().messages;
      return messages.find(function (message) {
        return message.id === id;
      }) || null;
    }

    function getAuditTrail(id) {
      var message = getMessageById(id);
      if (!message) {
        return [];
      }
      return message.auditTrail.slice().sort(function (left, right) {
        return right.timestamp - left.timestamp;
      });
    }

    function validateSubmission(payload, existingMessages, timestamp) {
      var name = normalizeText(payload.displayName);
      var content = normalizeText(payload.content);
      var postType = normalizeText(payload.postType || "").toLowerCase() || (Array.isArray(payload.images) && payload.images.length ? "image" : "text");
      var sourceId = normalizeText(payload.sourceId || "browser");
      var rules = getRules();
      var burnAfterRead = normalizeText(payload.burnAfter || "never") === "after_read";
      var images = Array.isArray(payload.images) ? payload.images.slice(0, rules.maxImageCount) : [];

      if (!name) {
        return { ok: false, type: "validation", message: "请输入昵称。" };
      }
      if (name.length > rules.maxNameLength) {
        return { ok: false, type: "validation", message: "昵称超过长度限制。" };
      }
      if (postType !== "text" && postType !== "image") {
        return { ok: false, type: "validation", message: "发布类型无效，请重新选择。" };
      }
      if (postType === "text" && !content) {
        return { ok: false, type: "validation", message: "文字发布需要填写内容。" };
      }
      if (postType === "text" && images.length) {
        return { ok: false, type: "validation", message: "文字发布不能携带图片。" };
      }
      if (postType === "image" && !images.length) {
        return { ok: false, type: "validation", message: "图片发布至少选择 1 张图片。" };
      }
      if (content.length > rules.maxContentLength) {
        return {
          ok: false,
          type: "validation",
          message: "留言内容不能超过 " + rules.maxContentLength + " 个字符。"
        };
      }
      if (
        rules.blockedKeywords.some(function (keyword) {
          return content.indexOf(keyword) >= 0 || name.indexOf(keyword) >= 0;
        })
      ) {
        return { ok: false, type: "validation", message: "内容触发了拦截规则，请调整后再提交。" };
      }
      if (images.length > rules.maxImageCount) {
        return { ok: false, type: "validation", message: "最多只能上传 " + rules.maxImageCount + " 张图片。" };
      }

      var recentBySource = existingMessages.filter(function (message) {
        return message.sourceId === sourceId && timestamp - message.createdAt <= rules.rateLimitWindowMs;
      });
      if (recentBySource.length >= rules.rateLimitMax) {
        return { ok: false, type: "rate_limit", message: "提交过于频繁，请稍后再试。" };
      }

      return {
        ok: true,
        data: {
          displayName: name,
          content: content,
          postType: postType,
          images: images,
          sourceId: sourceId,
          burnAfterRead: burnAfterRead
        }
      };
    }

    function submitMessage(payload) {
      var state = readState();
      var timestamp = nowProvider();
      var validation = validateSubmission(payload || {}, state.messages, timestamp);

      if (!validation.ok) {
        return validation;
      }

      var nextMessage = {
        id: createId("msg"),
        displayName: validation.data.displayName,
        content: validation.data.content,
        postType: validation.data.postType,
        status: "approved",
        createdAt: timestamp,
        publishedAt: timestamp,
        images: validation.data.images,
        burnAfterRead: validation.data.burnAfterRead,
        burnViewedAt: null,
        burnAt: null,
        burnedAt: null,
        sourceId: validation.data.sourceId,
        auditTrail: [
          buildAuditEvent({
            action: "submitted",
            operator: "visitor",
            note:
              (validation.data.postType === "image" ? "Submitted image post" : "Submitted text post") +
              (validation.data.burnAfterRead ? " with burn-after-read" : ""),
            timestamp: timestamp,
            toStatus: "approved"
          })
        ]
      };

      state.messages.push(nextMessage);
      writeState(state);
      return {
        ok: true,
        type: "success",
        message: validation.data.burnAfterRead
          ? (validation.data.postType === "image" ? "图片已发布，首次查看后会开始 60 秒焚烧倒计时。" : "文字已发布，首次查看后会开始 60 秒焚烧倒计时。")
          : validation.data.postType === "image"
            ? "图片已发布，现在所有访客都可以看到。"
            : "文字已发布，现在所有访客都可以看到。",
        record: nextMessage
      };
    }

    function viewBurnMessage(payload) {
      var state = readState();
      var message = state.messages.find(function (item) {
        return item.id === payload.id;
      });
      if (!message) {
        return { ok: false, type: "missing", message: "目标留言不存在。" };
      }
      if (!message.burnAfterRead || message.status !== "approved") {
        return { ok: false, type: "transition", message: "该留言当前不能执行焚烧。" };
      }

      var timestamp = nowProvider();
      startBurnCountdown(message, {
        operator: payload.operator || "viewer",
        note: normalizeText(payload.note) || "Burn countdown started",
        timestamp: timestamp
      });
      writeState(state);
      return {
        ok: true,
        type: "success",
        message: "焚烧倒计时已开始。",
        record: Object.assign({}, message, {
          burnRemainingMs: Math.max(0, message.burnAt - timestamp)
        })
      };
    }

    function burnMessageNow(payload) {
      var state = readState();
      var message = state.messages.find(function (item) {
        return item.id === payload.id;
      });
      if (!message) {
        return { ok: false, type: "missing", message: "目标留言不存在。" };
      }
      if (message.status !== "approved") {
        return { ok: false, type: "transition", message: "该留言当前不能立即焚烧。" };
      }

      var timestamp = nowProvider();
      message.status = "burned";
      message.burnedAt = timestamp;
      message.auditTrail.push(
        buildAuditEvent({
          action: "burn",
          operator: payload.operator || "viewer",
          note: normalizeText(payload.note) || "Burned from public board",
          timestamp: timestamp,
          fromStatus: "approved",
          toStatus: "burned"
        })
      );
      writeState(state);
      return {
        ok: true,
        type: "success",
        message: "留言已焚烧。"
      };
    }

    function isValidTransition(currentStatus, action) {
      var rules = {
        approve: ["rejected", "hidden"],
        reject: ["approved", "hidden"],
        hide: ["approved"],
        restore: ["rejected", "hidden"]
      };
      return (rules[action] || []).indexOf(currentStatus) >= 0;
    }

    function targetStatusForAction(action) {
      return {
        approve: "approved",
        reject: "rejected",
        hide: "hidden",
        restore: "approved"
      }[action];
    }

    function updateMessageStatus(payload) {
      var state = readState();
      var action = payload.action;
      var message = state.messages.find(function (item) {
        return item.id === payload.id;
      });

      if (!message) {
        return { ok: false, type: "missing", message: "目标留言不存在。" };
      }
      if (!isValidTransition(message.status, action)) {
        return {
          ok: false,
          type: "transition",
          message: "当前状态不支持该操作。"
        };
      }

      var timestamp = nowProvider();
      var nextStatus = targetStatusForAction(action);
      var previousStatus = message.status;
      message.status = nextStatus;
      message.publishedAt = nextStatus === "approved" ? timestamp : message.publishedAt;
      if (nextStatus !== "burned") {
        message.burnedAt = message.status === "approved" ? null : message.burnedAt;
      }
      message.auditTrail.push(
        buildAuditEvent({
          action: action,
          operator: payload.operator || "Admin",
          note: normalizeText(payload.note),
          timestamp: timestamp,
          fromStatus: previousStatus,
          toStatus: nextStatus
        })
      );
      writeState(state);

      return {
        ok: true,
        type: "success",
        message: "留言状态已更新为 " + STATUS_LABELS[nextStatus] + "。",
        record: message
      };
    }

    function batchUpdate(payload) {
      var ids = payload.ids || [];
      if (!ids.length) {
        return { ok: false, type: "validation", message: "请先选择至少一条留言。" };
      }
      var state = readState();
      var invalid = [];
      ids.forEach(function (id) {
        var message = state.messages.find(function (item) {
          return item.id === id;
        });
        if (!message || !isValidTransition(message.status, payload.action)) {
          invalid.push(id);
        }
      });
      if (invalid.length) {
        return {
          ok: false,
          type: "transition",
          message: "部分留言无法执行该批量操作: " + invalid.join(", ")
        };
      }

      var results = ids.map(function (id) {
        return updateMessageStatus({
          id: id,
          action: payload.action,
          note: payload.note,
          operator: payload.operator
        });
      });

      return {
        ok: true,
        type: "success",
        message: "批量操作完成，共处理 " + results.length + " 条留言。",
        results: results
      };
    }

    return {
      seedInitialData: seedInitialData,
      resetState: resetState,
      getRules: getRules,
      getStats: getStats,
      listApprovedMessages: listApprovedMessages,
      autoStartBurns: autoStartBurns,
      ensureBurnCountdownStarted: ensureBurnCountdownStarted,
      listReadableMessages: listReadableMessages,
      listMessages: listMessages,
      getMessageById: getMessageById,
      getAuditTrail: getAuditTrail,
      submitMessage: submitMessage,
      viewBurnMessage: viewBurnMessage,
      burnMessageNow: burnMessageNow,
      updateMessageStatus: updateMessageStatus,
      batchUpdate: batchUpdate,
      statusLabels: Object.assign({}, STATUS_LABELS),
      burnAfterOptions: BURN_AFTER_OPTIONS.slice(),
      burnCountdownMs: BURN_COUNTDOWN_MS
    };
  }

  var api = {
    STORAGE_KEY: STORAGE_KEY,
    BLOCKED_KEYWORDS: BLOCKED_KEYWORDS.slice(),
    STATUS_LABELS: Object.assign({}, STATUS_LABELS),
    BURN_AFTER_OPTIONS: BURN_AFTER_OPTIONS.slice(),
    createMemoryStorage: createMemoryStorage,
    createBrowserStorage: createBrowserStorage,
    createMessageService: createMessageService,
    formatTimestamp: formatTimestamp
  };

  globalScope.MessageBoardApp = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
