# Tag System Comprehensive Guide

## What Are Tags?

Tags are interactive placeholders placed on PDF documents that indicate where specific information needs to be entered during document signing sessions. They serve as visual guides and data entry points that streamline the notarization process.

### Purpose and Benefits

- **Pre-session Document Setup**: Tags are placed during tagging sessions to prepare documents before actual signing
- **Streamlined Signing Process**: Pre-placed tags make signing sessions faster and more efficient
- **Quality Assurance**: Ensures notaries don't miss any required fields during the signing process
- **Workflow Optimization**: Allows admins or notaries to set up documents ahead of time
- **Visual Guidance**: Provides clear indicators for both notaries and signers about where information should be entered

## Tag UI Design and Visual Elements

### Tag Visual Appearance

#### Tag Container Design
Each tag is rendered as a rectangular container with the following visual characteristics:

**Base Container**:
- **Border**: 2px solid border with user-specific colors
- **Background**: Semi-transparent white background (rgba(255, 255, 255, 0.95))
- **Border Radius**: 4px for modern, professional appearance
- **Box Shadow**: Subtle drop shadow (0 2px 4px rgba(0, 0, 0, 0.1)) for depth
- **Padding**: 8px internal spacing for content
- **Min Width**: 60px to ensure readability
- **Min Height**: 25px for proper content display

**Tag Content Layout**:
- **Icon**: Left-aligned tag type icon (16px × 16px)
- **Text**: Center-aligned placeholder text or completed content
- **Status Indicator**: Right-aligned completion status (checkmark, lock, or edit icon)

#### Tag Type Icons and Visual Indicators

**Universal Tags**:
- **T (Text)**: 📝 Document icon with text indicator
- **D (Date)**: 📆 Calendar icon with date format hint

**Signer Tags**:
- **A (Name)**: ✍️ Pen icon with user silhouette
- **S (Signature)**: 📝 Signature line with pen icon
- **I (Initials)**: 🔤 Letter "I" with decorative styling

**Notary Tags**:
- **N (Commission Number)**: 🆔 ID card icon with number indicator
- **X (Commission Expiration)**: 📅 Calendar with expiration warning
- **O (Disclosure)**: 📋 Document with legal text indicator
- **E (Seal)**: 🔖 Official seal/stamp icon
- **W (Whiteout)**: ⬜ White rectangle with "X" overlay

#### Tag States and Visual Feedback

**Incomplete State**:
- **Border Color**: User-specific color (blue for notary, green for signer, etc.)
- **Background**: Semi-transparent white with subtle pattern
- **Text Color**: Dark gray (#374151) for placeholder text
- **Icon Opacity**: 0.7 for subtle appearance
- **Hover Effect**: Border brightens and background becomes more opaque
- **Cursor**: Pointer cursor indicating interactivity

**Completed State**:
- **Border Color**: Success green (#059669) with 3px width
- **Background**: Light green background (#f0fdf4)
- **Text Color**: Dark green (#065f46) for completed content
- **Icon**: Green checkmark (✓) in top-right corner
- **Content Display**: Actual entered text, signature image, or other content
- **Hover Effect**: Subtle glow effect
- **Cursor**: Default cursor (no longer interactive)

**Selected State**:
- **Border Color**: Bright blue (#3b82f6) with 3px width
- **Background**: Light blue background (#eff6ff)
- **Box Shadow**: Enhanced shadow (0 4px 8px rgba(59, 130, 246, 0.3))
- **Resize Handles**: Eight white handles appear around perimeter
- **Drag Handle**: Center drag indicator appears
- **Z-Index**: Elevated to appear above other tags

**Error State**:
- **Border Color**: Error red (#dc2626) with 3px width
- **Background**: Light red background (#fef2f2)
- **Text Color**: Dark red (#991b1b)
- **Icon**: Red warning icon (⚠️) in top-right corner
- **Animation**: Subtle shake animation to draw attention
- **Tooltip**: Error message appears on hover

**Disabled State**:
- **Border Color**: Gray (#9ca3af) with 1px width
- **Background**: Light gray background (#f9fafb)
- **Text Color**: Gray (#6b7280)
- **Icon Opacity**: 0.3
- **Cursor**: Not-allowed cursor
- **Tooltip**: "Not assigned to you" or permission message

### Tag Interaction UI Elements

#### Resize Handles
When a tag is selected, eight resize handles appear:

**Corner Handles** (4):
- **Position**: Each corner of the tag
- **Appearance**: White square (8px × 8px) with blue border
- **Function**: Proportional scaling (maintains aspect ratio)
- **Cursor**: Diagonal resize cursors (nw-resize, ne-resize, sw-resize, se-resize)

**Edge Handles** (4):
- **Position**: Center of each edge (top, right, bottom, left)
- **Appearance**: White rectangle (4px × 12px) with blue border
- **Function**: Independent width/height adjustment
- **Cursor**: Horizontal/vertical resize cursors (ew-resize, ns-resize)

**Handle Behavior**:
- **Hover Effect**: Handles brighten and scale slightly (1.2x)
- **Active State**: Handles become blue when actively resizing
- **Snap-to-Grid**: Optional grid snapping for precise alignment
- **Minimum Size**: Enforced minimum dimensions (60px × 25px)

#### Drag Handle
When a tag is selected, a drag handle appears:

**Appearance**:
- **Position**: Center of the tag
- **Icon**: Drag indicator (⋮⋮) in light gray
- **Size**: 16px × 16px
- **Opacity**: 0.6 (subtle appearance)

**Behavior**:
- **Hover Effect**: Icon becomes more visible (opacity 1.0)
- **Cursor**: Move cursor when hovering over handle
- **Drag Preview**: Semi-transparent tag follows cursor during drag
- **Drop Zones**: Visual feedback for valid drop areas

#### Context Menu
Right-clicking on a tag opens a context menu:

**Menu Items**:
- **Edit Tag**: Opens tag editing dialog
- **Delete Tag**: Removes tag with confirmation
- **Duplicate Tag**: Creates copy of tag
- **Assign User**: Opens user assignment dialog
- **Lock/Unlock**: Toggles tag editability
- **Copy Position**: Copies tag coordinates to clipboard
- **Properties**: Shows tag properties panel

**Menu Styling**:
- **Background**: White background with subtle shadow
- **Border**: 1px gray border
- **Border Radius**: 4px
- **Padding**: 8px between items
- **Hover Effect**: Light blue background on hover

### Tag Content Display

#### Text Content Rendering
**Placeholder Text**:
- **Font**: System font stack (Inter, -apple-system, BlinkMacSystemFont, sans-serif)
- **Size**: 14px for standard text
- **Color**: Gray (#6b7280) for placeholder text
- **Style**: Italic for placeholder indication
- **Alignment**: Center-aligned within tag

**Completed Text**:
- **Font**: Same system font stack
- **Size**: 14px for standard text
- **Color**: Dark text (#111827) for completed content
- **Style**: Normal weight
- **Alignment**: Center-aligned within tag
- **Word Wrap**: Text wraps to multiple lines if needed

#### Signature Content Display
**Signature Image**:
- **Container**: Fixed aspect ratio container (3:1 width to height)
- **Image Scaling**: Maintains aspect ratio, fits within container
- **Background**: White background for signature visibility
- **Border**: 1px light gray border
- **Padding**: 4px internal spacing

**Typed Signature**:
- **Font**: Cursive font (Dancing Script, cursive)
- **Size**: 18px for signature prominence
- **Color**: Dark blue (#1e40af) for signature styling
- **Style**: Italic with slight rotation for natural appearance

#### Date Content Display
**Date Format**:
- **Format**: MM/DD/YYYY (US format)
- **Font**: Monospace font for consistent spacing
- **Size**: 14px
- **Color**: Dark text (#111827)
- **Alignment**: Center-aligned

**Date Validation**:
- **Visual Indicator**: Green checkmark for valid dates
- **Error State**: Red border and warning icon for invalid dates
- **Tooltip**: Shows date validation message

#### Seal Content Display
**Seal Image**:
- **Container**: Square container (60px × 60px)
- **Image Scaling**: Fits within container, maintains aspect ratio
- **Background**: Transparent background
- **Border**: Optional decorative border
- **Rotation**: Can be rotated for proper orientation

**Seal Configuration**:
- **Size Slider**: Adjust seal size (40px to 100px)
- **Rotation Slider**: Adjust seal rotation (0° to 360°)
- **Opacity Slider**: Adjust seal transparency (50% to 100%)
- **Preview**: Real-time preview of seal appearance

### Tag Animation and Transitions

#### Placement Animation
**New Tag Appearance**:
- **Duration**: 300ms ease-out animation
- **Start State**: 0% opacity, 50% scale
- **End State**: 100% opacity, 100% scale
- **Effect**: Smooth fade-in with scale-up effect

**Tag Movement**:
- **Duration**: 200ms ease-out animation
- **Property**: Transform transition for smooth movement
- **Performance**: Hardware-accelerated using transform3d

#### State Transition Animations
**Completion Animation**:
- **Duration**: 500ms ease-in-out animation
- **Start State**: Original appearance
- **End State**: Green border, checkmark icon
- **Effect**: Border color transition with checkmark fade-in

**Selection Animation**:
- **Duration**: 150ms ease-out animation
- **Start State**: Normal appearance
- **End State**: Blue border, enhanced shadow
- **Effect**: Border color and shadow transition

**Error Animation**:
- **Duration**: 600ms ease-in-out animation
- **Effect**: Shake animation (translateX: -5px, 5px, -5px, 5px, 0)
- **Repeat**: Shakes 3 times to draw attention

#### Hover Effects
**Tag Hover**:
- **Duration**: 200ms ease-out transition
- **Effect**: Border brightens, background becomes more opaque
- **Scale**: Subtle scale-up (1.02x) for interaction feedback

**Handle Hover**:
- **Duration**: 150ms ease-out transition
- **Effect**: Handle brightens and scales slightly
- **Cursor**: Changes to appropriate resize cursor

### Tag Accessibility Features

#### Keyboard Navigation
**Tab Navigation**:
- **Tab Order**: Tags are navigable in document order
- **Focus Indicator**: Blue outline (3px) when focused
- **Enter Key**: Activates tag completion
- **Space Key**: Alternative activation method
- **Escape Key**: Cancels current operation

**Keyboard Shortcuts**:
- **T**: Place text tag
- **D**: Place date tag
- **A**: Place name tag
- **S**: Place signature tag
- **I**: Place initials tag
- **N**: Place commission number tag
- **X**: Place commission expiration tag
- **O**: Place disclosure tag
- **E**: Place seal tag
- **W**: Place whiteout tag
- **Delete**: Delete selected tag
- **Ctrl+C**: Copy selected tag
- **Ctrl+V**: Paste tag
- **Ctrl+Z**: Undo last action

#### Screen Reader Support
**ARIA Labels**:
- **Role**: "button" for interactive tags
- **Label**: Descriptive label including tag type and purpose
- **State**: "pressed" for completed tags, "disabled" for locked tags
- **Description**: Additional context about tag function

**Live Regions**:
- **Status Updates**: Announce tag completion status
- **Error Messages**: Announce validation errors
- **Progress Updates**: Announce overall document completion

#### High Contrast Mode
**Color Adjustments**:
- **Border Colors**: Enhanced contrast for visibility
- **Text Colors**: High contrast text colors
- **Background Colors**: Adjusted for better contrast
- **Icon Colors**: Enhanced visibility in high contrast mode

### Tag Performance Optimization

#### Rendering Optimization
**Virtual Scrolling**:
- **Implementation**: Only render visible tags
- **Viewport Calculation**: Dynamic viewport based on scroll position
- **Tag Pooling**: Reuse DOM elements for better performance
- **Batch Updates**: Group multiple tag updates together

**Canvas Rendering**:
- **Large Documents**: Use canvas for documents with 100+ tags
- **Hardware Acceleration**: Leverage GPU for smooth animations
- **Memory Management**: Efficient memory usage for large tag sets
- **Frame Rate**: Maintain 60fps for smooth interactions

#### Data Optimization
**Caching Strategy**:
- **Tag Data**: Cache tag data per document
- **User Data**: Cache user profile data for auto-fill
- **Image Assets**: Cache signature and seal images
- **Validation Rules**: Cache validation logic

**Network Optimization**:
- **Batch Requests**: Group tag updates in single request
- **Delta Updates**: Only send changed tag data
- **Compression**: Compress tag data for faster transmission
- **Connection Management**: Handle network interruptions gracefully

### Tag System Architecture

#### Component Structure
**Tag Component Hierarchy**:
```
TagContainer
├── TagBorder (visual styling)
├── TagContent (text/image display)
├── TagIcon (type indicator)
├── TagStatus (completion indicator)
├── ResizeHandles (when selected)
├── DragHandle (when selected)
└── ContextMenu (on right-click)
```

**State Management**:
- **Local State**: Tag position, size, content
- **Global State**: User permissions, session status
- **Server State**: Tag data persistence, real-time updates
- **Cache State**: Optimized data access

#### Event Handling
**Mouse Events**:
- **Click**: Tag completion or selection
- **Double Click**: Edit tag properties
- **Right Click**: Open context menu
- **Drag Start**: Begin tag movement
- **Drag End**: Complete tag movement
- **Resize Start**: Begin tag resizing
- **Resize End**: Complete tag resizing

**Touch Events**:
- **Touch Start**: Begin touch interaction
- **Touch Move**: Handle touch dragging
- **Touch End**: Complete touch interaction
- **Pinch**: Handle touch resizing
- **Long Press**: Open context menu

**Keyboard Events**:
- **Key Down**: Handle keyboard shortcuts
- **Key Up**: Complete keyboard actions
- **Focus**: Handle focus management
- **Blur**: Handle focus loss

### Tag System Integration

#### Document Integration
**PDF Coordinate System**:
- **Origin**: Bottom-left corner of PDF page
- **Units**: Points (1/72 inch) for precise positioning
- **Scaling**: Automatic scaling based on PDF zoom level
- **Page Support**: Multi-page document support

**Document Events**:
- **Page Change**: Update tag visibility
- **Zoom Change**: Scale tag positions
- **Scroll**: Update tag positions
- **Resize**: Recalculate tag coordinates

#### Session Integration
**Real-time Updates**:
- **WebSocket Connection**: Real-time tag updates
- **User Activity**: Show active user indicators
- **Permission Changes**: Update tag accessibility
- **Session State**: Sync with session status

**Collaboration Features**:
- **User Cursors**: Show other users' cursor positions
- **Activity Indicators**: Show who is editing which tag
- **Conflict Resolution**: Handle simultaneous edits
- **Version Control**: Track tag changes over time

### Tag System Configuration

#### User Preferences
**Visual Preferences**:
- **Color Scheme**: User-defined tag colors
- **Font Size**: Adjustable tag text size
- **Animation Speed**: Configurable animation duration
- **Grid Snap**: Enable/disable grid snapping

**Interaction Preferences**:
- **Auto-Complete**: Enable/disable auto-completion
- **Confirmation Dialogs**: Enable/disable confirmations
- **Keyboard Shortcuts**: Customizable shortcuts
- **Accessibility**: High contrast, screen reader options

#### System Configuration
**Performance Settings**:
- **Tag Limit**: Maximum tags per document
- **Cache Size**: Memory allocation for caching
- **Update Frequency**: Real-time update interval
- **Batch Size**: Number of tags per batch update

**Security Settings**:
- **Permission Validation**: Strict permission checking
- **Content Validation**: Input sanitization rules
- **Audit Logging**: Comprehensive activity logging
- **Session Timeout**: Automatic session expiration

## Tag Types and Their Logic

The system implements 10 specific tag types, each with unique behavior and user permissions:

### Universal Tags (Available to All Users)

#### T - Text Tag (📝)
- **Description**: Free text input field
- **User Type**: Universal
- **Behavior**: 
  - Inline editing when clicked
  - Direct typing in tag area (no modal)
  - Any active user can complete
- **Use Case**: General text entry, notes, additional information
- **Keyboard Shortcut**: `T`
- **Validation**: Optional text length limits, character restrictions
- **Auto-save**: Content saved automatically as user types
- **Undo Support**: Ctrl+Z to revert changes

#### D - Date Tag (📆)
- **Description**: Date field
- **User Type**: Universal
- **Behavior**: 
  - Auto-fills with current date when clicked
  - No user interaction required
- **Use Case**: Document dates, signing dates, effective dates
- **Keyboard Shortcut**: `D`
- **Date Format**: MM/DD/YYYY (configurable)
- **Validation**: Ensures valid date format
- **Time Zone**: Uses user's local timezone

### Signer Tags (Available to Signers and Notaries)

#### A - Name Tag (✍️)
- **Description**: Signer name field
- **User Type**: Signer
- **Behavior**: 
  - Auto-fills with user's full name from profile
  - Uses `users.fullName` or `users.firstName + users.lastName`
- **Use Case**: Signer identification, name fields on documents
- **Keyboard Shortcut**: `A`
- **Name Format**: "First Last" or "First Middle Last"
- **Fallback**: Manual entry if profile data unavailable
- **Validation**: Ensures name contains at least first and last name

#### S - Signature Tag (📝)
- **Description**: Digital signature placement
- **User Type**: Signer
- **Behavior**: 
  - For notary tags: Auto-applies signature from profile
  - For signer tags: Opens signature selection modal
  - Uses `users.signatureImage`, `users.signatureData`, or `users.signatureTyped`
- **Use Case**: Digital signatures, legal document signing
- **Keyboard Shortcut**: `S`
- **Signature Types**: Image upload, drawn signature, typed signature
- **Signature Validation**: Ensures signature meets legal requirements
- **Signature Storage**: Encrypted storage of signature data

#### I - Initials Tag (🔤)
- **Description**: Initial placement
- **User Type**: Signer
- **Behavior**: 
  - Auto-fills with user's initials from profile
  - Uses `users.initialsImage`, `users.initialData`, or generates from name
- **Use Case**: Initial fields, abbreviated signatures
- **Keyboard Shortcut**: `I`
- **Initial Generation**: Automatically generates from first and last name
- **Custom Initials**: Allows manual override of generated initials
- **Format**: Single letter or multiple letters (e.g., "JD" for John Doe)

### Notary-Only Tags (Available Only to Notaries)

#### N - Commission Number Tag (🆔)
- **Description**: Notary commission number
- **User Type**: Notary
- **Behavior**: 
  - Auto-fills with notary's commission number from profile
  - Uses `users.commissionNumber`
- **Use Case**: Notary identification, legal compliance
- **Keyboard Shortcut**: `N`
- **Validation**: Ensures commission number format matches state requirements
- **Commission Verification**: Validates against state notary database
- **Expiration Check**: Warns if commission is near expiration

#### X - Commission Expiration Tag (📅)
- **Description**: Commission expiration date
- **User Type**: Notary
- **Behavior**: 
  - Auto-fills with notary's commission expiration date
  - Uses `users.commissionExpiration`
- **Use Case**: Notary credential validation, compliance tracking
- **Keyboard Shortcut**: `X`
- **Expiration Warning**: Alerts if commission expires within 30 days
- **Date Validation**: Ensures date is in the future
- **State Compliance**: Validates against state-specific requirements

#### O - Disclosure Tag (📋)
- **Description**: Notary disclosure statement
- **User Type**: Notary
- **Behavior**: 
  - Auto-fills with standard notary disclosure text
  - Pre-defined legal disclosure statement
- **Use Case**: Legal compliance, notary acknowledgment
- **Keyboard Shortcut**: `O`
- **State Variations**: Different disclosure text per state
- **Customization**: Allows notary to modify standard text
- **Legal Compliance**: Ensures disclosure meets state requirements

#### E - Seal Tag (🔖)
- **Description**: Notary seal/stamp
- **User Type**: Notary
- **Behavior**: 
  - Opens seal configuration dialog
  - Allows notary to select and configure stamp image
  - Requires manual interaction for customization
- **Use Case**: Official notary seal, document authentication
- **Keyboard Shortcut**: `E`
- **Seal Types**: State-issued seals, custom seals, digital seals
- **Seal Configuration**: Size, rotation, opacity, position
- **Seal Validation**: Ensures seal meets state requirements

#### W - Whiteout Tag (⬜)
- **Description**: Cover original PDF content
- **User Type**: Notary
- **Behavior**: 
  - Instantly completes when placed
  - Creates white rectangle to cover existing content
  - No user interaction required
- **Use Case**: Redacting sensitive information, covering errors
- **Keyboard Shortcut**: `W`
- **Size Configuration**: Adjustable width and height
- **Opacity Control**: Configurable transparency level
- **Audit Trail**: Logs all whiteout applications for compliance

## Advanced Tag System Features

### Tag Templates and Presets

#### Predefined Tag Sets
**Common Document Templates**:
- **Deed of Trust**: Standard mortgage document tag layout
- **Power of Attorney**: Legal authorization document tags
- **Affidavit**: Sworn statement document tags
- **Contract**: Business agreement tag layout
- **Will**: Estate planning document tags

**Template Features**:
- **One-Click Application**: Apply entire tag set with single click
- **Customizable Templates**: Modify templates for specific needs
- **Template Library**: Shared templates across organization
- **Version Control**: Track template changes over time

#### Tag Presets
**Size Presets**:
- **Small**: 80px × 20px for compact documents
- **Standard**: 120px × 25px for most documents
- **Large**: 160px × 30px for prominent fields
- **Custom**: User-defined dimensions

**Style Presets**:
- **Professional**: Clean, minimal styling
- **Bold**: High contrast, prominent appearance
- **Subtle**: Low opacity, background integration
- **Custom**: User-defined colors and styling

### Tag Automation and Smart Features

#### Auto-Placement Intelligence
**Smart Tag Placement**:
- **Form Field Detection**: Automatically detects form fields in PDFs
- **Optimal Positioning**: Suggests best tag positions based on document layout
- **Spacing Optimization**: Maintains consistent spacing between tags
- **Alignment Assistance**: Snap-to-grid and alignment guides

**Content Recognition**:
- **Text Pattern Matching**: Identifies common field types (name, date, signature)
- **Layout Analysis**: Understands document structure and field relationships
- **Smart Suggestions**: Recommends appropriate tag types for detected fields
- **Batch Processing**: Apply tags to multiple similar fields at once

#### Auto-Completion Intelligence
**Smart Content Filling**:
- **Context-Aware Filling**: Fills tags based on document context
- **Previous Session Memory**: Remembers content from previous sessions
- **User Preference Learning**: Learns user preferences for tag completion
- **Error Prevention**: Validates content before auto-filling

**Batch Operations**:
- **Multi-Tag Selection**: Select and modify multiple tags simultaneously
- **Bulk Assignment**: Assign multiple tags to users at once
- **Batch Validation**: Validate all tags in document at once
- **Mass Updates**: Update tag properties across multiple tags

### Tag Security and Compliance

#### Security Features
**Content Encryption**:
- **At-Rest Encryption**: All tag content encrypted in database
- **In-Transit Encryption**: Secure transmission of tag data
- **Access Control**: Role-based access to tag content
- **Audit Logging**: Complete audit trail of all tag interactions

**Permission Enforcement**:
- **Real-Time Validation**: Continuous permission checking
- **Session-Based Access**: Tags only accessible during active sessions
- **User Authentication**: Multi-factor authentication for sensitive tags
- **Geographic Restrictions**: Location-based access controls

#### Compliance Features
**Legal Compliance**:
- **State-Specific Requirements**: Compliance with state notary laws
- **Document Standards**: Adherence to document formatting standards
- **Signature Validation**: Ensures signatures meet legal requirements
- **Record Keeping**: Maintains required records for compliance

**Audit and Reporting**:
- **Comprehensive Logging**: Logs all tag interactions and changes
- **Audit Reports**: Detailed reports for compliance audits
- **Change Tracking**: Tracks all modifications to tags and content
- **Export Capabilities**: Export audit data for external review

### Tag Performance and Scalability

#### Performance Optimization
**Rendering Performance**:
- **Virtual Scrolling**: Only render visible tags for large documents
- **Canvas Rendering**: Use canvas for documents with 100+ tags
- **Hardware Acceleration**: Leverage GPU for smooth animations
- **Memory Management**: Efficient memory usage for large tag sets

**Network Optimization**:
- **Delta Updates**: Only send changed tag data
- **Batch Requests**: Group multiple updates in single request
- **Compression**: Compress tag data for faster transmission
- **Connection Management**: Handle network interruptions gracefully

#### Scalability Features
**Large Document Support**:
- **Multi-Page Documents**: Support for documents with 100+ pages
- **Tag Limits**: Configurable limits per document and page
- **Progressive Loading**: Load tags progressively as needed
- **Background Processing**: Process tags in background threads

**Multi-User Support**:
- **Concurrent Users**: Support for 50+ simultaneous users
- **Real-Time Collaboration**: Live updates across all users
- **Conflict Resolution**: Handle simultaneous tag edits
- **User Management**: Efficient user session management

### Tag Integration and APIs

#### External System Integration
**Document Management Systems**:
- **SharePoint Integration**: Direct integration with SharePoint
- **Google Drive**: Connect to Google Drive for document storage
- **Dropbox**: Integration with Dropbox for file management
- **Custom APIs**: RESTful APIs for custom integrations

**Authentication Systems**:
- **Active Directory**: Integration with AD for user authentication
- **SAML/SSO**: Single sign-on integration
- **OAuth 2.0**: Third-party authentication support
- **Custom Auth**: Support for custom authentication systems

#### API Endpoints
**Tag Management APIs**:
```typescript
// Create new tag
POST /api/tags
{
  documentId: number,
  tagType: string,
  xPosition: number,
  yPosition: number,
  assignedUserId: number
}

// Update tag
PUT /api/tags/:id
{
  content: string,
  isCompleted: boolean
}

// Get document tags
GET /api/documents/:id/tags

// Delete tag
DELETE /api/tags/:id
```

**Real-Time APIs**:
```typescript
// WebSocket events
{
  type: 'TAG_CREATED',
  data: { tagId, documentId, tagType, position }
}

{
  type: 'TAG_UPDATED',
  data: { tagId, content, isCompleted }
}

{
  type: 'TAG_DELETED',
  data: { tagId, documentId }
}
```

### Tag Analytics and Insights

#### Usage Analytics
**Tag Performance Metrics**:
- **Completion Time**: Average time to complete different tag types
- **Error Rates**: Frequency of validation errors by tag type
- **User Efficiency**: Tag completion speed by user role
- **Document Complexity**: Tags per document and completion rates

**User Behavior Analysis**:
- **Tag Placement Patterns**: Common tag placement locations
- **User Preferences**: Most frequently used tag types
- **Session Duration**: Time spent in tagging vs signing modes
- **Collaboration Patterns**: Multi-user interaction patterns

#### Quality Assurance
**Tag Quality Metrics**:
- **Validation Success Rate**: Percentage of tags passing validation
- **User Satisfaction**: User feedback on tag system usability
- **Error Prevention**: Reduction in document errors with tags
- **Compliance Adherence**: Percentage of documents meeting compliance requirements

**Continuous Improvement**:
- **A/B Testing**: Test different tag configurations
- **User Feedback**: Collect and analyze user feedback
- **Performance Monitoring**: Track system performance metrics
- **Feature Usage**: Monitor adoption of new tag features

### Tag System Administration

#### Administrative Tools
**Tag Management Console**:
- **Bulk Operations**: Manage multiple tags simultaneously
- **Template Management**: Create and manage tag templates
- **User Assignment**: Assign tags to users in bulk
- **System Configuration**: Configure tag system settings

**Monitoring and Alerts**:
- **Performance Monitoring**: Real-time system performance tracking
- **Error Alerts**: Automatic alerts for system errors
- **Usage Analytics**: Comprehensive usage reporting
- **Capacity Planning**: Resource usage forecasting

#### System Configuration
**Global Settings**:
- **Tag Limits**: Maximum tags per document and user
- **Session Timeouts**: Automatic session expiration settings
- **Security Policies**: Password policies and access controls
- **Backup Settings**: Automated backup configuration

**User Preferences**:
- **Default Tag Sizes**: User-specific default tag dimensions
- **Color Schemes**: Personalized tag color preferences
- **Keyboard Shortcuts**: Customizable keyboard shortcuts
- **Accessibility Options**: High contrast, screen reader support

### Tag System Troubleshooting

#### Common Issues and Solutions
**Performance Issues**:
- **Slow Tag Loading**: Clear browser cache, check network connectivity
- **Lag During Interaction**: Reduce document size, optimize tag count
- **Memory Usage**: Close unused documents, restart browser
- **Network Timeouts**: Check internet connection, increase timeout settings

**User Experience Issues**:
- **Tags Not Visible**: Check document filtering, verify permissions
- **Cannot Edit Tags**: Verify user role and session status
- **Auto-Fill Not Working**: Check user profile data, verify tag type
- **Permission Errors**: Confirm user assignments and role permissions

**Technical Issues**:
- **Database Errors**: Check database connectivity, verify schema
- **API Failures**: Monitor API endpoints, check authentication
- **WebSocket Issues**: Verify WebSocket connection, check firewall
- **Browser Compatibility**: Update browser, check JavaScript console

#### Debug Tools
**Developer Tools**:
- **Tag Inspector**: Examine tag properties and state
- **Network Monitor**: Track API calls and responses
- **Performance Profiler**: Analyze rendering performance
- **Error Console**: View detailed error messages

**Logging and Monitoring**:
- **Application Logs**: Comprehensive application logging
- **User Activity Logs**: Track user interactions and errors
- **Performance Metrics**: Real-time performance monitoring
- **Error Tracking**: Automatic error reporting and analysis

## Tags in Signing Sessions

### What Tags Do During Signing

Tags transform from static placeholders into interactive elements during signing sessions, serving as the primary interface for document completion:

#### Interactive Data Entry Points
- **Click to Complete**: Tags become clickable elements that trigger content insertion
- **Auto-Fill Behavior**: Most tags automatically populate with user profile data when clicked
- **Visual Feedback**: Tags change appearance to indicate completion status
- **Real-time Updates**: Completed tags immediately reflect changes across all participants

#### Document Completion Workflow
- **Sequential Processing**: Tags guide users through document completion in logical order
- **Validation Points**: Tags ensure required information is captured before proceeding
- **Progress Tracking**: Visual indicators show completion status of entire document
- **Quality Assurance**: Prevents missing critical information during signing

### Live Signing Session Architecture

#### Real-Time Communication System
**WebSocket Infrastructure**:
- **Connection Management**: Persistent WebSocket connections for all session participants
- **Room-Based Architecture**: Each signing session has dedicated WebSocket room
- **User Presence**: Real-time user online/offline status tracking
- **Connection Recovery**: Automatic reconnection with state restoration

**Message Types**:
```typescript
// Tag interaction messages
interface TagMessage {
  type: 'TAG_CLICKED' | 'TAG_COMPLETED' | 'TAG_EDITED' | 'TAG_DELETED';
  tagId: number;
  userId: number;
  sessionId: number;
  timestamp: Date;
  data?: any;
}

// User activity messages
interface UserActivityMessage {
  type: 'USER_JOINED' | 'USER_LEFT' | 'USER_ACTIVATED' | 'USER_DEACTIVATED';
  userId: number;
  sessionId: number;
  timestamp: Date;
}

// Session control messages
interface SessionControlMessage {
  type: 'SESSION_STARTED' | 'SESSION_PAUSED' | 'SESSION_COMPLETED' | 'SESSION_TERMINATED';
  sessionId: number;
  timestamp: Date;
  initiatedBy: number;
}
```

#### Webhook Integration System
**Webhook Endpoints**:
```typescript
// Tag completion webhook
POST /webhooks/tag-completed
{
  sessionId: number;
  tagId: number;
  userId: number;
  tagType: string;
  content: string;
  completedAt: Date;
  documentId: number;
}

// Session status webhook
POST /webhooks/session-status-changed
{
  sessionId: number;
  previousStatus: string;
  newStatus: string;
  changedBy: number;
  timestamp: Date;
}

// Document completion webhook
POST /webhooks/document-completed
{
  sessionId: number;
  documentId: number;
  completedBy: number;
  completedAt: Date;
  allTagsCompleted: boolean;
}
```

**Webhook Configuration**:
- **Retry Logic**: Automatic retry with exponential backoff for failed webhooks
- **Security**: HMAC signature verification for webhook authenticity
- **Rate Limiting**: Configurable rate limits to prevent abuse
- **Payload Validation**: Schema validation for all webhook payloads

### Live Signing Display Requirements

#### Real-Time Tag Visualization
**Tag State Synchronization**:
- **Live Updates**: Tags update in real-time across all participant screens
- **State Consistency**: All participants see identical tag states
- **Conflict Resolution**: Prevents simultaneous tag editing conflicts
- **Version Control**: Maintains tag state history for audit purposes

**Visual Indicators for Live Sessions**:
```typescript
interface LiveTagDisplay {
  // Tag completion status
  isCompleted: boolean;
  completedBy: number;
  completedAt: Date;
  
  // User assignment
  assignedUserId: number;
  assignedUserName: string;
  
  // Real-time activity
  isBeingEdited: boolean;
  editingBy: number;
  editingStartTime: Date;
  
  // Visual state
  visualState: 'incomplete' | 'completed' | 'editing' | 'error' | 'locked';
  userColor: string;
  completionIndicator: string;
}
```

#### User Activity Indicators
**Active User Display**:
- **User Avatars**: Show participant avatars with online status
- **Current Activity**: Display which user is currently active
- **Cursor Tracking**: Show other users' cursor positions (optional)
- **Activity Timeline**: Real-time feed of user actions

**Permission Visualization**:
- **Color Coding**: Each user's tags have distinct colors
- **Lock Indicators**: Show which tags are locked/unavailable
- **Permission Status**: Visual indication of user permissions
- **Assignment Display**: Clear indication of tag ownership

#### Progress Tracking Display
**Document Completion Progress**:
- **Progress Bar**: Visual progress indicator for entire document
- **Tag Count**: Show completed vs total tags
- **Page Progress**: Progress tracking per document page
- **Completion Time**: Estimated time to complete remaining tags

**Real-Time Statistics**:
```typescript
interface SessionProgress {
  totalTags: number;
  completedTags: number;
  remainingTags: number;
  completionPercentage: number;
  estimatedTimeRemaining: number;
  activeUsers: number;
  sessionDuration: number;
}
```

### Live Tag Interaction Workflow

#### Tag Activation Process
**User Activation Sequence**:
1. **Notary Control**: Notary activates specific users for tag interaction
2. **Permission Check**: System validates user permissions for tag types
3. **Visual Feedback**: UI updates to show active user and available tags
4. **Tag Highlighting**: User's assigned tags become highlighted
5. **Interaction Enablement**: User can now interact with assigned tags

**Activation States**:
```typescript
interface UserActivationState {
  userId: number;
  isActive: boolean;
  activatedBy: number;
  activatedAt: Date;
  allowedTagTypes: string[];
  currentTagId?: number;
  sessionPermissions: string[];
}
```

#### Tag Completion Workflow
**Step-by-Step Process**:
1. **Tag Selection**: User clicks on assigned tag
2. **Permission Validation**: System checks user permissions
3. **Content Generation**: Auto-fill or modal opens based on tag type
4. **Content Validation**: System validates entered content
5. **Real-Time Update**: Changes broadcast to all participants
6. **State Persistence**: Tag state saved to database
7. **Webhook Trigger**: Completion webhook sent to external systems
8. **Progress Update**: Document progress recalculated

**Completion Validation**:
```typescript
interface TagCompletionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields: string[];
  optionalFields: string[];
  validationRules: ValidationRule[];
}
```

#### Real-Time Collaboration Features
**Simultaneous User Support**:
- **User Queuing**: Multiple users can queue for tag completion
- **Turn Management**: System manages user turns for tag interaction
- **Conflict Prevention**: Prevents simultaneous editing of same tag
- **Activity Broadcasting**: All users see real-time activity

**Collaboration Indicators**:
- **User Cursors**: Optional display of other users' cursor positions
- **Activity Feed**: Real-time feed of user actions and tag completions
- **Chat Integration**: Built-in chat for user communication
- **Screen Sharing**: Optional screen sharing for guidance

### Webhook Implementation Details

#### Webhook Event Types
**Tag-Related Events**:
```typescript
// Tag placed
{
  event: 'TAG_PLACED',
  data: {
    tagId: number;
    tagType: string;
    position: { x: number; y: number };
    assignedUserId: number;
    placedBy: number;
    timestamp: Date;
  }
}

// Tag completed
{
  event: 'TAG_COMPLETED',
  data: {
    tagId: number;
    content: string;
    completedBy: number;
    completionTime: number;
    validationStatus: string;
    timestamp: Date;
  }
}

// Tag edited
{
  event: 'TAG_EDITED',
  data: {
    tagId: number;
    previousContent: string;
    newContent: string;
    editedBy: number;
    editReason: string;
    timestamp: Date;
  }
}
```

**Session-Related Events**:
```typescript
// Session started
{
  event: 'SESSION_STARTED',
  data: {
    sessionId: number;
    participants: User[];
    documents: Document[];
    startedBy: number;
    timestamp: Date;
  }
}

// User joined session
{
  event: 'USER_JOINED_SESSION',
  data: {
    sessionId: number;
    userId: number;
    userRole: string;
    joinTime: Date;
    timestamp: Date;
  }
}

// Session completed
{
  event: 'SESSION_COMPLETED',
  data: {
    sessionId: number;
    completionTime: number;
    totalTags: number;
    completedTags: number;
    participants: number[];
    timestamp: Date;
  }
}
```

#### Webhook Security and Reliability
**Security Measures**:
- **HMAC Signatures**: All webhooks signed with secret key
- **Payload Encryption**: Sensitive data encrypted in transit
- **IP Whitelisting**: Restrict webhook delivery to trusted IPs
- **Rate Limiting**: Prevent webhook abuse and spam

**Reliability Features**:
- **Retry Logic**: Automatic retry with exponential backoff
- **Dead Letter Queue**: Failed webhooks stored for manual processing
- **Delivery Confirmation**: Webhook delivery acknowledgment
- **Monitoring**: Real-time webhook delivery monitoring

### Live Signing UI Components

#### Tag Display Components
**Interactive Tag Component**:
```typescript
interface LiveTagProps {
  tag: Tag;
  isActive: boolean;
  currentUser: User;
  sessionState: SessionState;
  onTagClick: (tagId: number) => void;
  onTagComplete: (tagId: number, content: string) => void;
}

// Tag visual states during live signing
const tagVisualStates = {
  available: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    cursor: 'pointer',
    opacity: 1
  },
  completed: {
    borderColor: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    cursor: 'default',
    opacity: 0.8
  },
  editing: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    cursor: 'text',
    opacity: 1
  },
  locked: {
    borderColor: '#9ca3af',
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    cursor: 'not-allowed',
    opacity: 0.5
  }
};
```

#### User Activity Components
**Participant List Component**:
```typescript
interface ParticipantListProps {
  participants: User[];
  activeUser: number;
  currentUser: User;
  onUserActivate: (userId: number) => void;
  onUserDeactivate: (userId: number) => void;
}

// Participant status indicators
const participantStatus = {
  online: { color: '#059669', icon: '🟢' },
  active: { color: '#3b82f6', icon: '🔵' },
  editing: { color: '#f59e0b', icon: '🟡' },
  offline: { color: '#9ca3af', icon: '⚫' }
};
```

#### Progress Tracking Components
**Document Progress Component**:
```typescript
interface ProgressTrackerProps {
  totalTags: number;
  completedTags: number;
  currentPage: number;
  totalPages: number;
  estimatedTimeRemaining: number;
  onPageChange: (page: number) => void;
}

// Progress calculation
const calculateProgress = (completed: number, total: number) => {
  return {
    percentage: Math.round((completed / total) * 100),
    remaining: total - completed,
    estimatedTime: Math.round((total - completed) * 30) // 30 seconds per tag
  };
};
```

### Real-Time Data Synchronization

#### State Management
**Session State Structure**:
```typescript
interface LiveSessionState {
  sessionId: number;
  status: 'preparing' | 'active' | 'paused' | 'completed' | 'terminated';
  participants: User[];
  activeUser: number;
  currentPage: number;
  tags: Tag[];
  completedTags: number[];
  sessionStartTime: Date;
  lastActivityTime: Date;
  permissions: PermissionMap;
}
```

**Real-Time Updates**:
- **Optimistic Updates**: UI updates immediately for better UX
- **Server Confirmation**: Server confirms updates and resolves conflicts
- **State Reconciliation**: Automatic state synchronization across clients
- **Offline Support**: Queue updates when offline, sync when reconnected

#### Conflict Resolution
**Simultaneous Edit Handling**:
```typescript
interface ConflictResolution {
  type: 'TAG_EDIT_CONFLICT' | 'USER_ACTIVATION_CONFLICT' | 'PERMISSION_CONFLICT';
  conflictingUsers: number[];
  resolution: 'last-wins' | 'manual-resolution' | 'merge-content';
  resolvedBy: number;
  resolutionTime: Date;
}
```

**Conflict Prevention**:
- **Tag Locking**: Lock tags when user starts editing
- **User Queuing**: Queue users for tag interaction
- **Permission Enforcement**: Strict permission checking
- **Real-Time Validation**: Validate actions before execution

### Live Signing Performance Optimization

#### Real-Time Performance
**WebSocket Optimization**:
- **Message Batching**: Batch multiple updates in single message
- **Delta Updates**: Only send changed data
- **Compression**: Compress WebSocket messages
- **Connection Pooling**: Efficient connection management

**UI Performance**:
- **Virtual Scrolling**: Only render visible tags
- **Debounced Updates**: Debounce rapid UI updates
- **Memory Management**: Efficient memory usage for large sessions
- **Frame Rate Optimization**: Maintain 60fps for smooth interactions

#### Scalability Considerations
**Large Session Support**:
- **Tag Limits**: Configurable limits per session
- **User Limits**: Maximum participants per session
- **Document Limits**: Maximum documents per session
- **Time Limits**: Maximum session duration

**Load Balancing**:
- **Session Distribution**: Distribute sessions across servers
- **Geographic Distribution**: Route users to nearest servers
- **Auto-scaling**: Automatic scaling based on load
- **Failover**: Automatic failover for high availability

### Live Signing Security

#### Session Security
**Access Control**:
- **Session Authentication**: Verify user session access
- **Permission Validation**: Validate user permissions for each action
- **Session Isolation**: Isolate sessions from each other
- **Audit Logging**: Log all session activities

**Data Protection**:
- **Content Encryption**: Encrypt sensitive tag content
- **Transit Security**: Secure data transmission
- **Storage Security**: Secure data storage
- **Access Logging**: Log all data access

#### Compliance Features
**Legal Compliance**:
- **Notary Requirements**: Ensure compliance with notary laws
- **Document Integrity**: Maintain document authenticity
- **Audit Trail**: Complete audit trail for compliance
- **Record Keeping**: Maintain required records

**Privacy Protection**:
- **Data Minimization**: Only collect necessary data
- **User Consent**: Obtain user consent for data collection
- **Data Retention**: Implement data retention policies
- **Right to Deletion**: Support user data deletion requests

### Live Signing Monitoring and Analytics

#### Real-Time Monitoring
**Session Metrics**:
```typescript
interface SessionMetrics {
  activeSessions: number;
  totalParticipants: number;
  averageSessionDuration: number;
  tagCompletionRate: number;
  errorRate: number;
  systemPerformance: PerformanceMetrics;
}
```

**Performance Monitoring**:
- **Response Times**: Monitor API response times
- **WebSocket Latency**: Track real-time communication latency
- **Error Rates**: Monitor error frequencies
- **Resource Usage**: Track system resource consumption

#### Analytics and Reporting
**Usage Analytics**:
- **Session Patterns**: Analyze session usage patterns
- **User Behavior**: Track user interaction patterns
- **Performance Trends**: Monitor performance over time
- **Feature Adoption**: Track feature usage rates

**Compliance Reporting**:
- **Audit Reports**: Generate compliance audit reports
- **Activity Logs**: Export activity logs for review
- **Completion Reports**: Track document completion rates
- **Error Reports**: Monitor and report errors

### Live Signing Implementation Examples

#### WebSocket Event Handling
```typescript
// WebSocket connection setup
const setupWebSocket = (sessionId: number) => {
  const ws = new WebSocket(`wss://api.example.com/sessions/${sessionId}`);
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'TAG_COMPLETED':
        handleTagCompleted(message.data);
        break;
      case 'USER_ACTIVATED':
        handleUserActivated(message.data);
        break;
      case 'SESSION_STATUS_CHANGED':
        handleSessionStatusChanged(message.data);
        break;
    }
  };
  
  return ws;
};

// Tag completion handler
const handleTagCompleted = (data: TagCompletionData) => {
  // Update local tag state
  updateTagState(data.tagId, {
    isCompleted: true,
    completedBy: data.userId,
    completedAt: data.timestamp,
    content: data.content
  });
  
  // Update progress indicators
  updateProgressIndicators();
  
  // Trigger webhook if configured
  if (webhookConfig.enabled) {
    sendWebhook('TAG_COMPLETED', data);
  }
};
```

#### Real-Time UI Updates
```typescript
// React component for live tag display
const LiveTag: React.FC<LiveTagProps> = ({ tag, isActive, currentUser, sessionState }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(tag.content);
  
  const handleTagClick = async () => {
    if (!isActive || tag.isCompleted) return;
    
    // Check permissions
    if (!hasPermission(currentUser, tag)) {
      showError('You do not have permission to edit this tag');
      return;
    }
    
    // Start editing
    setIsEditing(true);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_EDITING_STARTED',
      tagId: tag.id,
      userId: currentUser.id
    });
  };
  
  const handleTagComplete = async () => {
    // Validate content
    if (!validateTagContent(tag.type, content)) {
      showError('Invalid content for this tag type');
      return;
    }
    
    // Complete tag
    await completeTag(tag.id, content);
    
    // Update local state
    setIsEditing(false);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_COMPLETED',
      tagId: tag.id,
      content: content,
      userId: currentUser.id
    });
  };
  
  return (
    <div 
      className={`live-tag ${getTagVisualState(tag, isActive, isEditing)}`}
      onClick={handleTagClick}
      style={{
        left: tag.xPosition,
        top: tag.yPosition,
        width: tag.width,
        height: tag.height,
        borderColor: getUserColor(tag.assignedUserId)
      }}
    >
      <div className="tag-icon">{getTagIcon(tag.type)}</div>
      <div className="tag-content">
        {isEditing ? (
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleTagComplete}
            autoFocus
          />
        ) : (
          <span>{tag.content || getPlaceholderText(tag.type)}</span>
        )}
      </div>
      <div className="tag-status">
        {tag.isCompleted && <span className="completion-check">✓</span>}
        {isEditing && <span className="editing-indicator">✏️</span>}
      </div>
    </div>
  );
};
```

#### Webhook Implementation
```typescript
// Webhook sender service
class WebhookService {
  private webhookQueue: WebhookMessage[] = [];
  private isProcessing = false;
  
  async sendWebhook(event: string, data: any) {
    const webhookMessage: WebhookMessage = {
      id: generateId(),
      event,
      data,
      timestamp: new Date(),
      retryCount: 0
    };
    
    this.webhookQueue.push(webhookMessage);
    await this.processQueue();
  }
  
  private async processQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.webhookQueue.length > 0) {
      const message = this.webhookQueue.shift();
      if (!message) continue;
      
      try {
        await this.deliverWebhook(message);
      } catch (error) {
        console.error('Webhook delivery failed:', error);
        
        // Retry logic
        if (message.retryCount < 3) {
          message.retryCount++;
          this.webhookQueue.push(message);
          
          // Exponential backoff
          await this.delay(Math.pow(2, message.retryCount) * 1000);
        } else {
          // Move to dead letter queue
          await this.moveToDeadLetterQueue(message);
        }
      }
    }
    
    this.isProcessing = false;
  }
  
  private async deliverWebhook(message: WebhookMessage) {
    const response = await fetch(webhookConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': this.generateSignature(message)
      },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status}`);
    }
  }
}
```

### Best Practices for Live Signing

#### Performance Best Practices
**WebSocket Optimization**:
- **Connection Management**: Implement proper connection lifecycle
- **Message Batching**: Batch multiple updates when possible
- **Compression**: Use compression for large payloads
- **Heartbeat**: Implement heartbeat to detect connection issues

**UI Performance**:
- **Virtual Rendering**: Only render visible tags
- **Debounced Updates**: Debounce rapid state updates
- **Memory Management**: Clean up unused resources
- **Error Boundaries**: Implement error boundaries for stability

#### Security Best Practices
**Authentication and Authorization**:
- **Session Validation**: Validate session tokens on every request
- **Permission Checking**: Check permissions for every action
- **Input Validation**: Validate all user inputs
- **Output Sanitization**: Sanitize all outputs

**Data Protection**:
- **Encryption**: Encrypt sensitive data at rest and in transit
- **Access Logging**: Log all data access for audit
- **Data Minimization**: Only collect necessary data
- **Secure Communication**: Use HTTPS and secure WebSocket connections

#### User Experience Best Practices
**Real-Time Feedback**:
- **Immediate Updates**: Provide immediate visual feedback
- **Progress Indicators**: Show progress for long operations
- **Error Handling**: Provide clear error messages
- **Loading States**: Show loading states for async operations

**Accessibility**:
- **Keyboard Navigation**: Support keyboard-only navigation
- **Screen Reader Support**: Provide proper ARIA labels
- **High Contrast**: Support high contrast mode
- **Focus Management**: Proper focus management for screen readers

### Troubleshooting Live Signing Issues

#### Common WebSocket Issues
**Connection Problems**:
- **Connection Drops**: Implement automatic reconnection
- **Latency Issues**: Use geographic distribution
- **Message Loss**: Implement message acknowledgment
- **Scalability**: Use load balancing for large sessions

**Performance Issues**:
- **Slow Updates**: Optimize message size and frequency
- **Memory Leaks**: Proper cleanup of event listeners
- **CPU Usage**: Optimize rendering and update logic
- **Network Usage**: Compress messages and batch updates

#### Debugging Tools
**WebSocket Debugging**:
```typescript
// WebSocket debug logger
const debugWebSocket = (ws: WebSocket, sessionId: number) => {
  const originalSend = ws.send;
  
  ws.send = function(data) {
    console.log(`[WS ${sessionId}] Sending:`, data);
    originalSend.call(this, data);
  };
  
  ws.addEventListener('message', (event) => {
    console.log(`[WS ${sessionId}] Received:`, event.data);
  });
  
  ws.addEventListener('error', (error) => {
    console.error(`[WS ${sessionId}] Error:`, error);
  });
  
  ws.addEventListener('close', (event) => {
    console.log(`[WS ${sessionId}] Closed:`, event.code, event.reason);
  });
};
```

**Performance Monitoring**:
```typescript
// Performance monitoring
const monitorPerformance = () => {
  const metrics = {
    messageLatency: [],
    renderTime: [],
    memoryUsage: [],
    errorRate: 0
  };
  
  // Monitor WebSocket latency
  const measureLatency = (startTime: number) => {
    const latency = Date.now() - startTime;
    metrics.messageLatency.push(latency);
    
    if (metrics.messageLatency.length > 100) {
      metrics.messageLatency.shift();
    }
  };
  
  // Monitor render performance
  const measureRenderTime = (callback: () => void) => {
    const startTime = performance.now();
    callback();
    const renderTime = performance.now() - startTime;
    metrics.renderTime.push(renderTime);
  };
  
  return { metrics, measureLatency, measureRenderTime };
};
```

This comprehensive guide now provides complete coverage of the tag system, including detailed information about live signing functionality, real-time interactions, webhook integration, and all aspects of the system's operation. The guide serves as a complete reference for understanding, implementing, and maintaining the tag system in live signing environments.

## User Permission System

### Notaries
- **Can place all tag types**: Universal + Signer + Notary-specific
- **Can edit any tag**: Full control over all tags in the session
- **Can activate any user**: Switch between different user contexts
- **Can delete/modify tags**: Complete tag management capabilities
- **Auto-fill privileges**: All tags auto-fill from their profile data

### Signers
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Can only edit assigned tags**: Limited to tags assigned to them
- **Cannot place notary tags**: No access to N, X, O, E, W tags
- **Auto-fill privileges**: Tags auto-fill from their profile data

### Witnesses
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Same restrictions as signers**: Limited tag placement and editing
- **Cannot place notary tags**: No access to notary-specific tags

### Admins
- **Full system access**: Can place and edit all tag types
- **Same privileges as notaries**: Complete control over tagging system
- **Can manage all sessions**: Administrative oversight capabilities

## Tag Interaction Logic

### Tagging Mode vs Signing Mode

#### Tagging Mode
- **Purpose**: Document preparation before signing
- **User Actions**: Place tags, configure positions, assign users
- **Tag Behavior**: Static placeholders, no auto-completion
- **Permissions**: Notaries and admins can place all tags

#### Signing Mode
- **Purpose**: Live document completion during signing session
- **User Actions**: Fill tags, complete documents
- **Tag Behavior**: Interactive completion, auto-fill from profiles
- **Permissions**: Users can only interact with assigned tags

## Tags in Signing Sessions

### What Tags Do During Signing

Tags transform from static placeholders into interactive elements during signing sessions, serving as the primary interface for document completion:

#### Interactive Data Entry Points
- **Click to Complete**: Tags become clickable elements that trigger content insertion
- **Auto-Fill Behavior**: Most tags automatically populate with user profile data when clicked
- **Visual Feedback**: Tags change appearance to indicate completion status
- **Real-time Updates**: Completed tags immediately reflect changes across all participants

#### Document Completion Workflow
- **Sequential Processing**: Tags guide users through document completion in logical order
- **Validation Points**: Tags ensure required information is captured before proceeding
- **Progress Tracking**: Visual indicators show completion status of entire document
- **Quality Assurance**: Prevents missing critical information during signing

### Live Signing Session Architecture

#### Real-Time Communication System
**WebSocket Infrastructure**:
- **Connection Management**: Persistent WebSocket connections for all session participants
- **Room-Based Architecture**: Each signing session has dedicated WebSocket room
- **User Presence**: Real-time user online/offline status tracking
- **Connection Recovery**: Automatic reconnection with state restoration

**Message Types**:
```typescript
// Tag interaction messages
interface TagMessage {
  type: 'TAG_CLICKED' | 'TAG_COMPLETED' | 'TAG_EDITED' | 'TAG_DELETED';
  tagId: number;
  userId: number;
  sessionId: number;
  timestamp: Date;
  data?: any;
}

// User activity messages
interface UserActivityMessage {
  type: 'USER_JOINED' | 'USER_LEFT' | 'USER_ACTIVATED' | 'USER_DEACTIVATED';
  userId: number;
  sessionId: number;
  timestamp: Date;
}

// Session control messages
interface SessionControlMessage {
  type: 'SESSION_STARTED' | 'SESSION_PAUSED' | 'SESSION_COMPLETED' | 'SESSION_TERMINATED';
  sessionId: number;
  timestamp: Date;
  initiatedBy: number;
}
```

#### Webhook Integration System
**Webhook Endpoints**:
```typescript
// Tag completion webhook
POST /webhooks/tag-completed
{
  sessionId: number;
  tagId: number;
  userId: number;
  tagType: string;
  content: string;
  completedAt: Date;
  documentId: number;
}

// Session status webhook
POST /webhooks/session-status-changed
{
  sessionId: number;
  previousStatus: string;
  newStatus: string;
  changedBy: number;
  timestamp: Date;
}

// Document completion webhook
POST /webhooks/document-completed
{
  sessionId: number;
  documentId: number;
  completedBy: number;
  completedAt: Date;
  allTagsCompleted: boolean;
}
```

**Webhook Configuration**:
- **Retry Logic**: Automatic retry with exponential backoff for failed webhooks
- **Security**: HMAC signature verification for webhook authenticity
- **Rate Limiting**: Configurable rate limits to prevent abuse
- **Payload Validation**: Schema validation for all webhook payloads

### Live Signing Display Requirements

#### Real-Time Tag Visualization
**Tag State Synchronization**:
- **Live Updates**: Tags update in real-time across all participant screens
- **State Consistency**: All participants see identical tag states
- **Conflict Resolution**: Prevents simultaneous tag editing conflicts
- **Version Control**: Maintains tag state history for audit purposes

**Visual Indicators for Live Sessions**:
```typescript
interface LiveTagDisplay {
  // Tag completion status
  isCompleted: boolean;
  completedBy: number;
  completedAt: Date;
  
  // User assignment
  assignedUserId: number;
  assignedUserName: string;
  
  // Real-time activity
  isBeingEdited: boolean;
  editingBy: number;
  editingStartTime: Date;
  
  // Visual state
  visualState: 'incomplete' | 'completed' | 'editing' | 'error' | 'locked';
  userColor: string;
  completionIndicator: string;
}
```

#### User Activity Indicators
**Active User Display**:
- **User Avatars**: Show participant avatars with online status
- **Current Activity**: Display which user is currently active
- **Cursor Tracking**: Show other users' cursor positions (optional)
- **Activity Timeline**: Real-time feed of user actions

**Permission Visualization**:
- **Color Coding**: Each user's tags have distinct colors
- **Lock Indicators**: Show which tags are locked/unavailable
- **Permission Status**: Visual indication of user permissions
- **Assignment Display**: Clear indication of tag ownership

#### Progress Tracking Display
**Document Completion Progress**:
- **Progress Bar**: Visual progress indicator for entire document
- **Tag Count**: Show completed vs total tags
- **Page Progress**: Progress tracking per document page
- **Completion Time**: Estimated time to complete remaining tags

**Real-Time Statistics**:
```typescript
interface SessionProgress {
  totalTags: number;
  completedTags: number;
  remainingTags: number;
  completionPercentage: number;
  estimatedTimeRemaining: number;
  activeUsers: number;
  sessionDuration: number;
}
```

### Live Tag Interaction Workflow

#### Tag Activation Process
**User Activation Sequence**:
1. **Notary Control**: Notary activates specific users for tag interaction
2. **Permission Check**: System validates user permissions for tag types
3. **Visual Feedback**: UI updates to show active user and available tags
4. **Tag Highlighting**: User's assigned tags become highlighted
5. **Interaction Enablement**: User can now interact with assigned tags

**Activation States**:
```typescript
interface UserActivationState {
  userId: number;
  isActive: boolean;
  activatedBy: number;
  activatedAt: Date;
  allowedTagTypes: string[];
  currentTagId?: number;
  sessionPermissions: string[];
}
```

#### Tag Completion Workflow
**Step-by-Step Process**:
1. **Tag Selection**: User clicks on assigned tag
2. **Permission Validation**: System checks user permissions
3. **Content Generation**: Auto-fill or modal opens based on tag type
4. **Content Validation**: System validates entered content
5. **Real-Time Update**: Changes broadcast to all participants
6. **State Persistence**: Tag state saved to database
7. **Webhook Trigger**: Completion webhook sent to external systems
8. **Progress Update**: Document progress recalculated

**Completion Validation**:
```typescript
interface TagCompletionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields: string[];
  optionalFields: string[];
  validationRules: ValidationRule[];
}
```

#### Real-Time Collaboration Features
**Simultaneous User Support**:
- **User Queuing**: Multiple users can queue for tag completion
- **Turn Management**: System manages user turns for tag interaction
- **Conflict Prevention**: Prevents simultaneous editing of same tag
- **Activity Broadcasting**: All users see real-time activity

**Collaboration Indicators**:
- **User Cursors**: Optional display of other users' cursor positions
- **Activity Feed**: Real-time feed of user actions and tag completions
- **Chat Integration**: Built-in chat for user communication
- **Screen Sharing**: Optional screen sharing for guidance

### Webhook Implementation Details

#### Webhook Event Types
**Tag-Related Events**:
```typescript
// Tag placed
{
  event: 'TAG_PLACED',
  data: {
    tagId: number;
    tagType: string;
    position: { x: number; y: number };
    assignedUserId: number;
    placedBy: number;
    timestamp: Date;
  }
}

// Tag completed
{
  event: 'TAG_COMPLETED',
  data: {
    tagId: number;
    content: string;
    completedBy: number;
    completionTime: number;
    validationStatus: string;
    timestamp: Date;
  }
}

// Tag edited
{
  event: 'TAG_EDITED',
  data: {
    tagId: number;
    previousContent: string;
    newContent: string;
    editedBy: number;
    editReason: string;
    timestamp: Date;
  }
}
```

**Session-Related Events**:
```typescript
// Session started
{
  event: 'SESSION_STARTED',
  data: {
    sessionId: number;
    participants: User[];
    documents: Document[];
    startedBy: number;
    timestamp: Date;
  }
}

// User joined session
{
  event: 'USER_JOINED_SESSION',
  data: {
    sessionId: number;
    userId: number;
    userRole: string;
    joinTime: Date;
    timestamp: Date;
  }
}

// Session completed
{
  event: 'SESSION_COMPLETED',
  data: {
    sessionId: number;
    completionTime: number;
    totalTags: number;
    completedTags: number;
    participants: number[];
    timestamp: Date;
  }
}
```

#### Webhook Security and Reliability
**Security Measures**:
- **HMAC Signatures**: All webhooks signed with secret key
- **Payload Encryption**: Sensitive data encrypted in transit
- **IP Whitelisting**: Restrict webhook delivery to trusted IPs
- **Rate Limiting**: Prevent webhook abuse and spam

**Reliability Features**:
- **Retry Logic**: Automatic retry with exponential backoff
- **Dead Letter Queue**: Failed webhooks stored for manual processing
- **Delivery Confirmation**: Webhook delivery acknowledgment
- **Monitoring**: Real-time webhook delivery monitoring

### Live Signing UI Components

#### Tag Display Components
**Interactive Tag Component**:
```typescript
interface LiveTagProps {
  tag: Tag;
  isActive: boolean;
  currentUser: User;
  sessionState: SessionState;
  onTagClick: (tagId: number) => void;
  onTagComplete: (tagId: number, content: string) => void;
}

// Tag visual states during live signing
const tagVisualStates = {
  available: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    cursor: 'pointer',
    opacity: 1
  },
  completed: {
    borderColor: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    cursor: 'default',
    opacity: 0.8
  },
  editing: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    cursor: 'text',
    opacity: 1
  },
  locked: {
    borderColor: '#9ca3af',
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    cursor: 'not-allowed',
    opacity: 0.5
  }
};
```

#### User Activity Components
**Participant List Component**:
```typescript
interface ParticipantListProps {
  participants: User[];
  activeUser: number;
  currentUser: User;
  onUserActivate: (userId: number) => void;
  onUserDeactivate: (userId: number) => void;
}

// Participant status indicators
const participantStatus = {
  online: { color: '#059669', icon: '🟢' },
  active: { color: '#3b82f6', icon: '🔵' },
  editing: { color: '#f59e0b', icon: '🟡' },
  offline: { color: '#9ca3af', icon: '⚫' }
};
```

#### Progress Tracking Components
**Document Progress Component**:
```typescript
interface ProgressTrackerProps {
  totalTags: number;
  completedTags: number;
  currentPage: number;
  totalPages: number;
  estimatedTimeRemaining: number;
  onPageChange: (page: number) => void;
}

// Progress calculation
const calculateProgress = (completed: number, total: number) => {
  return {
    percentage: Math.round((completed / total) * 100),
    remaining: total - completed,
    estimatedTime: Math.round((total - completed) * 30) // 30 seconds per tag
  };
};
```

### Real-Time Data Synchronization

#### State Management
**Session State Structure**:
```typescript
interface LiveSessionState {
  sessionId: number;
  status: 'preparing' | 'active' | 'paused' | 'completed' | 'terminated';
  participants: User[];
  activeUser: number;
  currentPage: number;
  tags: Tag[];
  completedTags: number[];
  sessionStartTime: Date;
  lastActivityTime: Date;
  permissions: PermissionMap;
}
```

**Real-Time Updates**:
- **Optimistic Updates**: UI updates immediately for better UX
- **Server Confirmation**: Server confirms updates and resolves conflicts
- **State Reconciliation**: Automatic state synchronization across clients
- **Offline Support**: Queue updates when offline, sync when reconnected

#### Conflict Resolution
**Simultaneous Edit Handling**:
```typescript
interface ConflictResolution {
  type: 'TAG_EDIT_CONFLICT' | 'USER_ACTIVATION_CONFLICT' | 'PERMISSION_CONFLICT';
  conflictingUsers: number[];
  resolution: 'last-wins' | 'manual-resolution' | 'merge-content';
  resolvedBy: number;
  resolutionTime: Date;
}
```

**Conflict Prevention**:
- **Tag Locking**: Lock tags when user starts editing
- **User Queuing**: Queue users for tag interaction
- **Permission Enforcement**: Strict permission checking
- **Real-Time Validation**: Validate actions before execution

### Live Signing Performance Optimization

#### Real-Time Performance
**WebSocket Optimization**:
- **Message Batching**: Batch multiple updates in single message
- **Delta Updates**: Only send changed data
- **Compression**: Compress WebSocket messages
- **Connection Pooling**: Efficient connection management

**UI Performance**:
- **Virtual Scrolling**: Only render visible tags
- **Debounced Updates**: Debounce rapid UI updates
- **Memory Management**: Efficient memory usage for large sessions
- **Frame Rate Optimization**: Maintain 60fps for smooth interactions

#### Scalability Considerations
**Large Session Support**:
- **Tag Limits**: Configurable limits per session
- **User Limits**: Maximum participants per session
- **Document Limits**: Maximum documents per session
- **Time Limits**: Maximum session duration

**Load Balancing**:
- **Session Distribution**: Distribute sessions across servers
- **Geographic Distribution**: Route users to nearest servers
- **Auto-scaling**: Automatic scaling based on load
- **Failover**: Automatic failover for high availability

### Live Signing Security

#### Session Security
**Access Control**:
- **Session Authentication**: Verify user session access
- **Permission Validation**: Validate user permissions for each action
- **Session Isolation**: Isolate sessions from each other
- **Audit Logging**: Log all session activities

**Data Protection**:
- **Content Encryption**: Encrypt sensitive tag content
- **Transit Security**: Secure data transmission
- **Storage Security**: Secure data storage
- **Access Logging**: Log all data access

#### Compliance Features
**Legal Compliance**:
- **Notary Requirements**: Ensure compliance with notary laws
- **Document Integrity**: Maintain document authenticity
- **Audit Trail**: Complete audit trail for compliance
- **Record Keeping**: Maintain required records

**Privacy Protection**:
- **Data Minimization**: Only collect necessary data
- **User Consent**: Obtain user consent for data collection
- **Data Retention**: Implement data retention policies
- **Right to Deletion**: Support user data deletion requests

### Live Signing Monitoring and Analytics

#### Real-Time Monitoring
**Session Metrics**:
```typescript
interface SessionMetrics {
  activeSessions: number;
  totalParticipants: number;
  averageSessionDuration: number;
  tagCompletionRate: number;
  errorRate: number;
  systemPerformance: PerformanceMetrics;
}
```

**Performance Monitoring**:
- **Response Times**: Monitor API response times
- **WebSocket Latency**: Track real-time communication latency
- **Error Rates**: Monitor error frequencies
- **Resource Usage**: Track system resource consumption

#### Analytics and Reporting
**Usage Analytics**:
- **Session Patterns**: Analyze session usage patterns
- **User Behavior**: Track user interaction patterns
- **Performance Trends**: Monitor performance over time
- **Feature Adoption**: Track feature usage rates

**Compliance Reporting**:
- **Audit Reports**: Generate compliance audit reports
- **Activity Logs**: Export activity logs for review
- **Completion Reports**: Track document completion rates
- **Error Reports**: Monitor and report errors

### Live Signing Implementation Examples

#### WebSocket Event Handling
```typescript
// WebSocket connection setup
const setupWebSocket = (sessionId: number) => {
  const ws = new WebSocket(`wss://api.example.com/sessions/${sessionId}`);
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'TAG_COMPLETED':
        handleTagCompleted(message.data);
        break;
      case 'USER_ACTIVATED':
        handleUserActivated(message.data);
        break;
      case 'SESSION_STATUS_CHANGED':
        handleSessionStatusChanged(message.data);
        break;
    }
  };
  
  return ws;
};

// Tag completion handler
const handleTagCompleted = (data: TagCompletionData) => {
  // Update local tag state
  updateTagState(data.tagId, {
    isCompleted: true,
    completedBy: data.userId,
    completedAt: data.timestamp,
    content: data.content
  });
  
  // Update progress indicators
  updateProgressIndicators();
  
  // Trigger webhook if configured
  if (webhookConfig.enabled) {
    sendWebhook('TAG_COMPLETED', data);
  }
};
```

#### Real-Time UI Updates
```typescript
// React component for live tag display
const LiveTag: React.FC<LiveTagProps> = ({ tag, isActive, currentUser, sessionState }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(tag.content);
  
  const handleTagClick = async () => {
    if (!isActive || tag.isCompleted) return;
    
    // Check permissions
    if (!hasPermission(currentUser, tag)) {
      showError('You do not have permission to edit this tag');
      return;
    }
    
    // Start editing
    setIsEditing(true);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_EDITING_STARTED',
      tagId: tag.id,
      userId: currentUser.id
    });
  };
  
  const handleTagComplete = async () => {
    // Validate content
    if (!validateTagContent(tag.type, content)) {
      showError('Invalid content for this tag type');
      return;
    }
    
    // Complete tag
    await completeTag(tag.id, content);
    
    // Update local state
    setIsEditing(false);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_COMPLETED',
      tagId: tag.id,
      content: content,
      userId: currentUser.id
    });
  };
  
  return (
    <div 
      className={`live-tag ${getTagVisualState(tag, isActive, isEditing)}`}
      onClick={handleTagClick}
      style={{
        left: tag.xPosition,
        top: tag.yPosition,
        width: tag.width,
        height: tag.height,
        borderColor: getUserColor(tag.assignedUserId)
      }}
    >
      <div className="tag-icon">{getTagIcon(tag.type)}</div>
      <div className="tag-content">
        {isEditing ? (
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleTagComplete}
            autoFocus
          />
        ) : (
          <span>{tag.content || getPlaceholderText(tag.type)}</span>
        )}
      </div>
      <div className="tag-status">
        {tag.isCompleted && <span className="completion-check">✓</span>}
        {isEditing && <span className="editing-indicator">✏️</span>}
      </div>
    </div>
  );
};
```

#### Webhook Implementation
```typescript
// Webhook sender service
class WebhookService {
  private webhookQueue: WebhookMessage[] = [];
  private isProcessing = false;
  
