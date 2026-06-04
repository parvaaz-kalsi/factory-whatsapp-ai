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

// Periodic broadcast of API limit decay
setInterval(() => {
    decayTimestamps();
}, 2000);

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

    // Start WhatsApp Bot Singleton in the same process
    console.log('Initializing WhatsApp Client singleton...');
    whatsappService.safeInitialize();
});
