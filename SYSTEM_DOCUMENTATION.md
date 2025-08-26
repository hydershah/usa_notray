# USA Notary Platform - Complete System Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [User Roles & Permissions](#user-roles--permissions)
4. [Core Workflows](#core-workflows)
5. [Database Schema](#database-schema)
6. [API Architecture](#api-architecture)
7. [Frontend Architecture](#frontend-architecture)
8. [Security & Authentication](#security--authentication)
9. [Document Management](#document-management)
10. [Real-time Collaboration](#real-time-collaboration)
11. [Payment & Billing](#payment--billing)
12. [Performance & Optimization](#performance--optimization)
13. [Deployment & Infrastructure](#deployment--infrastructure)
14. [Monitoring & Logging](#monitoring--logging)
15. [Development Guidelines](#development-guidelines)

---

## System Overview

### Purpose
The USA Notary Platform is a comprehensive digital notarization system that enables secure, compliant, and efficient remote notarization services. The platform supports multiple user types including notaries, title companies, clients, and administrators, providing end-to-end document signing workflows with real-time collaboration.

### Key Features
- **Multi-role User Management**: Support for notaries, title companies, clients, and administrators
- **Real-time Document Signing**: Live collaborative document editing and signing sessions
- **Identity Verification**: EVS (Electronic Verification System) integration for KYC compliance
- **Digital Certificates**: PKI-based digital signatures and certificates
- **Payment Processing**: Integrated billing and payment management
- **Audit Trail**: Comprehensive logging and compliance tracking
- **Mobile Responsive**: Cross-platform compatibility

### Technology Stack
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Frontend**: React.js, TypeScript, Tailwind CSS
- **Real-time**: WebSocket, Socket.io
- **Document Processing**: PDF.js, Apryse WebViewer
- **Storage**: Vultr Object Storage
- **Authentication**: JWT, bcrypt
- **Payment**: Stripe integration

---

## Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │   Mobile App    │    │   Admin Panel   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   API Gateway   │
                    │   (Express.js)  │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │   WebSocket     │
                    │   (Socket.io)   │
                    └─────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │   Vultr Storage │    │   External APIs │
│   Database      │    │   (Documents)   │    │   (EVS, Stripe) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Component Architecture

#### Backend Services
- **Authentication Service**: JWT token management, role-based access control
- **User Management Service**: User CRUD operations, profile management
- **Document Service**: Document upload, processing, and storage
- **Session Service**: Real-time signing session management
- **Payment Service**: Billing and payment processing
- **Notification Service**: Email and in-app notifications
- **Audit Service**: Comprehensive logging and compliance tracking

#### Frontend Components
- **Authentication Module**: Login, registration, password reset
- **Dashboard Module**: Role-specific dashboards
- **Document Editor**: PDF viewing and annotation
- **Session Management**: Real-time collaboration interface
- **User Management**: Admin user management interface
- **Payment Module**: Billing and payment interface

---

## User Roles & Permissions

### Role Hierarchy
```
Admin (Super User)
├── Notary (Service Provider)
│   ├── Contractor (Independent)
│   └── Subscriber (Platform User)
├── Title Company (Client)
│   ├── Manager (Primary Contact)
│   └── Authorized User (Secondary Contact)
├── Client (End User)
│   ├── Signer (Document Signer)
│   └── Witness (Document Witness)
└── Observer (View Only)
```

### Detailed Role Descriptions

#### Admin
- **Permissions**: Full system access, user management, system configuration
- **Capabilities**: 
  - Approve/reject user registrations
  - Manage system settings
  - View audit logs
  - Override verification requirements
  - Manage payment processing

#### Notary
- **Permissions**: Document notarization, session management, profile management
- **Capabilities**:
  - Create and manage signing sessions
  - Verify signer identities
  - Apply digital signatures and stamps
  - Manage availability and scheduling
  - Process payments and view earnings

#### Title Company
- **Permissions**: Job creation, document management, user invitation
- **Capabilities**:
  - Create notarization jobs
  - Upload documents
  - Invite signers and witnesses
  - Track job progress
  - Manage billing and payments

#### Client (Signer/Witness)
- **Permissions**: Document signing, session participation
- **Capabilities**:
  - Join signing sessions
  - Sign documents electronically
  - Complete identity verification
  - View session history

---

## Core Workflows

### 1. User Registration & Onboarding

```mermaid
graph TD
    A[User Registration] --> B[Email Verification]
    B --> C[Profile Completion]
    C --> D[Role Assignment]
    D --> E[Identity Verification]
    E --> F[Admin Approval]
    F --> G[Account Activation]
    
    C --> C1[Personal Information]
    C --> C2[Address Information]
    C --> C3[Contact Information]
    
    E --> E1[EVS Verification]
    E --> E2[KBA Authentication]
    E --> E3[Document Upload]
    
    F --> F1[Approved]
    F --> F2[Rejected]
    F --> F3[Requires Update]
```

### 2. Job Creation & Assignment

```mermaid
graph TD
    A[Title Company Creates Job] --> B[Upload Documents]
    B --> C[Define Signers]
    C --> D[Select Notary]
    D --> E[Schedule Session]
    E --> F[Send Invitations]
    F --> G[Session Execution]
    
    D --> D1[Preferred Notary]
    D --> D2[Random Assignment]
    D --> D3[Auto Assignment]
    
    G --> G1[Identity Verification]
    G --> G2[Document Review]
    G --> G3[Digital Signing]
    G --> G4[Notary Certification]
```

### 3. Live Signing Session

```mermaid
graph TD
    A[Session Initiation] --> B[Participant Join]
    B --> C[Identity Verification]
    C --> D[Document Review]
    D --> E[Digital Signing]
    E --> F[Notary Certification]
    F --> G[Session Completion]
    
    C --> C1[EVS Verification]
    C --> C2[KBA Authentication]
    C --> C3[Manual Verification]
    
    E --> E1[Signature Application]
    E --> E2[Initial Application]
    E --> E3[Date/Time Stamps]
    
    F --> F1[Notary Seal]
    F --> F2[Digital Certificate]
    F --> F3[Audit Trail]
```

---

## Database Schema

### Core Tables

#### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client',
  privileges TEXT[],
  
  -- Profile Information
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  phone_number TEXT,
  
  -- Address Information
  address_1 TEXT,
  address_2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  
  -- Company Association
  company_id INTEGER REFERENCES companies(id),
  company_role TEXT,
  
  -- Notary Specific Fields
  commission_number TEXT,
  commission_expiration TEXT,
  notary_id_code TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- Financial Management
  account_balance INTEGER DEFAULT 0,
  minimum_balance INTEGER DEFAULT 2500,
  stripe_customer_id TEXT,
  
  -- Verification Fields
  is_verified BOOLEAN DEFAULT false,
  verification_status TEXT DEFAULT 'pending',
  evs_transaction_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Jobs Table
```sql
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  title_company TEXT NOT NULL,
  closing_type TEXT NOT NULL,
  internal_reference TEXT,
  
  -- Property Information
  property_address_one TEXT NOT NULL,
  property_address_two TEXT,
  property_city TEXT NOT NULL,
  property_state TEXT NOT NULL,
  property_zip_code TEXT NOT NULL,
  
  -- Notary Assignment
  notary_option TEXT,
  selected_notary TEXT,
  notary_id INTEGER REFERENCES users(id),
  
  -- Session Information
  session_token TEXT,
  scheduled_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Status Management
  job_status TEXT NOT NULL DEFAULT 'open',
  notary_approval_status TEXT DEFAULT 'pending_assignment',
  
  -- Metadata
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Job Documents Table
```sql
CREATE TABLE job_documents (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id) NOT NULL,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'original',
  status TEXT NOT NULL DEFAULT 'uploaded',
  
  -- Signature Information
  signature_pages TEXT[] DEFAULT '{}',
  
  -- Metadata
  uploaded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Relationship Diagram
```
users (1) ──── (many) jobs
users (1) ──── (many) job_documents
jobs (1) ──── (many) job_documents
jobs (1) ──── (many) job_participants
users (1) ──── (many) job_participants
jobs (1) ──── (many) signers
users (1) ──── (many) signers
```

---

## API Architecture

### RESTful API Design

#### Authentication Endpoints
```
POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/logout
POST   /api/auth/refresh
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
```

#### User Management Endpoints
```
GET    /api/users
GET    /api/users/:id
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id
GET    /api/users/me
PUT    /api/users/me
```

#### Job Management Endpoints
```
GET    /api/jobs
GET    /api/jobs/:id
POST   /api/jobs
PUT    /api/jobs/:id
DELETE /api/jobs/:id
GET    /api/jobs/:id/documents
POST   /api/jobs/:id/documents
```

#### Session Management Endpoints
```
GET    /api/sessions/:id
POST   /api/sessions/:id/join
POST   /api/sessions/:id/leave
GET    /api/sessions/:id/participants
POST   /api/sessions/:id/participants
```

### WebSocket Events

#### Client to Server
```typescript
// Join session
socket.emit('join-session', { sessionId, userId, role });

// Update cursor position
socket.emit('cursor-update', { x, y, userId });

// Apply signature
socket.emit('apply-signature', { 
  documentId, 
  page, 
  x, 
  y, 
  signatureData 
});

// Send message
socket.emit('send-message', { message, type });
```

#### Server to Client
```typescript
// User joined
socket.emit('user-joined', { user, role });

// User left
socket.emit('user-left', { userId });

// Cursor update
socket.emit('cursor-updated', { x, y, userId });

// Signature applied
socket.emit('signature-applied', { 
  documentId, 
  page, 
  signatureData 
});

// New message
socket.emit('new-message', { message, user, timestamp });
```

---

## Frontend Architecture

### Component Structure
```
src/
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   └── PasswordReset.tsx
│   ├── dashboard/
│   │   ├── AdminDashboard.tsx
│   │   ├── NotaryDashboard.tsx
│   │   └── ClientDashboard.tsx
│   ├── editor/
│   │   ├── DocumentViewer.tsx
│   │   ├── SignaturePad.tsx
│   │   └── CollaborationPanel.tsx
│   ├── session/
│   │   ├── SessionManager.tsx
│   │   ├── ParticipantList.tsx
│   │   └── ChatPanel.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Modal.tsx
│       └── Table.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useSession.ts
│   └── useWebSocket.ts
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Jobs.tsx
│   └── Session.tsx
└── utils/
    ├── api.ts
    ├── auth.ts
    └── validation.ts
```

### State Management
- **React Query**: Server state management
- **Context API**: Global application state
- **Local State**: Component-specific state
- **WebSocket State**: Real-time session state

### Key Components

#### Document Editor
```typescript
interface DocumentEditorProps {
  documentId: string;
  sessionId: string;
  userRole: UserRole;
  onSignatureApplied: (signature: Signature) => void;
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({
  documentId,
  sessionId,
  userRole,
  onSignatureApplied
}) => {
  const [document, setDocument] = useState<Document | null>(null);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const { socket } = useWebSocket(sessionId);

  // Document loading and rendering logic
  // Real-time collaboration features
  // Signature application interface
};
```

#### Session Manager
```typescript
interface SessionManagerProps {
  sessionId: string;
  participants: Participant[];
  documents: Document[];
}

const SessionManager: React.FC<SessionManagerProps> = ({
  sessionId,
  participants,
  documents
}) => {
  const [sessionState, setSessionState] = useState<SessionState>('waiting');
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null);

  // Session state management
  // Participant coordination
  // Document progression
};
```

---

## Security & Authentication

### Authentication Flow
1. **User Registration**: Email verification, password hashing
2. **Login**: JWT token generation, role-based access
3. **Session Management**: Token refresh, secure logout
4. **Multi-Factor Authentication**: Optional 2FA for enhanced security

### Security Measures
- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: Secure token-based authentication
- **CORS Protection**: Cross-origin request restrictions
- **Rate Limiting**: API request throttling
- **Input Validation**: Comprehensive input sanitization
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Content Security Policy headers

### Identity Verification
- **EVS Integration**: Electronic Verification System
- **KBA Authentication**: Knowledge-Based Authentication
- **Document Verification**: ID document validation
- **Biometric Verification**: Face matching and liveness detection

---

## Document Management

### Document Processing Pipeline
1. **Upload**: File validation and virus scanning
2. **Processing**: PDF optimization and metadata extraction
3. **Storage**: Secure cloud storage with access controls
4. **Rendering**: Client-side PDF rendering with annotations
5. **Signing**: Digital signature application
6. **Archival**: Long-term storage with audit trail

### Document Types
- **Original Documents**: Source documents uploaded by title companies
- **Notarized Documents**: Final documents with signatures and seals
- **Additional Documents**: Supporting documentation
- **Certificates**: Digital certificates and audit reports

### Signature Types
- **Digital Signatures**: PKI-based cryptographic signatures
- **Electronic Signatures**: Typed or drawn signatures
- **Notary Seals**: Official notary stamps and seals
- **Date/Time Stamps**: Cryptographic timestamps

---

## Real-time Collaboration

### WebSocket Architecture
- **Connection Management**: Persistent WebSocket connections
- **Room-based Sessions**: Isolated session rooms
- **Event Broadcasting**: Real-time event propagation
- **Connection Recovery**: Automatic reconnection handling

### Collaboration Features
- **Live Cursor Tracking**: Real-time cursor position sharing
- **Document Synchronization**: Multi-user document editing
- **Chat System**: In-session messaging
- **Participant Management**: Join/leave notifications
- **Session Recording**: Complete session audit trail

### Performance Optimization
- **Message Batching**: Efficient event batching
- **Connection Pooling**: Optimized connection management
- **Event Filtering**: Relevant event filtering
- **Memory Management**: Efficient memory usage

---

## Payment & Billing

### Payment Models
- **Subscription-based**: Monthly/yearly subscriptions for notaries
- **Per-transaction**: Pay-per-use for title companies
- **Contractor Payments**: Commission-based payments for contractors

### Payment Processing
- **Stripe Integration**: Secure payment processing
- **Invoice Generation**: Automated invoice creation
- **Payment Tracking**: Comprehensive payment history
- **Refund Management**: Automated refund processing

### Billing Features
- **Account Balances**: Real-time balance tracking
- **Payment Schedules**: Automated payment scheduling
- **Transaction History**: Detailed transaction logs
- **Financial Reports**: Comprehensive financial reporting

---

## Performance & Optimization

### Database Optimization
- **Indexing Strategy**: Comprehensive database indexing
- **Query Optimization**: Efficient SQL query design
- **Connection Pooling**: Optimized database connections
- **Caching Strategy**: Multi-level caching implementation

### Frontend Optimization
- **Code Splitting**: Dynamic import optimization
- **Lazy Loading**: Component and route lazy loading
- **Bundle Optimization**: Webpack optimization
- **CDN Integration**: Content delivery network usage

### API Optimization
- **Response Caching**: API response caching
- **Request Batching**: Efficient request batching
- **Rate Limiting**: API rate limiting
- **Compression**: Response compression

### Monitoring & Metrics
- **Performance Monitoring**: Real-time performance tracking
- **Error Tracking**: Comprehensive error monitoring
- **User Analytics**: User behavior analytics
- **System Health**: System health monitoring

---

## Deployment & Infrastructure

### Environment Configuration
```bash
# Production Environment Variables
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=your-secret-key
STRIPE_SECRET_KEY=sk_live_...
VULTR_ACCESS_KEY=your-vultr-key
VULTR_SECRET_KEY=your-vultr-secret
```

### Deployment Process
1. **Code Review**: Automated code review and testing
2. **Build Process**: Automated build and compilation
3. **Testing**: Comprehensive test suite execution
4. **Deployment**: Automated deployment to production
5. **Monitoring**: Post-deployment monitoring

### Infrastructure Components
- **Load Balancer**: Traffic distribution and SSL termination
- **Application Servers**: Node.js application instances
- **Database Cluster**: PostgreSQL database cluster
- **Cache Layer**: Redis caching layer
- **Storage**: Vultr object storage
- **CDN**: Content delivery network

---

## Monitoring & Logging

### Logging Strategy
- **Application Logs**: Comprehensive application logging
- **Error Logs**: Detailed error tracking and reporting
- **Audit Logs**: Complete audit trail for compliance
- **Performance Logs**: Performance monitoring and optimization

### Monitoring Tools
- **Application Monitoring**: Real-time application performance
- **Database Monitoring**: Database performance and health
- **Infrastructure Monitoring**: Server and network monitoring
- **User Analytics**: User behavior and engagement tracking

### Alert System
- **Error Alerts**: Critical error notifications
- **Performance Alerts**: Performance degradation alerts
- **Security Alerts**: Security incident notifications
- **Capacity Alerts**: Resource capacity warnings

---

## Development Guidelines

### Code Standards
- **TypeScript**: Strict TypeScript configuration
- **ESLint**: Comprehensive linting rules
- **Prettier**: Code formatting standards
- **Git Hooks**: Pre-commit validation

### Testing Strategy
- **Unit Tests**: Component and function testing
- **Integration Tests**: API and database testing
- **E2E Tests**: End-to-end user flow testing
- **Performance Tests**: Load and stress testing

### Documentation Standards
- **API Documentation**: Comprehensive API documentation
- **Code Documentation**: Inline code documentation
- **User Guides**: End-user documentation
- **Developer Guides**: Technical implementation guides

### Security Guidelines
- **Code Review**: Security-focused code review
- **Dependency Management**: Regular dependency updates
- **Vulnerability Scanning**: Automated vulnerability scanning
- **Security Training**: Regular security training

---

## Conclusion

The USA Notary Platform represents a comprehensive solution for digital notarization services, combining modern web technologies with robust security measures and real-time collaboration capabilities. The system is designed to be scalable, secure, and compliant with industry standards while providing an excellent user experience for all participants in the notarization process.

### Key Strengths
- **Comprehensive Role Management**: Flexible user role system supporting all notarization participants
- **Real-time Collaboration**: Advanced WebSocket-based real-time features
- **Security & Compliance**: Robust security measures and audit trails
- **Scalable Architecture**: Modern, scalable architecture supporting growth
- **User Experience**: Intuitive interface design for all user types

### Future Enhancements
- **Mobile Application**: Native mobile app development
- **AI Integration**: Machine learning for document analysis
- **Blockchain Integration**: Blockchain-based document verification
- **International Expansion**: Multi-language and multi-jurisdiction support
- **Advanced Analytics**: Business intelligence and reporting features

This documentation provides a comprehensive overview of the system architecture, implementation details, and operational guidelines for the USA Notary Platform.