  async sendWebhook(event: string, data: any) {
    const webhookMessage: WebhookMessage = {
      id: generateId(),
      event,
      data,
      timestamp: new Date(),
      retryCount: 0
    };
    
    this.webhookQueue.push(webhookMessage);
    await this.processQueue();
  }
  
  private async processQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.webhookQueue.length > 0) {
      const message = this.webhookQueue.shift();
      if (!message) continue;
      
      try {
        await this.deliverWebhook(message);
      } catch (error) {
        console.error('Webhook delivery failed:', error);
        
        // Retry logic
        if (message.retryCount < 3) {
          message.retryCount++;
          this.webhookQueue.push(message);
          
          // Exponential backoff
          await this.delay(Math.pow(2, message.retryCount) * 1000);
        } else {
          // Move to dead letter queue
          await this.moveToDeadLetterQueue(message);
        }
      }
    }
    
    this.isProcessing = false;
  }
  
  private async deliverWebhook(message: WebhookMessage) {
    const response = await fetch(webhookConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': this.generateSignature(message)
      },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status}`);
    }
  }
}
```

### Best Practices for Live Signing

#### Performance Best Practices
**WebSocket Optimization**:
- **Connection Management**: Implement proper connection lifecycle
- **Message Batching**: Batch multiple updates when possible
- **Compression**: Use compression for large payloads
- **Heartbeat**: Implement heartbeat to detect connection issues

**UI Performance**:
- **Virtual Rendering**: Only render visible tags
- **Debounced Updates**: Debounce rapid state updates
- **Memory Management**: Clean up unused resources
- **Error Boundaries**: Implement error boundaries for stability

#### Security Best Practices
**Authentication and Authorization**:
- **Session Validation**: Validate session tokens on every request
- **Permission Checking**: Check permissions for every action
- **Input Validation**: Validate all user inputs
- **Output Sanitization**: Sanitize all outputs

**Data Protection**:
- **Encryption**: Encrypt sensitive data at rest and in transit
- **Access Logging**: Log all data access for audit
- **Data Minimization**: Only collect necessary data
- **Secure Communication**: Use HTTPS and secure WebSocket connections

#### User Experience Best Practices
**Real-Time Feedback**:
- **Immediate Updates**: Provide immediate visual feedback
- **Progress Indicators**: Show progress for long operations
- **Error Handling**: Provide clear error messages
- **Loading States**: Show loading states for async operations

**Accessibility**:
- **Keyboard Navigation**: Support keyboard-only navigation
- **Screen Reader Support**: Provide proper ARIA labels
- **High Contrast**: Support high contrast mode
- **Focus Management**: Proper focus management for screen readers

### Troubleshooting Live Signing Issues

#### Common WebSocket Issues
**Connection Problems**:
- **Connection Drops**: Implement automatic reconnection
- **Latency Issues**: Use geographic distribution
- **Message Loss**: Implement message acknowledgment
- **Scalability**: Use load balancing for large sessions

**Performance Issues**:
- **Slow Updates**: Optimize message size and frequency
- **Memory Leaks**: Proper cleanup of event listeners
- **CPU Usage**: Optimize rendering and update logic
- **Network Usage**: Compress messages and batch updates

#### Debugging Tools
**WebSocket Debugging**:
```typescript
// WebSocket debug logger
const debugWebSocket = (ws: WebSocket, sessionId: number) => {
  const originalSend = ws.send;
  
  ws.send = function(data) {
    console.log(`[WS ${sessionId}] Sending:`, data);
    originalSend.call(this, data);
  };
  
  ws.addEventListener('message', (event) => {
    console.log(`[WS ${sessionId}] Received:`, event.data);
  });
  
  ws.addEventListener('error', (error) => {
    console.error(`[WS ${sessionId}] Error:`, error);
  });
  
  ws.addEventListener('close', (event) => {
    console.log(`[WS ${sessionId}] Closed:`, event.code, event.reason);
  });
};
```

**Performance Monitoring**:
```typescript
// Performance monitoring
const monitorPerformance = () => {
  const metrics = {
    messageLatency: [],
    renderTime: [],
    memoryUsage: [],
    errorRate: 0
  };
  
  // Monitor WebSocket latency
  const measureLatency = (startTime: number) => {
    const latency = Date.now() - startTime;
    metrics.messageLatency.push(latency);
    
    if (metrics.messageLatency.length > 100) {
      metrics.messageLatency.shift();
    }
  };
  
  // Monitor render performance
  const measureRenderTime = (callback: () => void) => {
    const startTime = performance.now();
    callback();
    const renderTime = performance.now() - startTime;
    metrics.renderTime.push(renderTime);
  };
  
  return { metrics, measureLatency, measureRenderTime };
};
```

