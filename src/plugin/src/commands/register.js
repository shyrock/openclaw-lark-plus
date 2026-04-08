"use strict";
/**
 * [openclaw-lark-plus] /feishu_register and approval commands.
 *
 * Security model:
 *   - First scan: auto-approved, becomes admin
 *   - Subsequent scans: pending admin approval via Feishu message
 *   - Admin approves/rejects via /feishu approve|reject <id>
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRegisterCommand = registerRegisterCommand;
exports.runRegisterFlow = runRegisterFlow;
exports.approveRegistration = approveRegistration;
exports.rejectRegistration = rejectRegistration;
exports.listPending = listPending;

const app_registration_1 = require("../core/app-registration.js");
const accounts_manager_1 = require("../core/accounts-manager.js");
const lark_logger_1 = require("../core/lark-logger.js");
const log = (0, lark_logger_1.larkLogger)('commands/register');

// ---------------------------------------------------------------------------
// I18n
// ---------------------------------------------------------------------------

const T = {
    zh_cn: {
        qrReady: (qrUrl, expireMin) =>
            `📱 **新用户注册二维码已生成**\n\n` +
            `请将以下链接发送给新用户，用飞书扫码即可注册：\n\n` +
            `🔗 ${qrUrl}\n\n` +
            `⏰ 有效期：${expireMin} 分钟\n\n` +
            `⏳ 正在后台等待扫码结果...`,
        firstUserSuccess: (accountId, appId, openId) =>
            `✅ **首位用户注册成功（已设为管理员）**\n\n` +
            `  • 账号 ID: \`${accountId}\`\n` +
            `  • App ID: \`${appId}\`\n` +
            `  • 管理员 Open ID: \`${openId}\`\n\n` +
            `🔑 您是管理员，后续用户注册需要您审批。\n` +
            `运行 \`openclaw gateway restart\` 使 Bot 生效。`,
        pendingApproval: (pendingId, appId, openId) =>
            `⏳ **新用户待审批**\n\n` +
            `  • 待审批 ID: \`${pendingId}\`\n` +
            `  • App ID: \`${appId}\`\n` +
            `  • 用户 Open ID: \`${openId || '(未知)'}\`\n\n` +
            `已通知管理员审批。`,
        adminNotify: (pendingId, appId, openId) =>
            `🔔 **新用户注册申请**\n\n` +
            `  • 待审批 ID: \`${pendingId}\`\n` +
            `  • App ID: \`${appId}\`\n` +
            `  • 用户 Open ID: \`${openId || '(未知)'}\`\n\n` +
            `请回复以下命令进行审批：\n` +
            `  ✅ \`/feishu approve ${pendingId}\`\n` +
            `  ❌ \`/feishu reject ${pendingId}\``,
        approved: (pendingId, accountId) =>
            `✅ **已批准注册** \`${pendingId}\`\n\n` +
            `账号 \`${accountId}\` 已写入配置。\n` +
            `运行 \`openclaw gateway restart\` 使新 Bot 生效。`,
        rejected: (pendingId) =>
            `❌ **已拒绝注册** \`${pendingId}\`\n\n凭据已丢弃，该用户需要重新扫码注册。`,
        notFound: (pendingId) => `⚠️ 未找到待审批记录: \`${pendingId}\``,
        notAdmin: '❌ 仅管理员可执行此操作',
        noAdmin: '⚠️ 尚未设置管理员（等待第一位用户完成扫码注册）',
        noPending: '📋 当前无待审批的注册请求',
        pendingList: (items) => {
            const lines = ['📋 **待审批注册列表**\n'];
            for (const item of items) {
                const age = Math.floor((Date.now() - item.requestedAt) / 60000);
                lines.push(`  • \`${item.pendingId}\` | App: \`${item.appId}\` | 用户: \`${item.openId || '-'}\` | ${age} 分钟前`);
            }
            lines.push(`\n审批命令：\`/feishu approve <id>\` 或 \`/feishu reject <id>\``);
            return lines.join('\n');
        },
        scanFailed: (err) => `❌ 注册失败: ${err}`,
        usage:
            '用法: /feishu register [agent_id]\n\n' +
            '生成新用户注册二维码。\n' +
            '  • 第一个扫码的用户自动成为管理员\n' +
            '  • 后续用户需管理员审批\n\n' +
            '审批命令：\n' +
            '  /feishu approve <pending_id> - 批准注册\n' +
            '  /feishu reject <pending_id>  - 拒绝注册\n' +
            '  /feishu pending              - 查看待审批列表',
    },
};

// ---------------------------------------------------------------------------
// Core registration flow
// ---------------------------------------------------------------------------

/**
 * @param {object} params
 * @param {string} [params.agentId]
 * @param {object} [params.workspace]
 * @param {string} [params.locale]
 * @param {(msg: string) => void} [params.sendToAdmin] - Send message to admin's chat
 * @param {(msg: string) => void} [params.sendToRequester] - Send follow-up to requester's chat
 */
