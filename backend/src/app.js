const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const prisma = require('./config/db');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const requestRoutes = require('./routes/requestRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const kpiRoutes = require('./routes/kpiRoutes');

const app = express();

// --------------------------------------------------
// Middleware
// --------------------------------------------------
app.use(cors());
app.use(express.json());

// Serve local voice note audio files from a dedicated directory
const audioDir = path.join(process.cwd(), 'audio_files');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
app.use('/audio', express.static(audioDir));

// --------------------------------------------------
// Health Check
// --------------------------------------------------
app.get('/health', async (req, res) => {
    const whatsappService = require('./services/whatsappService');
    const healthStatus = {
        uptime: process.uptime(),
        status: 'UP',
        timestamp: new Date().toISOString(),
        database: 'unhealthy',
        whatsapp: whatsappService.getStatus().status
    };

    try {
        // We do NOT query the database here.
        // A periodic query on the health endpoint prevents serverless databases (like Neon) from auto-suspending.
        healthStatus.database = 'unverified (skipping ping to allow auto-suspend)';
    } catch (dbErr) {
        console.error('[Health Check] Database check failed:', dbErr.message);
        healthStatus.status = 'DOWN';
        healthStatus.database = dbErr.message;
        return res.status(500).json(healthStatus);
    }

    res.json(healthStatus);
});

app.get('/api/health', (req, res) => {
    res.redirect('/health');
});

// Voice notes listing
app.get('/api/voice-notes', (req, res) => {
    try {
        const voiceDir = path.join(process.cwd(), 'audio_files');
        if (!fs.existsSync(voiceDir)) return res.json([]);
        const files = fs.readdirSync(voiceDir);
        const voiceNotes = files
            .filter(file => file.startsWith('voice_') && file.endsWith('.ogg'))
            .map(file => {
                const timestampStr = file.replace('voice_', '').replace('.ogg', '');
                const timestamp = parseInt(timestampStr, 10);
                const stats = fs.statSync(path.join(voiceDir, file));
                return {
                    filename: file,
                    url: `/audio/${file}`,
                    timestamp,
                    date: isNaN(timestamp) ? stats.birthtime : new Date(timestamp),
                    sizeBytes: stats.size
                };
            })
            .sort((a, b) => b.timestamp - a.timestamp);

        res.json(voiceNotes);
    } catch (err) {
        console.error('Error listing voice notes:', err);
        res.status(500).json({ error: 'Failed to scan voice notes' });
    }
});

// --------------------------------------------------
// API Routes
// --------------------------------------------------
app.use('/api', authRoutes);
app.use('/api', requestRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', whatsappRoutes);
app.use('/api', kpiRoutes);

// --------------------------------------------------
// Serve Frontend in Production
// --------------------------------------------------
const distPath = path.join(process.cwd(), '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*splat', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

module.exports = app;