This comprehensive guide now provides complete coverage of the tag system, including detailed information about live signing functionality, real-time interactions, webhook integration, and all aspects of the system's operation. The guide serves as a complete reference for understanding, implementing, and maintaining the tag system in live signing environments.

## User Permission System

### Notaries
- **Can place all tag types**: Universal + Signer + Notary-specific
- **Can edit any tag**: Full control over all tags in the session
- **Can activate any user**: Switch between different user contexts
- **Can delete/modify tags**: Complete tag management capabilities
- **Auto-fill privileges**: All tags auto-fill from their profile data

### Signers
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Can only edit assigned tags**: Limited to tags assigned to them
- **Cannot place notary tags**: No access to N, X, O, E, W tags
- **Auto-fill privileges**: Tags auto-fill from their profile data

### Witnesses
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Same restrictions as signers**: Limited tag placement and editing
- **Cannot place notary tags**: No access to notary-specific tags

### Admins
- **Full system access**: Can place and edit all tag types
- **Same privileges as notaries**: Complete control over tagging system
- **Can manage all sessions**: Administrative oversight capabilities

## Tag Interaction Logic

### Tagging Mode vs Signing Mode

#### Tagging Mode
- **Purpose**: Document preparation before signing
- **User Actions**: Place tags, configure positions, assign users
- **Tag Behavior**: Static placeholders, no auto-completion
- **Permissions**: Notaries and admins can place all tags

#### Signing Mode
- **Purpose**: Live document completion during signing session
- **User Actions**: Fill tags, complete documents
- **Tag Behavior**: Interactive completion, auto-fill from profiles
- **Permissions**: Users can only interact with assigned tags

## Tags in Signing Sessions

### What Tags Do During Signing

Tags transform from static placeholders into interactive elements during signing sessions, serving as the primary interface for document completion:

#### Interactive Data Entry Points
- **Click to Complete**: Tags become clickable elements that trigger content insertion
- **Auto-Fill Behavior**: Most tags automatically populate with user profile data when clicked
- **Visual Feedback**: Tags change appearance to indicate completion status
- **Real-time Updates**: Completed tags immediately reflect changes across all participants

#### Document Completion Workflow
- **Sequential Processing**: Tags guide users through document completion in logical order
- **Validation Points**: Tags ensure required information is captured before proceeding
- **Progress Tracking**: Visual indicators show completion status of entire document
- **Quality Assurance**: Prevents missing critical information during signing

### Live Signing Session Architecture

#### Real-Time Communication System
**WebSocket Infrastructure**:
- **Connection Management**: Persistent WebSocket connections for all session participants
- **Room-Based Architecture**: Each signing session has dedicated WebSocket room
- **User Presence**: Real-time user online/offline status tracking
- **Connection Recovery**: Automatic reconnection with state restoration

**Message Types**:
```typescript
// Tag interaction messages
interface TagMessage {
  type: 'TAG_CLICKED' | 'TAG_COMPLETED' | 'TAG_EDITED' | 'TAG_DELETED';
  tagId: number;
  userId: number;
  sessionId: number;
  timestamp: Date;
  data?: any;
}

// User activity messages
interface UserActivityMessage {
  type: 'USER_JOINED' | 'USER_LEFT' | 'USER_ACTIVATED' | 'USER_DEACTIVATED';
  userId: number;
  sessionId: number;
  timestamp: Date;
}

// Session control messages
interface SessionControlMessage {
  type: 'SESSION_STARTED' | 'SESSION_PAUSED' | 'SESSION_COMPLETED' | 'SESSION_TERMINATED';
  sessionId: number;
  timestamp: Date;
  initiatedBy: number;
}
```

#### Webhook Integration System
**Webhook Endpoints**:
```typescript
// Tag completion webhook
POST /webhooks/tag-completed
{
  sessionId: number;
  tagId: number;
  userId: number;
  tagType: string;
  content: string;
  completedAt: Date;
  documentId: number;
}

// Session status webhook
POST /webhooks/session-status-changed
{
  sessionId: number;
  previousStatus: string;
  newStatus: string;
  changedBy: number;
  timestamp: Date;
}

// Document completion webhook
POST /webhooks/document-completed
{
  sessionId: number;
  documentId: number;
  completedBy: number;
  completedAt: Date;
  allTagsCompleted: boolean;
}
```

**Webhook Configuration**:
- **Retry Logic**: Automatic retry with exponential backoff for failed webhooks
- **Security**: HMAC signature verification for webhook authenticity
- **Rate Limiting**: Configurable rate limits to prevent abuse
- **Payload Validation**: Schema validation for all webhook payloads

### Live Signing Display Requirements

#### Real-Time Tag Visualization
**Tag State Synchronization**:
- **Live Updates**: Tags update in real-time across all participant screens
- **State Consistency**: All participants see identical tag states
- **Conflict Resolution**: Prevents simultaneous tag editing conflicts
- **Version Control**: Maintains tag state history for audit purposes

**Visual Indicators for Live Sessions**:
```typescript
interface LiveTagDisplay {
  // Tag completion status
  isCompleted: boolean;
  completedBy: number;
  completedAt: Date;
  
  // User assignment
  assignedUserId: number;
  assignedUserName: string;
  
  // Real-time activity
  isBeingEdited: boolean;
  editingBy: number;
  editingStartTime: Date;
  
  // Visual state
  visualState: 'incomplete' | 'completed' | 'editing' | 'error' | 'locked';
  userColor: string;
  completionIndicator: string;
}
```

#### User Activity Indicators
**Active User Display**:
- **User Avatars**: Show participant avatars with online status
- **Current Activity**: Display which user is currently active
- **Cursor Tracking**: Show other users' cursor positions (optional)
- **Activity Timeline**: Real-time feed of user actions

**Permission Visualization**:
- **Color Coding**: Each user's tags have distinct colors
- **Lock Indicators**: Show which tags are locked/unavailable
- **Permission Status**: Visual indication of user permissions
- **Assignment Display**: Clear indication of tag ownership

#### Progress Tracking Display
**Document Completion Progress**:
- **Progress Bar**: Visual progress indicator for entire document
- **Tag Count**: Show completed vs total tags
- **Page Progress**: Progress tracking per document page
- **Completion Time**: Estimated time to complete remaining tags

**Real-Time Statistics**:
```typescript
interface SessionProgress {
  totalTags: number;
  completedTags: number;
  remainingTags: number;
  completionPercentage: number;
  estimatedTimeRemaining: number;
  activeUsers: number;
  sessionDuration: number;
}
```

### Live Tag Interaction Workflow

#### Tag Activation Process
**User Activation Sequence**:
1. **Notary Control**: Notary activates specific users for tag interaction
2. **Permission Check**: System validates user permissions for tag types
3. **Visual Feedback**: UI updates to show active user and available tags
4. **Tag Highlighting**: User's assigned tags become highlighted
5. **Interaction Enablement**: User can now interact with assigned tags

**Activation States**:
```typescript
interface UserActivationState {
  userId: number;
  isActive: boolean;
  activatedBy: number;
  activatedAt: Date;
  allowedTagTypes: string[];
  currentTagId?: number;
  sessionPermissions: string[];
}
```

#### Tag Completion Workflow
**Step-by-Step Process**:
1. **Tag Selection**: User clicks on assigned tag
2. **Permission Validation**: System checks user permissions
3. **Content Generation**: Auto-fill or modal opens based on tag type
4. **Content Validation**: System validates entered content
5. **Real-Time Update**: Changes broadcast to all participants
6. **State Persistence**: Tag state saved to database
7. **Webhook Trigger**: Completion webhook sent to external systems
8. **Progress Update**: Document progress recalculated

**Completion Validation**:
```typescript
interface TagCompletionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields: string[];
  optionalFields: string[];
  validationRules: ValidationRule[];
}
```

#### Real-Time Collaboration Features
**Simultaneous User Support**:
- **User Queuing**: Multiple users can queue for tag completion
- **Turn Management**: System manages user turns for tag interaction
- **Conflict Prevention**: Prevents simultaneous editing of same tag
- **Activity Broadcasting**: All users see real-time activity

**Collaboration Indicators**:
- **User Cursors**: Optional display of other users' cursor positions
- **Activity Feed**: Real-time feed of user actions and tag completions
- **Chat Integration**: Built-in chat for user communication
- **Screen Sharing**: Optional screen sharing for guidance

### Webhook Implementation Details

#### Webhook Event Types
**Tag-Related Events**:
```typescript
// Tag placed
{
  event: 'TAG_PLACED',
  data: {
    tagId: number;
    tagType: string;
    position: { x: number; y: number };
    assignedUserId: number;
    placedBy: number;
    timestamp: Date;
  }
}

// Tag completed
{
  event: 'TAG_COMPLETED',
  data: {
    tagId: number;
    content: string;
    completedBy: number;
    completionTime: number;
    validationStatus: string;
    timestamp: Date;
  }
}

// Tag edited
{
  event: 'TAG_EDITED',
  data: {
    tagId: number;
    previousContent: string;
    newContent: string;
    editedBy: number;
    editReason: string;
    timestamp: Date;
  }
}
```

**Session-Related Events**:
```typescript
// Session started
{
  event: 'SESSION_STARTED',
  data: {
    sessionId: number;
    participants: User[];
    documents: Document[];
    startedBy: number;
    timestamp: Date;
  }
}

// User joined session
{
  event: 'USER_JOINED_SESSION',
  data: {
    sessionId: number;
    userId: number;
    userRole: string;
    joinTime: Date;
    timestamp: Date;
  }
}

// Session completed
{
  event: 'SESSION_COMPLETED',
  data: {
    sessionId: number;
    completionTime: number;
    totalTags: number;
    completedTags: number;
    participants: number[];
    timestamp: Date;
  }
}
```

#### Webhook Security and Reliability
**Security Measures**:
- **HMAC Signatures**: All webhooks signed with secret key
- **Payload Encryption**: Sensitive data encrypted in transit
- **IP Whitelisting**: Restrict webhook delivery to trusted IPs
- **Rate Limiting**: Prevent webhook abuse and spam

**Reliability Features**:
- **Retry Logic**: Automatic retry with exponential backoff
- **Dead Letter Queue**: Failed webhooks stored for manual processing
- **Delivery Confirmation**: Webhook delivery acknowledgment
- **Monitoring**: Real-time webhook delivery monitoring

### Live Signing UI Components

#### Tag Display Components
**Interactive Tag Component**:
```typescript
interface LiveTagProps {
  tag: Tag;
  isActive: boolean;
  currentUser: User;
  sessionState: SessionState;
  onTagClick: (tagId: number) => void;
  onTagComplete: (tagId: number, content: string) => void;
}

// Tag visual states during live signing
const tagVisualStates = {
  available: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    cursor: 'pointer',
    opacity: 1
  },
  completed: {
    borderColor: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    cursor: 'default',
    opacity: 0.8
  },
  editing: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    cursor: 'text',
    opacity: 1
  },
  locked: {
    borderColor: '#9ca3af',
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    cursor: 'not-allowed',
    opacity: 0.5
  }
};
```

#### User Activity Components
**Participant List Component**:
```typescript
interface ParticipantListProps {
  participants: User[];
  activeUser: number;
  currentUser: User;
  onUserActivate: (userId: number) => void;
  onUserDeactivate: (userId: number) => void;
}

// Participant status indicators
const participantStatus = {
  online: { color: '#059669', icon: '🟢' },
  active: { color: '#3b82f6', icon: '🔵' },
  editing: { color: '#f59e0b', icon: '🟡' },
  offline: { color: '#9ca3af', icon: '⚫' }
};
```

#### Progress Tracking Components
**Document Progress Component**:
```typescript
interface ProgressTrackerProps {
  totalTags: number;
  completedTags: number;
  currentPage: number;
  totalPages: number;
  estimatedTimeRemaining: number;
  onPageChange: (page: number) => void;
}

// Progress calculation
const calculateProgress = (completed: number, total: number) => {
  return {
    percentage: Math.round((completed / total) * 100),
    remaining: total - completed,
    estimatedTime: Math.round((total - completed) * 30) // 30 seconds per tag
  };
};
```

### Real-Time Data Synchronization

#### State Management
**Session State Structure**:
```typescript
interface LiveSessionState {
  sessionId: number;
  status: 'preparing' | 'active' | 'paused' | 'completed' | 'terminated';
  participants: User[];
  activeUser: number;
  currentPage: number;
  tags: Tag[];
  completedTags: number[];
  sessionStartTime: Date;
  lastActivityTime: Date;
  permissions: PermissionMap;
}
```

**Real-Time Updates**:
- **Optimistic Updates**: UI updates immediately for better UX
- **Server Confirmation**: Server confirms updates and resolves conflicts
- **State Reconciliation**: Automatic state synchronization across clients
- **Offline Support**: Queue updates when offline, sync when reconnected

#### Conflict Resolution
**Simultaneous Edit Handling**:
```typescript
interface ConflictResolution {
  type: 'TAG_EDIT_CONFLICT' | 'USER_ACTIVATION_CONFLICT' | 'PERMISSION_CONFLICT';
  conflictingUsers: number[];
  resolution: 'last-wins' | 'manual-resolution' | 'merge-content';
  resolvedBy: number;
  resolutionTime: Date;
}
```

**Conflict Prevention**:
- **Tag Locking**: Lock tags when user starts editing
- **User Queuing**: Queue users for tag interaction
- **Permission Enforcement**: Strict permission checking
- **Real-Time Validation**: Validate actions before execution

### Live Signing Performance Optimization

#### Real-Time Performance
**WebSocket Optimization**:
- **Message Batching**: Batch multiple updates in single message
- **Delta Updates**: Only send changed data
- **Compression**: Compress WebSocket messages
- **Connection Pooling**: Efficient connection management

**UI Performance**:
- **Virtual Scrolling**: Only render visible tags
- **Debounced Updates**: Debounce rapid UI updates
- **Memory Management**: Efficient memory usage for large sessions
- **Frame Rate Optimization**: Maintain 60fps for smooth interactions

#### Scalability Considerations
**Large Session Support**:
- **Tag Limits**: Configurable limits per session
- **User Limits**: Maximum participants per session
- **Document Limits**: Maximum documents per session
- **Time Limits**: Maximum session duration

**Load Balancing**:
- **Session Distribution**: Distribute sessions across servers
- **Geographic Distribution**: Route users to nearest servers
- **Auto-scaling**: Automatic scaling based on load
- **Failover**: Automatic failover for high availability

### Live Signing Security

#### Session Security
**Access Control**:
- **Session Authentication**: Verify user session access
- **Permission Validation**: Validate user permissions for each action
- **Session Isolation**: Isolate sessions from each other
- **Audit Logging**: Log all session activities

**Data Protection**:
- **Content Encryption**: Encrypt sensitive tag content
- **Transit Security**: Secure data transmission
- **Storage Security**: Secure data storage
- **Access Logging**: Log all data access

#### Compliance Features
**Legal Compliance**:
- **Notary Requirements**: Ensure compliance with notary laws
- **Document Integrity**: Maintain document authenticity
- **Audit Trail**: Complete audit trail for compliance
- **Record Keeping**: Maintain required records

**Privacy Protection**:
- **Data Minimization**: Only collect necessary data
- **User Consent**: Obtain user consent for data collection
- **Data Retention**: Implement data retention policies
- **Right to Deletion**: Support user data deletion requests

### Live Signing Monitoring and Analytics

#### Real-Time Monitoring
**Session Metrics**:
```typescript
interface SessionMetrics {
  activeSessions: number;
  totalParticipants: number;
  averageSessionDuration: number;
  tagCompletionRate: number;
  errorRate: number;
  systemPerformance: PerformanceMetrics;
}
```

**Performance Monitoring**:
- **Response Times**: Monitor API response times
- **WebSocket Latency**: Track real-time communication latency
- **Error Rates**: Monitor error frequencies
- **Resource Usage**: Track system resource consumption

#### Analytics and Reporting
**Usage Analytics**:
- **Session Patterns**: Analyze session usage patterns
- **User Behavior**: Track user interaction patterns
- **Performance Trends**: Monitor performance over time
- **Feature Adoption**: Track feature usage rates

**Compliance Reporting**:
- **Audit Reports**: Generate compliance audit reports
- **Activity Logs**: Export activity logs for review
- **Completion Reports**: Track document completion rates
- **Error Reports**: Monitor and report errors

### Live Signing Implementation Examples

#### WebSocket Event Handling
```typescript
// WebSocket connection setup
const setupWebSocket = (sessionId: number) => {
  const ws = new WebSocket(`wss://api.example.com/sessions/${sessionId}`);
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'TAG_COMPLETED':
        handleTagCompleted(message.data);
        break;
      case 'USER_ACTIVATED':
        handleUserActivated(message.data);
        break;
      case 'SESSION_STATUS_CHANGED':
        handleSessionStatusChanged(message.data);
        break;
    }
  };
  
  return ws;
};

// Tag completion handler
const handleTagCompleted = (data: TagCompletionData) => {
  // Update local tag state
  updateTagState(data.tagId, {
    isCompleted: true,
    completedBy: data.userId,
    completedAt: data.timestamp,
    content: data.content
  });
  
  // Update progress indicators
  updateProgressIndicators();
  
  // Trigger webhook if configured
  if (webhookConfig.enabled) {
    sendWebhook('TAG_COMPLETED', data);
  }
};
```

#### Real-Time UI Updates
```typescript
// React component for live tag display
const LiveTag: React.FC<LiveTagProps> = ({ tag, isActive, currentUser, sessionState }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(tag.content);
  
  const handleTagClick = async () => {
    if (!isActive || tag.isCompleted) return;
    
    // Check permissions
    if (!hasPermission(currentUser, tag)) {
      showError('You do not have permission to edit this tag');
      return;
    }
    
    // Start editing
    setIsEditing(true);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_EDITING_STARTED',
      tagId: tag.id,
      userId: currentUser.id
    });
  };
  
  const handleTagComplete = async () => {
    // Validate content
    if (!validateTagContent(tag.type, content)) {
      showError('Invalid content for this tag type');
      return;
    }
    
    // Complete tag
    await completeTag(tag.id, content);
    
    // Update local state
    setIsEditing(false);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_COMPLETED',
      tagId: tag.id,
      content: content,
      userId: currentUser.id
    });
  };
  
  return (
    <div 
      className={`live-tag ${getTagVisualState(tag, isActive, isEditing)}`}
      onClick={handleTagClick}
      style={{
        left: tag.xPosition,
        top: tag.yPosition,
        width: tag.width,
        height: tag.height,
        borderColor: getUserColor(tag.assignedUserId)
      }}
    >
      <div className="tag-icon">{getTagIcon(tag.type)}</div>
      <div className="tag-content">
        {isEditing ? (
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleTagComplete}
            autoFocus
          />
        ) : (
          <span>{tag.content || getPlaceholderText(tag.type)}</span>
        )}
      </div>
      <div className="tag-status">
        {tag.isCompleted && <span className="completion-check">✓</span>}
        {isEditing && <span className="editing-indicator">✏️</span>}
      </div>
    </div>
  );
};
```

#### Webhook Implementation
```typescript
// Webhook sender service
class WebhookService {
  private webhookQueue: WebhookMessage[] = [];
  private isProcessing = false;
  
  async sendWebhook(event: string, data: any) {
    const webhookMessage: WebhookMessage = {
      id: generateId(),
      event,
      data,
      timestamp: new Date(),
      retryCount: 0
    };
    
    this.webhookQueue.push(webhookMessage);
    await this.processQueue();
  }
  
  private async processQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.webhookQueue.length > 0) {
      const message = this.webhookQueue.shift();
      if (!message) continue;
      
      try {
        await this.deliverWebhook(message);
      } catch (error) {
        console.error('Webhook delivery failed:', error);
        
        // Retry logic
        if (message.retryCount < 3) {
          message.retryCount++;
          this.webhookQueue.push(message);
          
          // Exponential backoff
          await this.delay(Math.pow(2, message.retryCount) * 1000);
        } else {
          // Move to dead letter queue
          await this.moveToDeadLetterQueue(message);
        }
      }
    }
    
    this.isProcessing = false;
  }
  
  private async deliverWebhook(message: WebhookMessage) {
    const response = await fetch(webhookConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': this.generateSignature(message)
      },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status}`);
    }
  }
}
```

### Best Practices for Live Signing

#### Performance Best Practices
**WebSocket Optimization**:
- **Connection Management**: Implement proper connection lifecycle
- **Message Batching**: Batch multiple updates when possible
- **Compression**: Use compression for large payloads
- **Heartbeat**: Implement heartbeat to detect connection issues

**UI Performance**:
- **Virtual Rendering**: Only render visible tags
- **Debounced Updates**: Debounce rapid state updates
- **Memory Management**: Clean up unused resources
- **Error Boundaries**: Implement error boundaries for stability

#### Security Best Practices
**Authentication and Authorization**:
- **Session Validation**: Validate session tokens on every request
- **Permission Checking**: Check permissions for every action
- **Input Validation**: Validate all user inputs
- **Output Sanitization**: Sanitize all outputs

**Data Protection**:
- **Encryption**: Encrypt sensitive data at rest and in transit
- **Access Logging**: Log all data access for audit
- **Data Minimization**: Only collect necessary data
- **Secure Communication**: Use HTTPS and secure WebSocket connections

#### User Experience Best Practices
**Real-Time Feedback**:
- **Immediate Updates**: Provide immediate visual feedback
- **Progress Indicators**: Show progress for long operations
- **Error Handling**: Provide clear error messages
- **Loading States**: Show loading states for async operations

**Accessibility**:
- **Keyboard Navigation**: Support keyboard-only navigation
- **Screen Reader Support**: Provide proper ARIA labels
- **High Contrast**: Support high contrast mode
- **Focus Management**: Proper focus management for screen readers

### Troubleshooting Live Signing Issues

#### Common WebSocket Issues
**Connection Problems**:
- **Connection Drops**: Implement automatic reconnection
- **Latency Issues**: Use geographic distribution
- **Message Loss**: Implement message acknowledgment
- **Scalability**: Use load balancing for large sessions

**Performance Issues**:
- **Slow Updates**: Optimize message size and frequency
- **Memory Leaks**: Proper cleanup of event listeners
- **CPU Usage**: Optimize rendering and update logic
- **Network Usage**: Compress messages and batch updates

#### Debugging Tools
**WebSocket Debugging**:
```typescript
// WebSocket debug logger
const debugWebSocket = (ws: WebSocket, sessionId: number) => {
  const originalSend = ws.send;
  
  ws.send = function(data) {
    console.log(`[WS ${sessionId}] Sending:`, data);
    originalSend.call(this, data);
  };
  
  ws.addEventListener('message', (event) => {
    console.log(`[WS ${sessionId}] Received:`, event.data);
  });
  
  ws.addEventListener('error', (error) => {
    console.error(`[WS ${sessionId}] Error:`, error);
  });
  
  ws.addEventListener('close', (event) => {
    console.log(`[WS ${sessionId}] Closed:`, event.code, event.reason);
  });
};
```

**Performance Monitoring**:
```typescript
// Performance monitoring
const monitorPerformance = () => {
  const metrics = {
    messageLatency: [],
    renderTime: [],
    memoryUsage: [],
    errorRate: 0
  };
  
  // Monitor WebSocket latency
  const measureLatency = (startTime: number) => {
    const latency = Date.now() - startTime;
    metrics.messageLatency.push(latency);
    
    if (metrics.messageLatency.length > 100) {
      metrics.messageLatency.shift();
    }
  };
  
  // Monitor render performance
  const measureRenderTime = (callback: () => void) => {
    const startTime = performance.now();
    callback();
    const renderTime = performance.now() - startTime;
    metrics.renderTime.push(renderTime);
  };
  
  return { metrics, measureLatency, measureRenderTime };
};
```

This comprehensive guide now provides complete coverage of the tag system, including detailed information about live signing functionality, real-time interactions, webhook integration, and all aspects of the system's operation. The guide serves as a complete reference for understanding, implementing, and maintaining the tag system in live signing environments.

## User Permission System

### Notaries
- **Can place all tag types**: Universal + Signer + Notary-specific
- **Can edit any tag**: Full control over all tags in the session
- **Can activate any user**: Switch between different user contexts
- **Can delete/modify tags**: Complete tag management capabilities
- **Auto-fill privileges**: All tags auto-fill from their profile data

### Signers
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Can only edit assigned tags**: Limited to tags assigned to them
- **Cannot place notary tags**: No access to N, X, O, E, W tags
- **Auto-fill privileges**: Tags auto-fill from their profile data

### Witnesses
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Same restrictions as signers**: Limited tag placement and editing
- **Cannot place notary tags**: No access to notary-specific tags

### Admins
- **Full system access**: Can place and edit all tag types
- **Same privileges as notaries**: Complete control over tagging system
- **Can manage all sessions**: Administrative oversight capabilities

## Tag Interaction Logic

### Tagging Mode vs Signing Mode

#### Tagging Mode
- **Purpose**: Document preparation before signing
- **User Actions**: Place tags, configure positions, assign users
- **Tag Behavior**: Static placeholders, no auto-completion
- **Permissions**: Notaries and admins can place all tags

#### Signing Mode
- **Purpose**: Live document completion during signing session
- **User Actions**: Fill tags, complete documents
- **Tag Behavior**: Interactive completion, auto-fill from profiles
- **Permissions**: Users can only interact with assigned tags

## Tags in Signing Sessions

### What Tags Do During Signing

Tags transform from static placeholders into interactive elements during signing sessions, serving as the primary interface for document completion:

#### Interactive Data Entry Points
- **Click to Complete**: Tags become clickable elements that trigger content insertion
- **Auto-Fill Behavior**: Most tags automatically populate with user profile data when clicked
- **Visual Feedback**: Tags change appearance to indicate completion status
- **Real-time Updates**: Completed tags immediately reflect changes across all participants

#### Document Completion Workflow
- **Sequential Processing**: Tags guide users through document completion in logical order
- **Validation Points**: Tags ensure required information is captured before proceeding
- **Progress Tracking**: Visual indicators show completion status of entire document
- **Quality Assurance**: Prevents missing critical information during signing

### Live Signing Session Architecture

#### Real-Time Communication System
**WebSocket Infrastructure**:
- **Connection Management**: Persistent WebSocket connections for all session participants
- **Room-Based Architecture**: Each signing session has dedicated WebSocket room
- **User Presence**: Real-time user online/offline status tracking
- **Connection Recovery**: Automatic reconnection with state restoration

**Message Types**:
```typescript
// Tag interaction messages
interface TagMessage {
  type: 'TAG_CLICKED' | 'TAG_COMPLETED' | 'TAG_EDITED' | 'TAG_DELETED';
  tagId: number;
  userId: number;
  sessionId: number;
  timestamp: Date;
  data?: any;
}

// User activity messages
interface UserActivityMessage {
  type: 'USER_JOINED' | 'USER_LEFT' | 'USER_ACTIVATED' | 'USER_DEACTIVATED';
  userId: number;
  sessionId: number;
  timestamp: Date;
}

// Session control messages
interface SessionControlMessage {
  type: 'SESSION_STARTED' | 'SESSION_PAUSED' | 'SESSION_COMPLETED' | 'SESSION_TERMINATED';
  sessionId: number;
  timestamp: Date;
  initiatedBy: number;
}
```

#### Webhook Integration System
**Webhook Endpoints**:
```typescript
// Tag completion webhook
POST /webhooks/tag-completed
{
  sessionId: number;
  tagId: number;
  userId: number;
  tagType: string;
  content: string;
  completedAt: Date;
  documentId: number;
}

// Session status webhook
POST /webhooks/session-status-changed
{
  sessionId: number;
  previousStatus: string;
  newStatus: string;
  changedBy: number;
  timestamp: Date;
}

// Document completion webhook
POST /webhooks/document-completed
{
  sessionId: number;
  documentId: number;
  completedBy: number;
  completedAt: Date;
  allTagsCompleted: boolean;
}
```

**Webhook Configuration**:
- **Retry Logic**: Automatic retry with exponential backoff for failed webhooks
- **Security**: HMAC signature verification for webhook authenticity
- **Rate Limiting**: Configurable rate limits to prevent abuse
- **Payload Validation**: Schema validation for all webhook payloads

### Live Signing Display Requirements

#### Real-Time Tag Visualization
**Tag State Synchronization**:
- **Live Updates**: Tags update in real-time across all participant screens
- **State Consistency**: All participants see identical tag states
- **Conflict Resolution**: Prevents simultaneous tag editing conflicts
- **Version Control**: Maintains tag state history for audit purposes

**Visual Indicators for Live Sessions**:
```typescript
interface LiveTagDisplay {
  // Tag completion status
  isCompleted: boolean;
  completedBy: number;
  completedAt: Date;
  
  // User assignment
  assignedUserId: number;
  assignedUserName: string;
  
  // Real-time activity
  isBeingEdited: boolean;
  editingBy: number;
  editingStartTime: Date;
  
  // Visual state
  visualState: 'incomplete' | 'completed' | 'editing' | 'error' | 'locked';
  userColor: string;
  completionIndicator: string;
}
```

#### User Activity Indicators
**Active User Display**:
- **User Avatars**: Show participant avatars with online status
- **Current Activity**: Display which user is currently active
- **Cursor Tracking**: Show other users' cursor positions (optional)
- **Activity Timeline**: Real-time feed of user actions

**Permission Visualization**:
- **Color Coding**: Each user's tags have distinct colors
- **Lock Indicators**: Show which tags are locked/unavailable
- **Permission Status**: Visual indication of user permissions
- **Assignment Display**: Clear indication of tag ownership

#### Progress Tracking Display
**Document Completion Progress**:
- **Progress Bar**: Visual progress indicator for entire document
- **Tag Count**: Show completed vs total tags
- **Page Progress**: Progress tracking per document page
- **Completion Time**: Estimated time to complete remaining tags

**Real-Time Statistics**:
```typescript
interface SessionProgress {
  totalTags: number;
  completedTags: number;
  remainingTags: number;
  completionPercentage: number;
  estimatedTimeRemaining: number;
  activeUsers: number;
  sessionDuration: number;
}
```

### Live Tag Interaction Workflow

#### Tag Activation Process
**User Activation Sequence**:
1. **Notary Control**: Notary activates specific users for tag interaction
2. **Permission Check**: System validates user permissions for tag types
3. **Visual Feedback**: UI updates to show active user and available tags
4. **Tag Highlighting**: User's assigned tags become highlighted
5. **Interaction Enablement**: User can now interact with assigned tags

**Activation States**:
```typescript
interface UserActivationState {
  userId: number;
  isActive: boolean;
  activatedBy: number;
  activatedAt: Date;
  allowedTagTypes: string[];
  currentTagId?: number;
  sessionPermissions: string[];
}
```

#### Tag Completion Workflow
**Step-by-Step Process**:
1. **Tag Selection**: User clicks on assigned tag
2. **Permission Validation**: System checks user permissions
3. **Content Generation**: Auto-fill or modal opens based on tag type
4. **Content Validation**: System validates entered content
5. **Real-Time Update**: Changes broadcast to all participants
6. **State Persistence**: Tag state saved to database
7. **Webhook Trigger**: Completion webhook sent to external systems
8. **Progress Update**: Document progress recalculated

**Completion Validation**:
```typescript
interface TagCompletionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields: string[];
  optionalFields: string[];
  validationRules: ValidationRule[];
}
```

#### Real-Time Collaboration Features
**Simultaneous User Support**:
- **User Queuing**: Multiple users can queue for tag completion
- **Turn Management**: System manages user turns for tag interaction
- **Conflict Prevention**: Prevents simultaneous editing of same tag
- **Activity Broadcasting**: All users see real-time activity

**Collaboration Indicators**:
- **User Cursors**: Optional display of other users' cursor positions
- **Activity Feed**: Real-time feed of user actions and tag completions
- **Chat Integration**: Built-in chat for user communication
- **Screen Sharing**: Optional screen sharing for guidance

### Webhook Implementation Details

#### Webhook Event Types
**Tag-Related Events**:
```typescript
// Tag placed
{
  event: 'TAG_PLACED',
  data: {
    tagId: number;
    tagType: string;
    position: { x: number; y: number };
    assignedUserId: number;
    placedBy: number;
    timestamp: Date;
  }
}

// Tag completed
{
  event: 'TAG_COMPLETED',
  data: {
    tagId: number;
    content: string;
    completedBy: number;
    completionTime: number;
    validationStatus: string;
    timestamp: Date;
  }
}

// Tag edited
{
  event: 'TAG_EDITED',
  data: {
    tagId: number;
    previousContent: string;
    newContent: string;
    editedBy: number;
    editReason: string;
    timestamp: Date;
  }
}
```

**Session-Related Events**:
```typescript
// Session started
{
  event: 'SESSION_STARTED',
  data: {
    sessionId: number;
    participants: User[];
    documents: Document[];
    startedBy: number;
    timestamp: Date;
  }
}

// User joined session
{
  event: 'USER_JOINED_SESSION',
  data: {
    sessionId: number;
    userId: number;
    userRole: string;
    joinTime: Date;
    timestamp: Date;
  }
}

// Session completed
{
  event: 'SESSION_COMPLETED',
  data: {
    sessionId: number;
    completionTime: number;
    totalTags: number;
    completedTags: number;
    participants: number[];
    timestamp: Date;
  }
}
```

#### Webhook Security and Reliability
**Security Measures**:
- **HMAC Signatures**: All webhooks signed with secret key
- **Payload Encryption**: Sensitive data encrypted in transit
- **IP Whitelisting**: Restrict webhook delivery to trusted IPs
- **Rate Limiting**: Prevent webhook abuse and spam

**Reliability Features**:
- **Retry Logic**: Automatic retry with exponential backoff
- **Dead Letter Queue**: Failed webhooks stored for manual processing
- **Delivery Confirmation**: Webhook delivery acknowledgment
- **Monitoring**: Real-time webhook delivery monitoring

### Live Signing UI Components

#### Tag Display Components
**Interactive Tag Component**:
```typescript
interface LiveTagProps {
  tag: Tag;
  isActive: boolean;
  currentUser: User;
  sessionState: SessionState;
  onTagClick: (tagId: number) => void;
  onTagComplete: (tagId: number, content: string) => void;
}

// Tag visual states during live signing
const tagVisualStates = {
  available: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    cursor: 'pointer',
    opacity: 1
  },
  completed: {
    borderColor: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    cursor: 'default',
    opacity: 0.8
  },
  editing: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    cursor: 'text',
    opacity: 1
  },
  locked: {
    borderColor: '#9ca3af',
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    cursor: 'not-allowed',
    opacity: 0.5
  }
};
```

#### User Activity Components
**Participant List Component**:
```typescript
interface ParticipantListProps {
  participants: User[];
  activeUser: number;
  currentUser: User;
  onUserActivate: (userId: number) => void;
  onUserDeactivate: (userId: number) => void;
}

// Participant status indicators
const participantStatus = {
  online: { color: '#059669', icon: '🟢' },
  active: { color: '#3b82f6', icon: '🔵' },
  editing: { color: '#f59e0b', icon: '🟡' },
  offline: { color: '#9ca3af', icon: '⚫' }
};
```

#### Progress Tracking Components
**Document Progress Component**:
```typescript
interface ProgressTrackerProps {
  totalTags: number;
  completedTags: number;
  currentPage: number;
  totalPages: number;
  estimatedTimeRemaining: number;
  onPageChange: (page: number) => void;
}

// Progress calculation
const calculateProgress = (completed: number, total: number) => {
  return {
    percentage: Math.round((completed / total) * 100),
    remaining: total - completed,
    estimatedTime: Math.round((total - completed) * 30) // 30 seconds per tag
  };
};
```

### Real-Time Data Synchronization

#### State Management
**Session State Structure**:
```typescript
interface LiveSessionState {
  sessionId: number;
  status: 'preparing' | 'active' | 'paused' | 'completed' | 'terminated';
  participants: User[];
  activeUser: number;
  currentPage: number;
  tags: Tag[];
  completedTags: number[];
  sessionStartTime: Date;
  lastActivityTime: Date;
  permissions: PermissionMap;
}
```

**Real-Time Updates**:
- **Optimistic Updates**: UI updates immediately for better UX
- **Server Confirmation**: Server confirms updates and resolves conflicts
- **State Reconciliation**: Automatic state synchronization across clients
- **Offline Support**: Queue updates when offline, sync when reconnected

#### Conflict Resolution
**Simultaneous Edit Handling**:
```typescript
interface ConflictResolution {
  type: 'TAG_EDIT_CONFLICT' | 'USER_ACTIVATION_CONFLICT' | 'PERMISSION_CONFLICT';
  conflictingUsers: number[];
  resolution: 'last-wins' | 'manual-resolution' | 'merge-content';
  resolvedBy: number;
  resolutionTime: Date;
}
```

**Conflict Prevention**:
- **Tag Locking**: Lock tags when user starts editing
- **User Queuing**: Queue users for tag interaction
- **Permission Enforcement**: Strict permission checking
- **Real-Time Validation**: Validate actions before execution

### Live Signing Performance Optimization

#### Real-Time Performance
**WebSocket Optimization**:
- **Message Batching**: Batch multiple updates in single message
- **Delta Updates**: Only send changed data
- **Compression**: Compress WebSocket messages
- **Connection Pooling**: Efficient connection management

