require('dotenv').config();

// Global error handlers to prevent async crashes from taking down the Express web service
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Unhandled Rejection Alert]:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[Uncaught Exception Alert]:', err.message || err);
});

const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const whatsappService = require('./services/whatsappService');
const { getApiLimitInfo, decayTimestamps } = require('./services/aiService');

const PORT = process.env.PORT || 5000;

// --------------------------------------------------
// HTTP Server + Socket.IO
// --------------------------------------------------
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*" }
});
global.io = io; // Expose globally to broadcast from anywhere

io.on('connection', (socket) => {
    console.log('[Socket.IO] New dashboard client connected:', socket.id);

    // Immediately send current API limits on new connection
    const limitInfo = getApiLimitInfo();
    socket.emit('api_limit_update', limitInfo);

    socket.on('disconnect', () => console.log('[Socket.IO] Client disconnected:', socket.id));
});

// Periodic broadcast of API limit decay (every 10s is sufficient for cosmetic UI)
setInterval(() => {
    decayTimestamps();
}, 10000);

// --------------------------------------------------
// Start Server
// --------------------------------------------------
httpServer.listen(PORT, async () => {
    console.log(`==================================================`);
    console.log(`  Express Dashboard Backend running on port ${PORT}`);
    console.log(`  API Access: http://localhost:${PORT}/api/requests`);
    console.log(`==================================================`);

    // Ensure whatsapp_groups table exists
    await whatsappService.ensureWhatsappGroupsTable();

    // Ensure amount column exists in pending_requests & recycle bin columns in inventory
    try {
        const prisma = require('./config/db');
        await prisma.$executeRawUnsafe(`ALTER TABLE pending_requests ADD COLUMN IF NOT EXISTS amount VARCHAR(100);`);
        await prisma.$executeRawUnsafe(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255);`);
        console.log('Database schema verified (amount column in pending_requests & recycle bin in inventory).');
    } catch (colErr) {
        console.warn('Could not auto-verify schema columns:', colErr.message);
    }

    // Start WhatsApp Bot Singleton in the same process
    console.log('Initializing WhatsApp Client singleton...');
    whatsappService.safeInitialize();
});


