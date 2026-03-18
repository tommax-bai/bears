const assert = require("assert");
const {
  createMemoryStorage,
  createMessageService
} = require("../app/message-board.js");

let currentTime = Date.UTC(2026, 2, 17, 9, 0, 0);

function now() {
  return currentTime;
}

function advanceMinutes(minutes) {
  currentTime += minutes * 60 * 1000;
}

function createService() {
  const service = createMessageService({
    storage: createMemoryStorage(),
    now
  });
  service.seedInitialData();
  return service;
}

function createServiceWithState(state) {
  return createMessageService({
    storage: createMemoryStorage({
      "codex.mobile.message.board.state": JSON.stringify(state)
    }),
    now
  });
}

function run() {
  const service = createService();

  assert.strictEqual(service.listApprovedMessages().length, 5, "seed should expose five approved messages");
  assert.strictEqual(service.getStats().approved, 5, "seed should include five approved messages");
  assert.strictEqual(service.getStats().ephemeral, 1, "seed should include one burn-after-read message");

  const valid = service.submitMessage({
    displayName: "测试访客",
    content: "这个留言板在手机上录入很顺手。",
    postType: "text",
    sourceId: "tester"
  });
  assert.strictEqual(valid.ok, true, "valid submission should succeed");
  assert.strictEqual(valid.record.status, "approved", "new submission should publish immediately");
  assert.strictEqual(valid.record.postType, "text", "text submission should persist post type");
  assert.strictEqual(valid.record.images.length, 0, "text submission should not store images");

  const imagePost = service.submitMessage({
    displayName: "图片访客",
    content: "发一组现场图。",
    postType: "image",
    images: [
      {
        name: "demo.png",
        type: "image/png",
        dataUrl: "data:image/png;base64,AAAA"
      }
    ],
    sourceId: "image-tester"
  });
  assert.strictEqual(imagePost.ok, true, "image submission should succeed");
  assert.strictEqual(imagePost.record.postType, "image", "image submission should persist post type");
  assert.strictEqual(imagePost.record.images.length, 1, "uploaded images should persist with the message");

  const invalidTextWithImage = service.submitMessage({
    displayName: "混发用户",
    content: "这条不应该通过。",
    postType: "text",
    images: [
      {
        name: "mix.png",
        type: "image/png",
        dataUrl: "data:image/png;base64,AAAA"
      }
    ],
    sourceId: "mix-client"
  });
  assert.strictEqual(invalidTextWithImage.ok, false, "text mode should reject images");
  assert.strictEqual(invalidTextWithImage.type, "validation", "mixed text/image should be a validation error");

  const invalidImageWithoutFile = service.submitMessage({
    displayName: "空图片用户",
    content: "",
    postType: "image",
    images: [],
    sourceId: "empty-image-client"
  });
  assert.strictEqual(invalidImageWithoutFile.ok, false, "image mode should require at least one image");

  const imageLimit = service.submitMessage({
    displayName: "九宫格访客",
    postType: "image",
    images: new Array(9).fill(null).map((_, index) => ({
      name: "img-" + index + ".png",
      type: "image/png",
      dataUrl: "data:image/png;base64,AAAA"
    })),
    sourceId: "gallery-client"
  });
  assert.strictEqual(imageLimit.ok, true, "image mode should accept up to nine images");

  const blocked = service.submitMessage({
    displayName: "广告账号",
    content: "这是广告内容，请联系我。",
    sourceId: "tester"
  });
  assert.strictEqual(blocked.ok, false, "blocked keyword should fail");
  assert.strictEqual(blocked.type, "validation", "blocked keyword should be a validation failure");

  advanceMinutes(1);
  const rateService = service;
  ["第一条限流测试留言", "第二条限流测试留言", "第三条限流测试留言"].forEach((content) => {
    const result = rateService.submitMessage({
      displayName: "高频访客",
      content,
      sourceId: "rate-limit-client"
    });
    assert.strictEqual(result.ok, true, "initial rate-limit submissions should pass");
  });

  const rateLimited = rateService.submitMessage({
    displayName: "高频访客",
    content: "第四条限流测试留言",
    sourceId: "rate-limit-client"
  });
  assert.strictEqual(rateLimited.ok, false, "fourth quick submission should be blocked");
  assert.strictEqual(rateLimited.type, "rate_limit", "rate-limit response type should be preserved");

  const burnCandidate = service.submitMessage({
    displayName: "闪现用户",
    content: "这是一条会在查看后焚毁的留言。",
    postType: "text",
    sourceId: "burn-client",
    burnAfter: "after_read"
  });
  assert.strictEqual(burnCandidate.ok, true, "burn-after-read submission should succeed");
  assert.strictEqual(burnCandidate.record.burnAfterRead, true, "record should persist burn-after-read mode");

  const autoStartedReadable = service.listReadableMessages({
    autoStartBurn: true,
    operator: "viewer"
  });
  const autoStartedBurnMessage = autoStartedReadable.find((message) => message.id === burnCandidate.record.id);
  assert.ok(autoStartedBurnMessage, "burn-after-read message should remain readable after public render");
  assert.ok(autoStartedBurnMessage.burnAt > autoStartedBurnMessage.burnViewedAt, "public render should create a burn deadline");
  assert.strictEqual(service.getMessageById(burnCandidate.record.id).status, "approved", "message should remain visible during countdown");

  advanceMinutes(2);
  assert.strictEqual(service.getMessageById(burnCandidate.record.id).status, "burned", "burned message should leave public view after countdown");

  currentTime = Date.UTC(2026, 2, 17, 9, 3, 0);
  const repairedBurnService = createServiceWithState({
    messages: [
      {
        id: "msg-broken-burn",
        displayName: "旧版焚烧留言",
        content: "缺少 burnAt 的旧数据",
        postType: "text",
        status: "approved",
        createdAt: currentTime - 2 * 60 * 1000,
        publishedAt: currentTime - 2 * 60 * 1000,
        images: [],
        burnAfterRead: true,
        burnViewedAt: currentTime - 30 * 1000,
        burnAt: null,
        burnedAt: null,
        sourceId: "legacy",
        auditTrail: []
      }
    ],
    meta: {
      createdAt: currentTime - 2 * 60 * 1000,
      updatedAt: currentTime - 30 * 1000
    },
    rules: {}
  });
  const repairedReadable = repairedBurnService.listReadableMessages();
  assert.strictEqual(repairedReadable.length, 1, "legacy burn message should still be readable during repaired countdown");
  assert.ok(repairedReadable[0].burnRemainingMs <= 30 * 1000, "legacy burn message should recover its countdown");
  advanceMinutes(1);
  assert.strictEqual(repairedBurnService.getMessageById("msg-broken-burn").status, "burned", "legacy burn message should expire after recovered countdown");

  const pendingId = valid.record.id;
  const hide = service.updateMessageStatus({
    id: pendingId,
    action: "hide",
    note: "临时下线",
    operator: "Moderator"
  });
  assert.strictEqual(hide.ok, true, "admin should hide approved message");
  assert.strictEqual(service.getMessageById(pendingId).status, "hidden", "hide should update state");

  const restore = service.updateMessageStatus({
    id: pendingId,
    action: "restore",
    note: "重新公开",
    operator: "Moderator"
  });
  assert.strictEqual(restore.ok, true, "hidden message should restore to approved");
  assert.strictEqual(service.getMessageById(pendingId).status, "approved", "restore should return to approved");

  const burnNow = service.burnMessageNow({
    id: pendingId,
    operator: "viewer"
  });
  assert.strictEqual(burnNow.ok, true, "viewer should be able to burn an approved message immediately");
  assert.strictEqual(service.getMessageById(pendingId).status, "burned", "immediate burn should remove the message from public view");

  const hideCandidate = service.submitMessage({
    displayName: "批量隐藏目标",
    content: "这条留言专门用于验证批量隐藏。",
    sourceId: "hide-batch-client"
  });
  assert.strictEqual(hideCandidate.ok, true, "hide batch candidate should be created");
  const hideCandidateId = hideCandidate.record.id;

  const approvedBatchIds = service
    .listMessages({ status: "approved" })
    .filter((message) => message.id !== hideCandidateId)
    .slice(0, 2)
    .map((message) => message.id);
  const batchResult = service.batchUpdate({
    ids: approvedBatchIds,
    action: "reject",
    note: "批量清理",
    operator: "Moderator"
  });
  assert.strictEqual(batchResult.ok, true, "batch rejection should succeed for approved messages");
  assert.ok(
    approvedBatchIds.every((id) => service.getMessageById(id).status === "rejected"),
    "batch rejection should update every selected item"
  );

  const invalidBatch = service.batchUpdate({
    ids: [hideCandidateId],
    action: "hide",
    note: "无效操作测试",
    operator: "Moderator"
  });
  assert.strictEqual(invalidBatch.ok, true, "approved item can be hidden in batch");

  const conflictBatch = service.batchUpdate({
    ids: [hideCandidateId],
    action: "hide",
    note: "重复屏蔽",
    operator: "Moderator"
  });
  assert.strictEqual(conflictBatch.ok, false, "invalid state transition should fail in batch");
}

run();
console.log("message-board scenarios passed");