**UI Performance**:
- **Virtual Scrolling**: Only render visible tags
- **Debounced Updates**: Debounce rapid UI updates
- **Memory Management**: Efficient memory usage for large sessions
- **Frame Rate Optimization**: Maintain 60fps for smooth interactions

#### Scalability Considerations
**Large Session Support**:
- **Tag Limits**: Configurable limits per session
- **User Limits**: Maximum participants per session
- **Document Limits**: Maximum documents per session
- **Time Limits**: Maximum session duration

**Load Balancing**:
- **Session Distribution**: Distribute sessions across servers
- **Geographic Distribution**: Route users to nearest servers
- **Auto-scaling**: Automatic scaling based on load
- **Failover**: Automatic failover for high availability

### Live Signing Security

#### Session Security
**Access Control**:
- **Session Authentication**: Verify user session access
- **Permission Validation**: Validate user permissions for each action
- **Session Isolation**: Isolate sessions from each other
- **Audit Logging**: Log all session activities

**Data Protection**:
- **Content Encryption**: Encrypt sensitive tag content
- **Transit Security**: Secure data transmission
- **Storage Security**: Secure data storage
- **Access Logging**: Log all data access

#### Compliance Features
**Legal Compliance**:
- **Notary Requirements**: Ensure compliance with notary laws
- **Document Integrity**: Maintain document authenticity
- **Audit Trail**: Complete audit trail for compliance
- **Record Keeping**: Maintain required records

**Privacy Protection**:
- **Data Minimization**: Only collect necessary data
- **User Consent**: Obtain user consent for data collection
- **Data Retention**: Implement data retention policies
- **Right to Deletion**: Support user data deletion requests

### Live Signing Monitoring and Analytics

#### Real-Time Monitoring
**Session Metrics**:
```typescript
interface SessionMetrics {
  activeSessions: number;
  totalParticipants: number;
  averageSessionDuration: number;
  tagCompletionRate: number;
  errorRate: number;
  systemPerformance: PerformanceMetrics;
}
```

**Performance Monitoring**:
- **Response Times**: Monitor API response times
- **WebSocket Latency**: Track real-time communication latency
- **Error Rates**: Monitor error frequencies
- **Resource Usage**: Track system resource consumption

#### Analytics and Reporting
**Usage Analytics**:
- **Session Patterns**: Analyze session usage patterns
- **User Behavior**: Track user interaction patterns
- **Performance Trends**: Monitor performance over time
- **Feature Adoption**: Track feature usage rates

**Compliance Reporting**:
- **Audit Reports**: Generate compliance audit reports
- **Activity Logs**: Export activity logs for review
- **Completion Reports**: Track document completion rates
- **Error Reports**: Monitor and report errors

### Live Signing Implementation Examples

#### WebSocket Event Handling
```typescript
// WebSocket connection setup
const setupWebSocket = (sessionId: number) => {
  const ws = new WebSocket(`wss://api.example.com/sessions/${sessionId}`);
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'TAG_COMPLETED':
        handleTagCompleted(message.data);
        break;
      case 'USER_ACTIVATED':
        handleUserActivated(message.data);
        break;
      case 'SESSION_STATUS_CHANGED':
        handleSessionStatusChanged(message.data);
        break;
    }
  };
  
  return ws;
};

// Tag completion handler
const handleTagCompleted = (data: TagCompletionData) => {
  // Update local tag state
  updateTagState(data.tagId, {
    isCompleted: true,
    completedBy: data.userId,
    completedAt: data.timestamp,
    content: data.content
  });
  
  // Update progress indicators
  updateProgressIndicators();
  
  // Trigger webhook if configured
  if (webhookConfig.enabled) {
    sendWebhook('TAG_COMPLETED', data);
  }
};
```

#### Real-Time UI Updates
```typescript
// React component for live tag display
const LiveTag: React.FC<LiveTagProps> = ({ tag, isActive, currentUser, sessionState }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(tag.content);
  
  const handleTagClick = async () => {
    if (!isActive || tag.isCompleted) return;
    
    // Check permissions
    if (!hasPermission(currentUser, tag)) {
      showError('You do not have permission to edit this tag');
      return;
    }
    
    // Start editing
    setIsEditing(true);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_EDITING_STARTED',
      tagId: tag.id,
      userId: currentUser.id
    });
  };
  
  const handleTagComplete = async () => {
    // Validate content
    if (!validateTagContent(tag.type, content)) {
      showError('Invalid content for this tag type');
      return;
    }
    
    // Complete tag
    await completeTag(tag.id, content);
    
    // Update local state
    setIsEditing(false);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_COMPLETED',
      tagId: tag.id,
      content: content,
      userId: currentUser.id
    });
  };
  
  return (
    <div 
      className={`live-tag ${getTagVisualState(tag, isActive, isEditing)}`}
      onClick={handleTagClick}
      style={{
        left: tag.xPosition,
        top: tag.yPosition,
        width: tag.width,
        height: tag.height,
        borderColor: getUserColor(tag.assignedUserId)
      }}
    >
      <div className="tag-icon">{getTagIcon(tag.type)}</div>
      <div className="tag-content">
        {isEditing ? (
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleTagComplete}
            autoFocus
          />
        ) : (
          <span>{tag.content || getPlaceholderText(tag.type)}</span>
        )}
      </div>
      <div className="tag-status">
        {tag.isCompleted && <span className="completion-check">✓</span>}
        {isEditing && <span className="editing-indicator">✏️</span>}
      </div>
    </div>
  );
};
```

#### Webhook Implementation
```typescript
// Webhook sender service
class WebhookService {
  private webhookQueue: WebhookMessage[] = [];
  private isProcessing = false;
  
  async sendWebhook(event: string, data: any) {
    const webhookMessage: WebhookMessage = {
      id: generateId(),
      event,
      data,
      timestamp: new Date(),
      retryCount: 0
    };
    
    this.webhookQueue.push(webhookMessage);
    await this.processQueue();
  }
  
  private async processQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.webhookQueue.length > 0) {
      const message = this.webhookQueue.shift();
      if (!message) continue;
      
      try {
        await this.deliverWebhook(message);
      } catch (error) {
        console.error('Webhook delivery failed:', error);
        
        // Retry logic
        if (message.retryCount < 3) {
          message.retryCount++;
          this.webhookQueue.push(message);
          
          // Exponential backoff
          await this.delay(Math.pow(2, message.retryCount) * 1000);
        } else {
          // Move to dead letter queue
          await this.moveToDeadLetterQueue(message);
        }
      }
    }
    
    this.isProcessing = false;
  }
  
  private async deliverWebhook(message: WebhookMessage) {
    const response = await fetch(webhookConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': this.generateSignature(message)
      },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status}`);
    }
  }
}
```

### Best Practices for Live Signing

#### Performance Best Practices
**WebSocket Optimization**:
- **Connection Management**: Implement proper connection lifecycle
- **Message Batching**: Batch multiple updates when possible
- **Compression**: Use compression for large payloads
- **Heartbeat**: Implement heartbeat to detect connection issues

**UI Performance**:
- **Virtual Rendering**: Only render visible tags
- **Debounced Updates**: Debounce rapid state updates
- **Memory Management**: Clean up unused resources
- **Error Boundaries**: Implement error boundaries for stability

#### Security Best Practices
**Authentication and Authorization**:
- **Session Validation**: Validate session tokens on every request
- **Permission Checking**: Check permissions for every action
- **Input Validation**: Validate all user inputs
- **Output Sanitization**: Sanitize all outputs

**Data Protection**:
- **Encryption**: Encrypt sensitive data at rest and in transit
- **Access Logging**: Log all data access for audit
- **Data Minimization**: Only collect necessary data
- **Secure Communication**: Use HTTPS and secure WebSocket connections

#### User Experience Best Practices
**Real-Time Feedback**:
- **Immediate Updates**: Provide immediate visual feedback
- **Progress Indicators**: Show progress for long operations
- **Error Handling**: Provide clear error messages
- **Loading States**: Show loading states for async operations

**Accessibility**:
- **Keyboard Navigation**: Support keyboard-only navigation
- **Screen Reader Support**: Provide proper ARIA labels
- **High Contrast**: Support high contrast mode
- **Focus Management**: Proper focus management for screen readers

### Troubleshooting Live Signing Issues

#### Common WebSocket Issues
**Connection Problems**:
- **Connection Drops**: Implement automatic reconnection
- **Latency Issues**: Use geographic distribution
- **Message Loss**: Implement message acknowledgment
- **Scalability**: Use load balancing for large sessions

**Performance Issues**:
- **Slow Updates**: Optimize message size and frequency
- **Memory Leaks**: Proper cleanup of event listeners
- **CPU Usage**: Optimize rendering and update logic
- **Network Usage**: Compress messages and batch updates

#### Debugging Tools
**WebSocket Debugging**:
```typescript
// WebSocket debug logger
const debugWebSocket = (ws: WebSocket, sessionId: number) => {
  const originalSend = ws.send;
  
  ws.send = function(data) {
    console.log(`[WS ${sessionId}] Sending:`, data);
    originalSend.call(this, data);
  };
  
  ws.addEventListener('message', (event) => {
    console.log(`[WS ${sessionId}] Received:`, event.data);
  });
  
  ws.addEventListener('error', (error) => {
    console.error(`[WS ${sessionId}] Error:`, error);
  });
  
  ws.addEventListener('close', (event) => {
    console.log(`[WS ${sessionId}] Closed:`, event.code, event.reason);
  });
};
```

**Performance Monitoring**:
```typescript
// Performance monitoring
const monitorPerformance = () => {
  const metrics = {
    messageLatency: [],
    renderTime: [],
    memoryUsage: [],
    errorRate: 0
  };
  
  // Monitor WebSocket latency
  const measureLatency = (startTime: number) => {
    const latency = Date.now() - startTime;
    metrics.messageLatency.push(latency);
    
    if (metrics.messageLatency.length > 100) {
      metrics.messageLatency.shift();
    }
  };
  
  // Monitor render performance
  const measureRenderTime = (callback: () => void) => {
    const startTime = performance.now();
    callback();
    const renderTime = performance.now() - startTime;
    metrics.renderTime.push(renderTime);
  };
  
  return { metrics, measureLatency, measureRenderTime };
};
```

This comprehensive guide now provides complete coverage of the tag system, including detailed information about live signing functionality, real-time interactions, webhook integration, and all aspects of the system's operation. The guide serves as a complete reference for understanding, implementing, and maintaining the tag system in live signing environments.

## User Permission System

### Notaries
- **Can place all tag types**: Universal + Signer + Notary-specific
- **Can edit any tag**: Full control over all tags in the session
- **Can activate any user**: Switch between different user contexts
- **Can delete/modify tags**: Complete tag management capabilities
- **Auto-fill privileges**: All tags auto-fill from their profile data

### Signers
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Can only edit assigned tags**: Limited to tags assigned to them
- **Cannot place notary tags**: No access to N, X, O, E, W tags
- **Auto-fill privileges**: Tags auto-fill from their profile data

### Witnesses
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Same restrictions as signers**: Limited tag placement and editing
- **Cannot place notary tags**: No access to notary-specific tags

### Admins
- **Full system access**: Can place and edit all tag types
- **Same privileges as notaries**: Complete control over tagging system
- **Can manage all sessions**: Administrative oversight capabilities

## Tag Interaction Logic

### Tagging Mode vs Signing Mode

#### Tagging Mode
- **Purpose**: Document preparation before signing
- **User Actions**: Place tags, configure positions, assign users
- **Tag Behavior**: Static placeholders, no auto-completion
- **Permissions**: Notaries and admins can place all tags

#### Signing Mode
- **Purpose**: Live document completion during signing session
- **User Actions**: Fill tags, complete documents
- **Tag Behavior**: Interactive completion, auto-fill from profiles
- **Permissions**: Users can only interact with assigned tags

## Tags in Signing Sessions

### What Tags Do During Signing

Tags transform from static placeholders into interactive elements during signing sessions, serving as the primary interface for document completion:

#### Interactive Data Entry Points
- **Click to Complete**: Tags become clickable elements that trigger content insertion
- **Auto-Fill Behavior**: Most tags automatically populate with user profile data when clicked
- **Visual Feedback**: Tags change appearance to indicate completion status
- **Real-time Updates**: Completed tags immediately reflect changes across all participants

#### Document Completion Workflow
- **Sequential Processing**: Tags guide users through document completion in logical order
- **Validation Points**: Tags ensure required information is captured before proceeding
- **Progress Tracking**: Visual indicators show completion status of entire document
- **Quality Assurance**: Prevents missing critical information during signing

### Live Signing Session Architecture

#### Real-Time Communication System
**WebSocket Infrastructure**:
- **Connection Management**: Persistent WebSocket connections for all session participants
- **Room-Based Architecture**: Each signing session has dedicated WebSocket room
- **User Presence**: Real-time user online/offline status tracking
- **Connection Recovery**: Automatic reconnection with state restoration

**Message Types**:
```typescript
// Tag interaction messages
interface TagMessage {
  type: 'TAG_CLICKED' | 'TAG_COMPLETED' | 'TAG_EDITED' | 'TAG_DELETED';
  tagId: number;
  userId: number;
  sessionId: number;
  timestamp: Date;
  data?: any;
}

// User activity messages
interface UserActivityMessage {
  type: 'USER_JOINED' | 'USER_LEFT' | 'USER_ACTIVATED' | 'USER_DEACTIVATED';
  userId: number;
  sessionId: number;
  timestamp: Date;
}

// Session control messages
interface SessionControlMessage {
  type: 'SESSION_STARTED' | 'SESSION_PAUSED' | 'SESSION_COMPLETED' | 'SESSION_TERMINATED';
  sessionId: number;
  timestamp: Date;
  initiatedBy: number;
}
```

#### Webhook Integration System
**Webhook Endpoints**:
```typescript
// Tag completion webhook
POST /webhooks/tag-completed
{
  sessionId: number;
  tagId: number;
  userId: number;
  tagType: string;
  content: string;
  completedAt: Date;
  documentId: number;
}

// Session status webhook
POST /webhooks/session-status-changed
{
  sessionId: number;
  previousStatus: string;
  newStatus: string;
  changedBy: number;
  timestamp: Date;
}

// Document completion webhook
POST /webhooks/document-completed
{
  sessionId: number;
  documentId: number;
  completedBy: number;
  completedAt: Date;
  allTagsCompleted: boolean;
}
```

**Webhook Configuration**:
- **Retry Logic**: Automatic retry with exponential backoff for failed webhooks
- **Security**: HMAC signature verification for webhook authenticity
- **Rate Limiting**: Configurable rate limits to prevent abuse
- **Payload Validation**: Schema validation for all webhook payloads

### Live Signing Display Requirements

#### Real-Time Tag Visualization
**Tag State Synchronization**:
- **Live Updates**: Tags update in real-time across all participant screens
- **State Consistency**: All participants see identical tag states
- **Conflict Resolution**: Prevents simultaneous tag editing conflicts
- **Version Control**: Maintains tag state history for audit purposes

**Visual Indicators for Live Sessions**:
```typescript
interface LiveTagDisplay {
  // Tag completion status
  isCompleted: boolean;
  completedBy: number;
  completedAt: Date;
  
  // User assignment
  assignedUserId: number;
  assignedUserName: string;
  
  // Real-time activity
  isBeingEdited: boolean;
  editingBy: number;
  editingStartTime: Date;
  
  // Visual state
  visualState: 'incomplete' | 'completed' | 'editing' | 'error' | 'locked';
  userColor: string;
  completionIndicator: string;
}
```

#### User Activity Indicators
**Active User Display**:
- **User Avatars**: Show participant avatars with online status
- **Current Activity**: Display which user is currently active
- **Cursor Tracking**: Show other users' cursor positions (optional)
- **Activity Timeline**: Real-time feed of user actions

**Permission Visualization**:
- **Color Coding**: Each user's tags have distinct colors
- **Lock Indicators**: Show which tags are locked/unavailable
- **Permission Status**: Visual indication of user permissions
- **Assignment Display**: Clear indication of tag ownership

#### Progress Tracking Display
**Document Completion Progress**:
- **Progress Bar**: Visual progress indicator for entire document
- **Tag Count**: Show completed vs total tags
- **Page Progress**: Progress tracking per document page
- **Completion Time**: Estimated time to complete remaining tags

**Real-Time Statistics**:
```typescript
interface SessionProgress {
  totalTags: number;
  completedTags: number;
  remainingTags: number;
  completionPercentage: number;
  estimatedTimeRemaining: number;
  activeUsers: number;
  sessionDuration: number;
}
```

### Live Tag Interaction Workflow

#### Tag Activation Process
**User Activation Sequence**:
1. **Notary Control**: Notary activates specific users for tag interaction
2. **Permission Check**: System validates user permissions for tag types
3. **Visual Feedback**: UI updates to show active user and available tags
4. **Tag Highlighting**: User's assigned tags become highlighted
5. **Interaction Enablement**: User can now interact with assigned tags

**Activation States**:
```typescript
interface UserActivationState {
  userId: number;
  isActive: boolean;
  activatedBy: number;
  activatedAt: Date;
  allowedTagTypes: string[];
  currentTagId?: number;
  sessionPermissions: string[];
}
```

#### Tag Completion Workflow
**Step-by-Step Process**:
1. **Tag Selection**: User clicks on assigned tag
2. **Permission Validation**: System checks user permissions
3. **Content Generation**: Auto-fill or modal opens based on tag type
4. **Content Validation**: System validates entered content
5. **Real-Time Update**: Changes broadcast to all participants
6. **State Persistence**: Tag state saved to database
7. **Webhook Trigger**: Completion webhook sent to external systems
8. **Progress Update**: Document progress recalculated

**Completion Validation**:
```typescript
interface TagCompletionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields: string[];
  optionalFields: string[];
  validationRules: ValidationRule[];
}
```

#### Real-Time Collaboration Features
**Simultaneous User Support**:
- **User Queuing**: Multiple users can queue for tag completion
- **Turn Management**: System manages user turns for tag interaction
- **Conflict Prevention**: Prevents simultaneous editing of same tag
- **Activity Broadcasting**: All users see real-time activity

**Collaboration Indicators**:
- **User Cursors**: Optional display of other users' cursor positions
- **Activity Feed**: Real-time feed of user actions and tag completions
- **Chat Integration**: Built-in chat for user communication
- **Screen Sharing**: Optional screen sharing for guidance

### Webhook Implementation Details

#### Webhook Event Types
**Tag-Related Events**:
```typescript
// Tag placed
{
  event: 'TAG_PLACED',
  data: {
    tagId: number;
    tagType: string;
    position: { x: number; y: number };
    assignedUserId: number;
    placedBy: number;
    timestamp: Date;
  }
}

// Tag completed
{
  event: 'TAG_COMPLETED',
  data: {
    tagId: number;
    content: string;
    completedBy: number;
    completionTime: number;
    validationStatus: string;
    timestamp: Date;
  }
}

// Tag edited
{
  event: 'TAG_EDITED',
  data: {
    tagId: number;
    previousContent: string;
    newContent: string;
    editedBy: number;
    editReason: string;
    timestamp: Date;
  }
}
```

**Session-Related Events**:
```typescript
// Session started
{
  event: 'SESSION_STARTED',
  data: {
    sessionId: number;
    participants: User[];
    documents: Document[];
    startedBy: number;
    timestamp: Date;
  }
}

// User joined session
{
  event: 'USER_JOINED_SESSION',
  data: {
    sessionId: number;
    userId: number;
    userRole: string;
    joinTime: Date;
    timestamp: Date;
  }
}

// Session completed
{
  event: 'SESSION_COMPLETED',
  data: {
    sessionId: number;
    completionTime: number;
    totalTags: number;
    completedTags: number;
    participants: number[];
    timestamp: Date;
  }
}
```

#### Webhook Security and Reliability
**Security Measures**:
- **HMAC Signatures**: All webhooks signed with secret key
- **Payload Encryption**: Sensitive data encrypted in transit
- **IP Whitelisting**: Restrict webhook delivery to trusted IPs
- **Rate Limiting**: Prevent webhook abuse and spam

**Reliability Features**:
- **Retry Logic**: Automatic retry with exponential backoff
- **Dead Letter Queue**: Failed webhooks stored for manual processing
- **Delivery Confirmation**: Webhook delivery acknowledgment
- **Monitoring**: Real-time webhook delivery monitoring

### Live Signing UI Components

#### Tag Display Components
**Interactive Tag Component**:
```typescript
interface LiveTagProps {
  tag: Tag;
  isActive: boolean;
  currentUser: User;
  sessionState: SessionState;
  onTagClick: (tagId: number) => void;
  onTagComplete: (tagId: number, content: string) => void;
}

// Tag visual states during live signing
const tagVisualStates = {
  available: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    cursor: 'pointer',
    opacity: 1
  },
  completed: {
    borderColor: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    cursor: 'default',
    opacity: 0.8
  },
  editing: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    cursor: 'text',
    opacity: 1
  },
  locked: {
    borderColor: '#9ca3af',
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    cursor: 'not-allowed',
    opacity: 0.5
  }
};
```

#### User Activity Components
**Participant List Component**:
```typescript
interface ParticipantListProps {
  participants: User[];
  activeUser: number;
  currentUser: User;
  onUserActivate: (userId: number) => void;
  onUserDeactivate: (userId: number) => void;
}

// Participant status indicators
const participantStatus = {
  online: { color: '#059669', icon: '🟢' },
  active: { color: '#3b82f6', icon: '🔵' },
  editing: { color: '#f59e0b', icon: '🟡' },
  offline: { color: '#9ca3af', icon: '⚫' }
};
```

#### Progress Tracking Components
**Document Progress Component**:
```typescript
interface ProgressTrackerProps {
  totalTags: number;
  completedTags: number;
  currentPage: number;
  totalPages: number;
  estimatedTimeRemaining: number;
  onPageChange: (page: number) => void;
}

// Progress calculation
const calculateProgress = (completed: number, total: number) => {
  return {
    percentage: Math.round((completed / total) * 100),
    remaining: total - completed,
    estimatedTime: Math.round((total - completed) * 30) // 30 seconds per tag
  };
};
```

### Real-Time Data Synchronization

#### State Management
**Session State Structure**:
```typescript
interface LiveSessionState {
  sessionId: number;
  status: 'preparing' | 'active' | 'paused' | 'completed' | 'terminated';
  participants: User[];
  activeUser: number;
  currentPage: number;
  tags: Tag[];
  completedTags: number[];
  sessionStartTime: Date;
  lastActivityTime: Date;
  permissions: PermissionMap;
}
```

**Real-Time Updates**:
- **Optimistic Updates**: UI updates immediately for better UX
- **Server Confirmation**: Server confirms updates and resolves conflicts
- **State Reconciliation**: Automatic state synchronization across clients
- **Offline Support**: Queue updates when offline, sync when reconnected

#### Conflict Resolution
**Simultaneous Edit Handling**:
```typescript
interface ConflictResolution {
  type: 'TAG_EDIT_CONFLICT' | 'USER_ACTIVATION_CONFLICT' | 'PERMISSION_CONFLICT';
  conflictingUsers: number[];
  resolution: 'last-wins' | 'manual-resolution' | 'merge-content';
  resolvedBy: number;
  resolutionTime: Date;
}
```

**Conflict Prevention**:
- **Tag Locking**: Lock tags when user starts editing
- **User Queuing**: Queue users for tag interaction
- **Permission Enforcement**: Strict permission checking
- **Real-Time Validation**: Validate actions before execution

### Live Signing Performance Optimization

#### Real-Time Performance
**WebSocket Optimization**:
- **Message Batching**: Batch multiple updates in single message
- **Delta Updates**: Only send changed data
- **Compression**: Compress WebSocket messages
- **Connection Pooling**: Efficient connection management

**UI Performance**:
- **Virtual Scrolling**: Only render visible tags
- **Debounced Updates**: Debounce rapid UI updates
- **Memory Management**: Efficient memory usage for large sessions
- **Frame Rate Optimization**: Maintain 60fps for smooth interactions

#### Scalability Considerations
**Large Session Support**:
- **Tag Limits**: Configurable limits per session
- **User Limits**: Maximum participants per session
- **Document Limits**: Maximum documents per session
- **Time Limits**: Maximum session duration

**Load Balancing**:
- **Session Distribution**: Distribute sessions across servers
- **Geographic Distribution**: Route users to nearest servers
- **Auto-scaling**: Automatic scaling based on load
- **Failover**: Automatic failover for high availability

### Live Signing Security

#### Session Security
**Access Control**:
- **Session Authentication**: Verify user session access
- **Permission Validation**: Validate user permissions for each action
- **Session Isolation**: Isolate sessions from each other
- **Audit Logging**: Log all session activities

**Data Protection**:
- **Content Encryption**: Encrypt sensitive tag content
- **Transit Security**: Secure data transmission
- **Storage Security**: Secure data storage
- **Access Logging**: Log all data access

#### Compliance Features
**Legal Compliance**:
- **Notary Requirements**: Ensure compliance with notary laws
- **Document Integrity**: Maintain document authenticity
- **Audit Trail**: Complete audit trail for compliance
- **Record Keeping**: Maintain required records

**Privacy Protection**:
- **Data Minimization**: Only collect necessary data
- **User Consent**: Obtain user consent for data collection
- **Data Retention**: Implement data retention policies
- **Right to Deletion**: Support user data deletion requests

### Live Signing Monitoring and Analytics

#### Real-Time Monitoring
**Session Metrics**:
```typescript
interface SessionMetrics {
  activeSessions: number;
  totalParticipants: number;
  averageSessionDuration: number;
  tagCompletionRate: number;
  errorRate: number;
  systemPerformance: PerformanceMetrics;
}
```

**Performance Monitoring**:
- **Response Times**: Monitor API response times
- **WebSocket Latency**: Track real-time communication latency
- **Error Rates**: Monitor error frequencies
- **Resource Usage**: Track system resource consumption

#### Analytics and Reporting
**Usage Analytics**:
- **Session Patterns**: Analyze session usage patterns
- **User Behavior**: Track user interaction patterns
- **Performance Trends**: Monitor performance over time
- **Feature Adoption**: Track feature usage rates

**Compliance Reporting**:
- **Audit Reports**: Generate compliance audit reports
- **Activity Logs**: Export activity logs for review
- **Completion Reports**: Track document completion rates
- **Error Reports**: Monitor and report errors

### Live Signing Implementation Examples

#### WebSocket Event Handling
```typescript
// WebSocket connection setup
const setupWebSocket = (sessionId: number) => {
  const ws = new WebSocket(`wss://api.example.com/sessions/${sessionId}`);
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'TAG_COMPLETED':
        handleTagCompleted(message.data);
        break;
      case 'USER_ACTIVATED':
        handleUserActivated(message.data);
        break;
      case 'SESSION_STATUS_CHANGED':
        handleSessionStatusChanged(message.data);
        break;
    }
  };
  
  return ws;
};

// Tag completion handler
const handleTagCompleted = (data: TagCompletionData) => {
  // Update local tag state
  updateTagState(data.tagId, {
    isCompleted: true,
    completedBy: data.userId,
    completedAt: data.timestamp,
    content: data.content
  });
  
  // Update progress indicators
  updateProgressIndicators();
  
  // Trigger webhook if configured
  if (webhookConfig.enabled) {
    sendWebhook('TAG_COMPLETED', data);
  }
};
```

#### Real-Time UI Updates
```typescript
// React component for live tag display
const LiveTag: React.FC<LiveTagProps> = ({ tag, isActive, currentUser, sessionState }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(tag.content);
  
  const handleTagClick = async () => {
    if (!isActive || tag.isCompleted) return;
    
    // Check permissions
    if (!hasPermission(currentUser, tag)) {
      showError('You do not have permission to edit this tag');
      return;
    }
    
    // Start editing
    setIsEditing(true);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_EDITING_STARTED',
      tagId: tag.id,
      userId: currentUser.id
    });
  };
  
  const handleTagComplete = async () => {
    // Validate content
    if (!validateTagContent(tag.type, content)) {
      showError('Invalid content for this tag type');
      return;
    }
    
    // Complete tag
    await completeTag(tag.id, content);
    
    // Update local state
    setIsEditing(false);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_COMPLETED',
      tagId: tag.id,
      content: content,
      userId: currentUser.id
    });
  };
  
  return (
    <div 
      className={`live-tag ${getTagVisualState(tag, isActive, isEditing)}`}
      onClick={handleTagClick}
      style={{
        left: tag.xPosition,
        top: tag.yPosition,
        width: tag.width,
        height: tag.height,
        borderColor: getUserColor(tag.assignedUserId)
      }}
    >
      <div className="tag-icon">{getTagIcon(tag.type)}</div>
      <div className="tag-content">
        {isEditing ? (
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleTagComplete}
            autoFocus
          />
        ) : (
          <span>{tag.content || getPlaceholderText(tag.type)}</span>
        )}
      </div>
      <div className="tag-status">
        {tag.isCompleted && <span className="completion-check">✓</span>}
        {isEditing && <span className="editing-indicator">✏️</span>}
      </div>
    </div>
  );
};
```

#### Webhook Implementation
```typescript
// Webhook sender service
class WebhookService {
  private webhookQueue: WebhookMessage[] = [];
  private isProcessing = false;
  
  async sendWebhook(event: string, data: any) {
    const webhookMessage: WebhookMessage = {
      id: generateId(),
      event,
      data,
      timestamp: new Date(),
      retryCount: 0
    };
    
    this.webhookQueue.push(webhookMessage);
    await this.processQueue();
  }
  
  private async processQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.webhookQueue.length > 0) {
      const message = this.webhookQueue.shift();
      if (!message) continue;
      
      try {
        await this.deliverWebhook(message);
      } catch (error) {
        console.error('Webhook delivery failed:', error);
        
        // Retry logic
        if (message.retryCount < 3) {
          message.retryCount++;
          this.webhookQueue.push(message);
          
          // Exponential backoff
          await this.delay(Math.pow(2, message.retryCount) * 1000);
        } else {
          // Move to dead letter queue
          await this.moveToDeadLetterQueue(message);
        }
      }
    }
    
    this.isProcessing = false;
  }
  
  private async deliverWebhook(message: WebhookMessage) {
    const response = await fetch(webhookConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': this.generateSignature(message)
      },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status}`);
    }
  }
}
```

### Best Practices for Live Signing

#### Performance Best Practices
**WebSocket Optimization**:
- **Connection Management**: Implement proper connection lifecycle
- **Message Batching**: Batch multiple updates when possible
- **Compression**: Use compression for large payloads
- **Heartbeat**: Implement heartbeat to detect connection issues

**UI Performance**:
- **Virtual Rendering**: Only render visible tags
- **Debounced Updates**: Debounce rapid state updates
- **Memory Management**: Clean up unused resources
- **Error Boundaries**: Implement error boundaries for stability

#### Security Best Practices
**Authentication and Authorization**:
- **Session Validation**: Validate session tokens on every request
- **Permission Checking**: Check permissions for every action
- **Input Validation**: Validate all user inputs
- **Output Sanitization**: Sanitize all outputs

**Data Protection**:
- **Encryption**: Encrypt sensitive data at rest and in transit
- **Access Logging**: Log all data access for audit
- **Data Minimization**: Only collect necessary data
- **Secure Communication**: Use HTTPS and secure WebSocket connections

#### User Experience Best Practices
**Real-Time Feedback**:
- **Immediate Updates**: Provide immediate visual feedback
- **Progress Indicators**: Show progress for long operations
- **Error Handling**: Provide clear error messages
- **Loading States**: Show loading states for async operations

**Accessibility**:
- **Keyboard Navigation**: Support keyboard-only navigation
- **Screen Reader Support**: Provide proper ARIA labels
- **High Contrast**: Support high contrast mode
- **Focus Management**: Proper focus management for screen readers

### Troubleshooting Live Signing Issues

#### Common WebSocket Issues
**Connection Problems**:
- **Connection Drops**: Implement automatic reconnection
- **Latency Issues**: Use geographic distribution
- **Message Loss**: Implement message acknowledgment
- **Scalability**: Use load balancing for large sessions

**Performance Issues**:
- **Slow Updates**: Optimize message size and frequency
- **Memory Leaks**: Proper cleanup of event listeners
- **CPU Usage**: Optimize rendering and update logic
- **Network Usage**: Compress messages and batch updates

#### Debugging Tools
**WebSocket Debugging**:
```typescript
// WebSocket debug logger
const debugWebSocket = (ws: WebSocket, sessionId: number) => {
  const originalSend = ws.send;
  
  ws.send = function(data) {
    console.log(`[WS ${sessionId}] Sending:`, data);
    originalSend.call(this, data);
  };
  
  ws.addEventListener('message', (event) => {
    console.log(`[WS ${sessionId}] Received:`, event.data);
  });
  
  ws.addEventListener('error', (error) => {
    console.error(`[WS ${sessionId}] Error:`, error);
  });
  
  ws.addEventListener('close', (event) => {
    console.log(`[WS ${sessionId}] Closed:`, event.code, event.reason);
  });
};
```

**Performance Monitoring**:
```typescript
// Performance monitoring
const monitorPerformance = () => {
  const metrics = {
    messageLatency: [],
    renderTime: [],
    memoryUsage: [],
    errorRate: 0
  };
  
  // Monitor WebSocket latency
  const measureLatency = (startTime: number) => {
    const latency = Date.now() - startTime;
    metrics.messageLatency.push(latency);
    
    if (metrics.messageLatency.length > 100) {
      metrics.messageLatency.shift();
    }
  };
  
  // Monitor render performance
  const measureRenderTime = (callback: () => void) => {
    const startTime = performance.now();
    callback();
    const renderTime = performance.now() - startTime;
    metrics.renderTime.push(renderTime);
  };
  
  return { metrics, measureLatency, measureRenderTime };
};
```

This comprehensive guide now provides complete coverage of the tag system, including detailed information about live signing functionality, real-time interactions, webhook integration, and all aspects of the system's operation. The guide serves as a complete reference for understanding, implementing, and maintaining the tag system in live signing environments.

## User Permission System

### Notaries
- **Can place all tag types**: Universal + Signer + Notary-specific
- **Can edit any tag**: Full control over all tags in the session
- **Can activate any user**: Switch between different user contexts
- **Can delete/modify tags**: Complete tag management capabilities
- **Auto-fill privileges**: All tags auto-fill from their profile data

### Signers
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Can only edit assigned tags**: Limited to tags assigned to them
- **Cannot place notary tags**: No access to N, X, O, E, W tags
- **Auto-fill privileges**: Tags auto-fill from their profile data

### Witnesses
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Same restrictions as signers**: Limited tag placement and editing
- **Cannot place notary tags**: No access to notary-specific tags

### Admins
- **Full system access**: Can place and edit all tag types
- **Same privileges as notaries**: Complete control over tagging system
- **Can manage all sessions**: Administrative oversight capabilities

## Tag Interaction Logic

### Tagging Mode vs Signing Mode

#### Tagging Mode
- **Purpose**: Document preparation before signing
- **User Actions**: Place tags, configure positions, assign users
- **Tag Behavior**: Static placeholders, no auto-completion
- **Permissions**: Notaries and admins can place all tags

#### Signing Mode
- **Purpose**: Live document completion during signing session
- **User Actions**: Fill tags, complete documents
- **Tag Behavior**: Interactive completion, auto-fill from profiles
- **Permissions**: Users can only interact with assigned tags

## Tags in Signing Sessions

### What Tags Do During Signing

Tags transform from static placeholders into interactive elements during signing sessions, serving as the primary interface for document completion:

#### Interactive Data Entry Points
- **Click to Complete**: Tags become clickable elements that trigger content insertion
- **Auto-Fill Behavior**: Most tags automatically populate with user profile data when clicked
- **Visual Feedback**: Tags change appearance to indicate completion status
- **Real-time Updates**: Completed tags immediately reflect changes across all participants

#### Document Completion Workflow
- **Sequential Processing**: Tags guide users through document completion in logical order
- **Validation Points**: Tags ensure required information is captured before proceeding
- **Progress Tracking**: Visual indicators show completion status of entire document
- **Quality Assurance**: Prevents missing critical information during signing

### Live Signing Session Architecture

#### Real-Time Communication System
**WebSocket Infrastructure**:
- **Connection Management**: Persistent WebSocket connections for all session participants
- **Room-Based Architecture**: Each signing session has dedicated WebSocket room
- **User Presence**: Real-time user online/offline status tracking
- **Connection Recovery**: Automatic reconnection with state restoration

**Message Types**:
```typescript
// Tag interaction messages
interface TagMessage {
  type: 'TAG_CLICKED' | 'TAG_COMPLETED' | 'TAG_EDITED' | 'TAG_DELETED';
  tagId: number;
  userId: number;
  sessionId: number;
  timestamp: Date;
  data?: any;
}

// User activity messages
interface UserActivityMessage {
  type: 'USER_JOINED' | 'USER_LEFT' | 'USER_ACTIVATED' | 'USER_DEACTIVATED';
  userId: number;
  sessionId: number;
  timestamp: Date;
}

// Session control messages
interface SessionControlMessage {
  type: 'SESSION_STARTED' | 'SESSION_PAUSED' | 'SESSION_COMPLETED' | 'SESSION_TERMINATED';
  sessionId: number;
  timestamp: Date;
  initiatedBy: number;
}
```

