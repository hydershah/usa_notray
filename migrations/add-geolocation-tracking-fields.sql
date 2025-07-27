-- Migration: Add geolocation and location tracking fields to system_activity_logs
-- Date: January 2025
-- Purpose: Enable comprehensive location tracking for user activities

-- Add geolocation and enhanced location tracking fields
ALTER TABLE system_activity_logs 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS location_accuracy DECIMAL(6, 2),
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS state VARCHAR(50),
ADD COLUMN IF NOT EXISTS country VARCHAR(50),
ADD COLUMN IF NOT EXISTS isp_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS connection_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50);

-- Add indexes for location-based queries
CREATE INDEX IF NOT EXISTS idx_system_activity_logs_location ON system_activity_logs(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_system_activity_logs_city ON system_activity_logs(city);
CREATE INDEX IF NOT EXISTS idx_system_activity_logs_country ON system_activity_logs(country);
CREATE INDEX IF NOT EXISTS idx_system_activity_logs_timezone ON system_activity_logs(timezone);

-- Add comments for documentation
COMMENT ON COLUMN system_activity_logs.latitude IS 'GPS latitude coordinate (when available)';
COMMENT ON COLUMN system_activity_logs.longitude IS 'GPS longitude coordinate (when available)';
COMMENT ON COLUMN system_activity_logs.location_accuracy IS 'Location accuracy in meters';
COMMENT ON COLUMN system_activity_logs.city IS 'City name from IP geolocation or GPS';
COMMENT ON COLUMN system_activity_logs.state IS 'State/province from geolocation';
COMMENT ON COLUMN system_activity_logs.country IS 'Country from geolocation';
COMMENT ON COLUMN system_activity_logs.isp_name IS 'Internet Service Provider name';
COMMENT ON COLUMN system_activity_logs.connection_type IS 'Connection type (mobile/broadband/corporate)';
COMMENT ON COLUMN system_activity_logs.timezone IS 'User timezone'; 