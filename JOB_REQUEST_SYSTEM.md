# Job Request System

## Overview

The Job Request System allows signers to submit notarization requests to admins, who can then review, approve/reject, and assign notaries to handle the requests. This system provides a streamlined workflow for managing signer-initiated notarization needs.

## Features

### For Signers
- **Submit Job Requests**: Create detailed notarization requests with urgency levels
- **Track Request Status**: Monitor the progress of submitted requests
- **Receive Notifications**: Get email updates on request status changes
- **View Request History**: Access all past and current requests

### For Admins
- **Review Requests**: Approve or reject signer requests with notes
- **Assign Notaries**: Manually assign specific notaries or use auto-assignment
- **Convert to Jobs**: Transform approved requests into regular jobs
- **Manage Workflow**: Track request statistics and manage the approval process

### For Notaries
- **Receive Assignments**: Get notified when assigned to a request
- **View Assignment Details**: Access request information and contact details
- **Track Assignments**: Monitor assigned requests and their status

## Database Schema

### Job Requests Table
```sql
CREATE TABLE job_requests (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  document_type TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'normal',
  preferred_date TEXT,
  preferred_time TEXT,
  location TEXT,
  requestor_id INTEGER NOT NULL REFERENCES users(id),
  requestor_email TEXT NOT NULL,
  requestor_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT DEFAULT 'normal',
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  assigned_notary_id INTEGER REFERENCES users(id),
  assigned_at TIMESTAMP,
  assignment_notes TEXT,
  converted_to_job_id INTEGER REFERENCES jobs(id),
  converted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);
```

### Enhanced Jobs Table
The existing jobs table has been extended with signer request fields:
- `is_signer_request`: Boolean flag indicating if job originated from a signer request
- `signer_request_notes`: Notes from the original signer request
- `admin_review_notes`: Admin's review notes
- `admin_reviewed_by`: Admin who reviewed the request
- `admin_reviewed_at`: When the request was reviewed
- `request_priority`: Priority level of the request

## API Endpoints

### Signer Endpoints
- `POST /api/job-requests` - Create a new job request
- `GET /api/job-requests/my-requests` - Get user's job requests
- `GET /api/job-requests/:id` - Get specific job request

### Admin Endpoints
- `GET /api/job-requests/pending` - Get all pending requests
- `POST /api/job-requests/:id/review` - Review and approve/reject request
- `POST /api/job-requests/:id/convert` - Convert approved request to job
- `GET /api/job-requests/notaries` - Get available notaries
- `GET /api/job-requests/stats` - Get request statistics

### Notary Endpoints
- `GET /api/job-requests/assigned` - Get assigned requests

## Workflow

### 1. Signer Submits Request
1. Signer fills out job request form with:
   - Title and description
   - Document type
   - Urgency level
   - Preferred date/time
   - Location (optional)
   - Contact information

2. System creates request with status "pending"
3. Admin receives email notification

### 2. Admin Reviews Request
1. Admin views pending requests in admin dashboard
2. Admin can:
   - Approve the request
   - Reject the request with notes
   - Assign a specific notary
   - Add review notes

3. System updates request status and sends notifications

### 3. Notary Assignment
1. If approved, admin can assign a specific notary or use auto-assignment
2. Assigned notary receives email notification
3. Request status becomes "assigned"

### 4. Conversion to Job
1. Admin can convert approved/assigned requests to regular jobs
2. System creates a new job record linked to the original request
3. Request status becomes "completed"

## Email Notifications

### Admin Notifications
- **New Request**: Notifies admins when a new request is submitted
- **Request Details**: Includes urgency, requestor info, and description

### Signer Notifications
- **Review Decision**: Notifies signer of approval/rejection
- **Assignment Status**: Informs signer if a notary has been assigned
- **Admin Notes**: Includes any notes from the admin review

### Notary Notifications
- **New Assignment**: Notifies notary of new job assignment
- **Request Details**: Includes all relevant request information
- **Contact Information**: Provides requestor contact details

## Installation and Setup

### 1. Run Database Migration
```bash
npm run migrate:job-requests
```

### 2. Verify Email Configuration
Ensure your email service is configured to send notifications:
- Check email settings in admin dashboard
- Test email configuration

### 3. Access the System
- **Signers**: Navigate to `/job-request` to submit requests
- **Admins**: Navigate to `/admin/job-requests` to manage requests
- **Signers**: Navigate to `/my-job-requests` to view their requests

## Usage Examples

### Creating a Job Request (Signer)
```typescript
const response = await fetch('/api/job-requests', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Real Estate Document Notarization',
    description: 'Need to notarize property transfer documents',
    documentType: 'real_estate',
    urgency: 'high',
    preferredDate: '2024-01-15',
    preferredTime: '14:00',
    location: '123 Main St, City, State',
    requestorPhone: '555-123-4567'
  })
});
```

### Reviewing a Request (Admin)
```typescript
const response = await fetch(`/api/job-requests/${requestId}/review`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'approve',
    notes: 'Request approved for processing',
    assignedNotaryId: 123,
    assignmentNotes: 'Please contact the requestor to schedule'
  })
});
```

### Converting to Job (Admin)
```typescript
const response = await fetch(`/api/job-requests/${requestId}/convert`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});
```

## Security and Permissions

### Role-Based Access
- **Signers**: Can create and view their own requests
- **Admins**: Can view, review, and manage all requests
- **Notaries**: Can view their assigned requests

### Data Validation
- All input is validated using Zod schemas
- SQL injection protection through parameterized queries
- XSS protection through proper input sanitization

## Monitoring and Analytics

### Request Statistics
- Total requests by status
- Average processing time
- Request volume by urgency level
- Notary assignment success rate

### Performance Metrics
- Request submission success rate
- Admin review response time
- Email delivery success rate
- System uptime and reliability

## Troubleshooting

### Common Issues

1. **Migration Fails**
   - Check database connection
   - Verify SQL syntax in migration file
   - Ensure proper database permissions

2. **Email Notifications Not Sent**
   - Verify email service configuration
   - Check email provider settings
   - Review email logs for errors

3. **Request Status Not Updating**
   - Check database constraints
   - Verify API endpoint permissions
   - Review server logs for errors

### Debug Mode
Enable debug logging by setting environment variable:
```bash
DEBUG=job-requests:*
```

## Future Enhancements

### Planned Features
- **Bulk Operations**: Process multiple requests simultaneously
- **Advanced Filtering**: Filter requests by various criteria
- **Automated Assignment**: Intelligent notary assignment algorithms
- **Request Templates**: Predefined request templates for common scenarios
- **Mobile App**: Native mobile application for request management

### Integration Opportunities
- **Calendar Integration**: Sync with notary availability calendars
- **Payment Processing**: Integrated payment for premium services
- **Document Upload**: Allow document attachments to requests
- **SMS Notifications**: Text message notifications for urgent requests

## Support

For technical support or questions about the Job Request System:
- Check the system logs for error details
- Review the API documentation
- Contact the development team

## License

This system is part of the USA Notary Platform and follows the same licensing terms. 