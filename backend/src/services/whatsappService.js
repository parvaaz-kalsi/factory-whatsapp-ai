const path = require('path');
const fs = require('fs');
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage, isJidGroup } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const prisma = require('../config/db');
const { processText, processAudio, savePendingRequest } = require('./aiService');

// --------------------------------------------------
// State
// --------------------------------------------------
let whatsappClient = null;

let whatsappStatus = {
    status: 'disconnected',
    qr: null,
    qrDataUrl: null,
    phone: null,
    pushname: null,
    lastConnected: null,
    lastStateChange: Date.now(),
    initAttempt: 0
};

let lastReconnectTime = 0;
const RECONNECT_COOLDOWN_MS = 15000;
let authTimeoutHandle = null;
const AUTH_TIMEOUT_MS = 120000;

// --------------------------------------------------
// Auth Timeout Helpers
// --------------------------------------------------
function clearAuthTimeout() {
    if (authTimeoutHandle) {
        clearTimeout(authTimeoutHandle);
        authTimeoutHandle = null;
    }
}

function startAuthTimeout() {
    clearAuthTimeout();
    authTimeoutHandle = setTimeout(async () => {
        if (whatsappStatus.status === 'authenticating') {
            console.log('[WhatsApp Watchdog] Stuck in authenticating for too long. Forcing re-init...');
            whatsappStatus.status = 'disconnected';
            whatsappStatus.lastStateChange = Date.now();
            if (whatsappClient) {
                try { whatsappClient.end(new Error('Auth Timeout')); } catch (e) {}
            }
        }
    }, AUTH_TIMEOUT_MS);
}

// --------------------------------------------------
// Core Lifecycle
// --------------------------------------------------
async function safeInitialize() {
    const now = Date.now();
    if (now - lastReconnectTime < RECONNECT_COOLDOWN_MS) {
        const waitMs = RECONNECT_COOLDOWN_MS - (now - lastReconnectTime);
        console.log(`[WhatsApp] Reconnect cooldown active, waiting ${Math.ceil(waitMs / 1000)}s...`);
        await new Promise(r => setTimeout(r, waitMs));
    }
    lastReconnectTime = Date.now();
    whatsappStatus.initAttempt++;

    console.log(`[WhatsApp] Initializing Baileys client (attempt #${whatsappStatus.initAttempt})...`);
    try {
        const authDir = path.join(process.cwd(), '.auth_info_baileys');
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        const { version } = await fetchLatestBaileysVersion();

        whatsappClient = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,
            browser: ['Factory AI', 'Chrome', '1.0.0'],
            generateHighQualityLinkPreview: true,
            syncFullHistory: false
        });

        whatsappClient.ev.on('creds.update', saveCreds);
        setupBaileysEvents(whatsappClient);
    } catch (err) {
        console.error('[WhatsApp] Initialize failed:', err.message);
        whatsappStatus.status = 'disconnected';
        whatsappStatus.lastStateChange = Date.now();
    }
}

// --------------------------------------------------
// In-Memory Active Groups Cache (Eliminates polling)
// --------------------------------------------------
let activeGroupsLoaded = false;
const activeGroupsCacheSet = new Set();

async function loadActiveGroups() {
    try {
        const groups = await prisma.whatsapp_groups.findMany({ where: { active: true } });
        activeGroupsCacheSet.clear();
        groups.forEach(g => activeGroupsCacheSet.add(g.group_id));
        activeGroupsLoaded = true;
        console.log('[WhatsApp] Active groups cache loaded into memory.');
    } catch (err) {
        console.error('[WhatsApp] Failed to load active groups:', err);
    }
}

function updateActiveGroup(groupId, isActive) {
    if (isActive) activeGroupsCacheSet.add(groupId);
    else activeGroupsCacheSet.delete(groupId);
}