#### Webhook Integration System
**Webhook Endpoints**:
```typescript
// Tag completion webhook
POST /webhooks/tag-completed
{
  sessionId: number;
  tagId: number;
  userId: number;
  tagType: string;
  content: string;
  completedAt: Date;
  documentId: number;
}

// Session status webhook
POST /webhooks/session-status-changed
{
  sessionId: number;
  previousStatus: string;
  newStatus: string;
  changedBy: number;
  timestamp: Date;
}

// Document completion webhook
POST /webhooks/document-completed
{
  sessionId: number;
  documentId: number;
  completedBy: number;
  completedAt: Date;
  allTagsCompleted: boolean;
}
```

**Webhook Configuration**:
- **Retry Logic**: Automatic retry with exponential backoff for failed webhooks
- **Security**: HMAC signature verification for webhook authenticity
- **Rate Limiting**: Configurable rate limits to prevent abuse
- **Payload Validation**: Schema validation for all webhook payloads

### Live Signing Display Requirements

#### Real-Time Tag Visualization
**Tag State Synchronization**:
- **Live Updates**: Tags update in real-time across all participant screens
- **State Consistency**: All participants see identical tag states
- **Conflict Resolution**: Prevents simultaneous tag editing conflicts
- **Version Control**: Maintains tag state history for audit purposes

**Visual Indicators for Live Sessions**:
```typescript
interface LiveTagDisplay {
  // Tag completion status
  isCompleted: boolean;
  completedBy: number;
  completedAt: Date;
  
  // User assignment
  assignedUserId: number;
  assignedUserName: string;
  
  // Real-time activity
  isBeingEdited: boolean;
  editingBy: number;
  editingStartTime: Date;
  
  // Visual state
  visualState: 'incomplete' | 'completed' | 'editing' | 'error' | 'locked';
  userColor: string;
  completionIndicator: string;
}
```

#### User Activity Indicators
**Active User Display**:
- **User Avatars**: Show participant avatars with online status
- **Current Activity**: Display which user is currently active
- **Cursor Tracking**: Show other users' cursor positions (optional)
- **Activity Timeline**: Real-time feed of user actions

**Permission Visualization**:
- **Color Coding**: Each user's tags have distinct colors
- **Lock Indicators**: Show which tags are locked/unavailable
- **Permission Status**: Visual indication of user permissions
- **Assignment Display**: Clear indication of tag ownership

#### Progress Tracking Display
**Document Completion Progress**:
- **Progress Bar**: Visual progress indicator for entire document
- **Tag Count**: Show completed vs total tags
- **Page Progress**: Progress tracking per document page
- **Completion Time**: Estimated time to complete remaining tags

**Real-Time Statistics**:
```typescript
interface SessionProgress {
  totalTags: number;
  completedTags: number;
  remainingTags: number;
  completionPercentage: number;
  estimatedTimeRemaining: number;
  activeUsers: number;
  sessionDuration: number;
}
```

### Live Tag Interaction Workflow

#### Tag Activation Process
**User Activation Sequence**:
1. **Notary Control**: Notary activates specific users for tag interaction
2. **Permission Check**: System validates user permissions for tag types
3. **Visual Feedback**: UI updates to show active user and available tags
4. **Tag Highlighting**: User's assigned tags become highlighted
5. **Interaction Enablement**: User can now interact with assigned tags

**Activation States**:
```typescript
interface UserActivationState {
  userId: number;
  isActive: boolean;
  activatedBy: number;
  activatedAt: Date;
  allowedTagTypes: string[];
  currentTagId?: number;
  sessionPermissions: string[];
}
```

#### Tag Completion Workflow
**Step-by-Step Process**:
1. **Tag Selection**: User clicks on assigned tag
2. **Permission Validation**: System checks user permissions
3. **Content Generation**: Auto-fill or modal opens based on tag type
4. **Content Validation**: System validates entered content
5. **Real-Time Update**: Changes broadcast to all participants
6. **State Persistence**: Tag state saved to database
7. **Webhook Trigger**: Completion webhook sent to external systems
8. **Progress Update**: Document progress recalculated

**Completion Validation**:
```typescript
interface TagCompletionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields: string[];
  optionalFields: string[];
  validationRules: ValidationRule[];
}
```

#### Real-Time Collaboration Features
**Simultaneous User Support**:
- **User Queuing**: Multiple users can queue for tag completion
- **Turn Management**: System manages user turns for tag interaction
- **Conflict Prevention**: Prevents simultaneous editing of same tag
- **Activity Broadcasting**: All users see real-time activity

**Collaboration Indicators**:
- **User Cursors**: Optional display of other users' cursor positions
- **Activity Feed**: Real-time feed of user actions and tag completions
- **Chat Integration**: Built-in chat for user communication
- **Screen Sharing**: Optional screen sharing for guidance

### Webhook Implementation Details

#### Webhook Event Types
**Tag-Related Events**:
```typescript
// Tag placed
{
  event: 'TAG_PLACED',
  data: {
    tagId: number;
    tagType: string;
    position: { x: number; y: number };
    assignedUserId: number;
    placedBy: number;
    timestamp: Date;
  }
}

// Tag completed
{
  event: 'TAG_COMPLETED',
  data: {
    tagId: number;
    content: string;
    completedBy: number;
    completionTime: number;
    validationStatus: string;
    timestamp: Date;
  }
}

// Tag edited
{
  event: 'TAG_EDITED',
  data: {
    tagId: number;
    previousContent: string;
    newContent: string;
    editedBy: number;
    editReason: string;
    timestamp: Date;
  }
}
```

**Session-Related Events**:
```typescript
// Session started
{
  event: 'SESSION_STARTED',
  data: {
    sessionId: number;
    participants: User[];
    documents: Document[];
    startedBy: number;
    timestamp: Date;
  }
}

// User joined session
{
  event: 'USER_JOINED_SESSION',
  data: {
    sessionId: number;
    userId: number;
    userRole: string;
    joinTime: Date;
    timestamp: Date;
  }
}

// Session completed
{
  event: 'SESSION_COMPLETED',
  data: {
    sessionId: number;
    completionTime: number;
    totalTags: number;
    completedTags: number;
    participants: number[];
    timestamp: Date;
  }
}
```

#### Webhook Security and Reliability
**Security Measures**:
- **HMAC Signatures**: All webhooks signed with secret key
- **Payload Encryption**: Sensitive data encrypted in transit
- **IP Whitelisting**: Restrict webhook delivery to trusted IPs
- **Rate Limiting**: Prevent webhook abuse and spam

**Reliability Features**:
- **Retry Logic**: Automatic retry with exponential backoff
- **Dead Letter Queue**: Failed webhooks stored for manual processing
- **Delivery Confirmation**: Webhook delivery acknowledgment
- **Monitoring**: Real-time webhook delivery monitoring

### Live Signing UI Components

#### Tag Display Components
**Interactive Tag Component**:
```typescript
interface LiveTagProps {
  tag: Tag;
  isActive: boolean;
  currentUser: User;
  sessionState: SessionState;
  onTagClick: (tagId: number) => void;
  onTagComplete: (tagId: number, content: string) => void;
}

// Tag visual states during live signing
const tagVisualStates = {
  available: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    cursor: 'pointer',
    opacity: 1
  },
  completed: {
    borderColor: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    cursor: 'default',
    opacity: 0.8
  },
  editing: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    cursor: 'text',
    opacity: 1
  },
  locked: {
    borderColor: '#9ca3af',
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    cursor: 'not-allowed',
    opacity: 0.5
  }
};
```

#### User Activity Components
**Participant List Component**:
```typescript
interface ParticipantListProps {
  participants: User[];
  activeUser: number;
  currentUser: User;
  onUserActivate: (userId: number) => void;
  onUserDeactivate: (userId: number) => void;
}

// Participant status indicators
const participantStatus = {
  online: { color: '#059669', icon: '🟢' },
  active: { color: '#3b82f6', icon: '🔵' },
  editing: { color: '#f59e0b', icon: '🟡' },
  offline: { color: '#9ca3af', icon: '⚫' }
};
```

#### Progress Tracking Components
**Document Progress Component**:
```typescript
interface ProgressTrackerProps {
  totalTags: number;
  completedTags: number;
  currentPage: number;
  totalPages: number;
  estimatedTimeRemaining: number;
  onPageChange: (page: number) => void;
}

// Progress calculation
const calculateProgress = (completed: number, total: number) => {
  return {
    percentage: Math.round((completed / total) * 100),
    remaining: total - completed,
    estimatedTime: Math.round((total - completed) * 30) // 30 seconds per tag
  };
};
```

### Real-Time Data Synchronization

#### State Management
**Session State Structure**:
```typescript
interface LiveSessionState {
  sessionId: number;
  status: 'preparing' | 'active' | 'paused' | 'completed' | 'terminated';
  participants: User[];
  activeUser: number;
  currentPage: number;
  tags: Tag[];
  completedTags: number[];
  sessionStartTime: Date;
  lastActivityTime: Date;
  permissions: PermissionMap;
}
```

**Real-Time Updates**:
- **Optimistic Updates**: UI updates immediately for better UX
- **Server Confirmation**: Server confirms updates and resolves conflicts
- **State Reconciliation**: Automatic state synchronization across clients
- **Offline Support**: Queue updates when offline, sync when reconnected

#### Conflict Resolution
**Simultaneous Edit Handling**:
```typescript
interface ConflictResolution {
  type: 'TAG_EDIT_CONFLICT' | 'USER_ACTIVATION_CONFLICT' | 'PERMISSION_CONFLICT';
  conflictingUsers: number[];
  resolution: 'last-wins' | 'manual-resolution' | 'merge-content';
  resolvedBy: number;
  resolutionTime: Date;
}
```

**Conflict Prevention**:
- **Tag Locking**: Lock tags when user starts editing
- **User Queuing**: Queue users for tag interaction
- **Permission Enforcement**: Strict permission checking
- **Real-Time Validation**: Validate actions before execution

### Live Signing Performance Optimization

#### Real-Time Performance
**WebSocket Optimization**:
- **Message Batching**: Batch multiple updates in single message
- **Delta Updates**: Only send changed data
- **Compression**: Compress WebSocket messages
- **Connection Pooling**: Efficient connection management

**UI Performance**:
- **Virtual Scrolling**: Only render visible tags
- **Debounced Updates**: Debounce rapid UI updates
- **Memory Management**: Efficient memory usage for large sessions
- **Frame Rate Optimization**: Maintain 60fps for smooth interactions

#### Scalability Considerations
**Large Session Support**:
- **Tag Limits**: Configurable limits per session
- **User Limits**: Maximum participants per session
- **Document Limits**: Maximum documents per session
- **Time Limits**: Maximum session duration

**Load Balancing**:
- **Session Distribution**: Distribute sessions across servers
- **Geographic Distribution**: Route users to nearest servers
- **Auto-scaling**: Automatic scaling based on load
- **Failover**: Automatic failover for high availability

### Live Signing Security

#### Session Security
**Access Control**:
- **Session Authentication**: Verify user session access
- **Permission Validation**: Validate user permissions for each action
- **Session Isolation**: Isolate sessions from each other
- **Audit Logging**: Log all session activities

**Data Protection**:
- **Content Encryption**: Encrypt sensitive tag content
- **Transit Security**: Secure data transmission
- **Storage Security**: Secure data storage
- **Access Logging**: Log all data access

#### Compliance Features
**Legal Compliance**:
- **Notary Requirements**: Ensure compliance with notary laws
- **Document Integrity**: Maintain document authenticity
- **Audit Trail**: Complete audit trail for compliance
- **Record Keeping**: Maintain required records

**Privacy Protection**:
- **Data Minimization**: Only collect necessary data
- **User Consent**: Obtain user consent for data collection
- **Data Retention**: Implement data retention policies
- **Right to Deletion**: Support user data deletion requests

### Live Signing Monitoring and Analytics

#### Real-Time Monitoring
**Session Metrics**:
```typescript
interface SessionMetrics {
  activeSessions: number;
  totalParticipants: number;
  averageSessionDuration: number;
  tagCompletionRate: number;
  errorRate: number;
  systemPerformance: PerformanceMetrics;
}
```

**Performance Monitoring**:
- **Response Times**: Monitor API response times
- **WebSocket Latency**: Track real-time communication latency
- **Error Rates**: Monitor error frequencies
- **Resource Usage**: Track system resource consumption

#### Analytics and Reporting
**Usage Analytics**:
- **Session Patterns**: Analyze session usage patterns
- **User Behavior**: Track user interaction patterns
- **Performance Trends**: Monitor performance over time
- **Feature Adoption**: Track feature usage rates

**Compliance Reporting**:
- **Audit Reports**: Generate compliance audit reports
- **Activity Logs**: Export activity logs for review
- **Completion Reports**: Track document completion rates
- **Error Reports**: Monitor and report errors

### Live Signing Implementation Examples

#### WebSocket Event Handling
```typescript
// WebSocket connection setup
const setupWebSocket = (sessionId: number) => {
  const ws = new WebSocket(`wss://api.example.com/sessions/${sessionId}`);
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'TAG_COMPLETED':
        handleTagCompleted(message.data);
        break;
      case 'USER_ACTIVATED':
        handleUserActivated(message.data);
        break;
      case 'SESSION_STATUS_CHANGED':
        handleSessionStatusChanged(message.data);
        break;
    }
  };
  
  return ws;
};

// Tag completion handler
const handleTagCompleted = (data: TagCompletionData) => {
  // Update local tag state
  updateTagState(data.tagId, {
    isCompleted: true,
    completedBy: data.userId,
    completedAt: data.timestamp,
    content: data.content
  });
  
  // Update progress indicators
  updateProgressIndicators();
  
  // Trigger webhook if configured
  if (webhookConfig.enabled) {
    sendWebhook('TAG_COMPLETED', data);
  }
};
```

#### Real-Time UI Updates
```typescript
// React component for live tag display
const LiveTag: React.FC<LiveTagProps> = ({ tag, isActive, currentUser, sessionState }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(tag.content);
  
  const handleTagClick = async () => {
    if (!isActive || tag.isCompleted) return;
    
    // Check permissions
    if (!hasPermission(currentUser, tag)) {
      showError('You do not have permission to edit this tag');
      return;
    }
    
    // Start editing
    setIsEditing(true);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_EDITING_STARTED',
      tagId: tag.id,
      userId: currentUser.id
    });
  };
  
  const handleTagComplete = async () => {
    // Validate content
    if (!validateTagContent(tag.type, content)) {
      showError('Invalid content for this tag type');
      return;
    }
    
    // Complete tag
    await completeTag(tag.id, content);
    
    // Update local state
    setIsEditing(false);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_COMPLETED',
      tagId: tag.id,
      content: content,
      userId: currentUser.id
    });
  };
  
  return (
    <div 
      className={`live-tag ${getTagVisualState(tag, isActive, isEditing)}`}
      onClick={handleTagClick}
      style={{
        left: tag.xPosition,
        top: tag.yPosition,
        width: tag.width,
        height: tag.height,
        borderColor: getUserColor(tag.assignedUserId)
      }}
    >
      <div className="tag-icon">{getTagIcon(tag.type)}</div>
      <div className="tag-content">
        {isEditing ? (
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleTagComplete}
            autoFocus
          />
        ) : (
          <span>{tag.content || getPlaceholderText(tag.type)}</span>
        )}
      </div>
      <div className="tag-status">
        {tag.isCompleted && <span className="completion-check">✓</span>}
        {isEditing && <span className="editing-indicator">✏️</span>}
      </div>
    </div>
  );
};
```

#### Webhook Implementation
```typescript
// Webhook sender service
class WebhookService {
  private webhookQueue: WebhookMessage[] = [];
  private isProcessing = false;
  
  async sendWebhook(event: string, data: any) {
    const webhookMessage: WebhookMessage = {
      id: generateId(),
      event,
      data,
      timestamp: new Date(),
      retryCount: 0
    };
    
    this.webhookQueue.push(webhookMessage);
    await this.processQueue();
  }
  
  private async processQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.webhookQueue.length > 0) {
      const message = this.webhookQueue.shift();
      if (!message) continue;
      
      try {
        await this.deliverWebhook(message);
      } catch (error) {
        console.error('Webhook delivery failed:', error);
        
        // Retry logic
        if (message.retryCount < 3) {
          message.retryCount++;
          this.webhookQueue.push(message);
          
          // Exponential backoff
          await this.delay(Math.pow(2, message.retryCount) * 1000);
        } else {
          // Move to dead letter queue
          await this.moveToDeadLetterQueue(message);
        }
      }
    }
    
    this.isProcessing = false;
  }
  
  private async deliverWebhook(message: WebhookMessage) {
    const response = await fetch(webhookConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': this.generateSignature(message)
      },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status}`);
    }
  }
}
```

### Best Practices for Live Signing

#### Performance Best Practices
**WebSocket Optimization**:
- **Connection Management**: Implement proper connection lifecycle
- **Message Batching**: Batch multiple updates when possible
- **Compression**: Use compression for large payloads
- **Heartbeat**: Implement heartbeat to detect connection issues

**UI Performance**:
- **Virtual Rendering**: Only render visible tags
- **Debounced Updates**: Debounce rapid state updates
- **Memory Management**: Clean up unused resources
- **Error Boundaries**: Implement error boundaries for stability

#### Security Best Practices
**Authentication and Authorization**:
- **Session Validation**: Validate session tokens on every request
- **Permission Checking**: Check permissions for every action
- **Input Validation**: Validate all user inputs
- **Output Sanitization**: Sanitize all outputs

**Data Protection**:
- **Encryption**: Encrypt sensitive data at rest and in transit
- **Access Logging**: Log all data access for audit
- **Data Minimization**: Only collect necessary data
- **Secure Communication**: Use HTTPS and secure WebSocket connections

#### User Experience Best Practices
**Real-Time Feedback**:
- **Immediate Updates**: Provide immediate visual feedback
- **Progress Indicators**: Show progress for long operations
- **Error Handling**: Provide clear error messages
- **Loading States**: Show loading states for async operations

**Accessibility**:
- **Keyboard Navigation**: Support keyboard-only navigation
- **Screen Reader Support**: Provide proper ARIA labels
- **High Contrast**: Support high contrast mode
- **Focus Management**: Proper focus management for screen readers

### Troubleshooting Live Signing Issues

#### Common WebSocket Issues
**Connection Problems**:
- **Connection Drops**: Implement automatic reconnection
- **Latency Issues**: Use geographic distribution
- **Message Loss**: Implement message acknowledgment
- **Scalability**: Use load balancing for large sessions

**Performance Issues**:
- **Slow Updates**: Optimize message size and frequency
- **Memory Leaks**: Proper cleanup of event listeners
- **CPU Usage**: Optimize rendering and update logic
- **Network Usage**: Compress messages and batch updates

#### Debugging Tools
**WebSocket Debugging**:
```typescript
// WebSocket debug logger
const debugWebSocket = (ws: WebSocket, sessionId: number) => {
  const originalSend = ws.send;
  
  ws.send = function(data) {
    console.log(`[WS ${sessionId}] Sending:`, data);
    originalSend.call(this, data);
  };
  
  ws.addEventListener('message', (event) => {
    console.log(`[WS ${sessionId}] Received:`, event.data);
  });
  
  ws.addEventListener('error', (error) => {
    console.error(`[WS ${sessionId}] Error:`, error);
  });
  
  ws.addEventListener('close', (event) => {
    console.log(`[WS ${sessionId}] Closed:`, event.code, event.reason);
  });
};
```

**Performance Monitoring**:
```typescript
// Performance monitoring
const monitorPerformance = () => {
  const metrics = {
    messageLatency: [],
    renderTime: [],
    memoryUsage: [],
    errorRate: 0
  };
  
  // Monitor WebSocket latency
  const measureLatency = (startTime: number) => {
    const latency = Date.now() - startTime;
    metrics.messageLatency.push(latency);
    
    if (metrics.messageLatency.length > 100) {
      metrics.messageLatency.shift();
    }
  };
  
  // Monitor render performance
  const measureRenderTime = (callback: () => void) => {
    const startTime = performance.now();
    callback();
    const renderTime = performance.now() - startTime;
    metrics.renderTime.push(renderTime);
  };
  
  return { metrics, measureLatency, measureRenderTime };
};
```

This comprehensive guide now provides complete coverage of the tag system, including detailed information about live signing functionality, real-time interactions, webhook integration, and all aspects of the system's operation. The guide serves as a complete reference for understanding, implementing, and maintaining the tag system in live signing environments.

## User Permission System

### Notaries
- **Can place all tag types**: Universal + Signer + Notary-specific
- **Can edit any tag**: Full control over all tags in the session
- **Can activate any user**: Switch between different user contexts
- **Can delete/modify tags**: Complete tag management capabilities
- **Auto-fill privileges**: All tags auto-fill from their profile data

### Signers
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Can only edit assigned tags**: Limited to tags assigned to them
- **Cannot place notary tags**: No access to N, X, O, E, W tags
- **Auto-fill privileges**: Tags auto-fill from their profile data

### Witnesses
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Same restrictions as signers**: Limited tag placement and editing
- **Cannot place notary tags**: No access to notary-specific tags

### Admins
- **Full system access**: Can place and edit all tag types
- **Same privileges as notaries**: Complete control over tagging system
- **Can manage all sessions**: Administrative oversight capabilities

## Tag Interaction Logic

### Tagging Mode vs Signing Mode

#### Tagging Mode
- **Purpose**: Document preparation before signing
- **User Actions**: Place tags, configure positions, assign users
- **Tag Behavior**: Static placeholders, no auto-completion
- **Permissions**: Notaries and admins can place all tags

#### Signing Mode
- **Purpose**: Live document completion during signing session
- **User Actions**: Fill tags, complete documents
- **Tag Behavior**: Interactive completion, auto-fill from profiles
- **Permissions**: Users can only interact with assigned tags

## Tags in Signing Sessions

### What Tags Do During Signing

Tags transform from static placeholders into interactive elements during signing sessions, serving as the primary interface for document completion:

#### Interactive Data Entry Points
- **Click to Complete**: Tags become clickable elements that trigger content insertion
- **Auto-Fill Behavior**: Most tags automatically populate with user profile data when clicked
- **Visual Feedback**: Tags change appearance to indicate completion status
- **Real-time Updates**: Completed tags immediately reflect changes across all participants

#### Document Completion Workflow
- **Sequential Processing**: Tags guide users through document completion in logical order
- **Validation Points**: Tags ensure required information is captured before proceeding
- **Progress Tracking**: Visual indicators show completion status of entire document
- **Quality Assurance**: Prevents missing critical information during signing

### Live Signing Session Architecture

#### Real-Time Communication System
**WebSocket Infrastructure**:
- **Connection Management**: Persistent WebSocket connections for all session participants
- **Room-Based Architecture**: Each signing session has dedicated WebSocket room
- **User Presence**: Real-time user online/offline status tracking
- **Connection Recovery**: Automatic reconnection with state restoration

**Message Types**:
```typescript
// Tag interaction messages
interface TagMessage {
  type: 'TAG_CLICKED' | 'TAG_COMPLETED' | 'TAG_EDITED' | 'TAG_DELETED';
  tagId: number;
  userId: number;
  sessionId: number;
  timestamp: Date;
  data?: any;
}

// User activity messages
interface UserActivityMessage {
  type: 'USER_JOINED' | 'USER_LEFT' | 'USER_ACTIVATED' | 'USER_DEACTIVATED';
  userId: number;
  sessionId: number;
  timestamp: Date;
}

// Session control messages
interface SessionControlMessage {
  type: 'SESSION_STARTED' | 'SESSION_PAUSED' | 'SESSION_COMPLETED' | 'SESSION_TERMINATED';
  sessionId: number;
  timestamp: Date;
  initiatedBy: number;
}
```

#### Webhook Integration System
**Webhook Endpoints**:
```typescript
// Tag completion webhook
POST /webhooks/tag-completed
{
  sessionId: number;
  tagId: number;
  userId: number;
  tagType: string;
  content: string;
  completedAt: Date;
  documentId: number;
}

// Session status webhook
POST /webhooks/session-status-changed
{
  sessionId: number;
  previousStatus: string;
  newStatus: string;
  changedBy: number;
  timestamp: Date;
}

// Document completion webhook
POST /webhooks/document-completed
{
  sessionId: number;
  documentId: number;
  completedBy: number;
  completedAt: Date;
  allTagsCompleted: boolean;
}
```

**Webhook Configuration**:
- **Retry Logic**: Automatic retry with exponential backoff for failed webhooks
- **Security**: HMAC signature verification for webhook authenticity
- **Rate Limiting**: Configurable rate limits to prevent abuse
- **Payload Validation**: Schema validation for all webhook payloads

### Live Signing Display Requirements

#### Real-Time Tag Visualization
**Tag State Synchronization**:
- **Live Updates**: Tags update in real-time across all participant screens
- **State Consistency**: All participants see identical tag states
- **Conflict Resolution**: Prevents simultaneous tag editing conflicts
- **Version Control**: Maintains tag state history for audit purposes

**Visual Indicators for Live Sessions**:
```typescript
interface LiveTagDisplay {
  // Tag completion status
  isCompleted: boolean;
  completedBy: number;
  completedAt: Date;
  
  // User assignment
  assignedUserId: number;
  assignedUserName: string;
  
  // Real-time activity
  isBeingEdited: boolean;
  editingBy: number;
  editingStartTime: Date;
  
  // Visual state
  visualState: 'incomplete' | 'completed' | 'editing' | 'error' | 'locked';
  userColor: string;
  completionIndicator: string;
}
```

#### User Activity Indicators
**Active User Display**:
- **User Avatars**: Show participant avatars with online status
- **Current Activity**: Display which user is currently active
- **Cursor Tracking**: Show other users' cursor positions (optional)
- **Activity Timeline**: Real-time feed of user actions

**Permission Visualization**:
- **Color Coding**: Each user's tags have distinct colors
- **Lock Indicators**: Show which tags are locked/unavailable
- **Permission Status**: Visual indication of user permissions
- **Assignment Display**: Clear indication of tag ownership

#### Progress Tracking Display
**Document Completion Progress**:
- **Progress Bar**: Visual progress indicator for entire document
- **Tag Count**: Show completed vs total tags
- **Page Progress**: Progress tracking per document page
- **Completion Time**: Estimated time to complete remaining tags

**Real-Time Statistics**:
```typescript
interface SessionProgress {
  totalTags: number;
  completedTags: number;
  remainingTags: number;
  completionPercentage: number;
  estimatedTimeRemaining: number;
  activeUsers: number;
  sessionDuration: number;
}
```

### Live Tag Interaction Workflow

#### Tag Activation Process
**User Activation Sequence**:
1. **Notary Control**: Notary activates specific users for tag interaction
2. **Permission Check**: System validates user permissions for tag types
3. **Visual Feedback**: UI updates to show active user and available tags
4. **Tag Highlighting**: User's assigned tags become highlighted
5. **Interaction Enablement**: User can now interact with assigned tags

**Activation States**:
```typescript
interface UserActivationState {
  userId: number;
  isActive: boolean;
  activatedBy: number;
  activatedAt: Date;
  allowedTagTypes: string[];
  currentTagId?: number;
  sessionPermissions: string[];
}
```

#### Tag Completion Workflow
**Step-by-Step Process**:
1. **Tag Selection**: User clicks on assigned tag
2. **Permission Validation**: System checks user permissions
3. **Content Generation**: Auto-fill or modal opens based on tag type
4. **Content Validation**: System validates entered content
5. **Real-Time Update**: Changes broadcast to all participants
6. **State Persistence**: Tag state saved to database
7. **Webhook Trigger**: Completion webhook sent to external systems
8. **Progress Update**: Document progress recalculated

**Completion Validation**:
```typescript
interface TagCompletionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields: string[];
  optionalFields: string[];
  validationRules: ValidationRule[];
}
```

#### Real-Time Collaboration Features
**Simultaneous User Support**:
- **User Queuing**: Multiple users can queue for tag completion
- **Turn Management**: System manages user turns for tag interaction
- **Conflict Prevention**: Prevents simultaneous editing of same tag
- **Activity Broadcasting**: All users see real-time activity

**Collaboration Indicators**:
- **User Cursors**: Optional display of other users' cursor positions
- **Activity Feed**: Real-time feed of user actions and tag completions
- **Chat Integration**: Built-in chat for user communication
- **Screen Sharing**: Optional screen sharing for guidance

### Webhook Implementation Details

#### Webhook Event Types
**Tag-Related Events**:
```typescript
// Tag placed
{
  event: 'TAG_PLACED',
  data: {
    tagId: number;
    tagType: string;
    position: { x: number; y: number };
    assignedUserId: number;
    placedBy: number;
    timestamp: Date;
  }
}

// Tag completed
{
  event: 'TAG_COMPLETED',
  data: {
    tagId: number;
    content: string;
    completedBy: number;
    completionTime: number;
    validationStatus: string;
    timestamp: Date;
  }
}

// Tag edited
{
  event: 'TAG_EDITED',
  data: {
    tagId: number;
    previousContent: string;
    newContent: string;
    editedBy: number;
    editReason: string;
    timestamp: Date;
  }
}
```

**Session-Related Events**:
```typescript
// Session started
{
  event: 'SESSION_STARTED',
  data: {
    sessionId: number;
    participants: User[];
    documents: Document[];
    startedBy: number;
    timestamp: Date;
  }
}

// User joined session
{
  event: 'USER_JOINED_SESSION',
  data: {
    sessionId: number;
    userId: number;
    userRole: string;
    joinTime: Date;
    timestamp: Date;
  }
}

// Session completed
{
  event: 'SESSION_COMPLETED',
  data: {
    sessionId: number;
    completionTime: number;
    totalTags: number;
    completedTags: number;
    participants: number[];
    timestamp: Date;
  }
}
```

#### Webhook Security and Reliability
**Security Measures**:
- **HMAC Signatures**: All webhooks signed with secret key
- **Payload Encryption**: Sensitive data encrypted in transit
- **IP Whitelisting**: Restrict webhook delivery to trusted IPs
- **Rate Limiting**: Prevent webhook abuse and spam

**Reliability Features**:
- **Retry Logic**: Automatic retry with exponential backoff
- **Dead Letter Queue**: Failed webhooks stored for manual processing
- **Delivery Confirmation**: Webhook delivery acknowledgment
- **Monitoring**: Real-time webhook delivery monitoring

### Live Signing UI Components

#### Tag Display Components
**Interactive Tag Component**:
```typescript
interface LiveTagProps {
  tag: Tag;
  isActive: boolean;
  currentUser: User;
  sessionState: SessionState;
  onTagClick: (tagId: number) => void;
  onTagComplete: (tagId: number, content: string) => void;
}

// Tag visual states during live signing
const tagVisualStates = {
  available: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    cursor: 'pointer',
    opacity: 1
  },
  completed: {
    borderColor: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    cursor: 'default',
    opacity: 0.8
  },
  editing: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    cursor: 'text',
    opacity: 1
  },
  locked: {
    borderColor: '#9ca3af',
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    cursor: 'not-allowed',
    opacity: 0.5
  }
};
```

#### User Activity Components
**Participant List Component**:
```typescript
interface ParticipantListProps {
  participants: User[];
  activeUser: number;
  currentUser: User;
  onUserActivate: (userId: number) => void;
  onUserDeactivate: (userId: number) => void;
}

// Participant status indicators
const participantStatus = {
  online: { color: '#059669', icon: '🟢' },
  active: { color: '#3b82f6', icon: '🔵' },
  editing: { color: '#f59e0b', icon: '🟡' },
  offline: { color: '#9ca3af', icon: '⚫' }
};
```

#### Progress Tracking Components
**Document Progress Component**:
```typescript
interface ProgressTrackerProps {
  totalTags: number;
  completedTags: number;
  currentPage: number;
  totalPages: number;
  estimatedTimeRemaining: number;
  onPageChange: (page: number) => void;
}

// Progress calculation
const calculateProgress = (completed: number, total: number) => {
  return {
    percentage: Math.round((completed / total) * 100),
    remaining: total - completed,
    estimatedTime: Math.round((total - completed) * 30) // 30 seconds per tag
  };
};
```

### Real-Time Data Synchronization

#### State Management
**Session State Structure**:
```typescript
interface LiveSessionState {
  sessionId: number;
  status: 'preparing' | 'active' | 'paused' | 'completed' | 'terminated';
  participants: User[];
  activeUser: number;
  currentPage: number;
  tags: Tag[];
  completedTags: number[];
  sessionStartTime: Date;
  lastActivityTime: Date;
  permissions: PermissionMap;
}
```

**Real-Time Updates**:
- **Optimistic Updates**: UI updates immediately for better UX
- **Server Confirmation**: Server confirms updates and resolves conflicts
- **State Reconciliation**: Automatic state synchronization across clients
- **Offline Support**: Queue updates when offline, sync when reconnected

#### Conflict Resolution
**Simultaneous Edit Handling**:
```typescript
interface ConflictResolution {
  type: 'TAG_EDIT_CONFLICT' | 'USER_ACTIVATION_CONFLICT' | 'PERMISSION_CONFLICT';
  conflictingUsers: number[];
  resolution: 'last-wins' | 'manual-resolution' | 'merge-content';
  resolvedBy: number;
  resolutionTime: Date;
}
```

**Conflict Prevention**:
- **Tag Locking**: Lock tags when user starts editing
- **User Queuing**: Queue users for tag interaction
- **Permission Enforcement**: Strict permission checking
- **Real-Time Validation**: Validate actions before execution

### Live Signing Performance Optimization

#### Real-Time Performance
**WebSocket Optimization**:
- **Message Batching**: Batch multiple updates in single message
- **Delta Updates**: Only send changed data
- **Compression**: Compress WebSocket messages
- **Connection Pooling**: Efficient connection management

**UI Performance**:
- **Virtual Scrolling**: Only render visible tags
- **Debounced Updates**: Debounce rapid UI updates
- **Memory Management**: Efficient memory usage for large sessions
- **Frame Rate Optimization**: Maintain 60fps for smooth interactions

#### Scalability Considerations
**Large Session Support**:
- **Tag Limits**: Configurable limits per session
- **User Limits**: Maximum participants per session
- **Document Limits**: Maximum documents per session
- **Time Limits**: Maximum session duration

**Load Balancing**:
- **Session Distribution**: Distribute sessions across servers
- **Geographic Distribution**: Route users to nearest servers
- **Auto-scaling**: Automatic scaling based on load
- **Failover**: Automatic failover for high availability

### Live Signing Security

#### Session Security
**Access Control**:
- **Session Authentication**: Verify user session access
- **Permission Validation**: Validate user permissions for each action
- **Session Isolation**: Isolate sessions from each other
- **Audit Logging**: Log all session activities

**Data Protection**:
- **Content Encryption**: Encrypt sensitive tag content
- **Transit Security**: Secure data transmission
- **Storage Security**: Secure data storage
- **Access Logging**: Log all data access

#### Compliance Features
**Legal Compliance**:
- **Notary Requirements**: Ensure compliance with notary laws
- **Document Integrity**: Maintain document authenticity
- **Audit Trail**: Complete audit trail for compliance
- **Record Keeping**: Maintain required records

**Privacy Protection**:
- **Data Minimization**: Only collect necessary data
- **User Consent**: Obtain user consent for data collection
- **Data Retention**: Implement data retention policies
- **Right to Deletion**: Support user data deletion requests

### Live Signing Monitoring and Analytics

#### Real-Time Monitoring
**Session Metrics**:
```typescript
interface SessionMetrics {
  activeSessions: number;
  totalParticipants: number;
  averageSessionDuration: number;
  tagCompletionRate: number;
  errorRate: number;
  systemPerformance: PerformanceMetrics;
}
```

**Performance Monitoring**:
- **Response Times**: Monitor API response times
- **WebSocket Latency**: Track real-time communication latency
- **Error Rates**: Monitor error frequencies
- **Resource Usage**: Track system resource consumption

#### Analytics and Reporting
**Usage Analytics**:
- **Session Patterns**: Analyze session usage patterns
- **User Behavior**: Track user interaction patterns
- **Performance Trends**: Monitor performance over time
- **Feature Adoption**: Track feature usage rates

**Compliance Reporting**:
- **Audit Reports**: Generate compliance audit reports
- **Activity Logs**: Export activity logs for review
- **Completion Reports**: Track document completion rates
- **Error Reports**: Monitor and report errors

### Live Signing Implementation Examples

#### WebSocket Event Handling
```typescript
// WebSocket connection setup
const setupWebSocket = (sessionId: number) => {
  const ws = new WebSocket(`wss://api.example.com/sessions/${sessionId}`);
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'TAG_COMPLETED':
        handleTagCompleted(message.data);
        break;
      case 'USER_ACTIVATED':
        handleUserActivated(message.data);
        break;
      case 'SESSION_STATUS_CHANGED':
        handleSessionStatusChanged(message.data);
        break;
    }
  };
  
  return ws;
};

