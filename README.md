# MyRadar — Disaster Response Intelligence Platform

> **When the network goes down, response doesn't.**

MyRadar is an offline-first disaster response intelligence platform built for India's flood emergency management. It provides real-time situational awareness, rescue coordination, relief logistics, and AI-assisted decision-making — even when internet connectivity is unavailable.

---

## 🚨 Live Demo

**Scenario:** Monsoon season multi-state flooding across India  
**Affected regions:** Mumbai, Patna, Guwahati, Kolkata, Chennai, Bhubaneswar, Hyderabad

---

## 🛰️ AWS Services Used

### Amazon DynamoDB
**Purpose:** Operational data store for the entire platform  
**What it stores:**
- Sync events from offline field devices (`disaster_id` as partition key)
- Incident records created by operators (`INC#` prefix)
- Sensor readings written by IoT Core rules (`SENSOR#` prefix)
- Road status updates, team deployments, shelter changes

**Key design:** Idempotent writes using `ConditionExpression: attribute_not_exists(disaster_id)` — safe to retry without duplicates.

---

### AWS IoT Core
**Purpose:** Real-time sensor telemetry pipeline  
**What it does:**
- Water-level sensors (Mithi River Mumbai, Ganga Patna, Brahmaputra Guwahati, etc.) publish readings to MQTT topics every 10 seconds
- Topic structure: `myradar/sensors/{sensorId}` (e.g. `myradar/sensors/W-07`)
- IoT Rule automatically writes every MQTT message into DynamoDB with `eventType: SENSOR_READING`
- Trigger: sensor crossing 3.5m threshold → SNS flood alert fires automatically

**IoT Rule SQL:**
```sql
SELECT *, topic(3) as sensorId, concat('SENSOR#', topic(3)) as disaster_id, 
'SENSOR_READING' as eventType FROM 'myradar/sensors/+'
```

---

### Amazon SNS (Simple Notification Service)
**Purpose:** Automated flood alert notifications  
**What it does:**
- Sends email alerts to subscribed emergency coordinators
- Auto-triggers when any water sensor exceeds 3.5m
- Auto-triggers when any shelter reaches CRITICAL capacity
- Manual test send available from IoT + SNS panel in the UI
- Debounced per alert key (5-minute cooldown per sensor)

**Alert format:**
```
Subject: 🚨 CRITICAL: Extreme Flood Warning — Brahmaputra Sensor
Body:    Brahmaputra Sensor is reading 5.10m (CRITICAL).
         Immediate response required.
         Location: Brahmaputra Sensor | Water: 5.10m
         Time: 3:25:57 PM IST
```

---

### Amazon Bedrock (Amazon Nova Pro)
**Purpose:** AI-powered disaster intelligence assistant  
**Model:** `amazon.nova-pro-v1:0`  
**What it does:**
- Answers natural language questions about the disaster situation
- City-specific queries: "What is the situation in Mumbai?" → full flood report
- Operational queries: "Which shelter is safest?", "Which roads are blocked?"
- Context-aware: receives live sensor data, team status, shelter capacity, active alerts
- Graceful degradation: falls back to Gemini → local rule engine when Bedrock unavailable

**System prompt includes:** real-time severity, flood risk %, water level, affected population, shelter summary, top alerts, city flood levels.

---

### AWS IoT TwinMaker (Digital Twin concept)
**Purpose:** Digital Twin visualization of affected infrastructure  
**What it represents:**
- Buildings (residential, hospitals, critical infrastructure)
- Flood depth per building
- Status: HEALTHY → AT_RISK → FLOODED → CRITICAL → EVACUATED
- Rescue team positions
- Sensor locations

---

## 🗺️ Map & Visualization

### MapLibre GL JS (3D Map Engine)
- Loaded via CDN to bypass Next.js/Turbopack bundler constraints
- **3D building extrusion** — individual buildings visible when zoomed in
- **Satellite hybrid** tiles from MapTiler — real aerial imagery
- **Map style switcher:** 🛰 Satellite / 🗺 Streets / 🌑 Dark
- Flood zone fill layers with depth-based opacity
- Custom HTML emoji markers for shelters, teams, sensors, hazards

