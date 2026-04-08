"use strict";
/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Register all chat commands (/feishu_diagnose, /feishu_doctor, /feishu_auth, /feishu).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFeishuStart = runFeishuStart;
exports.runFeishuStartI18n = runFeishuStartI18n;
exports.getFeishuHelp = getFeishuHelp;
exports.getFeishuHelpI18n = getFeishuHelpI18n;
exports.registerCommands = registerCommands;
const version_1 = require("../core/version.js");
const diagnose_1 = require("./diagnose.js");
const doctor_1 = require("./doctor.js");
const auth_1 = require("./auth.js");
const users_1 = require("./users.js");
const register_1 = require("./register.js");
// ---------------------------------------------------------------------------
// I18n text map for /feishu start, help, and error messages
// ---------------------------------------------------------------------------
const T = {
    zh_cn: {
        legacyNotDisabled: '❌ 检测到旧版插件未禁用。\n' +
            '👉 请依次运行命令：\n' +
            '```\n' +
            'openclaw config set plugins.entries.feishu.enabled false --json\n' +
            'openclaw gateway restart\n' +
            '```',
        toolsProfileWarn: (profile) => `⚠️ 工具 Profile 当前为 \`${profile}\`，飞书工具可能无法加载。请检查配置是否正确。\n`,
        startFailed: (details) => `❌ 飞书 OpenClaw 插件启动失败：\n\n${details}`,
        startWithWarnings: (version, details) => `⚠️ 飞书 OpenClaw 插件已启动 v${version}（存在警告）\n\n${details}`,
        startOk: (version) => `✅ 飞书 OpenClaw 插件已启动 v${version}`,
        helpTitle: (version) => `飞书OpenClaw插件 v${version}`,
        helpUsage: '用法：',
        helpStart: '/feishu start - 校验插件配置',
        helpAuth: '/feishu auth - 批量授权用户权限',
        helpDoctor: '/feishu doctor - 运行诊断',
        helpUsers: '/feishu users - 查看授权用户列表',
        helpRegister: '/feishu register [agent_id] - 生成新用户注册二维码',
        helpApprove: '/feishu approve <id> - 批准用户注册',
        helpReject: '/feishu reject <id> - 拒绝用户注册',
        helpPending: '/feishu pending - 查看待审批列表',
        helpHelp: '/feishu help - 显示此帮助',
        diagFailed: (msg) => `诊断执行失败: ${msg}`,
        authFailed: (msg) => `授权执行失败: ${msg}`,
        execFailed: (msg) => `执行失败: ${msg}`,
    },
    en_us: {
        legacyNotDisabled: '❌ Legacy plugin is not disabled.\n' +
            '👉 Please run the following commands:\n' +
            '```\n' +
            'openclaw config set plugins.entries.feishu.enabled false --json\n' +
            'openclaw gateway restart\n' +
            '```',
        toolsProfileWarn: (profile) => `⚠️ Tools profile is currently set to \`${profile}\`. Feishu tools may not load properly. Please check your configuration.\n`,
        startFailed: (details) => `❌ Feishu OpenClaw plugin failed to start:\n\n${details}`,
        startWithWarnings: (version, details) => `⚠️ Feishu OpenClaw plugin started v${version} (with warnings)\n\n${details}`,
        startOk: (version) => `✅ Feishu OpenClaw plugin started v${version}`,
        helpTitle: (version) => `Feishu OpenClaw Plugin v${version}`,
        helpUsage: 'Usage:',
        helpStart: '/feishu start - Validate plugin configuration',
        helpAuth: '/feishu auth - Batch authorize user permissions',
        helpDoctor: '/feishu doctor - Run diagnostics',
        helpUsers: '/feishu users - List authorized users',
        helpRegister: '/feishu register [agent_id] - Generate new user registration QR code',
        helpApprove: '/feishu approve <id> - Approve user registration',
        helpReject: '/feishu reject <id> - Reject user registration',
        helpPending: '/feishu pending - List pending registrations',
        helpHelp: '/feishu help - Show this help',
        diagFailed: (msg) => `Diagnostics failed: ${msg}`,
        authFailed: (msg) => `Authorization failed: ${msg}`,
        execFailed: (msg) => `Execution failed: ${msg}`,
    },
};
// ---------------------------------------------------------------------------
// Exported i18n functions
// ---------------------------------------------------------------------------
/**
 * 运行 /feishu start 校验，返回 Markdown 格式结果。
 */
function runFeishuStart(config, locale = 'zh_cn') {
    const t = T[locale];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = config;
    const errors = [];
    const warnings = [];
    // 检查旧版插件是否已禁用 (error)
    const feishuEntry = cfg.plugins?.entries?.feishu;
    if (feishuEntry && feishuEntry.enabled !== false) {
        errors.push(t.legacyNotDisabled);
    }
    // 检查 tools.profile (warning)
    const profile = cfg.tools?.profile;
    const incompleteProfiles = new Set(['minimal', 'coding', 'messaging']);
    if (profile && incompleteProfiles.has(profile)) {
        warnings.push(t.toolsProfileWarn(profile));
    }
    if (errors.length > 0) {
        const all = [...errors, ...warnings];
        return t.startFailed(all.join('\n\n'));
    }
    if (warnings.length > 0) {
        return t.startWithWarnings((0, version_1.getPluginVersion)(), warnings.join('\n\n'));
    }
    return t.startOk((0, version_1.getPluginVersion)());
}
/**
 * 运行 /feishu start，同时生成中英双语结果。
 */
function runFeishuStartI18n(config) {
    return {
        zh_cn: runFeishuStart(config, 'zh_cn'),
        en_us: runFeishuStart(config, 'en_us'),
    };
}
/**
 * 生成 /feishu help 帮助文本。
 */