// Tag completion handler
const handleTagCompleted = (data: TagCompletionData) => {
  // Update local tag state
  updateTagState(data.tagId, {
    isCompleted: true,
    completedBy: data.userId,
    completedAt: data.timestamp,
    content: data.content
  });
  
  // Update progress indicators
  updateProgressIndicators();
  
  // Trigger webhook if configured
  if (webhookConfig.enabled) {
    sendWebhook('TAG_COMPLETED', data);
  }
};
```

#### Real-Time UI Updates
```typescript
// React component for live tag display
const LiveTag: React.FC<LiveTagProps> = ({ tag, isActive, currentUser, sessionState }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(tag.content);
  
  const handleTagClick = async () => {
    if (!isActive || tag.isCompleted) return;
    
    // Check permissions
    if (!hasPermission(currentUser, tag)) {
      showError('You do not have permission to edit this tag');
      return;
    }
    
    // Start editing
    setIsEditing(true);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_EDITING_STARTED',
      tagId: tag.id,
      userId: currentUser.id
    });
  };
  
  const handleTagComplete = async () => {
    // Validate content
    if (!validateTagContent(tag.type, content)) {
      showError('Invalid content for this tag type');
      return;
    }
    
    // Complete tag
    await completeTag(tag.id, content);
    
    // Update local state
    setIsEditing(false);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_COMPLETED',
      tagId: tag.id,
      content: content,
      userId: currentUser.id
    });
  };
  
  return (
    <div 
      className={`live-tag ${getTagVisualState(tag, isActive, isEditing)}`}
      onClick={handleTagClick}
      style={{
        left: tag.xPosition,
        top: tag.yPosition,
        width: tag.width,
        height: tag.height,
        borderColor: getUserColor(tag.assignedUserId)
      }}
    >
      <div className="tag-icon">{getTagIcon(tag.type)}</div>
      <div className="tag-content">
        {isEditing ? (
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleTagComplete}
            autoFocus
          />
        ) : (
          <span>{tag.content || getPlaceholderText(tag.type)}</span>
        )}
      </div>
      <div className="tag-status">
        {tag.isCompleted && <span className="completion-check">✓</span>}
        {isEditing && <span className="editing-indicator">✏️</span>}
      </div>
    </div>
  );
};
```

#### Webhook Implementation
```typescript
// Webhook sender service
class WebhookService {
  private webhookQueue: WebhookMessage[] = [];
  private isProcessing = false;
  
  async sendWebhook(event: string, data: any) {
    const webhookMessage: WebhookMessage = {
      id: generateId(),
      event,
      data,
      timestamp: new Date(),
      retryCount: 0
    };
    
    this.webhookQueue.push(webhookMessage);
    await this.processQueue();
  }
  
  private async processQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.webhookQueue.length > 0) {
      const message = this.webhookQueue.shift();
      if (!message) continue;
      
      try {
        await this.deliverWebhook(message);
      } catch (error) {
        console.error('Webhook delivery failed:', error);
        
        // Retry logic
        if (message.retryCount < 3) {
          message.retryCount++;
          this.webhookQueue.push(message);
          
          // Exponential backoff
          await this.delay(Math.pow(2, message.retryCount) * 1000);
        } else {
          // Move to dead letter queue
          await this.moveToDeadLetterQueue(message);
        }
      }
    }
    
    this.isProcessing = false;
  }
  
  private async deliverWebhook(message: WebhookMessage) {
    const response = await fetch(webhookConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': this.generateSignature(message)
      },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status}`);
    }
  }
}
```

### Best Practices for Live Signing

#### Performance Best Practices
**WebSocket Optimization**:
- **Connection Management**: Implement proper connection lifecycle
- **Message Batching**: Batch multiple updates when possible
- **Compression**: Use compression for large payloads
- **Heartbeat**: Implement heartbeat to detect connection issues

**UI Performance**:
- **Virtual Rendering**: Only render visible tags
- **Debounced Updates**: Debounce rapid state updates
- **Memory Management**: Clean up unused resources
- **Error Boundaries**: Implement error boundaries for stability

#### Security Best Practices
**Authentication and Authorization**:
- **Session Validation**: Validate session tokens on every request
- **Permission Checking**: Check permissions for every action
- **Input Validation**: Validate all user inputs
- **Output Sanitization**: Sanitize all outputs

**Data Protection**:
- **Encryption**: Encrypt sensitive data at rest and in transit
- **Access Logging**: Log all data access for audit
- **Data Minimization**: Only collect necessary data
- **Secure Communication**: Use HTTPS and secure WebSocket connections

#### User Experience Best Practices
**Real-Time Feedback**:
- **Immediate Updates**: Provide immediate visual feedback
- **Progress Indicators**: Show progress for long operations
- **Error Handling**: Provide clear error messages
- **Loading States**: Show loading states for async operations

**Accessibility**:
- **Keyboard Navigation**: Support keyboard-only navigation
- **Screen Reader Support**: Provide proper ARIA labels
- **High Contrast**: Support high contrast mode
- **Focus Management**: Proper focus management for screen readers

### Troubleshooting Live Signing Issues

#### Common WebSocket Issues
**Connection Problems**:
- **Connection Drops**: Implement automatic reconnection
- **Latency Issues**: Use geographic distribution
- **Message Loss**: Implement message acknowledgment
- **Scalability**: Use load balancing for large sessions

**Performance Issues**:
- **Slow Updates**: Optimize message size and frequency
- **Memory Leaks**: Proper cleanup of event listeners
- **CPU Usage**: Optimize rendering and update logic
- **Network Usage**: Compress messages and batch updates

#### Debugging Tools
**WebSocket Debugging**:
```typescript
// WebSocket debug logger
const debugWebSocket = (ws: WebSocket, sessionId: number) => {
  const originalSend = ws.send;
  
  ws.send = function(data) {
    console.log(`[WS ${sessionId}] Sending:`, data);
    originalSend.call(this, data);
  };
  
  ws.addEventListener('message', (event) => {
    console.log(`[WS ${sessionId}] Received:`, event.data);
  });
  
  ws.addEventListener('error', (error) => {
    console.error(`[WS ${sessionId}] Error:`, error);
  });
  
  ws.addEventListener('close', (event) => {
    console.log(`[WS ${sessionId}] Closed:`, event.code, event.reason);
  });
};
```

**Performance Monitoring**:
```typescript
// Performance monitoring
const monitorPerformance = () => {
  const metrics = {
    messageLatency: [],
    renderTime: [],
    memoryUsage: [],
    errorRate: 0
  };
  
  // Monitor WebSocket latency
  const measureLatency = (startTime: number) => {
    const latency = Date.now() - startTime;
    metrics.messageLatency.push(latency);
    
    if (metrics.messageLatency.length > 100) {
      metrics.messageLatency.shift();
    }
  };
  
  // Monitor render performance
  const measureRenderTime = (callback: () => void) => {
    const startTime = performance.now();
    callback();
    const renderTime = performance.now() - startTime;
    metrics.renderTime.push(renderTime);
  };
  
  return { metrics, measureLatency, measureRenderTime };
};
```

This comprehensive guide now provides complete coverage of the tag system, including detailed information about live signing functionality, real-time interactions, webhook integration, and all aspects of the system's operation. The guide serves as a complete reference for understanding, implementing, and maintaining the tag system in live signing environments.

## User Permission System

### Notaries
- **Can place all tag types**: Universal + Signer + Notary-specific
- **Can edit any tag**: Full control over all tags in the session
- **Can activate any user**: Switch between different user contexts
- **Can delete/modify tags**: Complete tag management capabilities
- **Auto-fill privileges**: All tags auto-fill from their profile data

### Signers
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Can only edit assigned tags**: Limited to tags assigned to them
- **Cannot place notary tags**: No access to N, X, O, E, W tags
- **Auto-fill privileges**: Tags auto-fill from their profile data

### Witnesses
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Same restrictions as signers**: Limited tag placement and editing
- **Cannot place notary tags**: No access to notary-specific tags

### Admins
- **Full system access**: Can place and edit all tag types
- **Same privileges as notaries**: Complete control over tagging system
- **Can manage all sessions**: Administrative oversight capabilities

## Tag Interaction Logic

### Tagging Mode vs Signing Mode

#### Tagging Mode
- **Purpose**: Document preparation before signing
- **User Actions**: Place tags, configure positions, assign users
- **Tag Behavior**: Static placeholders, no auto-completion
- **Permissions**: Notaries and admins can place all tags

#### Signing Mode
- **Purpose**: Live document completion during signing session
- **User Actions**: Fill tags, complete documents
- **Tag Behavior**: Interactive completion, auto-fill from profiles
- **Permissions**: Users can only interact with assigned tags

## Tags in Signing Sessions

### What Tags Do During Signing

Tags transform from static placeholders into interactive elements during signing sessions, serving as the primary interface for document completion:

#### Interactive Data Entry Points
- **Click to Complete**: Tags become clickable elements that trigger content insertion
- **Auto-Fill Behavior**: Most tags automatically populate with user profile data when clicked
- **Visual Feedback**: Tags change appearance to indicate completion status
- **Real-time Updates**: Completed tags immediately reflect changes across all participants

#### Document Completion Workflow
- **Sequential Processing**: Tags guide users through document completion in logical order
- **Validation Points**: Tags ensure required information is captured before proceeding
- **Progress Tracking**: Visual indicators show completion status of entire document
- **Quality Assurance**: Prevents missing critical information during signing

### Live Signing Session Architecture

#### Real-Time Communication System
**WebSocket Infrastructure**:
- **Connection Management**: Persistent WebSocket connections for all session participants
- **Room-Based Architecture**: Each signing session has dedicated WebSocket room
- **User Presence**: Real-time user online/offline status tracking
- **Connection Recovery**: Automatic reconnection with state restoration

**Message Types**:
```typescript
// Tag interaction messages
interface TagMessage {
  type: 'TAG_CLICKED' | 'TAG_COMPLETED' | 'TAG_EDITED' | 'TAG_DELETED';
  tagId: number;
  userId: number;
  sessionId: number;
  timestamp: Date;
  data?: any;
}

// User activity messages
interface UserActivityMessage {
  type: 'USER_JOINED' | 'USER_LEFT' | 'USER_ACTIVATED' | 'USER_DEACTIVATED';
  userId: number;
  sessionId: number;
  timestamp: Date;
}

// Session control messages
interface SessionControlMessage {
  type: 'SESSION_STARTED' | 'SESSION_PAUSED' | 'SESSION_COMPLETED' | 'SESSION_TERMINATED';
  sessionId: number;
  timestamp: Date;
  initiatedBy: number;
}
```

#### Webhook Integration System
**Webhook Endpoints**:
```typescript
// Tag completion webhook
POST /webhooks/tag-completed
{
  sessionId: number;
  tagId: number;
  userId: number;
  tagType: string;
  content: string;
  completedAt: Date;
  documentId: number;
}

// Session status webhook
POST /webhooks/session-status-changed
{
  sessionId: number;
  previousStatus: string;
  newStatus: string;
  changedBy: number;
  timestamp: Date;
}

// Document completion webhook
POST /webhooks/document-completed
{
  sessionId: number;
  documentId: number;
  completedBy: number;
  completedAt: Date;
  allTagsCompleted: boolean;
}
```

**Webhook Configuration**:
- **Retry Logic**: Automatic retry with exponential backoff for failed webhooks
- **Security**: HMAC signature verification for webhook authenticity
- **Rate Limiting**: Configurable rate limits to prevent abuse
- **Payload Validation**: Schema validation for all webhook payloads

### Live Signing Display Requirements

#### Real-Time Tag Visualization
**Tag State Synchronization**:
- **Live Updates**: Tags update in real-time across all participant screens
- **State Consistency**: All participants see identical tag states
- **Conflict Resolution**: Prevents simultaneous tag editing conflicts
- **Version Control**: Maintains tag state history for audit purposes

**Visual Indicators for Live Sessions**:
```typescript
interface LiveTagDisplay {
  // Tag completion status
  isCompleted: boolean;
  completedBy: number;
  completedAt: Date;
  
  // User assignment
  assignedUserId: number;
  assignedUserName: string;
  
  // Real-time activity
  isBeingEdited: boolean;
  editingBy: number;
  editingStartTime: Date;
  
  // Visual state
  visualState: 'incomplete' | 'completed' | 'editing' | 'error' | 'locked';
  userColor: string;
  completionIndicator: string;
}
```

#### User Activity Indicators
**Active User Display**:
- **User Avatars**: Show participant avatars with online status
- **Current Activity**: Display which user is currently active
- **Cursor Tracking**: Show other users' cursor positions (optional)
- **Activity Timeline**: Real-time feed of user actions

**Permission Visualization**:
- **Color Coding**: Each user's tags have distinct colors
- **Lock Indicators**: Show which tags are locked/unavailable
- **Permission Status**: Visual indication of user permissions
- **Assignment Display**: Clear indication of tag ownership

#### Progress Tracking Display
**Document Completion Progress**:
- **Progress Bar**: Visual progress indicator for entire document
- **Tag Count**: Show completed vs total tags
- **Page Progress**: Progress tracking per document page
- **Completion Time**: Estimated time to complete remaining tags

**Real-Time Statistics**:
```typescript
interface SessionProgress {
  totalTags: number;
  completedTags: number;
  remainingTags: number;
  completionPercentage: number;
  estimatedTimeRemaining: number;
  activeUsers: number;
  sessionDuration: number;
}
```

### Live Tag Interaction Workflow

#### Tag Activation Process
**User Activation Sequence**:
1. **Notary Control**: Notary activates specific users for tag interaction
2. **Permission Check**: System validates user permissions for tag types
3. **Visual Feedback**: UI updates to show active user and available tags
4. **Tag Highlighting**: User's assigned tags become highlighted
5. **Interaction Enablement**: User can now interact with assigned tags

**Activation States**:
```typescript
interface UserActivationState {
  userId: number;
  isActive: boolean;
  activatedBy: number;
  activatedAt: Date;
  allowedTagTypes: string[];
  currentTagId?: number;
  sessionPermissions: string[];
}
```

#### Tag Completion Workflow
**Step-by-Step Process**:
1. **Tag Selection**: User clicks on assigned tag
2. **Permission Validation**: System checks user permissions
3. **Content Generation**: Auto-fill or modal opens based on tag type
4. **Content Validation**: System validates entered content
5. **Real-Time Update**: Changes broadcast to all participants
6. **State Persistence**: Tag state saved to database
7. **Webhook Trigger**: Completion webhook sent to external systems
8. **Progress Update**: Document progress recalculated

**Completion Validation**:
```typescript
interface TagCompletionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields: string[];
  optionalFields: string[];
  validationRules: ValidationRule[];
}
```

#### Real-Time Collaboration Features
**Simultaneous User Support**:
- **User Queuing**: Multiple users can queue for tag completion
- **Turn Management**: System manages user turns for tag interaction
- **Conflict Prevention**: Prevents simultaneous editing of same tag
- **Activity Broadcasting**: All users see real-time activity

**Collaboration Indicators**:
- **User Cursors**: Optional display of other users' cursor positions
- **Activity Feed**: Real-time feed of user actions and tag completions
- **Chat Integration**: Built-in chat for user communication
- **Screen Sharing**: Optional screen sharing for guidance

### Webhook Implementation Details

#### Webhook Event Types
**Tag-Related Events**:
```typescript
// Tag placed
{
  event: 'TAG_PLACED',
  data: {
    tagId: number;
    tagType: string;
    position: { x: number; y: number };
    assignedUserId: number;
    placedBy: number;
    timestamp: Date;
  }
}

// Tag completed
{
  event: 'TAG_COMPLETED',
  data: {
    tagId: number;
    content: string;
    completedBy: number;
    completionTime: number;
    validationStatus: string;
    timestamp: Date;
  }
}

// Tag edited
{
  event: 'TAG_EDITED',
  data: {
    tagId: number;
    previousContent: string;
    newContent: string;
    editedBy: number;
    editReason: string;
    timestamp: Date;
  }
}
```

**Session-Related Events**:
```typescript
// Session started
{
  event: 'SESSION_STARTED',
  data: {
    sessionId: number;
    participants: User[];
    documents: Document[];
    startedBy: number;
    timestamp: Date;
  }
}

// User joined session
{
  event: 'USER_JOINED_SESSION',
  data: {
    sessionId: number;
    userId: number;
    userRole: string;
    joinTime: Date;
    timestamp: Date;
  }
}

// Session completed
{
  event: 'SESSION_COMPLETED',
  data: {
    sessionId: number;
    completionTime: number;
    totalTags: number;
    completedTags: number;
    participants: number[];
    timestamp: Date;
  }
}
```

#### Webhook Security and Reliability
**Security Measures**:
- **HMAC Signatures**: All webhooks signed with secret key
- **Payload Encryption**: Sensitive data encrypted in transit
- **IP Whitelisting**: Restrict webhook delivery to trusted IPs
- **Rate Limiting**: Prevent webhook abuse and spam

**Reliability Features**:
- **Retry Logic**: Automatic retry with exponential backoff
- **Dead Letter Queue**: Failed webhooks stored for manual processing
- **Delivery Confirmation**: Webhook delivery acknowledgment
- **Monitoring**: Real-time webhook delivery monitoring

### Live Signing UI Components

#### Tag Display Components
**Interactive Tag Component**:
```typescript
interface LiveTagProps {
  tag: Tag;
  isActive: boolean;
  currentUser: User;
  sessionState: SessionState;
  onTagClick: (tagId: number) => void;
  onTagComplete: (tagId: number, content: string) => void;
}

// Tag visual states during live signing
const tagVisualStates = {
  available: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    cursor: 'pointer',
    opacity: 1
  },
  completed: {
    borderColor: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    cursor: 'default',
    opacity: 0.8
  },
  editing: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    cursor: 'text',
    opacity: 1
  },
  locked: {
    borderColor: '#9ca3af',
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    cursor: 'not-allowed',
    opacity: 0.5
  }
};
```

#### User Activity Components
**Participant List Component**:
```typescript
interface ParticipantListProps {
  participants: User[];
  activeUser: number;
  currentUser: User;
  onUserActivate: (userId: number) => void;
  onUserDeactivate: (userId: number) => void;
}

// Participant status indicators
const participantStatus = {
  online: { color: '#059669', icon: '🟢' },
  active: { color: '#3b82f6', icon: '🔵' },
  editing: { color: '#f59e0b', icon: '🟡' },
  offline: { color: '#9ca3af', icon: '⚫' }
};
```

#### Progress Tracking Components
**Document Progress Component**:
```typescript
interface ProgressTrackerProps {
  totalTags: number;
  completedTags: number;
  currentPage: number;
  totalPages: number;
  estimatedTimeRemaining: number;
  onPageChange: (page: number) => void;
}

// Progress calculation
const calculateProgress = (completed: number, total: number) => {
  return {
    percentage: Math.round((completed / total) * 100),
    remaining: total - completed,
    estimatedTime: Math.round((total - completed) * 30) // 30 seconds per tag
  };
};
```

### Real-Time Data Synchronization

#### State Management
**Session State Structure**:
```typescript
interface LiveSessionState {
  sessionId: number;
  status: 'preparing' | 'active' | 'paused' | 'completed' | 'terminated';
  participants: User[];
  activeUser: number;
  currentPage: number;
  tags: Tag[];
  completedTags: number[];
  sessionStartTime: Date;
  lastActivityTime: Date;
  permissions: PermissionMap;
}
```

**Real-Time Updates**:
- **Optimistic Updates**: UI updates immediately for better UX
- **Server Confirmation**: Server confirms updates and resolves conflicts
- **State Reconciliation**: Automatic state synchronization across clients
- **Offline Support**: Queue updates when offline, sync when reconnected

#### Conflict Resolution
**Simultaneous Edit Handling**:
```typescript
interface ConflictResolution {
  type: 'TAG_EDIT_CONFLICT' | 'USER_ACTIVATION_CONFLICT' | 'PERMISSION_CONFLICT';
  conflictingUsers: number[];
  resolution: 'last-wins' | 'manual-resolution' | 'merge-content';
  resolvedBy: number;
  resolutionTime: Date;
}
```

**Conflict Prevention**:
- **Tag Locking**: Lock tags when user starts editing
- **User Queuing**: Queue users for tag interaction
- **Permission Enforcement**: Strict permission checking
- **Real-Time Validation**: Validate actions before execution

### Live Signing Performance Optimization

#### Real-Time Performance
**WebSocket Optimization**:
- **Message Batching**: Batch multiple updates in single message
- **Delta Updates**: Only send changed data
- **Compression**: Compress WebSocket messages
- **Connection Pooling**: Efficient connection management

**UI Performance**:
- **Virtual Scrolling**: Only render visible tags
- **Debounced Updates**: Debounce rapid UI updates
- **Memory Management**: Efficient memory usage for large sessions
- **Frame Rate Optimization**: Maintain 60fps for smooth interactions

#### Scalability Considerations
**Large Session Support**:
- **Tag Limits**: Configurable limits per session
- **User Limits**: Maximum participants per session
- **Document Limits**: Maximum documents per session
- **Time Limits**: Maximum session duration

**Load Balancing**:
- **Session Distribution**: Distribute sessions across servers
- **Geographic Distribution**: Route users to nearest servers
- **Auto-scaling**: Automatic scaling based on load
- **Failover**: Automatic failover for high availability

### Live Signing Security

#### Session Security
**Access Control**:
- **Session Authentication**: Verify user session access
- **Permission Validation**: Validate user permissions for each action
- **Session Isolation**: Isolate sessions from each other
- **Audit Logging**: Log all session activities

**Data Protection**:
- **Content Encryption**: Encrypt sensitive tag content
- **Transit Security**: Secure data transmission
- **Storage Security**: Secure data storage
- **Access Logging**: Log all data access

#### Compliance Features
**Legal Compliance**:
- **Notary Requirements**: Ensure compliance with notary laws
- **Document Integrity**: Maintain document authenticity
- **Audit Trail**: Complete audit trail for compliance
- **Record Keeping**: Maintain required records

**Privacy Protection**:
- **Data Minimization**: Only collect necessary data
- **User Consent**: Obtain user consent for data collection
- **Data Retention**: Implement data retention policies
- **Right to Deletion**: Support user data deletion requests

### Live Signing Monitoring and Analytics

#### Real-Time Monitoring
**Session Metrics**:
```typescript
interface SessionMetrics {
  activeSessions: number;
  totalParticipants: number;
  averageSessionDuration: number;
  tagCompletionRate: number;
  errorRate: number;
  systemPerformance: PerformanceMetrics;
}
```

**Performance Monitoring**:
- **Response Times**: Monitor API response times
- **WebSocket Latency**: Track real-time communication latency
- **Error Rates**: Monitor error frequencies
- **Resource Usage**: Track system resource consumption

#### Analytics and Reporting
**Usage Analytics**:
- **Session Patterns**: Analyze session usage patterns
- **User Behavior**: Track user interaction patterns
- **Performance Trends**: Monitor performance over time
- **Feature Adoption**: Track feature usage rates

**Compliance Reporting**:
- **Audit Reports**: Generate compliance audit reports
- **Activity Logs**: Export activity logs for review
- **Completion Reports**: Track document completion rates
- **Error Reports**: Monitor and report errors

### Live Signing Implementation Examples

#### WebSocket Event Handling
```typescript
// WebSocket connection setup
const setupWebSocket = (sessionId: number) => {
  const ws = new WebSocket(`wss://api.example.com/sessions/${sessionId}`);
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'TAG_COMPLETED':
        handleTagCompleted(message.data);
        break;
      case 'USER_ACTIVATED':
        handleUserActivated(message.data);
        break;
      case 'SESSION_STATUS_CHANGED':
        handleSessionStatusChanged(message.data);
        break;
    }
  };
  
  return ws;
};

// Tag completion handler
const handleTagCompleted = (data: TagCompletionData) => {
  // Update local tag state
  updateTagState(data.tagId, {
    isCompleted: true,
    completedBy: data.userId,
    completedAt: data.timestamp,
    content: data.content
  });
  
  // Update progress indicators
  updateProgressIndicators();
  
  // Trigger webhook if configured
  if (webhookConfig.enabled) {
    sendWebhook('TAG_COMPLETED', data);
  }
};
```

#### Real-Time UI Updates
```typescript
// React component for live tag display
const LiveTag: React.FC<LiveTagProps> = ({ tag, isActive, currentUser, sessionState }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(tag.content);
  
  const handleTagClick = async () => {
    if (!isActive || tag.isCompleted) return;
    
    // Check permissions
    if (!hasPermission(currentUser, tag)) {
      showError('You do not have permission to edit this tag');
      return;
    }
    
    // Start editing
    setIsEditing(true);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_EDITING_STARTED',
      tagId: tag.id,
      userId: currentUser.id
    });
  };
  
  const handleTagComplete = async () => {
    // Validate content
    if (!validateTagContent(tag.type, content)) {
      showError('Invalid content for this tag type');
      return;
    }
    
    // Complete tag
    await completeTag(tag.id, content);
    
    // Update local state
    setIsEditing(false);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_COMPLETED',
      tagId: tag.id,
      content: content,
      userId: currentUser.id
    });
  };
  
  return (
    <div 
      className={`live-tag ${getTagVisualState(tag, isActive, isEditing)}`}
      onClick={handleTagClick}
      style={{
        left: tag.xPosition,
        top: tag.yPosition,
        width: tag.width,
        height: tag.height,
        borderColor: getUserColor(tag.assignedUserId)
      }}
    >
      <div className="tag-icon">{getTagIcon(tag.type)}</div>
      <div className="tag-content">
        {isEditing ? (
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleTagComplete}
            autoFocus
          />
        ) : (
          <span>{tag.content || getPlaceholderText(tag.type)}</span>
        )}
      </div>
      <div className="tag-status">
        {tag.isCompleted && <span className="completion-check">✓</span>}
        {isEditing && <span className="editing-indicator">✏️</span>}
      </div>
    </div>
  );
};
```

#### Webhook Implementation
```typescript
// Webhook sender service
class WebhookService {
  private webhookQueue: WebhookMessage[] = [];
  private isProcessing = false;
  
  async sendWebhook(event: string, data: any) {
    const webhookMessage: WebhookMessage = {
      id: generateId(),
      event,
      data,
      timestamp: new Date(),
      retryCount: 0
    };
    
    this.webhookQueue.push(webhookMessage);
    await this.processQueue();
  }
  
  private async processQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.webhookQueue.length > 0) {
      const message = this.webhookQueue.shift();
      if (!message) continue;
      
      try {
        await this.deliverWebhook(message);
      } catch (error) {
        console.error('Webhook delivery failed:', error);
        
        // Retry logic
        if (message.retryCount < 3) {
          message.retryCount++;
          this.webhookQueue.push(message);
          
          // Exponential backoff
          await this.delay(Math.pow(2, message.retryCount) * 1000);
        } else {
          // Move to dead letter queue
          await this.moveToDeadLetterQueue(message);
        }
      }
    }
    
    this.isProcessing = false;
  }
  
  private async deliverWebhook(message: WebhookMessage) {
    const response = await fetch(webhookConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': this.generateSignature(message)
      },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status}`);
    }
  }
}
```

### Best Practices for Live Signing

#### Performance Best Practices
**WebSocket Optimization**:
- **Connection Management**: Implement proper connection lifecycle
- **Message Batching**: Batch multiple updates when possible
- **Compression**: Use compression for large payloads
- **Heartbeat**: Implement heartbeat to detect connection issues

**UI Performance**:
- **Virtual Rendering**: Only render visible tags
- **Debounced Updates**: Debounce rapid state updates
- **Memory Management**: Clean up unused resources
- **Error Boundaries**: Implement error boundaries for stability

#### Security Best Practices
**Authentication and Authorization**:
- **Session Validation**: Validate session tokens on every request
- **Permission Checking**: Check permissions for every action
- **Input Validation**: Validate all user inputs
- **Output Sanitization**: Sanitize all outputs

**Data Protection**:
- **Encryption**: Encrypt sensitive data at rest and in transit
- **Access Logging**: Log all data access for audit
- **Data Minimization**: Only collect necessary data
- **Secure Communication**: Use HTTPS and secure WebSocket connections

#### User Experience Best Practices
**Real-Time Feedback**:
- **Immediate Updates**: Provide immediate visual feedback
- **Progress Indicators**: Show progress for long operations
- **Error Handling**: Provide clear error messages
- **Loading States**: Show loading states for async operations

**Accessibility**:
- **Keyboard Navigation**: Support keyboard-only navigation
- **Screen Reader Support**: Provide proper ARIA labels
- **High Contrast**: Support high contrast mode
- **Focus Management**: Proper focus management for screen readers

### Troubleshooting Live Signing Issues

#### Common WebSocket Issues
**Connection Problems**:
- **Connection Drops**: Implement automatic reconnection
- **Latency Issues**: Use geographic distribution
- **Message Loss**: Implement message acknowledgment
- **Scalability**: Use load balancing for large sessions

**Performance Issues**:
- **Slow Updates**: Optimize message size and frequency
- **Memory Leaks**: Proper cleanup of event listeners
- **CPU Usage**: Optimize rendering and update logic
- **Network Usage**: Compress messages and batch updates

#### Debugging Tools
**WebSocket Debugging**:
```typescript
// WebSocket debug logger
const debugWebSocket = (ws: WebSocket, sessionId: number) => {
  const originalSend = ws.send;
  
  ws.send = function(data) {
    console.log(`[WS ${sessionId}] Sending:`, data);
    originalSend.call(this, data);
  };
  
  ws.addEventListener('message', (event) => {
    console.log(`[WS ${sessionId}] Received:`, event.data);
  });
  
  ws.addEventListener('error', (error) => {
    console.error(`[WS ${sessionId}] Error:`, error);
  });
  
  ws.addEventListener('close', (event) => {
    console.log(`[WS ${sessionId}] Closed:`, event.code, event.reason);
  });
};
```

**Performance Monitoring**:
```typescript
// Performance monitoring
const monitorPerformance = () => {
  const metrics = {
    messageLatency: [],
    renderTime: [],
    memoryUsage: [],
    errorRate: 0
  };
  
  // Monitor WebSocket latency
  const measureLatency = (startTime: number) => {
    const latency = Date.now() - startTime;
    metrics.messageLatency.push(latency);
    
    if (metrics.messageLatency.length > 100) {
      metrics.messageLatency.shift();
    }
  };
  
  // Monitor render performance
  const measureRenderTime = (callback: () => void) => {
    const startTime = performance.now();
    callback();
    const renderTime = performance.now() - startTime;
    metrics.renderTime.push(renderTime);
  };
  
  return { metrics, measureLatency, measureRenderTime };
};
```

This comprehensive guide now provides complete coverage of the tag system, including detailed information about live signing functionality, real-time interactions, webhook integration, and all aspects of the system's operation. The guide serves as a complete reference for understanding, implementing, and maintaining the tag system in live signing environments.

## User Permission System

### Notaries
- **Can place all tag types**: Universal + Signer + Notary-specific
- **Can edit any tag**: Full control over all tags in the session
- **Can activate any user**: Switch between different user contexts
- **Can delete/modify tags**: Complete tag management capabilities
- **Auto-fill privileges**: All tags auto-fill from their profile data

### Signers
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Can only edit assigned tags**: Limited to tags assigned to them
- **Cannot place notary tags**: No access to N, X, O, E, W tags
- **Auto-fill privileges**: Tags auto-fill from their profile data

### Witnesses
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Same restrictions as signers**: Limited tag placement and editing
- **Cannot place notary tags**: No access to notary-specific tags

### Admins
- **Full system access**: Can place and edit all tag types
- **Same privileges as notaries**: Complete control over tagging system
- **Can manage all sessions**: Administrative oversight capabilities

## Tag Interaction Logic

### Tagging Mode vs Signing Mode

#### Tagging Mode
- **Purpose**: Document preparation before signing
- **User Actions**: Place tags, configure positions, assign users
- **Tag Behavior**: Static placeholders, no auto-completion
- **Permissions**: Notaries and admins can place all tags

#### Signing Mode
- **Purpose**: Live document completion during signing session
- **User Actions**: Fill tags, complete documents
- **Tag Behavior**: Interactive completion, auto-fill from profiles
- **Permissions**: Users can only interact with assigned tags

## Tags in Signing Sessions

### What Tags Do During Signing

Tags transform from static placeholders into interactive elements during signing sessions, serving as the primary interface for document completion:

#### Interactive Data Entry Points
- **Click to Complete**: Tags become clickable elements that trigger content insertion
- **Auto-Fill Behavior**: Most tags automatically populate with user profile data when clicked
- **Visual Feedback**: Tags change appearance to indicate completion status
- **Real-time Updates**: Completed tags immediately reflect changes across all participants

#### Document Completion Workflow
- **Sequential Processing**: Tags guide users through document completion in logical order
- **Validation Points**: Tags ensure required information is captured before proceeding
- **Progress Tracking**: Visual indicators show completion status of entire document
- **Quality Assurance**: Prevents missing critical information during signing

### Live Signing Session Architecture

#### Real-Time Communication System
**WebSocket Infrastructure**:
- **Connection Management**: Persistent WebSocket connections for all session participants
- **Room-Based Architecture**: Each signing session has dedicated WebSocket room
- **User Presence**: Real-time user online/offline status tracking
- **Connection Recovery**: Automatic reconnection with state restoration

**Message Types**:
```typescript
// Tag interaction messages
interface TagMessage {
  type: 'TAG_CLICKED' | 'TAG_COMPLETED' | 'TAG_EDITED' | 'TAG_DELETED';
  tagId: number;
  userId: number;
  sessionId: number;
  timestamp: Date;
  data?: any;
}

// User activity messages
interface UserActivityMessage {
  type: 'USER_JOINED' | 'USER_LEFT' | 'USER_ACTIVATED' | 'USER_DEACTIVATED';
  userId: number;
  sessionId: number;
  timestamp: Date;
}

// Session control messages
interface SessionControlMessage {
  type: 'SESSION_STARTED' | 'SESSION_PAUSED' | 'SESSION_COMPLETED' | 'SESSION_TERMINATED';
  sessionId: number;
  timestamp: Date;
  initiatedBy: number;
}
```

#### Webhook Integration System
**Webhook Endpoints**:
```typescript
// Tag completion webhook
POST /webhooks/tag-completed
{
  sessionId: number;
  tagId: number;
  userId: number;
  tagType: string;
  content: string;
  completedAt: Date;
  documentId: number;
}

// Session status webhook
POST /webhooks/session-status-changed
{
  sessionId: number;
  previousStatus: string;
  newStatus: string;
  changedBy: number;
  timestamp: Date;
}

// Document completion webhook
POST /webhooks/document-completed
{
  sessionId: number;
  documentId: number;
  completedBy: number;
  completedAt: Date;
  allTagsCompleted: boolean;
}
```

**Webhook Configuration**:
- **Retry Logic**: Automatic retry with exponential backoff for failed webhooks
- **Security**: HMAC signature verification for webhook authenticity
- **Rate Limiting**: Configurable rate limits to prevent abuse
- **Payload Validation**: Schema validation for all webhook payloads

### Live Signing Display Requirements

#### Real-Time Tag Visualization
**Tag State Synchronization**:
- **Live Updates**: Tags update in real-time across all participant screens
- **State Consistency**: All participants see identical tag states
- **Conflict Resolution**: Prevents simultaneous tag editing conflicts
- **Version Control**: Maintains tag state history for audit purposes

**Visual Indicators for Live Sessions**:
```typescript
interface LiveTagDisplay {
  // Tag completion status
  isCompleted: boolean;
  completedBy: number;
  completedAt: Date;
  
  // User assignment
  assignedUserId: number;
  assignedUserName: string;
  
  // Real-time activity
  isBeingEdited: boolean;
  editingBy: number;
  editingStartTime: Date;
  
  // Visual state
  visualState: 'incomplete' | 'completed' | 'editing' | 'error' | 'locked';
  userColor: string;
  completionIndicator: string;
}
```

#### User Activity Indicators
**Active User Display**:
- **User Avatars**: Show participant avatars with online status
- **Current Activity**: Display which user is currently active
- **Cursor Tracking**: Show other users' cursor positions (optional)
- **Activity Timeline**: Real-time feed of user actions

**Permission Visualization**:
- **Color Coding**: Each user's tags have distinct colors
- **Lock Indicators**: Show which tags are locked/unavailable
- **Permission Status**: Visual indication of user permissions
- **Assignment Display**: Clear indication of tag ownership

#### Progress Tracking Display
**Document Completion Progress**:
- **Progress Bar**: Visual progress indicator for entire document
- **Tag Count**: Show completed vs total tags
- **Page Progress**: Progress tracking per document page
- **Completion Time**: Estimated time to complete remaining tags

**Real-Time Statistics**:
```typescript
interface SessionProgress {
  totalTags: number;
  completedTags: number;
  remainingTags: number;
  completionPercentage: number;
  estimatedTimeRemaining: number;
  activeUsers: number;
  sessionDuration: number;
}
```

### Live Tag Interaction Workflow

#### Tag Activation Process
**User Activation Sequence**:
1. **Notary Control**: Notary activates specific users for tag interaction
2. **Permission Check**: System validates user permissions for tag types
3. **Visual Feedback**: UI updates to show active user and available tags
4. **Tag Highlighting**: User's assigned tags become highlighted
5. **Interaction Enablement**: User can now interact with assigned tags

**Activation States**:
```typescript
interface UserActivationState {
  userId: number;
  isActive: boolean;
  activatedBy: number;
  activatedAt: Date;
  allowedTagTypes: string[];
  currentTagId?: number;
  sessionPermissions: string[];
}
```

#### Tag Completion Workflow
**Step-by-Step Process**:
1. **Tag Selection**: User clicks on assigned tag
2. **Permission Validation**: System checks user permissions
3. **Content Generation**: Auto-fill or modal opens based on tag type
4. **Content Validation**: System validates entered content
5. **Real-Time Update**: Changes broadcast to all participants
6. **State Persistence**: Tag state saved to database
7. **Webhook Trigger**: Completion webhook sent to external systems
8. **Progress Update**: Document progress recalculated

**Completion Validation**:
```typescript
interface TagCompletionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields: string[];
  optionalFields: string[];
  validationRules: ValidationRule[];
}
```

