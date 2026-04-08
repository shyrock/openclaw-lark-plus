"use strict";
/**
 * [openclaw-lark-plus] Feishu App Registration API client.
 *
 * Ported from @larksuite/openclaw-lark-tools FeishuAuth class.
 * Uses the undocumented /oauth/v1/app/registration endpoint to
 * programmatically create a new Feishu PersonalAgent application
 * via QR-code scanning.
 *
 * Flow:
 *   1. init()  → initialize registration session
 *   2. begin() → get QR-code URL (archetype=PersonalAgent)
 *   3. poll()  → wait for user scan, returns client_id + client_secret
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppRegistration = void 0;
exports.createRegistrationSession = createRegistrationSession;

const feishu_fetch_1 = require("./feishu-fetch.js");
const lark_logger_1 = require("./lark-logger.js");
const log = (0, lark_logger_1.larkLogger)('core/app-registration');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FEISHU_BASE = 'https://accounts.feishu.cn';
const LARK_BASE = 'https://accounts.larksuite.com';

const DEFAULT_POLL_INTERVAL_S = 5;
const DEFAULT_EXPIRE_S = 600; // 10 minutes

// ---------------------------------------------------------------------------
// AppRegistration class
// ---------------------------------------------------------------------------

class AppRegistration {
    /**
     * @param {object} [options]
     * @param {boolean} [options.isLark] - Use Lark (international) domain
     */
    constructor(options = {}) {
        this.baseUrl = options.isLark ? LARK_BASE : FEISHU_BASE;
        this.isLark = !!options.isLark;
    }

    /** Switch to Lark international domain. */
    setLarkDomain() {
        this.baseUrl = LARK_BASE;
        this.isLark = true;
    }

    /**
     * Step 1: Initialize registration session.
     * @returns {Promise<{ supported_auth_methods: string[] }>}
     */
    async init() {
        const resp = await feishuPost(this.baseUrl, { action: 'init' });
        return resp;
    }

    /**
     * Step 2: Begin registration — returns QR code URL.
     * @returns {Promise<{ verification_uri_complete: string, device_code: string, interval: number, expire_in: number }>}
     */
    async begin() {
        const resp = await feishuPost(this.baseUrl, {
            action: 'begin',
            archetype: 'PersonalAgent',
            auth_method: 'client_secret',
            request_user_info: 'open_id',
        });
        return resp;
    }

    /**
     * Step 3: Poll for scan completion.
     * @param {string} deviceCode
     * @returns {Promise<{ client_id?: string, client_secret?: string, user_info?: { open_id: string, tenant_brand?: string }, error?: string, error_description?: string }>}
     */
    async poll(deviceCode) {
        const resp = await feishuPost(this.baseUrl, {
            action: 'poll',
            device_code: deviceCode,
        });
        return resp;
    }
}

exports.AppRegistration = AppRegistration;

// ---------------------------------------------------------------------------
// High-level session helper
// ---------------------------------------------------------------------------

/**
 * Create a registration session and return { qrUrl, waitForScan }.
 *
 * Usage:
 *   const session = await createRegistrationSession();
 *   // Show session.qrUrl to the user
 *   const result = await session.waitForScan();
 *   // result = { appId, appSecret, openId, domain }
 *
 * @param {object} [options]
 * @param {AbortSignal} [options.signal] - Abort signal to cancel polling
 * @returns {Promise<{ qrUrl: string, deviceCode: string, waitForScan: () => Promise<RegistrationResult> }>}
 */
async function createRegistrationSession(options = {}) {
    const reg = new AppRegistration();

    // Step 1: init
    const initRes = await reg.init();
    if (!initRes.supported_auth_methods?.includes('client_secret')) {
        throw new Error('Feishu registration API does not support client_secret auth method');
    }

    // Step 2: begin
    const beginRes = await reg.begin();
    const qrUrl = new URL(beginRes.verification_uri_complete);
    qrUrl.searchParams.set('from', 'onboard');
    const qrUrlStr = qrUrl.toString();
    const deviceCode = beginRes.device_code;
    const interval = beginRes.interval || DEFAULT_POLL_INTERVAL_S;
    const expireIn = beginRes.expire_in || DEFAULT_EXPIRE_S;

    log.info(`registration session created, deviceCode=${deviceCode.slice(0, 8)}..., expire=${expireIn}s`);

    // Step 3: return poll function
    const waitForScan = () => pollUntilComplete(reg, deviceCode, interval, expireIn, options.signal);

    return { qrUrl: qrUrlStr, deviceCode, expireIn, waitForScan };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function pollUntilComplete(reg, deviceCode, intervalS, expireIn, signal) {
    const startTime = Date.now();
    let currentInterval = intervalS;
    let domainSwitched = false;

    while (Date.now() - startTime < expireIn * 1000) {
        if (signal?.aborted) {
            throw new Error('Registration cancelled');
        }

        const res = await reg.poll(deviceCode);

        // Check tenant brand for domain switching
        if (res.user_info?.tenant_brand === 'lark' && !domainSwitched) {
            reg.setLarkDomain();
            domainSwitched = true;
            log.info('tenant is lark, switching domain');
            continue;
        }

        // Success: got credentials
        if (res.client_id && res.client_secret) {
            const domain = domainSwitched ? 'lark' : 'feishu';
            log.info(`registration complete: appId=${res.client_id}, openId=${res.user_info?.open_id}, domain=${domain}`);
            return {
                appId: res.client_id,
                appSecret: res.client_secret,
                openId: res.user_info?.open_id,
                domain,
            };
        }

        // Handle errors
        if (res.error) {
            if (res.error === 'authorization_pending') {
                // Normal — keep polling
            } else if (res.error === 'slow_down') {
                currentInterval += 5;
            } else if (res.error === 'access_denied') {
                throw new Error('User denied authorization');
            } else if (res.error === 'expired_token') {
                throw new Error('Registration session expired');
            } else {
                throw new Error(`Registration error: ${res.error} - ${res.error_description || ''}`);
            }
        }

        await sleep(currentInterval * 1000, signal);
    }

    throw new Error('Registration timed out');
}

async function feishuPost(baseUrl, params) {
    const url = `${baseUrl}/oauth/v1/app/registration`;
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v != null) body.append(k, String(v));
    }
    try {
        const resp = await (0, feishu_fetch_1.feishuFetch)(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });
        const data = await resp.json();
        return data;
    } catch (err) {
        // For poll errors, the API returns error in JSON body with non-2xx status
        if (err?.response) {
            return err.response;
        }
        throw err;
    }
}

function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        if (signal) {
            signal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new Error('Aborted'));
            }, { once: true });
        }
    });
}
