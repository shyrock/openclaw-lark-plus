"use strict";
/**
 * [openclaw-lark-plus] Per-user agent routing.
 *
 * Maps individual Feishu users to specific agent configurations,
 * enabling different system prompts, tools, and skills per user.
 *
 * Config shape:
 *   channels.feishu.userAgentMap: {
 *     "ou_xxxx": "agent-researcher",
 *     "ou_yyyy": "agent-developer",
 *     "*": "agent-default"           // fallback for unmapped users
 *   }
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveUserAgentId = resolveUserAgentId;

/**
 * Resolve the agent ID for a given user.
 *
 * @param cfg - Account-scoped config (channels.feishu already resolved)
 * @param userOpenId - The user's open_id
 * @returns Agent ID string, or undefined if no mapping exists
 */
function resolveUserAgentId(cfg, userOpenId) {
    const feishuCfg = cfg?.channels?.feishu;
    const map = feishuCfg?.userAgentMap;
    if (!map || typeof map !== 'object') return undefined;
    return map[userOpenId] ?? map['*'] ?? undefined;
}
