/**
 * ANGEL Backend - Main Express Server
 * Orchestrates API, WebSocket, and database
 */

import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { initializeDatabase, closeDatabase } from './db.js';
import { setupApiRoutes } from './api.js';
import { setupWebSocket } from './websocket.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
}));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// Initialize and start
async function start() {
    try {
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
