# Bear's Home

This repository now contains the Bear's Home prototype with instant publishing, optional burn-after-read messages, and a responsive moderation console.

## Files

- `index.html`: public message board
- `admin.html`: moderation console
- `styles.css`: shared visual system and responsive layouts
- `app/message-board.js`: in-browser data model, validation rules, moderation state machine, and local APIs
- `app/public.js`: public board interactions
- `app/admin.js`: admin console interactions
- `tests/message-board.test.js`: scenario coverage for submission and moderation flows

## Data Model

Each message record contains:

- `id`
- `displayName`
- `content`
- `status` (`approved`, `rejected`, `hidden`, `burned`)
- `burnAfterRead`
- `burnedAt`
- `createdAt`
- `publishedAt`
- `sourceId`
- `auditTrail[]`

Each audit event contains:

- `id`
- `action`
- `operator`
- `note`
- `timestamp`
- `fromStatus`
- `toStatus`

## Local API Surface

Public APIs:

- `listApprovedMessages()`
- `listReadableMessages()`
- `submitMessage({ displayName, content, sourceId, burnAfter })`
- `burnMessage({ id, operator })`

Admin APIs:

- `listMessages({ status, query })`
- `getMessageById(id)`
- `getStats()`
- `getAuditTrail(id)`
- `updateMessageStatus({ id, action, note, operator })`
- `batchUpdate({ ids, action, note, operator })`

## Notes

- Data is stored in `localStorage`, so public and admin pages share the same message state in the browser.
- New messages are public immediately by default.
- Message content only requires non-empty input and still enforces the 280-character maximum.
- Burn-after-read messages are removed from the public board after the first explicit view action.

## Local Preview

Run:

```bash
npm run preview
```

Then open:

- `http://127.0.0.1:4173/`
- `http://127.0.0.1:4173/admin.html`

To start the server and open the browser automatically:

```bash
npm run preview:open
```

## Deployment (GitHub Pages)

This repository includes a GitHub Actions workflow that deploys the static site to GitHub Pages on every push to `main`.

1. Open repository **Settings → Pages**.
2. Set **Build and deployment** source to **GitHub Actions**.
3. Push to `main` (or manually trigger **Deploy Bear's Home to GitHub Pages** workflow).

After deployment:

- Public board: `https://<your-username>.github.io/<repo>/`
- Admin page: `https://<your-username>.github.io/<repo>/admin.html`
