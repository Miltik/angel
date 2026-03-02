# ANGEL Backend API Reference

Complete API documentation for the ANGEL remote backend.

---

## Base URL

```
http://localhost:3000
```

---

## Endpoints

### 1. Health Check

**GET** `/health`

Check if backend is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1704067200000
}
```

---

### 2. Get Status

**GET** `/api/status`

Get current game state and pending commands.

**Response:**
```json
{
  "status": "ok",
  "lastUpdate": 1704067200000,
  "latestData": {
    "id": 123,
    "timestamp": 1704067200000,
    "module_name": "hacking",
    "money_rate": 1500000.50,
    "xp_rate": 250.25,
    "hack_level": 450,
    "current_money": "1000000000",
    "uptime": 3600000,
    "module_status": "running",
    "execution_count": 150,
    "failure_count": 2,
    "avg_execution_time": 1250.5
  },
  "pendingCommands": 3,
  "timestamp": 1704067200000
}
```

---

### 3. Send Telemetry

**POST** `/api/telemetry`

Send telemetry data from Bitburner. Called every 10 seconds.

**Request Body:**
```json
{
  "runId": "1704067200000",
  "timestamp": 1704067200000,
  "modules": {
    "hacking": {
      "executions": 150,
      "failures": 2,
      "avgTime": 1250.5,
      "status": "running"
    },
    "servers": {
      "executions": 75,
      "failures": 0,
      "avgTime": 890.3,
      "status": "running"
    }
  },
  "stats": {
    "uptime": 3600000,
    "totalExecutions": 225,
    "totalFailures": 2,
    "moneyRate": 1500000.50,
    "xpRate": 250.25
  },
  "memory": {
    "used": 64,
    "total": 256
  },
  "money": "1000000000",
  "xp": 50000,
  "hackLevel": 450
}
```

**Response:**
```json
{
  "success": true,
  "message": "Telemetry recorded",
  "samplesReceived": 2
}
```

---

### 4. Queue Command

**POST** `/api/commands`

Queue a command to be executed by Angel.

**Request Body:**
```json
{
  "commandType": "pause|resume|report|runModule",
  "parameters": {
    "module": "hacking"  // For runModule command
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Command queued",
  "commandId": 42
}
```

**Command Types:**
- `pause` - Pause Angel execution
- `resume` - Resume Angel execution
- `report` - Generate telemetry report
- `runModule` - Run specific module (parameters.module required)

---

### 5. Get Pending Commands

**GET** `/api/commands`

Retrieve pending commands for the game. Called every 30 seconds by Angel.

**Query Parameters:**
- None required

**Response:**
```json
{
  "success": true,
  "commands": [
    {
      "id": 42,
      "type": "pause",
      "parameters": {}
    },
    {
      "id": 43,
      "type": "report",
      "parameters": {}
    }
  ],
  "count": 2
}
```

---

### 6. Update Command Status

**PATCH** `/api/commands/:id`

Mark a command as executed.

**URL Parameters:**
- `id` (required) - Command ID

**Request Body:**
```json
{
  "status": "executed|failed",
  "result": {
    "status": "paused",
    "message": "Execution paused successfully"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Command updated"
}
```

---

### 7. Get Telemetry History

**GET** `/api/history`

Retrieve historical telemetry data.

**Query Parameters:**
- `limit` (optional, default: 100) - Number of samples to retrieve
- `module` (optional) - Filter by module name

**Examples:**
```
GET /api/history?limit=50
GET /api/history?module=hacking
GET /api/history?limit=200&module=servers
```

**Response:**
```json
{
  "success": true,
  "count": 50,
  "data": [
    {
      "id": 1,
      "timestamp": 1704067200000,
      "run_id": "1704067200000",
      "module_name": "hacking",
      "money_rate": 1500000.50,
      "xp_rate": 250.25,
      "hack_level": 450,
      "execution_count": 150,
      "failure_count": 2,
      "avg_execution_time": 1250.5
    }
    // ... more samples
  ]
}
```

---

### 8. Get Statistics

**GET** `/api/stats`

Get aggregated statistics for last 7 days.

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_samples": 10080,
    "unique_modules": 12,
    "avg_money_rate": 1200000.75,
    "peak_money_rate": 2500000.25,
    "avg_xp_rate": 200.5,
    "modules_with_failures": 2
  }
}
```

---

## WebSocket Events

**Connect:** `ws://localhost:3001`

### Server → Client Events

**connected**
```json
{
  "type": "connected",
  "message": "Connected to ANGEL backend",
  "timestamp": 1704067200000
}
```

**telemetry**
```json
{
  "type": "telemetry",
  "data": {
    "timestamp": 1704067200000,
    "moneyRate": 1500000.50,
    "xpRate": 250.25,
    "modules": 12
  },
  "timestamp": 1704067200000
}
```

**command**
```json
{
  "type": "command",
  "data": {
    "id": 42,
    "type": "pause",
    "status": "executed"
  },
  "timestamp": 1704067200000
}
```

**alert**
```json
{
  "type": "alert",
  "data": {
    "severity": "warning|error|info",
    "title": "High Failure Rate",
    "message": "Hacking module failure rate exceeded 10%"
  },
  "timestamp": 1704067200000
}
```

### Client → Server Messages

**subscribe**
```json
{
  "type": "subscribe",
  "channel": "telemetry"
}
```

**ping** (keep-alive)
```json
{
  "type": "ping"
}
```

---

## Error Responses

All endpoints follow consistent error format:

```json
{
  "success": false,
  "error": "Error description"
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad request
- `404` - Not found
- `500` - Server error

---

## Rate Limiting

- No rate limits currently enforced
- Recommended: 
  - Telemetry: Every 10 seconds
  - Command check: Every 30 seconds
  - Status queries: Every 5 seconds

---

## Authentication

Currently no authentication required (local only).

For production deployment, consider:
- API tokens
- JWT
- OAuth2

---

## Examples

### Send Telemetry from Bitburner

```javascript
async function sendTelemetry(ns, data) {
    const response = await fetch('http://localhost:3000/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}
```

### Poll for Commands from Bitburner

```javascript
async function checkCommands(ns) {
    const response = await fetch('http://localhost:3000/api/commands');
    const { commands } = await response.json();
    return commands;
}
```

### Send Command from Web Dashboard

```javascript
async function sendCommand(type, parameters = {}) {
    const response = await fetch('http://localhost:3000/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandType: type, parameters })
    });
    return response.json();
}
```

### Connect to WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe', channel: 'telemetry' }));
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log('Received:', message.type, message.data);
};
```

---

## Database Schema

### telemetry_samples
```sql
id INTEGER PRIMARY KEY
timestamp INTEGER
run_id TEXT
module_name TEXT
memory_used REAL
money_rate REAL
xp_rate REAL
hack_level INTEGER
current_money TEXT
uptime INTEGER
module_status TEXT
execution_count INTEGER
failure_count INTEGER
avg_execution_time REAL
raw_data TEXT
created_at DATETIME
```

### commands
```sql
id INTEGER PRIMARY KEY
command_type TEXT
parameters TEXT
status TEXT (pending|executed|failed)
executed_at DATETIME
result TEXT
created_at DATETIME
```

### discord_alerts
```sql
id INTEGER PRIMARY KEY
alert_type TEXT
title TEXT
message TEXT
severity TEXT (info|warning|error)
sent_at DATETIME
created_at DATETIME
```

### system_state
```sql
id INTEGER PRIMARY KEY
key TEXT UNIQUE
value TEXT
updated_at DATETIME
```

---

## Performance Notes

- SQLite keeps last 7 days of telemetry
- Automatic cleanup of old data
- WebSocket broadcasts to all connected clients
- Typically <50ms response time per request
- Database queries optimized with indexes on frequently filtered columns
