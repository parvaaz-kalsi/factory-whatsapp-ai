const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const pool = require('./config/db');

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

// Serve local voice note audio files as static resources
app.use('/audio', express.static(path.join(process.cwd())));

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
        const dbCheck = await pool.query('SELECT NOW()');
        if (dbCheck && dbCheck.rows.length > 0) {
            healthStatus.database = 'healthy';
        }
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
        const rootDir = process.cwd();
        const files = fs.readdirSync(rootDir);
        const voiceNotes = files
            .filter(file => file.startsWith('voice_') && file.endsWith('.ogg'))
            .map(file => {
                const timestampStr = file.replace('voice_', '').replace('.ogg', '');
                const timestamp = parseInt(timestampStr, 10);
                const stats = fs.statSync(path.join(rootDir, file));
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
