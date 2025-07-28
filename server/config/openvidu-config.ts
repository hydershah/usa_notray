// OpenVidu Configuration
export interface OpenViduEnvironment {
  // OpenVidu Server Configuration
  serverUrl: string;
  secret: string;
  
  // Recording Configuration
  recordingEnabled: boolean;
  recordingPath: string;
  recordingNotificationEndpoint?: string;
  
  // Vultr Object Storage Configuration
  vultrStorage: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    cdnUrl?: string;
  };
  
  // Security Configuration
  jwtSecret: string;
  allowInsecureConnections: boolean;
  
  // Session Configuration
  defaultSessionConfig: {
    maxParticipants: number;
    defaultRecordingLayout: 'GRID' | 'FOCUS' | 'CUSTOM';
    defaultResolution: '640x480' | '1280x720' | '1920x1080' | '4K';
    defaultFrameRate: number;
  };
}

// Environment Configuration
export const openViduConfig: OpenViduEnvironment = {
  // OpenVidu Server
  serverUrl: process.env.OPENVIDU_SERVER_URL || 'https://localhost:4443',
  secret: process.env.OPENVIDU_SECRET || 'MY_SECRET',
  
  // Recording
  recordingEnabled: process.env.OPENVIDU_RECORDING_ENABLED === 'true' || true,
  recordingPath: process.env.OPENVIDU_RECORDING_PATH || '/opt/openvidu/recordings',
  recordingNotificationEndpoint: process.env.OPENVIDU_RECORDING_NOTIFICATION_ENDPOINT,
  
  // Vultr Object Storage
  vultrStorage: {
    endpoint: process.env.VULTR_STORAGE_ENDPOINT || '',
    region: process.env.VULTR_STORAGE_REGION || 'ewr1',
    bucket: process.env.VULTR_STORAGE_BUCKET || '',
    accessKey: process.env.VULTR_STORAGE_ACCESS_KEY || '',
    secretKey: process.env.VULTR_STORAGE_SECRET_KEY || '',
    cdnUrl: process.env.VULTR_STORAGE_CDN_URL
  },
  
  // Security
  jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret',
  allowInsecureConnections: process.env.NODE_ENV === 'development',
  
  // Default Session Settings
  defaultSessionConfig: {
    maxParticipants: parseInt(process.env.OPENVIDU_MAX_PARTICIPANTS || '8'),
    defaultRecordingLayout: (process.env.OPENVIDU_DEFAULT_LAYOUT as 'GRID' | 'FOCUS' | 'CUSTOM') || 'GRID',
    defaultResolution: (process.env.OPENVIDU_DEFAULT_RESOLUTION as '640x480' | '1280x720' | '1920x1080' | '4K') || '1920x1080',
    defaultFrameRate: parseInt(process.env.OPENVIDU_DEFAULT_FRAMERATE || '25')
  }
};

