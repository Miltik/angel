/**
 * ANGEL Backend - Main Express Server
 * Orchestrates API, WebSocket, and database
 */

import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import http from 'http';
import dotenv from 'dotenv';
import { initializeDatabase, closeDatabase } from './db.js';
import { setupApiRoutes } from './api.js';
import { setupWebSocket, broadcastTelemetry } from './websocket.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';  // Listen on all interfaces for WiFi access

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

function checkExistingServer() {
    return new Promise((resolve) => {
        const req = http.get({
            hostname: HOST,
            port: Number(PORT),
            path: '/health',
            timeout: 1500,
        }, (res) => {
            res.resume();
            resolve(res.statusCode === 200);
        });

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
    });
}

// Middleware
app.use(express.json());
app.use(cors({
    origin: function(origin, callback) {
        // Allow localhost, local network IPs, and undefined (same-origin requests)
        const localNetworkRegex = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.)/;
        if (!origin || origin === 'http://localhost:5173' || origin === 'http://localhost:3000' || localNetworkRegex.test(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS blocked'));
        }
    },
    credentials: true
}));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// Initialize and start
async function start() {
    try {
        server.on('error', async (error) => {
            if (error?.code === 'EADDRINUSE') {
                const healthy = await checkExistingServer();
                if (healthy) {
                    console.log(`⚠️ Backend already running on http://${HOST}:${PORT} (reusing existing process)`);
                    process.exit(0);
                    return;
                }
                console.error(`❌ Port ${PORT} is in use by another process.`);
                process.exit(1);
                return;
            }

            console.error('Server error:', error);
            process.exit(1);
        });

        // Initialize database
        await initializeDatabase();
        
        // Setup API routes
        setupApiRoutes(app);
        
        // Setup WebSocket
        setupWebSocket(wss);
        
        // Start server
        server.listen(PORT, HOST, () => {
            console.log('\n╔════════════════════════════════════════╗');
            console.log('║   ANGEL Backend Server Started         ║');
            console.log('╚════════════════════════════════════════╝\n');
            console.log(`🔌 API:       http://${HOST}:${PORT}`);
            console.log(`📡 WebSocket: ws://${HOST}:3001`);
            console.log(`💻 Dashboard: http://localhost:5173`);
            console.log(`🤖 Discord:   Waiting for token in .env\n`);
            console.log('Ready to receive telemetry from Bitburner...\n');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\nShutting down...');
    try {
        await closeDatabase();
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

start();

export { app, server, wss };