// --------------------------------------------------
// Baileys Event Handlers
// --------------------------------------------------
function setupBaileysEvents(sock) {
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('==================================================');
            console.log('  Scan QR Code below to connect WhatsApp:');
            console.log('==================================================');
            qrTerminal.generate(qr, { small: true });

            clearAuthTimeout();
            whatsappStatus.status = 'qr';
            whatsappStatus.qr = qr;
            whatsappStatus.phone = null;
            whatsappStatus.pushname = null;
            whatsappStatus.lastStateChange = Date.now();

            try {
                whatsappStatus.qrDataUrl = await QRCode.toDataURL(qr, {
                    width: 512, margin: 3,
                    errorCorrectionLevel: 'M',
                    color: { dark: '#000000', light: '#ffffff' }
                });
                console.log('[WhatsApp] QR data URL generated locally (instant)');
                if (global.io) global.io.emit('dashboard_update');
            } catch (err) {
                console.error('[WhatsApp] QR image generation failed:', err.message);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('[WhatsApp] Connection closed due to', lastDisconnect?.error?.message || lastDisconnect?.error, 'reconnecting:', shouldReconnect);

            clearAuthTimeout();
            whatsappStatus.status = 'disconnected';
            whatsappStatus.qr = null;
            whatsappStatus.qrDataUrl = null;
            whatsappStatus.phone = null;
            whatsappStatus.pushname = null;
            whatsappStatus.lastStateChange = Date.now();
            if (global.io) global.io.emit('dashboard_update');

            if (shouldReconnect) {
                safeInitialize();
            } else {
                console.log('[WhatsApp] Connection closed. You are logged out. Generating new QR...');
                const authPath = path.join(process.cwd(), '.auth_info_baileys');
                if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
                // Auto-generate a new QR after logout so user can re-scan
                setTimeout(() => safeInitialize(), 2000);
            }
        } else if (connection === 'open') {
            console.log('==================================================');
            console.log('  WhatsApp Connected & ready for message events!');
            console.log('==================================================');
            clearAuthTimeout();
            whatsappStatus.status = 'connected';
            whatsappStatus.qr = null;
            whatsappStatus.qrDataUrl = null;
            whatsappStatus.lastConnected = new Date().toISOString();
            whatsappStatus.lastStateChange = Date.now();
            whatsappStatus.phone = sock.user?.id?.split(':')[0] || null;
            whatsappStatus.pushname = sock.user?.name || null;
            whatsappStatus.initAttempt = 0;
            if (global.io) global.io.emit('dashboard_update');
        }
    });

    const processedMessageIds = new Set();

    sock.ev.on('messages.upsert', async (m) => {
        try {
            if (m.type !== 'notify') return;
            for (const msg of m.messages) {
                if (!msg.message || msg.key.fromMe) continue;

                const jid = msg.key.remoteJid;
                if (!isJidGroup(jid)) continue;

                if (msg.key.id) {
                    if (processedMessageIds.has(msg.key.id)) continue;
                    processedMessageIds.add(msg.key.id);
                    if (processedMessageIds.size > 1000) {
                        // Batch-clear oldest 200 entries to avoid per-message overhead
                        const iterator = processedMessageIds.values();
                        for (let i = 0; i < 200; i++) iterator.next();
                        const remaining = [];
                        for (const val of iterator) remaining.push(val);
                        processedMessageIds.clear();
                        remaining.forEach(v => processedMessageIds.add(v));
                    }
                }

                // Check database to see if this group is active (using in-memory set without TTL polling)
                if (!activeGroupsLoaded) {
                    await loadActiveGroups();
                }
                
                if (!activeGroupsCacheSet.has(jid)) continue;

                let senderName = msg.pushName || msg.key.participant?.split('@')[0] || 'WhatsApp User';
                senderName = senderName.toString().trim();

                console.log("\n==================");
                console.log("Factory Group JID:", jid);
                console.log("Resolved Sender JID:", senderName);
                console.log("==================");

                const messageType = Object.keys(msg.message)[0];
                const textBody = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

                if (textBody && textBody.trim() !== "") {
                    console.log("Text:", textBody);
                    const items = await processText(textBody);
                    console.log("\nExtracted:", items);
                    for (const item of items) {
                        console.log(`[WhatsApp Bot] Dispatching text request directly to DB. Sender: "${senderName}"`);
                        await savePendingRequest(item, senderName);
                    }
                } else if (messageType === 'audioMessage' || messageType === 'ptvMessage') {
                    console.log("Voice note received");
                    const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }) });
                    const audioDir = path.join(process.cwd(), 'audio_files');
                    if (!require('fs').existsSync(audioDir)) require('fs').mkdirSync(audioDir, { recursive: true });
                    const filename = path.join(audioDir, `voice_${Date.now()}.ogg`);
                    fs.writeFileSync(filename, buffer);
                    console.log("Saved audio file:", filename);

                    const items = await processAudio(filename);
                    console.log("\nExtracted:", items);

                    for (const item of items) {
                        console.log(`[WhatsApp Bot] Dispatching audio request directly to DB. Sender: "${senderName}"`);
                        await savePendingRequest(item, senderName);
                    }

                    try { fs.unlinkSync(filename); } catch (cleanupErr) {
                        console.error("Error cleaning up audio file:", cleanupErr.message);
                    }
                }
            }
        } catch (err) {
            console.log("\nERROR inside messages.upsert listener:", err);
        }
    });
}