### MapTiler Cloud
- Provides map tiles: satellite hybrid, streets-v2, dataviz-dark styles
- Free tier: 100,000 tile requests/month

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│                                                                   │
│  React 19 + Next.js 16 + TypeScript                               │
│  ├── 3D Map (MapLibre GL via CDN)                                 │
│  ├── 9 Operation Panels (Rescue, Relief, Evac, AI, IoT+SNS...)   │
│  ├── Local Simulation Engine (offline-capable)                   │
│  └── IndexedDB (offline persistence + sync queue)                │
└──────────────────┬────────────────────────────────────────────────┘
                   │ HTTPS
┌──────────────────▼────────────────────────────────────────────────┐
│                    NEXT.JS API ROUTES                              │
│  /api/myradar/ai       → Amazon Bedrock (Nova Pro)                │
│  /api/myradar/sync     → DynamoDB (sync queue flush)              │
│  /api/myradar/alerts/notify → Amazon SNS                         │
│  /api/myradar/iot/publish  → AWS IoT Core (MQTT publish)         │
│  /api/myradar/sensors  → DynamoDB scan                            │
│  /api/myradar/verify   → DynamoDB health + query                  │
└──────────────────┬────────────────────────────────────────────────┘
                   │ AWS SDK
┌──────────────────▼────────────────────────────────────────────────┐
│                      AWS SERVICES                                  │
│                                                                    │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐    │
│  │  DynamoDB   │  │  IoT Core    │  │         SNS            │    │
│  │             │  │              │  │                        │    │
│  │ myradar-    │  │ MQTT topics  │  │ myradar-flood-alerts   │    │
│  │ disaster    │◄─┤ myradar/     │  │                        │    │
│  │             │  │ sensors/+    │  │ Email subscriptions    │    │
│  └─────────────┘  └──────────────┘  └───────────────────────┘    │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              Amazon Bedrock (Nova Pro)                       │  │
│  │  Disaster AI — context-aware situation reports               │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                     EXPRESS BACKEND (Port 4000)                    │
│                                                                    │
│  WebSocket live push (sensor data every 2s)                       │
│  REST API: /api/sensors, /api/shelters, /api/rescue-teams         │
│  AI route: /api/ai/query → Bedrock fallback                       │
│  Sync route: /api/sync → process offline events                   │
└────────────────────────────────────────────────────────────────────┘
```

---

## 📱 Platform Features

### 1. Real-Time Operational Dashboard
- Live header metrics: Severity, Flood Risk, Water Level, Affected Population, Active Teams, Alerts
- 8-cell stats grid with large readable numbers
- Color-coded severity: CRITICAL (red) → HIGH (amber) → ELEVATED (yellow) → NORMAL (green)

### 2. 3D Interactive Map
- Full India view at launch, zoom to city for building-level detail
- Flood zone polygons with depth-based blue fill intensity
- Evacuation route lines (green=safe, amber=medium, red=high risk)
- Live markers: shelters 🏠, rescue teams 🚨, sensors 💧, hazards ⚠️

### 3. Offline-First Architecture
- **IndexedDB** stores complete state snapshot every 5 seconds
- App reloads after Wi-Fi loss — data persists from last session
- New incidents created offline queue to sync queue (IDB-backed)
- On reconnect: sync queue drains to DynamoDB automatically
- Service Worker caches app shell for offline reload

### 4. Incident Management
- Create incidents with: type, severity, city, description, team assignment
- All incidents immediately queued for DynamoDB sync
- Status tracking: OPEN → ASSIGNED → RESOLVED
- Live badge count in nav

### 5. Evacuation Intelligence
- Local Dijkstra routing engine (works offline)
- Auto-recalculates routes when roads are blocked
- Shows blocked road list with flood depth
- 7 Indian city origins supported

### 6. Rescue Mesh (NDRF/SDRF Coordination)
- 12 rescue teams: NDRF Battalions, SDRF, Army, Coast Guard, Medical
- Status tracking: AVAILABLE → RESPONDING → RESCUING → TRANSPORTING
- Team detail view with mission, battery, priority
- Quick status update by operator

### 7. Relief Route Logistics
- Supply center inventory tracking (water, food, medicine, blankets, fuel)
- Shelter supply level monitoring with critical needs detection
- Relief request management: PENDING → ASSIGNED → EN_ROUTE → DELIVERED
- Recommended next delivery calculation

### 8. Operations Control
- **Water Level Slider** (0–5m): sets all sensors + flood zones simultaneously
- **Road Manager**: block/reopen any road by name with reason
- **Shelter Metrics**: per-shelter occupancy bars with supply status
- **Reset Scenario**: two-click confirmation to restore initial state

### 9. MyRadar AI Assistant
- City-specific queries: "Mumbai situation", "Patna update", "Delhi status"
- Operational queries: blocked roads, safest shelter, relief needs
- Priority: Gemini → Bedrock Nova Pro → local rule engine
- Works offline with local knowledge base
- Shows AI provider in badge: CLOUD / LOCAL

### 10. IoT + SNS Panel
- Real-time MQTT publish status
- Live sensor → IoT Core connection display
- Manual "Send Test Alert" button
- Alert log with timestamp and delivery status
- Setup instructions for new deployments

---

## 🔄 Offline Demo Scenario

```
1. Load MyRadar (online)    → app caches to IndexedDB + service worker
2. Turn off Wi-Fi           → click "Kill Internet" in Operations panel
3. Reload the page          → app loads from cache, data from IndexedDB
4. Create rescue incident   → saved locally + queued for sync
5. Check sync queue         → incident shows as "pending sync"
6. Restore Wi-Fi            → click "Restore Internet"
7. Sync auto-fires          → incident posts to DynamoDB
8. Verify in DynamoDB       → http://localhost:3000/api/myradar/verify
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.4.0 | React framework + API routes |
| React | 19 | UI components |
| TypeScript | 5.7.3 | Type safety |
| Tailwind CSS | 4.3.3 | Styling |
| MapLibre GL JS | 4.7.1 (CDN) | 3D map rendering |
| react-leaflet | 5.0.0 | 2D map fallback |
| Leaflet | 1.9.4 | Map library |
| Lucide React | 1.16.0 | Icons |

