# 🚀 VisionGuard — AI-Ready Engineering Brief

## 1. Project Overview

VisionGuard is an AI-powered intelligent surveillance system that transforms standard CCTV/IP camera setups into smart monitoring systems.

It processes live video streams to:

- Detect objects (people, vehicles, etc.)
- Track identities across frames
- Recognize human actions and anomalies
- Generate structured event logs
- Enable natural language querying via an LLM interface

The system is designed for real-time monitoring and event-driven intelligence in security environments.

---

## 2. System Type

- Type: AI Video Surveillance System
- Architecture: Modular Backend + AI Pipeline + Database + Web Dashboard
- Input: RTSP IP camera streams / recorded videos
- Output: Events, alerts, searchable logs, video clips

---

## 3. Core Features (Functional Requirements Simplified)

### 3.1 Video Processing

- Ingest recorded video files (PRIMARY for MVP)
- Support RTSP streams (FUTURE phase)

---

### 3.2 Object Detection & Tracking

- Detect people and vehicles using YOLOv8/YOLOv10
- Track objects across frames using ByteTrack or DeepSORT
- Assign persistent IDs to detected entities

---

### 3.3 Action Recognition & Anomaly Detection

- Recognize human actions using X3D model (Kinetics dataset)
- Detect abnormal or suspicious behavior patterns
- Monitor rule-based compliance scenarios (e.g., dress code rules)
- Perform scene understanding (zones like corridors, stairs, doors)

---

### 3.4 Event Logging & Storage

- Store all detected events with:
    - Timestamp
    - Confidence score
    - Object metadata
    - Context info
- Link events to video clip segments
- Store everything in PostgreSQL (time-series supported)
- Auto-delete data after 30 days (retention policy)

---

### 3.5 LLM Query Interface

- Natural language query system (English)
- Users can ask questions like:
    - “Show suspicious activity near parking in last 2 hours”
- System returns:
    - Event summaries
    - Related video clips

---

### 3.6 Alerts System

- Real-time anomaly detection alerts
- Notification channels:
    - Email
    - In-app dashboard alerts

---

## 4. Users (Role-Based Access Control)

### System Administrator (Admin)

- Responsibilities: System configuration, camera management (IP/RTSP setup), user access control, and AI parameter tuning (Zones & Rules).

### Security Analyst (Unified Operator & Viewer)

- Responsibilities: Real-time monitoring, handling anomaly alerts, and performing historical event investigations via the Natural Language (LLM) query interface.

---

## 5. Tech Stack (Recommended)

- Backend: Python 3.12, FastAPI
- AI: PyTorch, OpenCV
- Detection: YOLOv8 / YOLOv10
- Tracking: ByteTrack / DeepSORT
- Action Recognition: X3D (Kinetics-700)
- Database: PostgreSQL (time-series enabled)
- Streaming: RTSP support
- Frontend: Web dashboard (React optional)

---

## 6. System Architecture (High Level)

- Camera Streams → AI Pipeline → Event Generator → Database → API Layer → Dashboard + LLM Interface

---

## 7. Data Model (Core Entities)

- Camera
- Frame / Video Stream
- DetectedObject (person, vehicle)
- Track (object identity over time)
- Event (action/anomaly detection result)
- VideoClip (linked footage segment)
- Alert
- User

---

## 8. API Overview

- POST /streams/start
- POST /streams/stop
- GET /events
- GET /events/{id}
- GET /alerts
- POST /query (LLM natural language query)
- GET /videos/{clip_id}