# openclaw-lark-plus

Multi-user fork of `@larksuite/openclaw-lark` — supports multiple users via QR-code registration, each with an independent Feishu bot, per-user agent routing, and workspace isolation.

## Why

The official `@larksuite/openclaw-lark` plugin is single-owner: only the app creator can complete OAuth, and only one Feishu bot is configured per OpenClaw instance.

`openclaw-lark-plus` solves this by:

- **QR-code registration**: New users scan a QR code to auto-create an independent Feishu bot (via Feishu's `/oauth/v1/app/registration` API)
- **Admin approval**: The first user becomes admin; subsequent registrations require admin approval
- **Per-user agent routing**: Each user can be assigned a different agent (via `userAgentMap`)
- **Per-user workspace**: Each user can have their own system prompt, skills, and tool policies (via `userWorkspaces`)
- **Conversation isolation**: Built on the SDK's per-user `sessionKey`, each user's chat history is naturally isolated

## Prerequisites

- [OpenClaw](https://github.com/nicepkg/openclaw) installed and running
- Node.js >= 18
- A Feishu account (for scanning QR codes)

## Installation

### 1. Install the plugin

```bash
cd ~/.openclaw/extensions
git clone https://github.com/shyrock/openclaw-lark-plus.git
cd openclaw-lark-plus
npm install
```

### 2. Register the plugin in OpenClaw config

Edit `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "allow": ["openclaw-lark-plus"],
    "entries": {
      "openclaw-lark-plus": {
        "enabled": true,
        "path": "~/.openclaw/extensions/openclaw-lark-plus"
      }
    }
  }
}
```

### 3. Restart the gateway

```bash
openclaw gateway restart
```

## Quick Start

### Step 1: Admin registers the first bot

In any Feishu chat with an existing OpenClaw bot (or via CLI), run:

```
/feishu register
```

This generates a QR code URL. The **first person** to scan it becomes the **admin** and gets their independent Feishu bot created automatically.

### Step 2: Invite more users

Run the register command again:

```
/feishu register
```

Share the QR code link with the new user. After they scan:

1. The system stores the registration as **pending**
2. The admin receives a notification with the pending ID
3. The admin approves or rejects:

```
/feishu approve reg-xxxxx    # Approve
/feishu reject reg-xxxxx     # Reject
```

### Step 3: Activate the new bot

After approval, restart the gateway to bring the new bot online:

```bash
openclaw gateway restart
```

## Commands

| Command | Description |
|---------|-------------|
| `/feishu register [agent_id]` | Generate QR code for new user registration |
| `/feishu approve <pending_id>` | Approve a pending registration (admin only) |
| `/feishu reject <pending_id>` | Reject a pending registration (admin only) |
| `/feishu pending` | List all pending registrations |
| `/feishu users` | List authorized users and their agent/workspace mappings |
| `/feishu start` | Validate plugin configuration |
| `/feishu doctor` | Run diagnostics |
| `/feishu auth` | Batch authorize user permissions |
| `/feishu help` | Show help |

## Configuration

After users register via QR code, the config is auto-generated. You can also manually configure advanced features:

```json
{
  "channels": {
    "feishu": {
      "appId": "cli_default_bot",
      "appSecret": "***",

      "accounts": {
        "user-ou_alice": {
          "appId": "cli_alice_bot",
          "appSecret": "***",
          "enabled": true,
          "dmPolicy": "allowlist",
          "allowFrom": ["ou_alice"]
        },
        "user-ou_bob": {
          "appId": "cli_bob_bot",
          "appSecret": "***",
          "enabled": true,
          "dmPolicy": "allowlist",
          "allowFrom": ["ou_bob"]
        }
      },

      "authorizedUsers": "*",

      "userAgentMap": {
        "ou_alice": "agent-researcher",
        "ou_bob": "agent-developer",
        "*": "agent-default"
      },

      "userWorkspaces": {
        "ou_alice": {
          "systemPrompt": "You are a research assistant skilled in documents and knowledge bases.",
          "skills": ["lark-doc", "lark-wiki"]
        },
        "ou_bob": {
          "systemPrompt": "You are a development assistant with full tool access."
        }
      },

      "plus": {
        "adminOpenId": "ou_alice",
        "adminAccountId": "user-ou_alice"
      }
    }
  }
}
```

### Config Reference

| Field | Type | Description |
|-------|------|-------------|
| `accounts.<id>` | object | Per-user bot config (appId, appSecret, dmPolicy, etc.) |
| `authorizedUsers` | `"*"` or `string[]` | Who can complete OAuth. `"*"` = all paired users |
| `userAgentMap` | `Record<openId, agentId>` | Maps users to specific agents. `"*"` = default |
| `userWorkspaces` | `Record<openId, WorkspaceConfig>` | Per-user system prompt, skills, tools |
| `plus.adminOpenId` | string | Admin user's open_id (first registered user) |
| `plus.adminAccountId` | string | Admin's account ID |
| `plus.pendingRegistrations` | object | Pending registrations awaiting approval |

### WorkspaceConfig

| Field | Type | Description |
|-------|------|-------------|
| `systemPrompt` | string | Custom system prompt for this user |
| `workspace` | string | Working directory path |
| `skills` | string[] | Skill filter (e.g. `["lark-doc", "lark-wiki"]`) |
| `tools` | ToolPolicy | Tool access policy |

## Architecture

```
User scans QR ─── Feishu creates PersonalAgent app
                          │
                  poll returns client_id + client_secret
                          │
                ┌─── First user? ───┐
                │                    │
            Yes (admin)         No (pending)
                │                    │
          Auto-approve         Notify admin
          Set as admin               │
                │            ┌───────┴───────┐
          Write config    /approve         /reject
                │            │                │
          Gateway restart  Write config   Discard credentials
```

### Key Files

| File | Purpose |
|------|---------|
| `src/plugin/src/core/app-registration.js` | Feishu App Registration API client (init/begin/poll) |
| `src/plugin/src/core/accounts-manager.js` | Multi-account config CRUD + admin + pending storage |
| `src/plugin/src/core/owner-policy.js` | Replaced owner-only with configurable access |
| `src/plugin/src/core/user-agent-map.js` | Per-user agent routing |
| `src/plugin/src/core/user-workspace.js` | Per-user workspace resolution |
| `src/plugin/src/commands/register.js` | QR registration + approval flow |
| `src/plugin/src/commands/users.js` | User management commands |
| `src/plugin/src/messaging/inbound/dispatch-context.js` | Agent override injection |
| `src/plugin/src/messaging/inbound/dispatch.js` | System prompt + skill filter injection |

## Security

- **Admin approval required**: Only the admin (first registered user) can approve new registrations
- **Credentials stored in config**: Pending appId/appSecret are stored in `~/.openclaw/openclaw.json` (mode 0600)
- **Rejected credentials are discarded**: `/feishu reject` permanently removes the pending app credentials
- **Per-user DM isolation**: Each bot uses `dmPolicy: "allowlist"` with only the registering user's openId
- **OAuth scope isolation**: Each bot's OAuth tokens are stored separately, keyed by `{appId}:{userOpenId}`

## License

MIT