### AWS SDKs (Server-side only)
| SDK | Purpose |
|---|---|
| @aws-sdk/client-bedrock-runtime | Nova Pro AI queries |
| @aws-sdk/client-dynamodb | DynamoDB operations |
| @aws-sdk/lib-dynamodb | Document client wrapper |
| @aws-sdk/client-iot-data-plane | MQTT publish to IoT Core |
| @aws-sdk/client-sns | Email alert publishing |

### Backend (Express)
| Technology | Purpose |
|---|---|
| Express 4 | REST API server |
| ws | WebSocket live data push |
| Zod | Request validation |
| ts-node-dev | Development hot reload |
| Morgan | Request logging |
| Helmet | Security headers |

### Local Storage
| Technology | Purpose |
|---|---|
| IndexedDB (native) | Offline state persistence |
| Service Worker | App shell caching |
| Sync Queue (IDB) | Offline event storage |

---

## 🚀 Running Locally

### Prerequisites
- Node.js 20+
- npm or pnpm

### Setup

```bash
# Clone
git clone https://github.com/rasagiX/MyRadar-AWS.git
cd MyRadar-AWS

# Install dependencies
npm run install:all

# Configure environment
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local with your values

# Start both servers
npm run dev
```

Frontend: http://localhost:3000  
Backend API: http://localhost:4000  
Backend WebSocket: ws://localhost:4000/ws

### Environment Variables

```bash
# frontend/.env.local

# Map tiles (free at maptiler.com)
NEXT_PUBLIC_MAPTILER_KEY=your_key

# AWS credentials (server-side only)
AWS_ENABLED=true
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret

# AWS services
DYNAMODB_TABLE=myradar-disaster
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:ACCOUNT:myradar-flood-alerts
AWS_IOT_ENDPOINT=xxxxx-ats.iot.us-east-1.amazonaws.com
IOT_TOPIC=myradar/sensors

# AI (optional — free at aistudio.google.com/apikey)
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-1.5-flash

# Bedrock model
BEDROCK_MODEL_ID=amazon.nova-pro-v1:0
```

### Demo without AWS credentials

The platform runs fully in demo mode without any AWS credentials:

```bash
AWS_ENABLED=false
```

All simulation, offline, and AI features work. Only real DynamoDB writes, IoT MQTT, and SNS emails are disabled.

---

## 📊 AWS Resource Setup

### DynamoDB Table
```
Table name:    myradar-disaster
Partition key: disaster_id (String)
Sort key:      none
Billing:       On-demand (PAY_PER_REQUEST)
```

### SNS Topic
```
Topic name:  myradar-flood-alerts
Type:        Standard
Protocol:    Email
Endpoint:    your@email.com
```

