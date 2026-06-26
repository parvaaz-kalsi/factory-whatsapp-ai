const prisma = require('../config/db');
const QRCode = require('qrcode');
const whatsappService = require('../services/whatsappService');

// GET /api/whatsapp/status
exports.getStatus = (req, res) => {
    res.json(whatsappService.getStatus());
};

// GET /api/whatsapp/qr-image
exports.getQrImage = async (req, res) => {
    const status = whatsappService.getStatus();
    if (!status.qr) {
        return res.status(404).json({ error: 'No QR code available', status: status.status });
    }
    try {
        const dataUrl = await QRCode.toDataURL(status.qr, {
            width: 300, margin: 2,
            color: { dark: '#0f172a', light: '#ffffff' }
        });
        res.json({ qrDataUrl: dataUrl });
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate QR image' });
    }
};

// GET /api/whatsapp/groups
exports.getGroups = async (req, res) => {
    try {
        let dbGroups = [];
        const dbMap = new Map();
        try {
            dbGroups = await prisma.whatsapp_groups.findMany();
            dbGroups.forEach(g => {
                dbMap.set(g.group_id, { name: g.group_name, active: g.active });
            });
            console.log(`[WhatsApp Groups] Loaded ${dbGroups.length} groups from database.`);
        } catch (dbErr) {
            console.error('[WhatsApp Groups] DB query failed:', dbErr.message);
        }

        let combinedGroups = [];
        const status = whatsappService.getStatus();
        const client = whatsappService.getClient();

        if (status.status === 'connected' && client) {
            try {
                if (!global.whatsappChatsCache) {
                    global.whatsappChatsCache = { data: [], lastFetch: 0, fetching: false };
                }

                const now = Date.now();
                if (now - global.whatsappChatsCache.lastFetch > 30000 && !global.whatsappChatsCache.fetching) {
                    global.whatsappChatsCache.fetching = true;
                    console.log('[WhatsApp Groups] Fetching live groups from Baileys (uncached)...');

                    client.groupFetchAllParticipating().then(groups => {
                        const chats = Object.values(groups).map(g => ({
                            id: { _serialized: g.id },
                            name: g.subject || 'Unnamed Group',
                            isGroup: true
                        }));
                        console.log(`[WhatsApp Groups] Total groups fetched: ${chats.length}`);
                        global.whatsappChatsCache.data = chats;
                        global.whatsappChatsCache.lastFetch = Date.now();
                        global.whatsappChatsCache.fetching = false;
                    }).catch(err => {
                        console.error('[WhatsApp Groups] Error fetching live chats:', err.message);
                        global.whatsappChatsCache.fetching = false;
                    });
                }

                const groupChats = global.whatsappChatsCache.data || [];
                groupChats.forEach(chat => {
                    const dbEntry = dbMap.get(chat.id._serialized);
                    combinedGroups.push({
                        id: chat.id._serialized,
                        name: chat.name || dbEntry?.name || 'Unnamed Group',
                        active: dbEntry ? dbEntry.active : false
                    });
                    dbMap.delete(chat.id._serialized);
                });
            } catch (clientErr) {
                console.error('[WhatsApp Groups] Error processing live chats:', clientErr.message);
            }
        } else {
            console.log(`[WhatsApp Groups] WhatsApp not connected (status: ${status.status}), skipping live chat fetch.`);
        }

        dbMap.forEach((val, key) => {
            combinedGroups.push({ id: key, name: val.name || 'Unnamed Group', active: val.active });
        });

        console.log(`[WhatsApp Groups] Returning ${combinedGroups.length} total groups to frontend.`);
        res.json({
            groups: combinedGroups,
            isSyncing: global.whatsappChatsCache ? global.whatsappChatsCache.fetching : false
        });
    } catch (err) {
        console.error('Error in GET /api/whatsapp/groups:', err);
        res.json({ groups: [], isSyncing: false });
    }
};

// POST /api/whatsapp/groups/active
exports.setGroupActive = async (req, res) => {
    try {
        const { groupId, active, name } = req.body;
        if (!groupId) return res.status(400).json({ error: 'groupId is required' });

        const result = await prisma.whatsapp_groups.upsert({
            where: { group_id: groupId },
            update: {
                active: !!active,
                group_name: name || 'Unnamed Group'
            },
            create: {
                group_id: groupId,
                group_name: name || 'Unnamed Group',
                active: !!active
            }
        });

        // Update the in-memory cache immediately to prevent polling
        whatsappService.updateActiveGroup(groupId, !!active);

        if (global.io) global.io.emit('dashboard_update');
        res.json({ success: true, group: result });
    } catch (err) {
        console.error('Error in POST /api/whatsapp/groups/active:', err);
        res.status(500).json({ error: 'Failed to update WhatsApp group active state' });
    }
};

// POST /api/whatsapp/logout
exports.logout = async (req, res) => {
    try {
        await whatsappService.logout();
        res.json({ success: true, message: 'Logged out. Generating new QR code...' });
    } catch (err) {
        console.error('Error logging out WhatsApp client:', err);
        res.status(500).json({ error: 'Failed to logout client', details: err.message });
    }
};

// POST /api/whatsapp/reconnect
exports.reconnect = async (req, res) => {
    try {
        await whatsappService.reconnect();
        res.json({ success: true, message: 'Re-initialization started. QR code will appear shortly.' });
    } catch (err) {
        console.error('Error re-initializing WhatsApp client:', err);
        res.status(500).json({ error: 'Failed to re-initialize client', details: err.message });
    }
};
