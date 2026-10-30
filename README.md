<img src="assets/icon.svg" width="64" height="64" alt="">

# github-slack-extension

A Chromium extension (Chrome, Edge, Brave, Arc) that adds a **Request PR review** button with a Slack icon to open GitHub pull requests. It sends a Review Request to Slack either as a message in a channel that mentions the Reviewers, or as a separate direct message to each Reviewer. Messages are posted as you.

See [CONTEXT.md](./CONTEXT.md) for the project's vocabulary.

## Set up

1. **Build the extension**

   ```sh
   pnpm install
   pnpm build
   ```

2. **Load it into the browser.** Open `chrome://extensions`, turn on *Developer mode*, click *Load unpacked* and choose `.output/chrome-mv3`.

3. **Create the Slack app.** Go to [api.slack.com/apps](https://api.slack.com/apps?new_app=1), choose *From a manifest*, pick your workspace and paste [`slack-app-manifest.json`](./slack-app-manifest.json). Under *Basic Information → Display Information*, upload [`assets/slack-app-icon.png`](./assets/slack-app-icon.png) as the app icon. Install the app, then copy the *User OAuth Token* (`xoxp-…`) from *OAuth & Permissions*.

4. **Connect the extension.** Click the extension's toolbar icon to open its settings. Paste the token, click *Save & test*, and optionally choose a Default Channel and Default Reviewers.

The token is stored with `chrome.storage.local` in this browser profile only. Only the background worker reads it and sends it to slack.com, so GitHub's page never sees it. The extension keeps no history of the Review Requests you send.

## Slack scopes

The manifest requests these user scopes:

| Scope | Used for |
| --- | --- |
| `chat:write` | Posting the Review Request as you |
| `users:read` | Searching Slack members to pick Reviewers |
| `channels:read`, `groups:read` | Listing the public and private channels you belong to |
| `im:write` | Opening a direct message with each Reviewer |

## Develop

```sh
pnpm dev       # launches Chromium with the extension and reloads on change
pnpm compile   # type-check
pnpm zip       # package for the Chrome Web Store
```

GitHub serves both a classic and a React pull request header. The button goes into the header's actions when it can find them, and floats in the bottom-right corner otherwise.
