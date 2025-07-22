# User Tracking Data Storage Locations

## 📊 Primary Database Tables

### 1. `system_activity_logs` (Main tracking table)
**Location**: PostgreSQL Database
**Records**: All user activities including login/logout
**Data Captured**:
- User identification (ID, email, role)
- IP addresses and geographic location
- Device information (browser, OS, device type)
- Action details with timestamps
- Success/failure status
- Security risk flags
- Session information

**Sample Data Structure**:
```sql
SELECT * FROM system_activity_logs WHERE action IN ('login', 'login_failed', 'logout');
```

### 2. `users` table (User profile data)
**Location**: PostgreSQL Database  
**Tracking Fields**:
- `last_login_at` - Last successful login timestamp
- `last_logout_at` - Last logout timestamp ✅ (Recently added)
- `verification_ip_address` - IP during verification
- `verification_user_agent` - Browser info during verification

### 3. `audit_trail` table (Audit logging)
**Location**: PostgreSQL Database
**Purpose**: Comprehensive audit trail for compliance
**Data**: User actions, changes, system events

## 🗄️ Session & Security Storage

### 4. Redis Cache
**Location**: Redis Server (localhost:6379)
**Stores**:
- Session tokens and blacklisted tokens
- Login attempt rate limiting
- Session state management
- Cache for location data (24-hour TTL)

### 5. Server Logs
**Location**: Console output & log files
**Contains**:
- Real-time login/logout events
- Detailed location tracking output
- Security warnings and risk assessments
- Performance metrics and slow requests

## 📍 Location Service Cache

### 6. In-Memory Location Cache
**Location**: Application memory
**Duration**: 24 hours per IP
**Purpose**: Avoid repeated API calls for location data
**Data**: Full geographic and ISP information

## 🔒 Security Tracking

### 7. Token Blacklist (Redis)
**Location**: Redis with TTL
**Purpose**: Prevent reuse of logged-out tokens
**Format**: `blacklist:token:{jwt_token}`

### 8. Session Management (Redis)
**Location**: Redis 
**Purpose**: Track active sessions
**Format**: `sess_{timestamp}_{random_id}`

## 📊 API Endpoints for Data Access

### Frontend Access Routes:
- `/api/user/activity-logs` - User's activity history
- `/api/user/audit-trail` - User's audit trail  
- `/api/user/notarization-logs` - Notarization activities
- `/api/user/notarization-sessions` - Session history

### Admin Access Routes:
- `/api/admin/verification-stats` - System statistics
- `/api/admin/verification-users` - User verification data

## 🔍 Data Verification Commands

### Check Recent Login Data:
```bash
npx tsx scripts/check-login-logs.ts
```

### Check All Activity Logs:
```bash
npx tsx scripts/check-activity-logs.ts
```

### Test Location Tracking:
```bash
npx tsx scripts/test-real-login-logging.ts
```

## 📈 Data Examples from Your System

### Recent Login Success (from logs):
```
Login Activity #93123:
User: admin@usanotary.com (ID: 1)
Action: login - authentication
Description: admin@usanotary.com login successful from Local, Local
Success: ✅
Time: 7/22/2025, 4:57:55 AM
IP: 127.0.0.1
Location: Local, Local, Local
ISP: Local Network
Device: Desktop - Chrome on macOS
```

### Real IP Location Detection:
```
Real external IP: 203.175.72.39
City: Rawalpindi
Region: Punjab
Country: Pakistan (PK)
ISP: Nayatel (Pvt) Ltd
Timezone: Asia/Karachi
```

## 🎯 Summary

Your user tracking system is **FULLY OPERATIONAL** and captures:

✅ **Login/Logout Events** → `system_activity_logs` table
✅ **IP & Location Data** → Database + Redis cache  
✅ **Device Information** → Database with full details
✅ **Session Management** → Redis with TTL
✅ **Security Flags** → Risk assessment in logs
✅ **Real-time Monitoring** → Server console logs
✅ **Historical Data** → Persistent database storage

The system successfully tracks all user activities and stores comprehensive audit trails for security, compliance, and monitoring purposes. 