// --------------------------------------------------
// Public Getters & Actions (used by controllers)
// --------------------------------------------------
function getStatus() {
    return {
        status: whatsappStatus.status,
        qr: whatsappStatus.qr,
        qrDataUrl: whatsappStatus.qrDataUrl,
        phone: whatsappStatus.phone,
        pushname: whatsappStatus.pushname,
        lastConnected: whatsappStatus.lastConnected,
        initAttempt: whatsappStatus.initAttempt
    };
}

function getClient() {
    return whatsappClient;
}

async function logout() {
    console.log('[WhatsApp Admin] Logging out WhatsApp client manually...');
    clearAuthTimeout();

    whatsappStatus.status = 'disconnected';
    whatsappStatus.qr = null;
    whatsappStatus.qrDataUrl = null;
    whatsappStatus.phone = null;
    whatsappStatus.pushname = null;
    whatsappStatus.lastStateChange = Date.now();

    if (whatsappClient) {
        try { await whatsappClient.logout(); } catch (e) {
            try { whatsappClient.end(new Error('Logout')); } catch (e2) {}
        }
    }

    // Remove Baileys auth folder completely
    const authPath = path.join(process.cwd(), '.auth_info_baileys');
    if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });

    if (global.io) global.io.emit('dashboard_update');
    setTimeout(() => safeInitialize(), 2000);
}

async function reconnect() {
    console.log('[WhatsApp Admin] Re-initializing WhatsApp client manually...');
    clearAuthTimeout();

    whatsappStatus.status = 'initializing';
    whatsappStatus.qr = null;
    whatsappStatus.qrDataUrl = null;
    whatsappStatus.lastStateChange = Date.now();

    if (whatsappClient) {
        try { whatsappClient.end(new Error('Reconnect')); } catch (e) {}
    }

    if (global.io) global.io.emit('dashboard_update');
    setTimeout(() => safeInitialize(), 2000);
}

async function ensureWhatsappGroupsTable() {
    // This is managed by Prisma migrations / schema sync now.
    // We can keep it as a no-op or a basic try/catch if absolutely necessary,
    // but the table is already defined in prisma/schema.prisma.
    console.log('ensureWhatsappGroupsTable: Handled by Prisma.');
}

module.exports = {
    safeInitialize,
    getStatus,
    getClient,
    logout,
    reconnect,
    ensureWhatsappGroupsTable,
    updateActiveGroup
};