async function runRegisterFlow(params = {}) {
    const { agentId, workspace, locale = 'zh_cn', sendToAdmin, sendToRequester } = params;
    const t = T[locale] || T.zh_cn;

    const session = await (0, app_registration_1.createRegistrationSession)();
    const expireMin = Math.floor(session.expireIn / 60);

    // Background poll
    session.waitForScan().then((result) => {
        const admin = (0, accounts_manager_1.getAdmin)();

        if (!admin) {
            // --- First user: auto-approve, set as admin ---
            const accountId = `user-${result.openId || result.appId}`;
            try {
                (0, accounts_manager_1.addFeishuAccount)({
                    accountId,
                    appId: result.appId,
                    appSecret: result.appSecret,
                    domain: result.domain,
                    openId: result.openId,
                    agentId,
                    workspace,
                });
                (0, accounts_manager_1.setAdmin)(result.openId, accountId);

                const msg = t.firstUserSuccess(accountId, result.appId, result.openId);
                log.info(`first user registered as admin: ${accountId}`);
                if (sendToRequester) sendToRequester(msg);
            } catch (err) {
                log.error(`first user registration failed: ${err}`);
                if (sendToRequester) sendToRequester(t.scanFailed(String(err)));
            }
        } else {
            // --- Subsequent user: store as pending, notify admin ---
            const pendingId = `reg-${Date.now().toString(36)}`;
            try {
                (0, accounts_manager_1.addPendingRegistration)({
                    pendingId,
                    appId: result.appId,
                    appSecret: result.appSecret,
                    openId: result.openId,
                    domain: result.domain,
                    agentId,
                    workspace,
                });

                log.info(`pending registration: ${pendingId} (awaiting admin approval)`);

                // Notify requester
                if (sendToRequester) {
                    sendToRequester(t.pendingApproval(pendingId, result.appId, result.openId));
                }

                // Notify admin
                if (sendToAdmin) {
                    sendToAdmin(t.adminNotify(pendingId, result.appId, result.openId));
                }
            } catch (err) {
                log.error(`failed to store pending registration: ${err}`);
                if (sendToRequester) sendToRequester(t.scanFailed(String(err)));
            }
        }
    }).catch((err) => {
        log.warn(`registration poll failed: ${err}`);
        if (sendToRequester) sendToRequester(t.scanFailed(String(err)));
    });

    return t.qrReady(session.qrUrl, expireMin);
}

// ---------------------------------------------------------------------------
// Approve / Reject
// ---------------------------------------------------------------------------

/**
 * Approve a pending registration — creates the account.
 * @param {string} pendingId
 * @returns {string} Result message
 */
function approveRegistration(pendingId) {
    const t = T.zh_cn;
    const reg = (0, accounts_manager_1.getPendingRegistration)(pendingId);
    if (!reg) return t.notFound(pendingId);

    const accountId = `user-${reg.openId || reg.appId}`;
    (0, accounts_manager_1.addFeishuAccount)({
        accountId,
        appId: reg.appId,
        appSecret: reg.appSecret,
        domain: reg.domain,
        openId: reg.openId,
        agentId: reg.agentId,
        workspace: reg.workspace,
    });

    (0, accounts_manager_1.removePendingRegistration)(pendingId);
    log.info(`registration approved: ${pendingId} -> ${accountId}`);
    return t.approved(pendingId, accountId);
}

/**
 * Reject a pending registration — discards credentials.
 * @param {string} pendingId
 * @returns {string} Result message
 */
function rejectRegistration(pendingId) {
    const t = T.zh_cn;
    const reg = (0, accounts_manager_1.removePendingRegistration)(pendingId);
    if (!reg) return t.notFound(pendingId);

    log.info(`registration rejected: ${pendingId}`);
    return t.rejected(pendingId);
}

/**
 * List pending registrations.
 * @returns {string}
 */
function listPending() {
    const t = T.zh_cn;
    const items = (0, accounts_manager_1.listPendingRegistrations)();
    if (items.length === 0) return t.noPending;
    return t.pendingList(items);
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

function registerRegisterCommand(api) {
    api.registerCommand({
        name: 'feishu_register',
        description: '[openclaw-lark-plus] Generate QR code for new user registration (admin approval required)',
        acceptsArgs: true,
        requireAuth: true,
        async handler(ctx) {
            const args = ctx.args?.trim().split(/\s+/) || [];
            const subArg = args[0]?.toLowerCase();

            if (subArg === 'help' || subArg === '-h') {
                return { text: T.zh_cn.usage };
            }

            const agentId = args[0] || undefined;

            try {
                const admin = (0, accounts_manager_1.getAdmin)();

                // Build message senders
                const makeSender = (toOpenId, toAccountId) => {
                    if (!toOpenId || !toAccountId) return undefined;
                    return (msg) => {
                        try {
                            const send = require("../messaging/outbound/send.js");
                            send.sendMessageFeishu({
                                cfg: ctx.config,
                                to: toOpenId,
                                text: msg,
                                accountId: toAccountId,
                            }).catch(err => log.error(`send failed: ${err}`));
                        } catch (err) {
                            log.error(`send error: ${err}`);
                        }
                    };
                };

                const sendToAdmin = admin ? makeSender(admin.openId, admin.accountId) : undefined;
                // Requester gets follow-up in the current chat
                const sendToRequester = ctx.chatId
                    ? (msg) => {
                        try {
                            const send = require("../messaging/outbound/send.js");
                            send.sendMessageFeishu({
                                cfg: ctx.config,
                                to: ctx.chatId,
                                text: msg,
                                accountId: ctx.accountId,
                            }).catch(err => log.error(`send failed: ${err}`));
                        } catch (err) {
                            log.error(`send error: ${err}`);
                        }
                    }
                    : undefined;

                const text = await runRegisterFlow({
                    agentId,
                    locale: 'zh_cn',
                    sendToAdmin,
                    sendToRequester,
                });

                return { text };
            } catch (err) {
                return { text: T.zh_cn.scanFailed(err instanceof Error ? err.message : String(err)) };
            }
        },
    });
}