#### Real-Time Collaboration Features
**Simultaneous User Support**:
- **User Queuing**: Multiple users can queue for tag completion
- **Turn Management**: System manages user turns for tag interaction
- **Conflict Prevention**: Prevents simultaneous editing of same tag
- **Activity Broadcasting**: All users see real-time activity

**Collaboration Indicators**:
- **User Cursors**: Optional display of other users' cursor positions
- **Activity Feed**: Real-time feed of user actions and tag completions
- **Chat Integration**: Built-in chat for user communication
- **Screen Sharing**: Optional screen sharing for guidance

### Webhook Implementation Details

#### Webhook Event Types
**Tag-Related Events**:
```typescript
// Tag placed
{
  event: 'TAG_PLACED',
  data: {
    tagId: number;
    tagType: string;
    position: { x: number; y: number };
    assignedUserId: number;
    placedBy: number;
    timestamp: Date;
  }
}

// Tag completed
{
  event: 'TAG_COMPLETED',
  data: {
    tagId: number;
    content: string;
    completedBy: number;
    completionTime: number;
    validationStatus: string;
    timestamp: Date;
  }
}

// Tag edited
{
  event: 'TAG_EDITED',
  data: {
    tagId: number;
    previousContent: string;
    newContent: string;
    editedBy: number;
    editReason: string;
    timestamp: Date;
  }
}
```

**Session-Related Events**:
```typescript
// Session started
{
  event: 'SESSION_STARTED',
  data: {
    sessionId: number;
    participants: User[];
    documents: Document[];
    startedBy: number;
    timestamp: Date;
  }
}

// User joined session
{
  event: 'USER_JOINED_SESSION',
  data: {
    sessionId: number;
    userId: number;
    userRole: string;
    joinTime: Date;
    timestamp: Date;
  }
}

// Session completed
{
  event: 'SESSION_COMPLETED',
  data: {
    sessionId: number;
    completionTime: number;
    totalTags: number;
    completedTags: number;
    participants: number[];
    timestamp: Date;
  }
}
```

#### Webhook Security and Reliability
**Security Measures**:
- **HMAC Signatures**: All webhooks signed with secret key
- **Payload Encryption**: Sensitive data encrypted in transit
- **IP Whitelisting**: Restrict webhook delivery to trusted IPs
- **Rate Limiting**: Prevent webhook abuse and spam

**Reliability Features**:
- **Retry Logic**: Automatic retry with exponential backoff
- **Dead Letter Queue**: Failed webhooks stored for manual processing
- **Delivery Confirmation**: Webhook delivery acknowledgment
- **Monitoring**: Real-time webhook delivery monitoring

### Live Signing UI Components

#### Tag Display Components
**Interactive Tag Component**:
```typescript
interface LiveTagProps {
  tag: Tag;
  isActive: boolean;
  currentUser: User;
  sessionState: SessionState;
  onTagClick: (tagId: number) => void;
  onTagComplete: (tagId: number, content: string) => void;
}

// Tag visual states during live signing
const tagVisualStates = {
  available: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    cursor: 'pointer',
    opacity: 1
  },
  completed: {
    borderColor: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    cursor: 'default',
    opacity: 0.8
  },
  editing: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    cursor: 'text',
    opacity: 1
  },
  locked: {
    borderColor: '#9ca3af',
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    cursor: 'not-allowed',
    opacity: 0.5
  }
};
```

#### User Activity Components
**Participant List Component**:
```typescript
interface ParticipantListProps {
  participants: User[];
  activeUser: number;
  currentUser: User;
  onUserActivate: (userId: number) => void;
  onUserDeactivate: (userId: number) => void;
}

// Participant status indicators
const participantStatus = {
  online: { color: '#059669', icon: '🟢' },
  active: { color: '#3b82f6', icon: '🔵' },
  editing: { color: '#f59e0b', icon: '🟡' },
  offline: { color: '#9ca3af', icon: '⚫' }
};
```

#### Progress Tracking Components
**Document Progress Component**:
```typescript
interface ProgressTrackerProps {
  totalTags: number;
  completedTags: number;
  currentPage: number;
  totalPages: number;
  estimatedTimeRemaining: number;
  onPageChange: (page: number) => void;
}

// Progress calculation
const calculateProgress = (completed: number, total: number) => {
  return {
    percentage: Math.round((completed / total) * 100),
    remaining: total - completed,
    estimatedTime: Math.round((total - completed) * 30) // 30 seconds per tag
  };
};
```

### Real-Time Data Synchronization

#### State Management
**Session State Structure**:
```typescript
interface LiveSessionState {
  sessionId: number;
  status: 'preparing' | 'active' | 'paused' | 'completed' | 'terminated';
  participants: User[];
  activeUser: number;
  currentPage: number;
  tags: Tag[];
  completedTags: number[];
  sessionStartTime: Date;
  lastActivityTime: Date;
  permissions: PermissionMap;
}
```

**Real-Time Updates**:
- **Optimistic Updates**: UI updates immediately for better UX
- **Server Confirmation**: Server confirms updates and resolves conflicts
- **State Reconciliation**: Automatic state synchronization across clients
- **Offline Support**: Queue updates when offline, sync when reconnected

#### Conflict Resolution
**Simultaneous Edit Handling**:
```typescript
interface ConflictResolution {
  type: 'TAG_EDIT_CONFLICT' | 'USER_ACTIVATION_CONFLICT' | 'PERMISSION_CONFLICT';
  conflictingUsers: number[];
  resolution: 'last-wins' | 'manual-resolution' | 'merge-content';
  resolvedBy: number;
  resolutionTime: Date;
}
```

**Conflict Prevention**:
- **Tag Locking**: Lock tags when user starts editing
- **User Queuing**: Queue users for tag interaction
- **Permission Enforcement**: Strict permission checking
- **Real-Time Validation**: Validate actions before execution

### Live Signing Performance Optimization

#### Real-Time Performance
**WebSocket Optimization**:
- **Message Batching**: Batch multiple updates in single message
- **Delta Updates**: Only send changed data
- **Compression**: Compress WebSocket messages
- **Connection Pooling**: Efficient connection management

**UI Performance**:
- **Virtual Scrolling**: Only render visible tags
- **Debounced Updates**: Debounce rapid UI updates
- **Memory Management**: Efficient memory usage for large sessions
- **Frame Rate Optimization**: Maintain 60fps for smooth interactions

#### Scalability Considerations
**Large Session Support**:
- **Tag Limits**: Configurable limits per session
- **User Limits**: Maximum participants per session
- **Document Limits**: Maximum documents per session
- **Time Limits**: Maximum session duration

**Load Balancing**:
- **Session Distribution**: Distribute sessions across servers
- **Geographic Distribution**: Route users to nearest servers
- **Auto-scaling**: Automatic scaling based on load
- **Failover**: Automatic failover for high availability

### Live Signing Security

#### Session Security
**Access Control**:
- **Session Authentication**: Verify user session access
- **Permission Validation**: Validate user permissions for each action
- **Session Isolation**: Isolate sessions from each other
- **Audit Logging**: Log all session activities

**Data Protection**:
- **Content Encryption**: Encrypt sensitive tag content
- **Transit Security**: Secure data transmission
- **Storage Security**: Secure data storage
- **Access Logging**: Log all data access

#### Compliance Features
**Legal Compliance**:
- **Notary Requirements**: Ensure compliance with notary laws
- **Document Integrity**: Maintain document authenticity
- **Audit Trail**: Complete audit trail for compliance
- **Record Keeping**: Maintain required records

**Privacy Protection**:
- **Data Minimization**: Only collect necessary data
- **User Consent**: Obtain user consent for data collection
- **Data Retention**: Implement data retention policies
- **Right to Deletion**: Support user data deletion requests

### Live Signing Monitoring and Analytics

#### Real-Time Monitoring
**Session Metrics**:
```typescript
interface SessionMetrics {
  activeSessions: number;
  totalParticipants: number;
  averageSessionDuration: number;
  tagCompletionRate: number;
  errorRate: number;
  systemPerformance: PerformanceMetrics;
}
```

**Performance Monitoring**:
- **Response Times**: Monitor API response times
- **WebSocket Latency**: Track real-time communication latency
- **Error Rates**: Monitor error frequencies
- **Resource Usage**: Track system resource consumption

#### Analytics and Reporting
**Usage Analytics**:
- **Session Patterns**: Analyze session usage patterns
- **User Behavior**: Track user interaction patterns
- **Performance Trends**: Monitor performance over time
- **Feature Adoption**: Track feature usage rates

**Compliance Reporting**:
- **Audit Reports**: Generate compliance audit reports
- **Activity Logs**: Export activity logs for review
- **Completion Reports**: Track document completion rates
- **Error Reports**: Monitor and report errors

### Live Signing Implementation Examples

#### WebSocket Event Handling
```typescript
// WebSocket connection setup
const setupWebSocket = (sessionId: number) => {
  const ws = new WebSocket(`wss://api.example.com/sessions/${sessionId}`);
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'TAG_COMPLETED':
        handleTagCompleted(message.data);
        break;
      case 'USER_ACTIVATED':
        handleUserActivated(message.data);
        break;
      case 'SESSION_STATUS_CHANGED':
        handleSessionStatusChanged(message.data);
        break;
    }
  };
  
  return ws;
};

// Tag completion handler
const handleTagCompleted = (data: TagCompletionData) => {
  // Update local tag state
  updateTagState(data.tagId, {
    isCompleted: true,
    completedBy: data.userId,
    completedAt: data.timestamp,
    content: data.content
  });
  
  // Update progress indicators
  updateProgressIndicators();
  
  // Trigger webhook if configured
  if (webhookConfig.enabled) {
    sendWebhook('TAG_COMPLETED', data);
  }
};
```

#### Real-Time UI Updates
```typescript
// React component for live tag display
const LiveTag: React.FC<LiveTagProps> = ({ tag, isActive, currentUser, sessionState }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(tag.content);
  
  const handleTagClick = async () => {
    if (!isActive || tag.isCompleted) return;
    
    // Check permissions
    if (!hasPermission(currentUser, tag)) {
      showError('You do not have permission to edit this tag');
      return;
    }
    
    // Start editing
    setIsEditing(true);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_EDITING_STARTED',
      tagId: tag.id,
      userId: currentUser.id
    });
  };
  
  const handleTagComplete = async () => {
    // Validate content
    if (!validateTagContent(tag.type, content)) {
      showError('Invalid content for this tag type');
      return;
    }
    
    // Complete tag
    await completeTag(tag.id, content);
    
    // Update local state
    setIsEditing(false);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_COMPLETED',
      tagId: tag.id,
      content: content,
      userId: currentUser.id
    });
  };
  
  return (
    <div 
      className={`live-tag ${getTagVisualState(tag, isActive, isEditing)}`}
      onClick={handleTagClick}
      style={{
        left: tag.xPosition,
        top: tag.yPosition,
        width: tag.width,
        height: tag.height,
        borderColor: getUserColor(tag.assignedUserId)
      }}
    >
      <div className="tag-icon">{getTagIcon(tag.type)}</div>
      <div className="tag-content">
        {isEditing ? (
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleTagComplete}
            autoFocus
          />
        ) : (
          <span>{tag.content || getPlaceholderText(tag.type)}</span>
        )}
      </div>
      <div className="tag-status">
        {tag.isCompleted && <span className="completion-check">✓</span>}
        {isEditing && <span className="editing-indicator">✏️</span>}
      </div>
    </div>
  );
};
```

#### Webhook Implementation
```typescript
// Webhook sender service
class WebhookService {
  private webhookQueue: WebhookMessage[] = [];
  private isProcessing = false;
  
  async sendWebhook(event: string, data: any) {
    const webhookMessage: WebhookMessage = {
      id: generateId(),
      event,
      data,
      timestamp: new Date(),
      retryCount: 0
    };
    
    this.webhookQueue.push(webhookMessage);
    await this.processQueue();
  }
  
  private async processQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.webhookQueue.length > 0) {
      const message = this.webhookQueue.shift();
      if (!message) continue;
      
      try {
        await this.deliverWebhook(message);
      } catch (error) {
        console.error('Webhook delivery failed:', error);
        
        // Retry logic
        if (message.retryCount < 3) {
          message.retryCount++;
          this.webhookQueue.push(message);
          
          // Exponential backoff
          await this.delay(Math.pow(2, message.retryCount) * 1000);
        } else {
          // Move to dead letter queue
          await this.moveToDeadLetterQueue(message);
        }
      }
    }
    
    this.isProcessing = false;
  }
  
  private async deliverWebhook(message: WebhookMessage) {
    const response = await fetch(webhookConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': this.generateSignature(message)
      },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status}`);
    }
  }
}
```

### Best Practices for Live Signing

#### Performance Best Practices
**WebSocket Optimization**:
- **Connection Management**: Implement proper connection lifecycle
- **Message Batching**: Batch multiple updates when possible
- **Compression**: Use compression for large payloads
- **Heartbeat**: Implement heartbeat to detect connection issues

**UI Performance**:
- **Virtual Rendering**: Only render visible tags
- **Debounced Updates**: Debounce rapid state updates
- **Memory Management**: Clean up unused resources
- **Error Boundaries**: Implement error boundaries for stability

#### Security Best Practices
**Authentication and Authorization**:
- **Session Validation**: Validate session tokens on every request
- **Permission Checking**: Check permissions for every action
- **Input Validation**: Validate all user inputs
- **Output Sanitization**: Sanitize all outputs

**Data Protection**:
- **Encryption**: Encrypt sensitive data at rest and in transit
- **Access Logging**: Log all data access for audit
- **Data Minimization**: Only collect necessary data
- **Secure Communication**: Use HTTPS and secure WebSocket connections

#### User Experience Best Practices
**Real-Time Feedback**:
- **Immediate Updates**: Provide immediate visual feedback
- **Progress Indicators**: Show progress for long operations
- **Error Handling**: Provide clear error messages
- **Loading States**: Show loading states for async operations

**Accessibility**:
- **Keyboard Navigation**: Support keyboard-only navigation
- **Screen Reader Support**: Provide proper ARIA labels
- **High Contrast**: Support high contrast mode
- **Focus Management**: Proper focus management for screen readers

### Troubleshooting Live Signing Issues

#### Common WebSocket Issues
**Connection Problems**:
- **Connection Drops**: Implement automatic reconnection
- **Latency Issues**: Use geographic distribution
- **Message Loss**: Implement message acknowledgment
- **Scalability**: Use load balancing for large sessions

**Performance Issues**:
- **Slow Updates**: Optimize message size and frequency
- **Memory Leaks**: Proper cleanup of event listeners
- **CPU Usage**: Optimize rendering and update logic
- **Network Usage**: Compress messages and batch updates

#### Debugging Tools
**WebSocket Debugging**:
```typescript
// WebSocket debug logger
const debugWebSocket = (ws: WebSocket, sessionId: number) => {
  const originalSend = ws.send;
  
  ws.send = function(data) {
    console.log(`[WS ${sessionId}] Sending:`, data);
    originalSend.call(this, data);
  };
  
  ws.addEventListener('message', (event) => {
    console.log(`[WS ${sessionId}] Received:`, event.data);
  });
  
  ws.addEventListener('error', (error) => {
    console.error(`[WS ${sessionId}] Error:`, error);
  });
  
  ws.addEventListener('close', (event) => {
    console.log(`[WS ${sessionId}] Closed:`, event.code, event.reason);
  });
};
```

**Performance Monitoring**:
```typescript
// Performance monitoring
const monitorPerformance = () => {
  const metrics = {
    messageLatency: [],
    renderTime: [],
    memoryUsage: [],
    errorRate: 0
  };
  
  // Monitor WebSocket latency
  const measureLatency = (startTime: number) => {
    const latency = Date.now() - startTime;
    metrics.messageLatency.push(latency);
    
    if (metrics.messageLatency.length > 100) {
      metrics.messageLatency.shift();
    }
  };
  
  // Monitor render performance
  const measureRenderTime = (callback: () => void) => {
    const startTime = performance.now();
    callback();
    const renderTime = performance.now() - startTime;
    metrics.renderTime.push(renderTime);
  };
  
  return { metrics, measureLatency, measureRenderTime };
};
```

This comprehensive guide now provides complete coverage of the tag system, including detailed information about live signing functionality, real-time interactions, webhook integration, and all aspects of the system's operation. The guide serves as a complete reference for understanding, implementing, and maintaining the tag system in live signing environments.

## User Permission System

### Notaries
- **Can place all tag types**: Universal + Signer + Notary-specific
- **Can edit any tag**: Full control over all tags in the session
- **Can activate any user**: Switch between different user contexts
- **Can delete/modify tags**: Complete tag management capabilities
- **Auto-fill privileges**: All tags auto-fill from their profile data

### Signers
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Can only edit assigned tags**: Limited to tags assigned to them
- **Cannot place notary tags**: No access to N, X, O, E, W tags
- **Auto-fill privileges**: Tags auto-fill from their profile data

### Witnesses
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Same restrictions as signers**: Limited tag placement and editing
- **Cannot place notary tags**: No access to notary-specific tags

### Admins
- **Full system access**: Can place and edit all tag types
- **Same privileges as notaries**: Complete control over tagging system
- **Can manage all sessions**: Administrative oversight capabilities

## Tag Interaction Logic

### Tagging Mode vs Signing Mode

#### Tagging Mode
- **Purpose**: Document preparation before signing
- **User Actions**: Place tags, configure positions, assign users
- **Tag Behavior**: Static placeholders, no auto-completion
- **Permissions**: Notaries and admins can place all tags

#### Signing Mode
- **Purpose**: Live document completion during signing session
- **User Actions**: Fill tags, complete documents
- **Tag Behavior**: Interactive completion, auto-fill from profiles
- **Permissions**: Users can only interact with assigned tags

## Tags in Signing Sessions

### What Tags Do During Signing

Tags transform from static placeholders into interactive elements during signing sessions, serving as the primary interface for document completion:

#### Interactive Data Entry Points
- **Click to Complete**: Tags become clickable elements that trigger content insertion
- **Auto-Fill Behavior**: Most tags automatically populate with user profile data when clicked
- **Visual Feedback**: Tags change appearance to indicate completion status
- **Real-time Updates**: Completed tags immediately reflect changes across all participants

#### Document Completion Workflow
- **Sequential Processing**: Tags guide users through document completion in logical order
- **Validation Points**: Tags ensure required information is captured before proceeding
- **Progress Tracking**: Visual indicators show completion status of entire document
- **Quality Assurance**: Prevents missing critical information during signing

### Live Signing Session Architecture

#### Real-Time Communication System
**WebSocket Infrastructure**:
- **Connection Management**: Persistent WebSocket connections for all session participants
- **Room-Based Architecture**: Each signing session has dedicated WebSocket room
- **User Presence**: Real-time user online/offline status tracking
- **Connection Recovery**: Automatic reconnection with state restoration

**Message Types**:
```typescript
// Tag interaction messages
interface TagMessage {
  type: 'TAG_CLICKED' | 'TAG_COMPLETED' | 'TAG_EDITED' | 'TAG_DELETED';
  tagId: number;
  userId: number;
  sessionId: number;
  timestamp: Date;
  data?: any;
}

// User activity messages
interface UserActivityMessage {
  type: 'USER_JOINED' | 'USER_LEFT' | 'USER_ACTIVATED' | 'USER_DEACTIVATED';
  userId: number;
  sessionId: number;
  timestamp: Date;
}

// Session control messages
interface SessionControlMessage {
  type: 'SESSION_STARTED' | 'SESSION_PAUSED' | 'SESSION_COMPLETED' | 'SESSION_TERMINATED';
  sessionId: number;
  timestamp: Date;
  initiatedBy: number;
}
```

#### Webhook Integration System
**Webhook Endpoints**:
```typescript
// Tag completion webhook
POST /webhooks/tag-completed
{
  sessionId: number;
  tagId: number;
  userId: number;
  tagType: string;
  content: string;
  completedAt: Date;
  documentId: number;
}

// Session status webhook
POST /webhooks/session-status-changed
{
  sessionId: number;
  previousStatus: string;
  newStatus: string;
  changedBy: number;
  timestamp: Date;
}

// Document completion webhook
POST /webhooks/document-completed
{
  sessionId: number;
  documentId: number;
  completedBy: number;
  completedAt: Date;
  allTagsCompleted: boolean;
}
```

**Webhook Configuration**:
- **Retry Logic**: Automatic retry with exponential backoff for failed webhooks
- **Security**: HMAC signature verification for webhook authenticity
- **Rate Limiting**: Configurable rate limits to prevent abuse
- **Payload Validation**: Schema validation for all webhook payloads

### Live Signing Display Requirements

#### Real-Time Tag Visualization
**Tag State Synchronization**:
- **Live Updates**: Tags update in real-time across all participant screens
- **State Consistency**: All participants see identical tag states
- **Conflict Resolution**: Prevents simultaneous tag editing conflicts
- **Version Control**: Maintains tag state history for audit purposes

**Visual Indicators for Live Sessions**:
```typescript
interface LiveTagDisplay {
  // Tag completion status
  isCompleted: boolean;
  completedBy: number;
  completedAt: Date;
  
  // User assignment
  assignedUserId: number;
  assignedUserName: string;
  
  // Real-time activity
  isBeingEdited: boolean;
  editingBy: number;
  editingStartTime: Date;
  
  // Visual state
  visualState: 'incomplete' | 'completed' | 'editing' | 'error' | 'locked';
  userColor: string;
  completionIndicator: string;
}
```

#### User Activity Indicators
**Active User Display**:
- **User Avatars**: Show participant avatars with online status
- **Current Activity**: Display which user is currently active
- **Cursor Tracking**: Show other users' cursor positions (optional)
- **Activity Timeline**: Real-time feed of user actions

**Permission Visualization**:
- **Color Coding**: Each user's tags have distinct colors
- **Lock Indicators**: Show which tags are locked/unavailable
- **Permission Status**: Visual indication of user permissions
- **Assignment Display**: Clear indication of tag ownership

#### Progress Tracking Display
**Document Completion Progress**:
- **Progress Bar**: Visual progress indicator for entire document
- **Tag Count**: Show completed vs total tags
- **Page Progress**: Progress tracking per document page
- **Completion Time**: Estimated time to complete remaining tags

**Real-Time Statistics**:
```typescript
interface SessionProgress {
  totalTags: number;
  completedTags: number;
  remainingTags: number;
  completionPercentage: number;
  estimatedTimeRemaining: number;
  activeUsers: number;
  sessionDuration: number;
}
```

### Live Tag Interaction Workflow

#### Tag Activation Process
**User Activation Sequence**:
1. **Notary Control**: Notary activates specific users for tag interaction
2. **Permission Check**: System validates user permissions for tag types
3. **Visual Feedback**: UI updates to show active user and available tags
4. **Tag Highlighting**: User's assigned tags become highlighted
5. **Interaction Enablement**: User can now interact with assigned tags

**Activation States**:
```typescript
interface UserActivationState {
  userId: number;
  isActive: boolean;
  activatedBy: number;
  activatedAt: Date;
  allowedTagTypes: string[];
  currentTagId?: number;
  sessionPermissions: string[];
}
```

#### Tag Completion Workflow
**Step-by-Step Process**:
1. **Tag Selection**: User clicks on assigned tag
2. **Permission Validation**: System checks user permissions
3. **Content Generation**: Auto-fill or modal opens based on tag type
4. **Content Validation**: System validates entered content
5. **Real-Time Update**: Changes broadcast to all participants
6. **State Persistence**: Tag state saved to database
7. **Webhook Trigger**: Completion webhook sent to external systems
8. **Progress Update**: Document progress recalculated

**Completion Validation**:
```typescript
interface TagCompletionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields: string[];
  optionalFields: string[];
  validationRules: ValidationRule[];
}
```

#### Real-Time Collaboration Features
**Simultaneous User Support**:
- **User Queuing**: Multiple users can queue for tag completion
- **Turn Management**: System manages user turns for tag interaction
- **Conflict Prevention**: Prevents simultaneous editing of same tag
- **Activity Broadcasting**: All users see real-time activity

**Collaboration Indicators**:
- **User Cursors**: Optional display of other users' cursor positions
- **Activity Feed**: Real-time feed of user actions and tag completions
- **Chat Integration**: Built-in chat for user communication
- **Screen Sharing**: Optional screen sharing for guidance

### Webhook Implementation Details

#### Webhook Event Types
**Tag-Related Events**:
```typescript
// Tag placed
{
  event: 'TAG_PLACED',
  data: {
    tagId: number;
    tagType: string;
    position: { x: number; y: number };
    assignedUserId: number;
    placedBy: number;
    timestamp: Date;
  }
}

// Tag completed
{
  event: 'TAG_COMPLETED',
  data: {
    tagId: number;
    content: string;
    completedBy: number;
    completionTime: number;
    validationStatus: string;
    timestamp: Date;
  }
}

// Tag edited
{
  event: 'TAG_EDITED',
  data: {
    tagId: number;
    previousContent: string;
    newContent: string;
    editedBy: number;
    editReason: string;
    timestamp: Date;
  }
}
```

**Session-Related Events**:
```typescript
// Session started
{
  event: 'SESSION_STARTED',
  data: {
    sessionId: number;
    participants: User[];
    documents: Document[];
    startedBy: number;
    timestamp: Date;
  }
}

// User joined session
{
  event: 'USER_JOINED_SESSION',
  data: {
    sessionId: number;
    userId: number;
    userRole: string;
    joinTime: Date;
    timestamp: Date;
  }
}

// Session completed
{
  event: 'SESSION_COMPLETED',
  data: {
    sessionId: number;
    completionTime: number;
    totalTags: number;
    completedTags: number;
    participants: number[];
    timestamp: Date;
  }
}
```

#### Webhook Security and Reliability
**Security Measures**:
- **HMAC Signatures**: All webhooks signed with secret key
- **Payload Encryption**: Sensitive data encrypted in transit
- **IP Whitelisting**: Restrict webhook delivery to trusted IPs
- **Rate Limiting**: Prevent webhook abuse and spam

**Reliability Features**:
- **Retry Logic**: Automatic retry with exponential backoff
- **Dead Letter Queue**: Failed webhooks stored for manual processing
- **Delivery Confirmation**: Webhook delivery acknowledgment
- **Monitoring**: Real-time webhook delivery monitoring

### Live Signing UI Components

#### Tag Display Components
**Interactive Tag Component**:
```typescript
interface LiveTagProps {
  tag: Tag;
  isActive: boolean;
  currentUser: User;
  sessionState: SessionState;
  onTagClick: (tagId: number) => void;
  onTagComplete: (tagId: number, content: string) => void;
}

// Tag visual states during live signing
const tagVisualStates = {
  available: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    cursor: 'pointer',
    opacity: 1
  },
  completed: {
    borderColor: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    cursor: 'default',
    opacity: 0.8
  },
  editing: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    cursor: 'text',
    opacity: 1
  },
  locked: {
    borderColor: '#9ca3af',
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    cursor: 'not-allowed',
    opacity: 0.5
  }
};
```

#### User Activity Components
**Participant List Component**:
```typescript
interface ParticipantListProps {
  participants: User[];
  activeUser: number;
  currentUser: User;
  onUserActivate: (userId: number) => void;
  onUserDeactivate: (userId: number) => void;
}

// Participant status indicators
const participantStatus = {
  online: { color: '#059669', icon: '🟢' },
  active: { color: '#3b82f6', icon: '🔵' },
  editing: { color: '#f59e0b', icon: '🟡' },
  offline: { color: '#9ca3af', icon: '⚫' }
};
```

#### Progress Tracking Components
**Document Progress Component**:
```typescript
interface ProgressTrackerProps {
  totalTags: number;
  completedTags: number;
  currentPage: number;
  totalPages: number;
  estimatedTimeRemaining: number;
  onPageChange: (page: number) => void;
}

// Progress calculation
const calculateProgress = (completed: number, total: number) => {
  return {
    percentage: Math.round((completed / total) * 100),
    remaining: total - completed,
    estimatedTime: Math.round((total - completed) * 30) // 30 seconds per tag
  };
};
```

### Real-Time Data Synchronization

#### State Management
**Session State Structure**:
```typescript
interface LiveSessionState {
  sessionId: number;
  status: 'preparing' | 'active' | 'paused' | 'completed' | 'terminated';
  participants: User[];
  activeUser: number;
  currentPage: number;
  tags: Tag[];
  completedTags: number[];
  sessionStartTime: Date;
  lastActivityTime: Date;
  permissions: PermissionMap;
}
```

**Real-Time Updates**:
- **Optimistic Updates**: UI updates immediately for better UX
- **Server Confirmation**: Server confirms updates and resolves conflicts
- **State Reconciliation**: Automatic state synchronization across clients
- **Offline Support**: Queue updates when offline, sync when reconnected

#### Conflict Resolution
**Simultaneous Edit Handling**:
```typescript
interface ConflictResolution {
  type: 'TAG_EDIT_CONFLICT' | 'USER_ACTIVATION_CONFLICT' | 'PERMISSION_CONFLICT';
  conflictingUsers: number[];
  resolution: 'last-wins' | 'manual-resolution' | 'merge-content';
  resolvedBy: number;
  resolutionTime: Date;
}
```

**Conflict Prevention**:
- **Tag Locking**: Lock tags when user starts editing
- **User Queuing**: Queue users for tag interaction
- **Permission Enforcement**: Strict permission checking
- **Real-Time Validation**: Validate actions before execution

### Live Signing Performance Optimization

#### Real-Time Performance
**WebSocket Optimization**:
- **Message Batching**: Batch multiple updates in single message
- **Delta Updates**: Only send changed data
- **Compression**: Compress WebSocket messages
- **Connection Pooling**: Efficient connection management

**UI Performance**:
- **Virtual Scrolling**: Only render visible tags
- **Debounced Updates**: Debounce rapid UI updates
- **Memory Management**: Efficient memory usage for large sessions
- **Frame Rate Optimization**: Maintain 60fps for smooth interactions

#### Scalability Considerations
**Large Session Support**:
- **Tag Limits**: Configurable limits per session
- **User Limits**: Maximum participants per session
- **Document Limits**: Maximum documents per session
- **Time Limits**: Maximum session duration

**Load Balancing**:
- **Session Distribution**: Distribute sessions across servers
- **Geographic Distribution**: Route users to nearest servers
- **Auto-scaling**: Automatic scaling based on load
- **Failover**: Automatic failover for high availability

### Live Signing Security

#### Session Security
**Access Control**:
- **Session Authentication**: Verify user session access
- **Permission Validation**: Validate user permissions for each action
- **Session Isolation**: Isolate sessions from each other
- **Audit Logging**: Log all session activities

**Data Protection**:
- **Content Encryption**: Encrypt sensitive tag content
- **Transit Security**: Secure data transmission
- **Storage Security**: Secure data storage
- **Access Logging**: Log all data access

#### Compliance Features
**Legal Compliance**:
- **Notary Requirements**: Ensure compliance with notary laws
- **Document Integrity**: Maintain document authenticity
- **Audit Trail**: Complete audit trail for compliance
- **Record Keeping**: Maintain required records

**Privacy Protection**:
- **Data Minimization**: Only collect necessary data
- **User Consent**: Obtain user consent for data collection
- **Data Retention**: Implement data retention policies
- **Right to Deletion**: Support user data deletion requests

### Live Signing Monitoring and Analytics

#### Real-Time Monitoring
**Session Metrics**:
```typescript
interface SessionMetrics {
  activeSessions: number;
  totalParticipants: number;
  averageSessionDuration: number;
  tagCompletionRate: number;
  errorRate: number;
  systemPerformance: PerformanceMetrics;
}
```

**Performance Monitoring**:
- **Response Times**: Monitor API response times
- **WebSocket Latency**: Track real-time communication latency
- **Error Rates**: Monitor error frequencies
- **Resource Usage**: Track system resource consumption

#### Analytics and Reporting
**Usage Analytics**:
- **Session Patterns**: Analyze session usage patterns
- **User Behavior**: Track user interaction patterns
- **Performance Trends**: Monitor performance over time
- **Feature Adoption**: Track feature usage rates

**Compliance Reporting**:
- **Audit Reports**: Generate compliance audit reports
- **Activity Logs**: Export activity logs for review
- **Completion Reports**: Track document completion rates
- **Error Reports**: Monitor and report errors

### Live Signing Implementation Examples

#### WebSocket Event Handling
```typescript
// WebSocket connection setup
const setupWebSocket = (sessionId: number) => {
  const ws = new WebSocket(`wss://api.example.com/sessions/${sessionId}`);
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'TAG_COMPLETED':
        handleTagCompleted(message.data);
        break;
      case 'USER_ACTIVATED':
        handleUserActivated(message.data);
        break;
      case 'SESSION_STATUS_CHANGED':
        handleSessionStatusChanged(message.data);
        break;
    }
  };
  
  return ws;
};

// Tag completion handler
const handleTagCompleted = (data: TagCompletionData) => {
  // Update local tag state
  updateTagState(data.tagId, {
    isCompleted: true,
    completedBy: data.userId,
    completedAt: data.timestamp,
    content: data.content
  });
  
  // Update progress indicators
  updateProgressIndicators();
  
  // Trigger webhook if configured
  if (webhookConfig.enabled) {
    sendWebhook('TAG_COMPLETED', data);
  }
};
```

#### Real-Time UI Updates
```typescript
// React component for live tag display
const LiveTag: React.FC<LiveTagProps> = ({ tag, isActive, currentUser, sessionState }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(tag.content);
  
  const handleTagClick = async () => {
    if (!isActive || tag.isCompleted) return;
    
    // Check permissions
    if (!hasPermission(currentUser, tag)) {
      showError('You do not have permission to edit this tag');
      return;
    }
    
    // Start editing
    setIsEditing(true);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_EDITING_STARTED',
      tagId: tag.id,
      userId: currentUser.id
    });
  };
  
  const handleTagComplete = async () => {
    // Validate content
    if (!validateTagContent(tag.type, content)) {
      showError('Invalid content for this tag type');
      return;
    }
    
    // Complete tag
    await completeTag(tag.id, content);
    
    // Update local state
    setIsEditing(false);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_COMPLETED',
      tagId: tag.id,
      content: content,
      userId: currentUser.id
    });
  };
  
  return (
    <div 
      className={`live-tag ${getTagVisualState(tag, isActive, isEditing)}`}
      onClick={handleTagClick}
      style={{
        left: tag.xPosition,
        top: tag.yPosition,
        width: tag.width,
        height: tag.height,
        borderColor: getUserColor(tag.assignedUserId)
      }}
    >
      <div className="tag-icon">{getTagIcon(tag.type)}</div>
      <div className="tag-content">
        {isEditing ? (
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleTagComplete}
            autoFocus
          />
        ) : (
          <span>{tag.content || getPlaceholderText(tag.type)}</span>
        )}
      </div>
      <div className="tag-status">
        {tag.isCompleted && <span className="completion-check">✓</span>}
        {isEditing && <span className="editing-indicator">✏️</span>}
      </div>
    </div>
  );
};
```

#### Webhook Implementation
```typescript
// Webhook sender service
class WebhookService {
  private webhookQueue: WebhookMessage[] = [];
  private isProcessing = false;
  
  async sendWebhook(event: string, data: any) {
    const webhookMessage: WebhookMessage = {
      id: generateId(),
      event,
      data,
      timestamp: new Date(),
      retryCount: 0
    };
    
    this.webhookQueue.push(webhookMessage);
    await this.processQueue();
  }
  
  private async processQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.webhookQueue.length > 0) {
      const message = this.webhookQueue.shift();
      if (!message) continue;
      
      try {
        await this.deliverWebhook(message);
      } catch (error) {
        console.error('Webhook delivery failed:', error);
        
        // Retry logic
        if (message.retryCount < 3) {
          message.retryCount++;
          this.webhookQueue.push(message);
          
          // Exponential backoff
          await this.delay(Math.pow(2, message.retryCount) * 1000);
        } else {
          // Move to dead letter queue
          await this.moveToDeadLetterQueue(message);
        }
      }
    }
    
    this.isProcessing = false;
  }
  
  private async deliverWebhook(message: WebhookMessage) {
    const response = await fetch(webhookConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': this.generateSignature(message)
      },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status}`);
    }
  }
}
```

### Best Practices for Live Signing

#### Performance Best Practices
**WebSocket Optimization**:
- **Connection Management**: Implement proper connection lifecycle
- **Message Batching**: Batch multiple updates when possible
- **Compression**: Use compression for large payloads
- **Heartbeat**: Implement heartbeat to detect connection issues

**UI Performance**:
- **Virtual Rendering**: Only render visible tags
- **Debounced Updates**: Debounce rapid state updates
- **Memory Management**: Clean up unused resources
- **Error Boundaries**: Implement error boundaries for stability

#### Security Best Practices
**Authentication and Authorization**:
- **Session Validation**: Validate session tokens on every request
- **Permission Checking**: Check permissions for every action
- **Input Validation**: Validate all user inputs
- **Output Sanitization**: Sanitize all outputs

**Data Protection**:
- **Encryption**: Encrypt sensitive data at rest and in transit
- **Access Logging**: Log all data access for audit
- **Data Minimization**: Only collect necessary data
- **Secure Communication**: Use HTTPS and secure WebSocket connections

#### User Experience Best Practices
**Real-Time Feedback**:
- **Immediate Updates**: Provide immediate visual feedback
- **Progress Indicators**: Show progress for long operations
- **Error Handling**: Provide clear error messages
- **Loading States**: Show loading states for async operations