// Configuration validation
export function validateOpenViduConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate OpenVidu Server
  if (!openViduConfig.serverUrl) {
    errors.push('OPENVIDU_SERVER_URL is required');
  }
  
  if (!openViduConfig.secret || openViduConfig.secret === 'MY_SECRET') {
    if (process.env.NODE_ENV === 'production') {
      errors.push('OPENVIDU_SECRET must be set to a secure value in production');
    }
  }
  
  // Validate Vultr Storage (optional but recommended)
  if (openViduConfig.recordingEnabled) {
    if (!openViduConfig.vultrStorage.endpoint) {
      console.warn('⚠️ VULTR_STORAGE_ENDPOINT not set - recordings will be stored locally only');
    }
    
    if (!openViduConfig.vultrStorage.bucket) {
      console.warn('⚠️ VULTR_STORAGE_BUCKET not set - recordings will be stored locally only');
    }
    
    if (!openViduConfig.vultrStorage.accessKey || !openViduConfig.vultrStorage.secretKey) {
      console.warn('⚠️ Vultr storage credentials not set - recordings will be stored locally only');
    }
  }
  
  // Validate JWT Secret
  if (!openViduConfig.jwtSecret || openViduConfig.jwtSecret === 'your-jwt-secret') {
    if (process.env.NODE_ENV === 'production') {
      errors.push('JWT_SECRET must be set to a secure value in production');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Docker Compose Configuration Template
export const dockerComposeTemplate = `
version: '3.8'

services:
  openvidu-server:
    image: openvidu/openvidu-dev:2.31.0
    restart: unless-stopped
    ports:
      - "4443:4443"
    environment:
      - OPENVIDU_SECRET=${openViduConfig.secret}
      - DOMAIN_OR_PUBLIC_IP=\${DOMAIN_OR_PUBLIC_IP:-localhost}
      - OPENVIDU_RECORDING=true
      - OPENVIDU_RECORDING_PATH=/opt/openvidu/recordings
      - OPENVIDU_RECORDING_NOTIFICATION=\${OPENVIDU_RECORDING_NOTIFICATION:-}
    volumes:
      - recordings:/opt/openvidu/recordings
    networks:
      - openvidu

volumes:
  recordings:

networks:
  openvidu:
    driver: bridge
`;

// Environment Variables Template
export const envTemplate = `
# OpenVidu Configuration
OPENVIDU_SERVER_URL=https://localhost:4443
OPENVIDU_SECRET=MY_SECRET_PLEASE_CHANGE
OPENVIDU_RECORDING_ENABLED=true
OPENVIDU_RECORDING_PATH=/opt/openvidu/recordings
OPENVIDU_MAX_PARTICIPANTS=8
OPENVIDU_DEFAULT_LAYOUT=GRID
OPENVIDU_DEFAULT_RESOLUTION=1920x1080
OPENVIDU_DEFAULT_FRAMERATE=25

# Vultr Object Storage Configuration
VULTR_STORAGE_ENDPOINT=https://ewr1.vultrobjects.com
VULTR_STORAGE_REGION=ewr1
VULTR_STORAGE_BUCKET=notary-recordings-prod
VULTR_STORAGE_ACCESS_KEY=your_vultr_access_key
VULTR_STORAGE_SECRET_KEY=your_vultr_secret_key
VULTR_STORAGE_CDN_URL=https://your-cdn-domain.com

# Application Configuration
JWT_SECRET=your_super_secure_jwt_secret
NODE_ENV=development
`;

// Configuration helper functions
export function getOpenViduWebhookUrl(): string {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/api/video/webhook`;
}

export function isOpenViduConfigured(): boolean {
  return !!(openViduConfig.serverUrl && openViduConfig.secret);
}

export function isVultrStorageConfigured(): boolean {
  return !!(
    openViduConfig.vultrStorage.endpoint &&
    openViduConfig.vultrStorage.bucket &&
    openViduConfig.vultrStorage.accessKey &&
    openViduConfig.vultrStorage.secretKey
  );
}

export function getRecordingStorageInfo(): {
  type: 'local' | 'vultr';
  configured: boolean;
  details: any;
} {
  if (isVultrStorageConfigured()) {
    return {
      type: 'vultr',
      configured: true,
      details: {
        bucket: openViduConfig.vultrStorage.bucket,
        endpoint: openViduConfig.vultrStorage.endpoint,
        cdnEnabled: !!openViduConfig.vultrStorage.cdnUrl
      }
    };
  }
  
  return {
    type: 'local',
    configured: openViduConfig.recordingEnabled,
    details: {
      path: openViduConfig.recordingPath
    }
  };
}

// Print configuration status
export function printConfigurationStatus(): void {
  console.log('\n📹 OpenVidu Configuration Status:');
  console.log('=====================================');
  
  const validation = validateOpenViduConfig();
  
  // OpenVidu Server
  console.log(`🔗 OpenVidu Server: ${isOpenViduConfigured() ? '✅ Configured' : '❌ Not Configured'}`);
  console.log(`   URL: ${openViduConfig.serverUrl}`);
  console.log(`   Secret: ${openViduConfig.secret !== 'MY_SECRET' ? '✅ Set' : '⚠️ Using default'}`);
  
  // Recording
  console.log(`🎬 Recording: ${openViduConfig.recordingEnabled ? '✅ Enabled' : '❌ Disabled'}`);
  
  // Storage
  const storageInfo = getRecordingStorageInfo();
  console.log(`💾 Storage: ${storageInfo.configured ? '✅' : '⚠️'} ${storageInfo.type.toUpperCase()}`);
  
  if (storageInfo.type === 'vultr') {
    console.log(`   Bucket: ${storageInfo.details.bucket}`);
    console.log(`   CDN: ${storageInfo.details.cdnEnabled ? '✅ Enabled' : '❌ Disabled'}`);
  } else {
    console.log(`   Path: ${storageInfo.details.path}`);
  }
  
  // Warnings and Errors
  if (validation.errors.length > 0) {
    console.log('\n⚠️ Configuration Issues:');
    validation.errors.forEach(error => console.log(`   - ${error}`));
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.log('\n🛠️ Development Mode: Using permissive settings');
  }
  
  console.log('=====================================\n');
} 