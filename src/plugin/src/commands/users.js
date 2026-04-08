"use strict";
/**
 * [openclaw-lark-plus] User management chat commands.
 *
 * Provides /feishu_users, /feishu_user_add, /feishu_user_remove commands
 * for managing authorized users and their agent/workspace mappings from
 * within Feishu conversations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUserCommands = registerUserCommands;
exports.formatUserList = formatUserList;

const accounts_1 = require("../core/accounts.js");
const lark_logger_1 = require("../core/lark-logger.js");
const log = (0, lark_logger_1.larkLogger)('commands/users');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFeishuConfig(cfg) {
    return cfg?.channels?.feishu;
}

function formatUserList(cfg) {
    const feishuCfg = getFeishuConfig(cfg);
    if (!feishuCfg) return '❌ 飞书插件未配置';

    const lines = [];
    lines.push('📋 **授权用户列表**\n');

    // Authorized users
    const authorizedUsers = feishuCfg.authorizedUsers;
    if (!authorizedUsers || authorizedUsers === '*') {
        lines.push('🔓 授权模式: **开放** (所有配对用户可授权)');
    } else if (Array.isArray(authorizedUsers)) {
        lines.push(`🔐 授权模式: **白名单** (${authorizedUsers.length} 个用户)`);
        for (const uid of authorizedUsers) {
            const agentId = feishuCfg.userAgentMap?.[uid] ?? '(默认)';
            const ws = feishuCfg.userWorkspaces?.[uid];
            const wsInfo = ws ? ` | prompt: ${ws.systemPrompt?.slice(0, 30) ?? '-'}...` : '';
            lines.push(`  • \`${uid}\` → agent: ${agentId}${wsInfo}`);
        }
    }

    // User-Agent mappings
    const agentMap = feishuCfg.userAgentMap;
    if (agentMap && Object.keys(agentMap).length > 0) {
        lines.push('\n🤖 **用户-Agent 映射**');
        for (const [uid, agentId] of Object.entries(agentMap)) {
            lines.push(`  • \`${uid}\` → \`${agentId}\``);
        }
    }

    // User workspaces
    const workspaces = feishuCfg.userWorkspaces;
    if (workspaces && Object.keys(workspaces).length > 0) {
        lines.push('\n📁 **用户工作空间**');
        for (const [uid, ws] of Object.entries(workspaces)) {
            const parts = [];
            if (ws.systemPrompt) parts.push(`prompt: "${ws.systemPrompt.slice(0, 40)}..."`);
            if (ws.workspace) parts.push(`path: ${ws.workspace}`);
            if (ws.skills) parts.push(`skills: [${ws.skills.join(', ')}]`);
            lines.push(`  • \`${uid}\`: ${parts.join(' | ') || '(空配置)'}`);
        }
    }

    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

function registerUserCommands(api) {
    // /feishu_users — list all authorized users
    api.registerCommand({
        name: 'feishu_users',
        description: '[openclaw-lark-plus] List authorized users and their agent/workspace mappings',
        acceptsArgs: false,
        requireAuth: true,
        async handler(ctx) {
            try {
                return { text: formatUserList(ctx.config) };
            } catch (err) {
                return { text: `❌ 查询用户列表失败: ${err instanceof Error ? err.message : String(err)}` };
            }
        },
    });

    // /feishu_user_add <open_id> [agent_id] — add user to authorized list
    api.registerCommand({
        name: 'feishu_user_add',
        description: '[openclaw-lark-plus] Add a user to the authorized list. Usage: /feishu_user_add <open_id> [agent_id]',
        acceptsArgs: true,
        requireAuth: true,
        async handler(ctx) {
            const args = ctx.args?.trim().split(/\s+/) || [];
            const openId = args[0];
            const agentId = args[1];

            if (!openId) {
                return { text: '用法: /feishu_user_add <open_id> [agent_id]\n示例: /feishu_user_add ou_xxxxx agent-researcher' };
            }

            if (!openId.startsWith('ou_') && !openId.startsWith('on_')) {
                return { text: `⚠️ open_id 格式不正确: \`${openId}\`\n期望格式: ou_xxx 或 on_xxx` };
            }

            const result = [];
            result.push(`✅ 用户 \`${openId}\` 已添加到授权列表`);

            if (agentId) {
                result.push(`🤖 Agent 映射: \`${openId}\` → \`${agentId}\``);
            }

            result.push('\n💡 请将以下配置添加到 openclaw 配置文件:');
            result.push('```json');

            const configSnippet = {
                "channels.feishu.authorizedUsers": [openId],
            };
            if (agentId) {
                configSnippet[`channels.feishu.userAgentMap.${openId}`] = agentId;
            }
            result.push(JSON.stringify(configSnippet, null, 2));
            result.push('```');
            result.push('\n或运行:');
            result.push('```');
            if (agentId) {
                result.push(`openclaw config set channels.feishu.userAgentMap.${openId} ${agentId}`);
            }
            result.push('```');

            return { text: result.join('\n') };
        },
    });

    // /feishu_user_remove <open_id> — remove user
    api.registerCommand({
        name: 'feishu_user_remove',
        description: '[openclaw-lark-plus] Remove a user from authorized list. Usage: /feishu_user_remove <open_id>',
        acceptsArgs: true,
        requireAuth: true,
        async handler(ctx) {
            const openId = ctx.args?.trim();

            if (!openId) {
                return { text: '用法: /feishu_user_remove <open_id>\n示例: /feishu_user_remove ou_xxxxx' };
            }

            const result = [];
            result.push(`🗑️ 用户 \`${openId}\` 将从授权列表中移除`);
            result.push('\n💡 请在 openclaw 配置文件中移除以下条目:');
            result.push(`  • \`channels.feishu.authorizedUsers\` 中的 \`${openId}\``);
            result.push(`  • \`channels.feishu.userAgentMap.${openId}\` (如有)`);
            result.push(`  • \`channels.feishu.userWorkspaces.${openId}\` (如有)`);

            return { text: result.join('\n') };
        },
    });
}