**Accessibility**:
- **Keyboard Navigation**: Support keyboard-only navigation
- **Screen Reader Support**: Provide proper ARIA labels
- **High Contrast**: Support high contrast mode
- **Focus Management**: Proper focus management for screen readers

### Troubleshooting Live Signing Issues

#### Common WebSocket Issues
**Connection Problems**:
- **Connection Drops**: Implement automatic reconnection
- **Latency Issues**: Use geographic distribution
- **Message Loss**: Implement message acknowledgment
- **Scalability**: Use load balancing for large sessions

**Performance Issues**:
- **Slow Updates**: Optimize message size and frequency
- **Memory Leaks**: Proper cleanup of event listeners
- **CPU Usage**: Optimize rendering and update logic
- **Network Usage**: Compress messages and batch updates

#### Debugging Tools
**WebSocket Debugging**:
```typescript
// WebSocket debug logger
const debugWebSocket = (ws: WebSocket, sessionId: number) => {
  const originalSend = ws.send;
  
  ws.send = function(data) {
    console.log(`[WS ${sessionId}] Sending:`, data);
    originalSend.call(this, data);
  };
  
  ws.addEventListener('message', (event) => {
    console.log(`[WS ${sessionId}] Received:`, event.data);
  });
  
  ws.addEventListener('error', (error) => {
    console.error(`[WS ${sessionId}] Error:`, error);
  });
  
  ws.addEventListener('close', (event) => {
    console.log(`[WS ${sessionId}] Closed:`, event.code, event.reason);
  });
};
```

**Performance Monitoring**:
```typescript
// Performance monitoring
const monitorPerformance = () => {
  const metrics = {
    messageLatency: [],
    renderTime: [],
    memoryUsage: [],
    errorRate: 0
  };
  
  // Monitor WebSocket latency
  const measureLatency = (startTime: number) => {
    const latency = Date.now() - startTime;
    metrics.messageLatency.push(latency);
    
    if (metrics.messageLatency.length > 100) {
      metrics.messageLatency.shift();
    }
  };
  
  // Monitor render performance
  const measureRenderTime = (callback: () => void) => {
    const startTime = performance.now();
    callback();
    const renderTime = performance.now() - startTime;
    metrics.renderTime.push(renderTime);
  };
  
  return { metrics, measureLatency, measureRenderTime };
};
```

This comprehensive guide now provides complete coverage of the tag system, including detailed information about live signing functionality, real-time interactions, webhook integration, and all aspects of the system's operation. The guide serves as a complete reference for understanding, implementing, and maintaining the tag system in live signing environments.

## User Permission System

### Notaries
- **Can place all tag types**: Universal + Signer + Notary-specific
- **Can edit any tag**: Full control over all tags in the session
- **Can activate any user**: Switch between different user contexts
- **Can delete/modify tags**: Complete tag management capabilities
- **Auto-fill privileges**: All tags auto-fill from their profile data

### Signers
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Can only edit assigned tags**: Limited to tags assigned to them
- **Cannot place notary tags**: No access to N, X, O, E, W tags
- **Auto-fill privileges**: Tags auto-fill from their profile data

### Witnesses
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Same restrictions as signers**: Limited tag placement and editing
- **Cannot place notary tags**: No access to notary-specific tags

### Admins
- **Full system access**: Can place and edit all tag types
- **Same privileges as notaries**: Complete control over tagging system
- **Can manage all sessions**: Administrative oversight capabilities

## Tag Interaction Logic

### Tagging Mode vs Signing Mode

#### Tagging Mode
- **Purpose**: Document preparation before signing
- **User Actions**: Place tags, configure positions, assign users
- **Tag Behavior**: Static placeholders, no auto-completion
- **Permissions**: Notaries and admins can place all tags

#### Signing Mode
- **Purpose**: Live document completion during signing session
- **User Actions**: Fill tags, complete documents
- **Tag Behavior**: Interactive completion, auto-fill from profiles
- **Permissions**: Users can only interact with assigned tags

## Tags in Signing Sessions

### What Tags Do During Signing

Tags transform from static placeholders into interactive elements during signing sessions, serving as the primary interface for document completion:

#### Interactive Data Entry Points
- **Click to Complete**: Tags become clickable elements that trigger content insertion
- **Auto-Fill Behavior**: Most tags automatically populate with user profile data when clicked
- **Visual Feedback**: Tags change appearance to indicate completion status
- **Real-time Updates**: Completed tags immediately reflect changes across all participants

#### Document Completion Workflow
- **Sequential Processing**: Tags guide users through document completion in logical order
- **Validation Points**: Tags ensure required information is captured before proceeding
- **Progress Tracking**: Visual indicators show completion status of entire document
- **Quality Assurance**: Prevents missing critical information during signing

### Live Signing Session Architecture

#### Real-Time Communication System
**WebSocket Infrastructure**:
- **Connection Management**: Persistent WebSocket connections for all session participants
- **Room-Based Architecture**: Each signing session has dedicated WebSocket room
- **User Presence**: Real-time user online/offline status tracking
- **Connection Recovery**: Automatic reconnection with state restoration

**Message Types**:
```typescript
// Tag interaction messages
interface TagMessage {
  type: 'TAG_CLICKED' | 'TAG_COMPLETED' | 'TAG_EDITED' | 'TAG_DELETED';
  tagId: number;
  userId: number;
  sessionId: number;
  timestamp: Date;
  data?: any;
}

// User activity messages
interface UserActivityMessage {
  type: 'USER_JOINED' | 'USER_LEFT' | 'USER_ACTIVATED' | 'USER_DEACTIVATED';
  userId: number;
  sessionId: number;
  timestamp: Date;
}

// Session control messages
interface SessionControlMessage {
  type: 'SESSION_STARTED' | 'SESSION_PAUSED' | 'SESSION_COMPLETED' | 'SESSION_TERMINATED';
  sessionId: number;
  timestamp: Date;
  initiatedBy: number;
}
```

#### Webhook Integration System
**Webhook Endpoints**:
```typescript
// Tag completion webhook
POST /webhooks/tag-completed
{
  sessionId: number;
  tagId: number;
  userId: number;
  tagType: string;
  content: string;
  completedAt: Date;
  documentId: number;
}

// Session status webhook
POST /webhooks/session-status-changed
{
  sessionId: number;
  previousStatus: string;
  newStatus: string;
  changedBy: number;
  timestamp: Date;
}

// Document completion webhook
POST /webhooks/document-completed
{
  sessionId: number;
  documentId: number;
  completedBy: number;
  completedAt: Date;
  allTagsCompleted: boolean;
}
```

**Webhook Configuration**:
- **Retry Logic**: Automatic retry with exponential backoff for failed webhooks
- **Security**: HMAC signature verification for webhook authenticity
- **Rate Limiting**: Configurable rate limits to prevent abuse
- **Payload Validation**: Schema validation for all webhook payloads

### Live Signing Display Requirements

#### Real-Time Tag Visualization
**Tag State Synchronization**:
- **Live Updates**: Tags update in real-time across all participant screens
- **State Consistency**: All participants see identical tag states
- **Conflict Resolution**: Prevents simultaneous tag editing conflicts
- **Version Control**: Maintains tag state history for audit purposes

**Visual Indicators for Live Sessions**:
```typescript
interface LiveTagDisplay {
  // Tag completion status
  isCompleted: boolean;
  completedBy: number;
  completedAt: Date;
  
  // User assignment
  assignedUserId: number;
  assignedUserName: string;
  
  // Real-time activity
  isBeingEdited: boolean;
  editingBy: number;
  editingStartTime: Date;
  
  // Visual state
  visualState: 'incomplete' | 'completed' | 'editing' | 'error' | 'locked';
  userColor: string;
  completionIndicator: string;
}
```

#### User Activity Indicators
**Active User Display**:
- **User Avatars**: Show participant avatars with online status
- **Current Activity**: Display which user is currently active
- **Cursor Tracking**: Show other users' cursor positions (optional)
- **Activity Timeline**: Real-time feed of user actions

**Permission Visualization**:
- **Color Coding**: Each user's tags have distinct colors
- **Lock Indicators**: Show which tags are locked/unavailable
- **Permission Status**: Visual indication of user permissions
- **Assignment Display**: Clear indication of tag ownership

#### Progress Tracking Display
**Document Completion Progress**:
- **Progress Bar**: Visual progress indicator for entire document
- **Tag Count**: Show completed vs total tags
- **Page Progress**: Progress tracking per document page
- **Completion Time**: Estimated time to complete remaining tags

**Real-Time Statistics**:
```typescript
interface SessionProgress {
  totalTags: number;
  completedTags: number;
  remainingTags: number;
  completionPercentage: number;
  estimatedTimeRemaining: number;
  activeUsers: number;
  sessionDuration: number;
}
```

### Live Tag Interaction Workflow

#### Tag Activation Process
**User Activation Sequence**:
1. **Notary Control**: Notary activates specific users for tag interaction
2. **Permission Check**: System validates user permissions for tag types
3. **Visual Feedback**: UI updates to show active user and available tags
4. **Tag Highlighting**: User's assigned tags become highlighted
5. **Interaction Enablement**: User can now interact with assigned tags

**Activation States**:
```typescript
interface UserActivationState {
  userId: number;
  isActive: boolean;
  activatedBy: number;
  activatedAt: Date;
  allowedTagTypes: string[];
  currentTagId?: number;
  sessionPermissions: string[];
}
```

#### Tag Completion Workflow
**Step-by-Step Process**:
1. **Tag Selection**: User clicks on assigned tag
2. **Permission Validation**: System checks user permissions
3. **Content Generation**: Auto-fill or modal opens based on tag type
4. **Content Validation**: System validates entered content
5. **Real-Time Update**: Changes broadcast to all participants
6. **State Persistence**: Tag state saved to database
7. **Webhook Trigger**: Completion webhook sent to external systems
8. **Progress Update**: Document progress recalculated

**Completion Validation**:
```typescript
interface TagCompletionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields: string[];
  optionalFields: string[];
  validationRules: ValidationRule[];
}
```

#### Real-Time Collaboration Features
**Simultaneous User Support**:
- **User Queuing**: Multiple users can queue for tag completion
- **Turn Management**: System manages user turns for tag interaction
- **Conflict Prevention**: Prevents simultaneous editing of same tag
- **Activity Broadcasting**: All users see real-time activity

**Collaboration Indicators**:
- **User Cursors**: Optional display of other users' cursor positions
- **Activity Feed**: Real-time feed of user actions and tag completions
- **Chat Integration**: Built-in chat for user communication
- **Screen Sharing**: Optional screen sharing for guidance

### Webhook Implementation Details

#### Webhook Event Types
**Tag-Related Events**:
```typescript
// Tag placed
{
  event: 'TAG_PLACED',
  data: {
    tagId: number;
    tagType: string;
    position: { x: number; y: number };
    assignedUserId: number;
    placedBy: number;
    timestamp: Date;
  }
}

// Tag completed
{
  event: 'TAG_COMPLETED',
  data: {
    tagId: number;
    content: string;
    completedBy: number;
    completionTime: number;
    validationStatus: string;
    timestamp: Date;
  }
}

// Tag edited
{
  event: 'TAG_EDITED',
  data: {
    tagId: number;
    previousContent: string;
    newContent: string;
    editedBy: number;
    editReason: string;
    timestamp: Date;
  }
}
```

**Session-Related Events**:
```typescript
// Session started
{
  event: 'SESSION_STARTED',
  data: {
    sessionId: number;
    participants: User[];
    documents: Document[];
    startedBy: number;
    timestamp: Date;
  }
}

// User joined session
{
  event: 'USER_JOINED_SESSION',
  data: {
    sessionId: number;
    userId: number;
    userRole: string;
    joinTime: Date;
    timestamp: Date;
  }
}

// Session completed
{
  event: 'SESSION_COMPLETED',
  data: {
    sessionId: number;
    completionTime: number;
    totalTags: number;
    completedTags: number;
    participants: number[];
    timestamp: Date;
  }
}
```

#### Webhook Security and Reliability
**Security Measures**:
- **HMAC Signatures**: All webhooks signed with secret key
- **Payload Encryption**: Sensitive data encrypted in transit
- **IP Whitelisting**: Restrict webhook delivery to trusted IPs
- **Rate Limiting**: Prevent webhook abuse and spam

**Reliability Features**:
- **Retry Logic**: Automatic retry with exponential backoff
- **Dead Letter Queue**: Failed webhooks stored for manual processing
- **Delivery Confirmation**: Webhook delivery acknowledgment
- **Monitoring**: Real-time webhook delivery monitoring

### Live Signing UI Components

#### Tag Display Components
**Interactive Tag Component**:
```typescript
interface LiveTagProps {
  tag: Tag;
  isActive: boolean;
  currentUser: User;
  sessionState: SessionState;
  onTagClick: (tagId: number) => void;
  onTagComplete: (tagId: number, content: string) => void;
}

// Tag visual states during live signing
const tagVisualStates = {
  available: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    cursor: 'pointer',
    opacity: 1
  },
  completed: {
    borderColor: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    cursor: 'default',
    opacity: 0.8
  },
  editing: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    cursor: 'text',
    opacity: 1
  },
  locked: {
    borderColor: '#9ca3af',
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    cursor: 'not-allowed',
    opacity: 0.5
  }
};
```

#### User Activity Components
**Participant List Component**:
```typescript
interface ParticipantListProps {
  participants: User[];
  activeUser: number;
  currentUser: User;
  onUserActivate: (userId: number) => void;
  onUserDeactivate: (userId: number) => void;
}

// Participant status indicators
const participantStatus = {
  online: { color: '#059669', icon: '🟢' },
  active: { color: '#3b82f6', icon: '🔵' },
  editing: { color: '#f59e0b', icon: '🟡' },
  offline: { color: '#9ca3af', icon: '⚫' }
};
```

#### Progress Tracking Components
**Document Progress Component**:
```typescript
interface ProgressTrackerProps {
  totalTags: number;
  completedTags: number;
  currentPage: number;
  totalPages: number;
  estimatedTimeRemaining: number;
  onPageChange: (page: number) => void;
}

// Progress calculation
const calculateProgress = (completed: number, total: number) => {
  return {
    percentage: Math.round((completed / total) * 100),
    remaining: total - completed,
    estimatedTime: Math.round((total - completed) * 30) // 30 seconds per tag
  };
};
```

### Real-Time Data Synchronization

#### State Management
**Session State Structure**:
```typescript
interface LiveSessionState {
  sessionId: number;
  status: 'preparing' | 'active' | 'paused' | 'completed' | 'terminated';
  participants: User[];
  activeUser: number;
  currentPage: number;
  tags: Tag[];
  completedTags: number[];
  sessionStartTime: Date;
  lastActivityTime: Date;
  permissions: PermissionMap;
}
```

**Real-Time Updates**:
- **Optimistic Updates**: UI updates immediately for better UX
- **Server Confirmation**: Server confirms updates and resolves conflicts
- **State Reconciliation**: Automatic state synchronization across clients
- **Offline Support**: Queue updates when offline, sync when reconnected

#### Conflict Resolution
**Simultaneous Edit Handling**:
```typescript
interface ConflictResolution {
  type: 'TAG_EDIT_CONFLICT' | 'USER_ACTIVATION_CONFLICT' | 'PERMISSION_CONFLICT';
  conflictingUsers: number[];
  resolution: 'last-wins' | 'manual-resolution' | 'merge-content';
  resolvedBy: number;
  resolutionTime: Date;
}
```

**Conflict Prevention**:
- **Tag Locking**: Lock tags when user starts editing
- **User Queuing**: Queue users for tag interaction
- **Permission Enforcement**: Strict permission checking
- **Real-Time Validation**: Validate actions before execution

### Live Signing Performance Optimization

#### Real-Time Performance
**WebSocket Optimization**:
- **Message Batching**: Batch multiple updates in single message
- **Delta Updates**: Only send changed data
- **Compression**: Compress WebSocket messages
- **Connection Pooling**: Efficient connection management

**UI Performance**:
- **Virtual Scrolling**: Only render visible tags
- **Debounced Updates**: Debounce rapid UI updates
- **Memory Management**: Efficient memory usage for large sessions
- **Frame Rate Optimization**: Maintain 60fps for smooth interactions

#### Scalability Considerations
**Large Session Support**:
- **Tag Limits**: Configurable limits per session
- **User Limits**: Maximum participants per session
- **Document Limits**: Maximum documents per session
- **Time Limits**: Maximum session duration

**Load Balancing**:
- **Session Distribution**: Distribute sessions across servers
- **Geographic Distribution**: Route users to nearest servers
- **Auto-scaling**: Automatic scaling based on load
- **Failover**: Automatic failover for high availability

### Live Signing Security

#### Session Security
**Access Control**:
- **Session Authentication**: Verify user session access
- **Permission Validation**: Validate user permissions for each action
- **Session Isolation**: Isolate sessions from each other
- **Audit Logging**: Log all session activities

**Data Protection**:
- **Content Encryption**: Encrypt sensitive tag content
- **Transit Security**: Secure data transmission
- **Storage Security**: Secure data storage
- **Access Logging**: Log all data access

#### Compliance Features
**Legal Compliance**:
- **Notary Requirements**: Ensure compliance with notary laws
- **Document Integrity**: Maintain document authenticity
- **Audit Trail**: Complete audit trail for compliance
- **Record Keeping**: Maintain required records

**Privacy Protection**:
- **Data Minimization**: Only collect necessary data
- **User Consent**: Obtain user consent for data collection
- **Data Retention**: Implement data retention policies
- **Right to Deletion**: Support user data deletion requests

### Live Signing Monitoring and Analytics

#### Real-Time Monitoring
**Session Metrics**:
```typescript
interface SessionMetrics {
  activeSessions: number;
  totalParticipants: number;
  averageSessionDuration: number;
  tagCompletionRate: number;
  errorRate: number;
  systemPerformance: PerformanceMetrics;
}
```

**Performance Monitoring**:
- **Response Times**: Monitor API response times
- **WebSocket Latency**: Track real-time communication latency
- **Error Rates**: Monitor error frequencies
- **Resource Usage**: Track system resource consumption

#### Analytics and Reporting
**Usage Analytics**:
- **Session Patterns**: Analyze session usage patterns
- **User Behavior**: Track user interaction patterns
- **Performance Trends**: Monitor performance over time
- **Feature Adoption**: Track feature usage rates

**Compliance Reporting**:
- **Audit Reports**: Generate compliance audit reports
- **Activity Logs**: Export activity logs for review
- **Completion Reports**: Track document completion rates
- **Error Reports**: Monitor and report errors

### Live Signing Implementation Examples

#### WebSocket Event Handling
```typescript
// WebSocket connection setup
const setupWebSocket = (sessionId: number) => {
  const ws = new WebSocket(`wss://api.example.com/sessions/${sessionId}`);
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'TAG_COMPLETED':
        handleTagCompleted(message.data);
        break;
      case 'USER_ACTIVATED':
        handleUserActivated(message.data);
        break;
      case 'SESSION_STATUS_CHANGED':
        handleSessionStatusChanged(message.data);
        break;
    }
  };
  
  return ws;
};

// Tag completion handler
const handleTagCompleted = (data: TagCompletionData) => {
  // Update local tag state
  updateTagState(data.tagId, {
    isCompleted: true,
    completedBy: data.userId,
    completedAt: data.timestamp,
    content: data.content
  });
  
  // Update progress indicators
  updateProgressIndicators();
  
  // Trigger webhook if configured
  if (webhookConfig.enabled) {
    sendWebhook('TAG_COMPLETED', data);
  }
};
```

#### Real-Time UI Updates
```typescript
// React component for live tag display
const LiveTag: React.FC<LiveTagProps> = ({ tag, isActive, currentUser, sessionState }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(tag.content);
  
  const handleTagClick = async () => {
    if (!isActive || tag.isCompleted) return;
    
    // Check permissions
    if (!hasPermission(currentUser, tag)) {
      showError('You do not have permission to edit this tag');
      return;
    }
    
    // Start editing
    setIsEditing(true);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_EDITING_STARTED',
      tagId: tag.id,
      userId: currentUser.id
    });
  };
  
  const handleTagComplete = async () => {
    // Validate content
    if (!validateTagContent(tag.type, content)) {
      showError('Invalid content for this tag type');
      return;
    }
    
    // Complete tag
    await completeTag(tag.id, content);
    
    // Update local state
    setIsEditing(false);
    
    // Notify other users
    sendWebSocketMessage({
      type: 'TAG_COMPLETED',
      tagId: tag.id,
      content: content,
      userId: currentUser.id
    });
  };
  
  return (
    <div 
      className={`live-tag ${getTagVisualState(tag, isActive, isEditing)}`}
      onClick={handleTagClick}
      style={{
        left: tag.xPosition,
        top: tag.yPosition,
        width: tag.width,
        height: tag.height,
        borderColor: getUserColor(tag.assignedUserId)
      }}
    >
      <div className="tag-icon">{getTagIcon(tag.type)}</div>
      <div className="tag-content">
        {isEditing ? (
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleTagComplete}
            autoFocus
          />
        ) : (
          <span>{tag.content || getPlaceholderText(tag.type)}</span>
        )}
      </div>
      <div className="tag-status">
        {tag.isCompleted && <span className="completion-check">✓</span>}
        {isEditing && <span className="editing-indicator">✏️</span>}
      </div>
    </div>
  );
};
```

#### Webhook Implementation
```typescript
// Webhook sender service
class WebhookService {
  private webhookQueue: WebhookMessage[] = [];
  private isProcessing = false;
  
  async sendWebhook(event: string, data: any) {
    const webhookMessage: WebhookMessage = {
      id: generateId(),
      event,
      data,
      timestamp: new Date(),
      retryCount: 0
    };
    
    this.webhookQueue.push(webhookMessage);
    await this.processQueue();
  }
  
  private async processQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.webhookQueue.length > 0) {
      const message = this.webhookQueue.shift();
      if (!message) continue;
      
      try {
        await this.deliverWebhook(message);
      } catch (error) {
        console.error('Webhook delivery failed:', error);
        
        // Retry logic
        if (message.retryCount < 3) {
          message.retryCount++;
          this.webhookQueue.push(message);
          
          // Exponential backoff
          await this.delay(Math.pow(2, message.retryCount) * 1000);
        } else {
          // Move to dead letter queue
          await this.moveToDeadLetterQueue(message);
        }
      }
    }
    
    this.isProcessing = false;
  }
  
  private async deliverWebhook(message: WebhookMessage) {
    const response = await fetch(webhookConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': this.generateSignature(message)
      },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status}`);
    }
  }
}
```

### Best Practices for Live Signing

#### Performance Best Practices
**WebSocket Optimization**:
- **Connection Management**: Implement proper connection lifecycle
- **Message Batching**: Batch multiple updates when possible
- **Compression**: Use compression for large payloads
- **Heartbeat**: Implement heartbeat to detect connection issues

**UI Performance**:
- **Virtual Rendering**: Only render visible tags
- **Debounced Updates**: Debounce rapid state updates
- **Memory Management**: Clean up unused resources
- **Error Boundaries**: Implement error boundaries for stability

#### Security Best Practices
**Authentication and Authorization**:
- **Session Validation**: Validate session tokens on every request
- **Permission Checking**: Check permissions for every action
- **Input Validation**: Validate all user inputs
- **Output Sanitization**: Sanitize all outputs

**Data Protection**:
- **Encryption**: Encrypt sensitive data at rest and in transit
- **Access Logging**: Log all data access for audit
- **Data Minimization**: Only collect necessary data
- **Secure Communication**: Use HTTPS and secure WebSocket connections

#### User Experience Best Practices
**Real-Time Feedback**:
- **Immediate Updates**: Provide immediate visual feedback
- **Progress Indicators**: Show progress for long operations
- **Error Handling**: Provide clear error messages
- **Loading States**: Show loading states for async operations

**Accessibility**:
- **Keyboard Navigation**: Support keyboard-only navigation
- **Screen Reader Support**: Provide proper ARIA labels
- **High Contrast**: Support high contrast mode
- **Focus Management**: Proper focus management for screen readers

### Troubleshooting Live Signing Issues

#### Common WebSocket Issues
**Connection Problems**:
- **Connection Drops**: Implement automatic reconnection
- **Latency Issues**: Use geographic distribution
- **Message Loss**: Implement message acknowledgment
- **Scalability**: Use load balancing for large sessions

**Performance Issues**:
- **Slow Updates**: Optimize message size and frequency
- **Memory Leaks**: Proper cleanup of event listeners
- **CPU Usage**: Optimize rendering and update logic
- **Network Usage**: Compress messages and batch updates

#### Debugging Tools
**WebSocket Debugging**:
```typescript
// WebSocket debug logger
const debugWebSocket = (ws: WebSocket, sessionId: number) => {
  const originalSend = ws.send;
  
  ws.send = function(data) {
    console.log(`[WS ${sessionId}] Sending:`, data);
    originalSend.call(this, data);
  };
  
  ws.addEventListener('message', (event) => {
    console.log(`[WS ${sessionId}] Received:`, event.data);
  });
  
  ws.addEventListener('error', (error) => {
    console.error(`[WS ${sessionId}] Error:`, error);
  });
  
  ws.addEventListener('close', (event) => {
    console.log(`[WS ${sessionId}] Closed:`, event.code, event.reason);
  });
};
```

**Performance Monitoring**:
```typescript
// Performance monitoring
const monitorPerformance = () => {
  const metrics = {
    messageLatency: [],
    renderTime: [],
    memoryUsage: [],
    errorRate: 0
  };
  
  // Monitor WebSocket latency
  const measureLatency = (startTime: number) => {
    const latency = Date.now() - startTime;
    metrics.messageLatency.push(latency);
    
    if (metrics.messageLatency.length > 100) {
      metrics.messageLatency.shift();
    }
  };
  
  // Monitor render performance
  const measureRenderTime = (callback: () => void) => {
    const startTime = performance.now();
    callback();
    const renderTime = performance.now() - startTime;
    metrics.renderTime.push(renderTime);
  };
  
  return { metrics, measureLatency, measureRenderTime };
};
```

This comprehensive guide now provides complete coverage of the tag system, including detailed information about live signing functionality, real-time interactions, webhook integration, and all aspects of the system's operation. The guide serves as a complete reference for understanding, implementing, and maintaining the tag system in live signing environments.

## User Permission System

### Notaries
- **Can place all tag types**: Universal + Signer + Notary-specific
- **Can edit any tag**: Full control over all tags in the session
- **Can activate any user**: Switch between different user contexts
- **Can delete/modify tags**: Complete tag management capabilities
- **Auto-fill privileges**: All tags auto-fill from their profile data

### Signers
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Can only edit assigned tags**: Limited to tags assigned to them
- **Cannot place notary tags**: No access to N, X, O, E, W tags
- **Auto-fill privileges**: Tags auto-fill from their profile data

### Witnesses
- **Can place limited tags**: Universal (T, D) + Signer tags (A, S, I)
- **Same restrictions as signers**: Limited tag placement and editing
- **Cannot place notary tags**: No access to notary-specific tags

### Admins
- **Full system access**: Can place and edit all tag types
- **Same privileges as notaries**: Complete control over tagging system
- **Can manage all sessions**: Administrative oversight capabilities

## Tag Interaction Logic

### Tagging Mode vs Signing Mode

#### Tagging Mode
- **Purpose**: Document preparation before signing
- **User Actions**: Place tags, configure positions, assign users
- **Tag Behavior**: Static placeholders, no auto-completion
- **Permissions**: Notaries and admins can place all tags

#### Signing Mode
- **Purpose**: Live document completion during signing session
- **User Actions**: Fill tags, complete documents
- **Tag Behavior**: Interactive completion, auto-fill from profiles
- **Permissions**: Users can only interact with assigned tags

## Tags in Signing Sessions

### What Tags Do During Signing

Tags transform from static placeholders into interactive elements during signing sessions, serving as the primary interface for document completion:

#### Interactive Data Entry Points
- **Click to Complete**: Tags become clickable elements that trigger content insertion
- **Auto-Fill Behavior**: Most tags automatically populate with user profile data when clicked
- **Visual Feedback**: Tags change appearance to indicate completion status
- **Real-time Updates**: Completed tags immediately reflect changes across all participants

#### Document Completion Workflow
- **Sequential Processing**: Tags guide users through document completion in logical order
- **Validation Points**: Tags ensure required information is captured before proceeding
- **Progress Tracking**: Visual indicators show completion status of entire document
- **Quality Assurance**: Prevents missing critical information during signing

### Live Signing Session Architecture

#### Real-Time Communication System
**WebSocket Infrastructure**:
- **Connection Management**: Persistent WebSocket connections for all session participants
- **Room-Based Architecture**: Each signing session has dedicated WebSocket room
- **User Presence**: Real-time user online/offline status tracking
- **Connection Recovery**: Automatic reconnection with state restoration

**Message Types**:
```typescript
// Tag interaction messages
interface TagMessage {
  type: 'TAG_CLICKED' | 'TAG_COMPLETED' | 'TAG_EDITED' | 'TAG_DELETED';
  tagId: number;
  userId: number;
  sessionId: number;
  timestamp: Date;
  data?: any;
}

// User activity messages
interface UserActivityMessage {
  type: 'USER_JOINED' | 'USER_LEFT' | 'USER_ACTIVATED' | 'USER_DEACTIVATED';
  userId: number;
  sessionId: number;
  timestamp: Date;
}

// Session control messages
interface SessionControlMessage {
  type: 'SESSION_STARTED' | 'SESSION_PAUSED' | 'SESSION_COMPLETED' | 'SESSION_TERMINATED';
  sessionId: number;
  timestamp: Date;
  initiatedBy: number;
}
```

#### Webhook Integration System
**Webhook Endpoints**:
```typescript
// Tag completion webhook
POST /webhooks/tag-completed
{
  sessionId: number;
  tagId: number;
  userId: number;
  tagType: string;
  content: string;
  completedAt: Date;
  documentId: number;
}

// Session status webhook
POST /webhooks/session-status-changed
{
  sessionId: number;
  previousStatus: string;
  newStatus: string;
  changedBy: number;
  timestamp: Date;
}

// Document completion webhook
POST /webhooks/document-completed
{
  sessionId: number;
  documentId: number;
  completedBy: number;
  completedAt: Date;
  allTagsCompleted: boolean;
}
```

**Webhook Configuration**:
- **Retry Logic**: Automatic retry with exponential backoff for failed webhooks
- **Security**: HMAC signature verification for webhook authenticity
- **Rate Limiting**: Configurable rate limits to prevent abuse
- **Payload Validation**: Schema validation for all webhook payloads

### Live Signing Display Requirements

#### Real-Time Tag Visualization
**Tag State Synchronization**:
- **Live Updates**: Tags update in real-time across all participant screens
- **State Consistency**: All participants see identical tag states
- **Conflict Resolution**: Prevents simultaneous tag editing conflicts
- **Version Control**: Maintains tag state history for audit purposes

**Visual Indicators for Live Sessions**:
```typescript
interface LiveTagDisplay {
  // Tag completion status
  isCompleted: boolean;
  completedBy: number;
  completedAt: Date;
  
  // User assignment
  assignedUserId: number;
  assignedUserName: string;
  
  // Real-time activity
  isBeingEdited: boolean;
  editingBy: number;
  editingStartTime: Date;
  
  // Visual state
  visualState: 'incomplete' | 'completed' | 'editing' | 'error' | 'locked';
  userColor: string;
  completionIndicator: string;
}
```

#### User Activity Indicators
**Active User Display**:
- **User Avatars**: Show participant avatars with online status
- **Current Activity**: Display which user is currently active
- **Cursor Tracking**: Show other users' cursor positions (optional)
- **Activity Timeline**: Real-time feed of user actions

**Permission Visualization**:
- **Color Coding**: Each user's tags have distinct colors
- **Lock Indicators**: Show which tags are locked/unavailable
- **Permission Status**: Visual indication of user permissions
- **Assignment Display**: Clear indication of tag ownership

#### Progress Tracking Display
**Document Completion Progress**:
- **Progress Bar**: Visual progress indicator for entire document
- **Tag Count**: Show completed vs total tags
- **Page Progress**: Progress tracking per document page
- **Completion Time**: Estimated time to complete remaining tags

**Real-Time Statistics**:
```typescript
interface SessionProgress {
  totalTags: number;
  completedTags: number;
  remainingTags: number;
  completionPercentage: number;
  estimatedTimeRemaining: number;
  activeUsers: number;
  sessionDuration: number;
}
```

### Live Tag Interaction Workflow

#### Tag Activation Process
**User Activation Sequence**:
1. **Notary Control**: Notary activates specific users for tag interaction
2. **Permission Check**: System validates user permissions for tag types
3. **Visual Feedback**: UI updates to show active user and available tags
4. **Tag Highlighting**: User's assigned tags become highlighted
5. **Interaction Enablement**: User can now interact with assigned tags

**Activation States**:
```typescript
interface UserActivationState {
  userId: number;
  isActive: boolean;
  activatedBy: number;
  activatedAt: Date;
  allowedTagTypes: string[];
  currentTagId?: number;
  sessionPermissions: string[];
}
```

#### Tag Completion Workflow
**Step-by-Step Process**:
1. **Tag Selection**: User clicks on assigned tag
2. **Permission Validation**: System checks user permissions
3. **Content Generation**: Auto-fill or modal opens based on tag type
4. **Content Validation**: System validates entered content
5. **Real-Time Update**: Changes broadcast to all participants
6. **State Persistence**: Tag state saved to database
7. **Webhook Trigger**: Completion webhook sent to external systems
8. **Progress Update**: Document progress recalculated

**Completion Validation**:
```typescript
interface TagCompletionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields: string[];
  optionalFields: string[];
  validationRules: ValidationRule[];
}
```

#### Real-Time Collaboration Features
**Simultaneous User Support**:
- **User Queuing**: Multiple users can queue for tag completion
- **Turn Management**: System manages user turns for tag interaction
- **Conflict Prevention**: Prevents simultaneous editing of same tag
- **Activity Broadcasting**: All users see real-time activity

**Collaboration Indicators**:
- **User Cursors**: Optional display of other users' cursor positions
- **Activity Feed**: Real-time feed of user actions and tag completions
- **Chat Integration**: Built-in chat for user communication
- **Screen Sharing**: Optional screen sharing for guidance

### Webhook Implementation Details

#### Webhook Event Types
**Tag-Related Events**:
```typescript
// Tag placed
{
  event: 'TAG_PLACED',
  data: {
    tagId: number;
    tagType: string;
    position: { x: number; y: number };
    assignedUserId: number;
    placedBy: number;
    timestamp: Date;
  }
}

// Tag completed
{
  event: 'TAG_COMPLETED',
  data: {
    tagId: number;
    content: string;
    completedBy: number;
    completionTime: number;
    validationStatus: string;
    timestamp: Date;
  }
}

// Tag edited
{
  event: 'TAG_EDITED',
  data: {
    tagId: number;
    previousContent: string;
    newContent: string;
    editedBy: number;
    editReason: string;
    timestamp: Date;
  }
}
```

**Session-Related Events**:
```typescript
// Session started
{
  event: 'SESSION_STARTED',
  data: {
    sessionId: number;
    participants: User[];
    documents: Document[];
    startedBy: number;
    timestamp: Date;
  }
}

// User joined session
{
  event: 'USER_JOINED_SESSION',
  data: {
    sessionId: number;
    userId: number;
    userRole: string;
    joinTime: Date;
    timestamp: Date;
  }
}

// Session completed
{
  event: 'SESSION_COMPLETED',
  data: {
    sessionId: number;
    completionTime: number;
    totalTags: number;
    completedTags: number;
    participants: number[];
    timestamp: Date;
  }
}
```

#### Webhook Security and Reliability
**Security Measures**:
- **HMAC Signatures**: All webhooks signed with secret key
- **Payload Encryption**: Sensitive data encrypted in transit
- **IP Whitelisting**: Restrict webhook delivery to trusted IPs
- **Rate Limiting**: Prevent webhook abuse and spam

**Reliability Features**:
- **Retry Logic**: Automatic retry with exponential backoff
- **Dead Letter Queue**: Failed webhooks stored for manual processing
- **Delivery Confirmation**: Webhook delivery acknowledgment
- **Monitoring**: Real-time webhook delivery monitoring

### Live Signing UI Components

#### Tag Display Components
**Interactive Tag Component**:
```typescript
interface LiveTagProps {
  tag: Tag;
  isActive: boolean;
  currentUser: User;
  sessionState: SessionState;
  onTagClick: (tagId: number) => void;
  onTagComplete: (tagId: number, content: string) => void;
}

// Tag visual states during live signing
const tagVisualStates = {
  available: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    cursor: 'pointer',
    opacity: 1
  },
  completed: {
    borderColor: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    cursor: 'default',
    opacity: 0.8
  },
  editing: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    cursor: 'text',
    opacity: 1
  },
  locked: {
    borderColor: '#9ca3af',
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    cursor: 'not-allowed',
    opacity: 0.5
  }
};
```

#### User Activity Components
**Participant List Component**:
```typescript
interface ParticipantListProps {
  participants: User[];
  activeUser: number;
  currentUser: User;
  onUserActivate: (userId: number) => void;
  onUserDeactivate: (userId: number) => void;
}

// Participant status indicators
const participantStatus = {
  online: { color: '#059669', icon: '🟢' },
  active: { color: '#3b82f6', icon: '🔵' },
  editing: { color: '#f59e0b', icon: '