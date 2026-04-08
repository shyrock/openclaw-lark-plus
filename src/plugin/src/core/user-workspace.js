"use strict";
/**
 * [openclaw-lark-plus] Per-user workspace configuration.
 *
 * Allows each user to have an independent system prompt, skill filter,
 * tools policy, and workspace directory.
 *
 * Config shape:
 *   channels.feishu.userWorkspaces: {
 *     "ou_xxxx": {
 *       systemPrompt: "你是研究助手...",
 *       workspace: "D:/workspaces/researcher",
 *       skills: ["lark-doc", "lark-wiki"],
 *       tools: { allow: ["feishu_doc_*"] }
 *     }
 *   }
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveUserWorkspace = resolveUserWorkspace;

/**
 * Resolve per-user workspace configuration.
 *
 * @param cfg - Account-scoped config
 * @param userOpenId - The user's open_id
 * @returns UserWorkspace config, or undefined if none configured
 */
function resolveUserWorkspace(cfg, userOpenId) {
    const feishuCfg = cfg?.channels?.feishu;
    const workspaces = feishuCfg?.userWorkspaces;
    if (!workspaces || typeof workspaces !== 'object') return undefined;
    return workspaces[userOpenId] ?? undefined;
}
