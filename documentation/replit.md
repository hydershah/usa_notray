# USA Notary System

## Overview
USA Notary is a full-stack web application built with React, Express, and PostgreSQL that manages notary services for title companies. The system allows title companies to create notary jobs, manage signers, and track job statuses while providing notaries with tools to accept and complete notarization tasks.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Library**: Shadcn/UI components built on Radix UI primitives
- **Styling**: TailwindCSS with CSS variables for theming
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite with hot module replacement

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Authentication**: JWT tokens with bcrypt for password hashing
- **File Uploads**: Multer middleware for document handling
- **Email**: Nodemailer for notifications

### Database Design
- **Primary Database**: PostgreSQL (via Neon serverless)
- **Schema Management**: Drizzle Kit for migrations
- **Connection Pool**: Neon serverless with WebSocket support

## Key Components

### User Management System
- **Role-based Access Control**: Four user roles (admin, title_company, notary, client)
- **Privilege System**: Granular permissions stored as JSON arrays
- **Authentication**: JWT-based with secure token storage
- **Password Security**: Bcrypt hashing with salt rounds

### Job Management Workflow
- **Job Creation**: Title companies create jobs with property details
- **Notary Assignment**: Auto-assignment or manual selection
- **Document Handling**: File upload for contracts and notarized documents
- **Status Tracking**: Open → Pending → Completed/Cancelled/Expired
- **KBA Integration**: Knowledge-based authentication support

### Document Management
- **File Storage**: Local filesystem with configurable upload limits (10MB)
- **Supported Formats**: PDF, DOC, DOCX files only
- **Security**: File type validation and size restrictions
- **Organization**: Separate storage for uploaded and notarized documents

### Notification System
- **Email Notifications**: SMTP configuration for job updates
- **Real-time Updates**: Query invalidation for immediate UI updates
- **User Preferences**: Role-based notification routing

## Data Flow

### Authentication Flow
1. User submits credentials via login form
2. Server validates credentials and generates JWT token
3. Token stored in localStorage with user profile
4. Protected routes verify token on each request
5. Automatic redirect to login if token invalid/expired

### Job Creation Flow
1. Title company accesses job creation wizard
2. Multi-step form collects property and signer details
3. Document upload and notary selection
4. Job record created with "open" status
5. Notifications sent to relevant parties

### Job Assignment Flow
1. Available jobs displayed to notaries
2. Notary accepts job (status changes to "pending")
3. Notary completes work and uploads notarized documents
4. Status updates to "completed"
5. All parties notified of completion

## External Dependencies

### Production Dependencies
- **UI Framework**: React ecosystem (react, react-dom, react-router)
- **Database**: @neondatabase/serverless, drizzle-orm
- **Authentication**: bcrypt, jsonwebtoken
- **File Handling**: multer
- **Email**: nodemailer
- **Validation**: zod, @hookform/resolvers
- **Styling**: tailwindcss, class-variance-authority

### Development Dependencies
- **Build Tools**: vite, esbuild, tsx
- **TypeScript**: Full type coverage with strict mode
- **Linting**: Built-in TypeScript checking

### Third-party Services
- **Database**: Neon PostgreSQL (serverless)
- **Email Service**: Configurable SMTP (Gmail by default)
- **Deployment**: Replit with autoscale deployment target

## Deployment Strategy

### Development Environment
- **Hot Reloading**: Vite dev server with HMR
- **Database**: Shared Neon instance with development schema
- **Port Configuration**: Development server on port 5000
- **Asset Serving**: Vite handles client assets, Express serves API

### Production Build
- **Client Build**: Vite builds React app to `dist/public`
- **Server Build**: esbuild bundles Express app to `dist/index.js`
- **Static Assets**: Express serves built client from public directory
- **Environment**: NODE_ENV=production with optimized builds

### Scaling Strategy
- **Stateless Design**: JWT tokens eliminate server session storage
- **Database Pooling**: Neon handles connection pooling automatically
- **Horizontal Scaling**: Stateless Express app can scale across instances
- **CDN Ready**: Static assets can be served from CDN

### Security Measures
- **Input Validation**: Zod schemas for all user inputs
- **File Upload Security**: Type and size restrictions
- **SQL Injection Protection**: Drizzle ORM with parameterized queries
- **Authentication**: Secure JWT implementation
- **CORS**: Configured for production origins

## Changelog
- June 25, 2025. Initial setup
- June 25, 2025. Whereby video integration completed for live notary sessions
- June 25, 2025. Admin Closing Types management system implemented with pricing configuration
- June 25, 2025. Fixed closing types integration in job creation form to load dynamic data from admin panel
- June 25, 2025. Redesigned live signing session UI with three-panel layout - videos on left, scrollable document in center, document tools on right side with drag-and-drop functionality, automatic recording on session start, integrated "Start Session" button in header
- June 25, 2025. Implemented production-level signature capture with real user data - actual dates, authentic signatures, session-based access control with JWT authentication, dual-mode workflow (tagging/signing), signature modal with metadata tracking. Fixed React infinite loop error in ProtectedRoute component.

## User Preferences
Preferred communication style: Simple, everyday language.