### IoT Core Rule
```sql
Rule name:   myradar_sensor_to_dynamodb
SQL:         SELECT *, topic(3) as sensorId, 
             concat('SENSOR#', topic(3)) as disaster_id,
             'SENSOR_READING' as eventType 
             FROM 'myradar/sensors/+'
Action:      DynamoDB v2 → myradar-disaster table
IAM Role:    myradar-iot-dynamodb-role (auto-created)
```

---

## 🗂️ Project Structure

```
MyRadar-AWS/
├── frontend/                    # Next.js application
│   ├── app/
│   │   ├── api/myradar/         # Server-side AWS API routes
│   │   │   ├── ai/              # Bedrock AI queries
│   │   │   ├── alerts/notify/   # SNS alert publishing
│   │   │   ├── iot/publish/     # IoT Core MQTT publish
│   │   │   ├── sync/            # DynamoDB sync queue flush
│   │   │   ├── verify/          # DynamoDB query/health
│   │   │   └── ...
│   │   ├── globals.css          # Design system
│   │   ├── layout.tsx           # Root layout + DisasterProvider
│   │   └── page.tsx             # Main command center
│   ├── components/
│   │   ├── DisasterMap.tsx      # Dynamic import wrapper
│   │   ├── DisasterMapInner.tsx # MapLibre GL 3D map
│   │   ├── EvacuationPanel.tsx  # Route calculator
│   │   ├── RescuePanel.tsx      # Team coordination
│   │   ├── ReliefPanel.tsx      # Supply logistics
│   │   ├── IncidentPanel.tsx    # Incident management
│   │   ├── OperationsPanel.tsx  # Water slider + road manager
│   │   ├── SensorPanel.tsx      # IoT sensor readings
│   │   ├── DisasterAI.tsx       # AI chat interface
│   │   ├── SyncPanel.tsx        # AWS sync status
│   │   ├── IoTPanel.tsx         # IoT + SNS monitoring
│   │   └── ...
│   ├── lib/
│   │   ├── awsClients.ts        # DynamoDB, SNS, IoT, Bedrock clients
│   │   ├── mockData.ts          # India flood scenario seed data
│   │   └── simulation.ts        # Disaster simulation engine
│   ├── services/
│   │   ├── aws/
│   │   │   ├── bedrock.ts       # AI query with Gemini fallback
│   │   │   ├── snsAlerts.ts     # Client-side SNS trigger helper
│   │   │   └── dynamodb.ts      # DynamoDB proxy helpers
│   │   └── local/
│   │       ├── database.ts      # IndexedDB wrapper
│   │       ├── cache.ts         # State persistence
│   │       ├── syncQueue.ts     # Offline event queue
│   │       ├── routing.ts       # Local Dijkstra routing
│   │       └── offlineAI.ts     # Local rule-based AI
│   ├── store/
│   │   └── disasterStore.tsx    # React Context + useReducer
│   └── types/
│       └── disaster.ts          # TypeScript domain types
│
├── backend/                     # Express API server
│   └── src/
│       ├── index.ts             # Express + WebSocket server
│       ├── store.ts             # In-memory data store
│       └── routes/
│           ├── ai.ts            # AI query endpoint
│           ├── alerts.ts        # Alert management
│           ├── sensors.ts       # Sensor data
│           ├── shelters.ts      # Shelter status
│           ├── rescue.ts        # Rescue team management
│           ├── incidents.ts     # Incident CRUD
│           └── sync.ts          # Sync queue processing
│
└── README.md
```

---

## 🏆 Hackathon Highlights

| Feature | Implementation |
|---|---|
| **Offline-first** | IndexedDB + Service Worker — app reloads after Wi-Fi loss |
| **Real IoT pipeline** | Simulation → IoT Core MQTT → DynamoDB Rule → verified |
| **Live alerts** | SNS email fires automatically on sensor threshold breach |
| **AI assistant** | Bedrock Nova Pro with city-specific flood intelligence |
| **3D visualization** | MapLibre GL with real satellite imagery + building extrusion |
| **Data pipeline** | 7 SENSOR_READING records confirmed in DynamoDB |
| **Production-ready** | TypeScript strict, zero build errors, offline sync |

---

## 👩‍💻 Team

Built for the AWS Hackathon by Rashi Agarwal  
Account: `348364742197` · Region: `us-east-1`

---

*MyRadar — Disaster Response Intelligence. When the network goes down, response doesn't.*