function getFeishuHelp(locale = 'zh_cn') {
    const t = T[locale];
    return (`${t.helpTitle((0, version_1.getPluginVersion)())}\n\n` +
        `${t.helpUsage}\n` +
        `  ${t.helpStart}\n` +
        `  ${t.helpAuth}\n` +
        `  ${t.helpDoctor}\n` +
        `  ${t.helpUsers}\n` +
        `  ${t.helpRegister}\n` +
        `  ${t.helpApprove}\n` +
        `  ${t.helpReject}\n` +
        `  ${t.helpPending}\n` +
        `  ${t.helpHelp}`);
}
/**
 * 生成 /feishu help，同时生成中英双语结果。
 */
function getFeishuHelpI18n() {
    return {
        zh_cn: getFeishuHelp('zh_cn'),
        en_us: getFeishuHelp('en_us'),
    };
}
// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------
function registerCommands(api) {
    // /feishu_diagnose
    api.registerCommand({
        name: 'feishu_diagnose',
        description: 'Run Feishu plugin diagnostics to check config, connectivity, and permissions',
        acceptsArgs: false,
        requireAuth: true,
        async handler(ctx) {
            try {
                const report = await (0, diagnose_1.runDiagnosis)({ config: ctx.config });
                return { text: (0, diagnose_1.formatDiagReportText)(report) };
            }
            catch (err) {
                return {
                    text: T.zh_cn.diagFailed(err instanceof Error ? err.message : String(err)),
                };
            }
        },
    });
    // /feishu_doctor
    api.registerCommand({
        name: 'feishu_doctor',
        description: 'Run Feishu plugin diagnostics',
        acceptsArgs: false,
        requireAuth: true,
        async handler(ctx) {
            try {
                const markdown = await (0, doctor_1.runFeishuDoctor)(ctx.config, ctx.accountId);
                return { text: markdown };
            }
            catch (err) {
                return {
                    text: T.zh_cn.diagFailed(err instanceof Error ? err.message : String(err)),
                };
            }
        },
    });
    // /feishu_auth
    api.registerCommand({
        name: 'feishu_auth',
        description: 'Batch authorize user permissions for Feishu',
        acceptsArgs: false,
        requireAuth: true,
        async handler(ctx) {
            try {
                const result = await (0, auth_1.runFeishuAuth)(ctx.config);
                return { text: result };
            }
            catch (err) {
                return {
                    text: T.zh_cn.authFailed(err instanceof Error ? err.message : String(err)),
                };
            }
        },
    });
    // /feishu (统一入口，支持子命令)
    api.registerCommand({
        name: 'feishu',
        description: 'Feishu plugin commands (subcommands: auth, doctor, start)',
        acceptsArgs: true,
        requireAuth: true,
        async handler(ctx) {
            const args = ctx.args?.trim().split(/\s+/) || [];
            const subcommand = args[0]?.toLowerCase();
            try {
                // /feishu auth 或 /feishu onboarding
                if (subcommand === 'auth' || subcommand === 'onboarding') {
                    const result = await (0, auth_1.runFeishuAuth)(ctx.config);
                    return { text: result };
                }
                // /feishu doctor
                if (subcommand === 'doctor') {
                    const markdown = await (0, doctor_1.runFeishuDoctor)(ctx.config, ctx.accountId);
                    return { text: markdown };
                }
                // /feishu start
                if (subcommand === 'start') {
                    return { text: runFeishuStart(ctx.config) };
                }
                // /feishu users [openclaw-lark-plus]
                if (subcommand === 'users') {
                    return { text: (0, users_1.formatUserList)(ctx.config) };
                }
                // /feishu register [agent_id] [openclaw-lark-plus]
                if (subcommand === 'register') {
                    const agentId = args[1] || undefined;
                    const accounts_manager = require("../core/accounts-manager.js");
                    const admin = accounts_manager.getAdmin();
                    const makeSender = (toOpenId, toAccountId) => {
                        if (!toOpenId || !toAccountId) return undefined;
                        return (msg) => {
                            const send = require("../messaging/outbound/send.js");
                            send.sendMessageFeishu({
                                cfg: ctx.config, to: toOpenId, text: msg, accountId: toAccountId,
                            }).catch(() => {});
                        };
                    };
                    try {
                        const text = await (0, register_1.runRegisterFlow)({
                            agentId,
                            locale: 'zh_cn',
                            sendToAdmin: admin ? makeSender(admin.openId, admin.accountId) : undefined,
                            sendToRequester: ctx.chatId
                                ? makeSender(ctx.chatId, ctx.accountId)
                                : undefined,
                        });
                        return { text };
                    } catch (err) {
                        return { text: T.zh_cn.execFailed(err instanceof Error ? err.message : String(err)) };
                    }
                }
                // /feishu approve <pending_id> [openclaw-lark-plus]
                if (subcommand === 'approve') {
                    const pendingId = args[1];
                    if (!pendingId) return { text: '用法: /feishu approve <pending_id>' };
                    return { text: (0, register_1.approveRegistration)(pendingId) };
                }
                // /feishu reject <pending_id> [openclaw-lark-plus]
                if (subcommand === 'reject') {
                    const pendingId = args[1];
                    if (!pendingId) return { text: '用法: /feishu reject <pending_id>' };
                    return { text: (0, register_1.rejectRegistration)(pendingId) };
                }
                // /feishu pending [openclaw-lark-plus]
                if (subcommand === 'pending') {
                    return { text: (0, register_1.listPending)() };
                }
                // /feishu help 或无效子命令或无参数
                return { text: getFeishuHelp() };
            }
            catch (err) {
                return {
                    text: T.zh_cn.execFailed(err instanceof Error ? err.message : String(err)),
                };
            }
        },
    });
}
