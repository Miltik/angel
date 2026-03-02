/**
 * ANGEL Backend - WebSocket Real-time Updates
 * Sends live updates to web dashboard
 */

import { query } from './db.js';

let clients = new Set();

export function setupWebSocket(wss) {
    wss.on('connection', (ws) => {
        console.log('🔌 New WebSocket client connected');
        clients.add(ws);

        // Send initial connection message
        ws.send(JSON.stringify({
            type: 'connected',
            message: 'Connected to ANGEL backend',
            timestamp: Date.now()
        }));

        // Handle incoming messages
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);

                switch (data.type) {
                    case 'subscribe':
                        // Client subscribing to updates
                        ws.send(JSON.stringify({
                            type: 'subscribed',
                            channel: data.channel,
                            timestamp: Date.now()
                        }));
                        break;

                    case 'ping':
                        // Keep-alive
                        ws.send(JSON.stringify({
                            type: 'pong',
                            timestamp: Date.now()
                        }));
                        break;
                }
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        });

        ws.on('close', () => {
            console.log('WebSocket client disconnected');
            clients.delete(ws);
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    });

    console.log('✓ WebSocket server configured');
}

export function broadcastUpdate(event, data) {
    const message = JSON.stringify({
        type: event,
        data,
        timestamp: Date.now()
    });

    for (const client of clients) {
        if (client.readyState === 1) { // 1 = OPEN
            client.send(message);
        }
    }
}

export function broadcastTelemetry(telemetryData) {
    broadcastUpdate('telemetry', telemetryData);
}

export function broadcastCommand(command) {
    broadcastUpdate('command', command);
}

export function broadcastAlert(alert) {
    broadcastUpdate('alert', alert);
}

export function getConnectedClients() {
    return clients.size;
}
