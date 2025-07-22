import { db } from '../server/db';
import { systemActivityLogs } from '../shared/schema';
import { desc, eq, or, like } from 'drizzle-orm';
import { locationService } from '../server/services/location-service';

async function getExactCoordinates() {
  try {
    console.log('🗺️  Getting Exact GPS Coordinates from User Tracking Data...\n');
    
    // 1. Get coordinates from recent login logs
    console.log('📊 Checking stored coordinates in login logs:');
    const loginLogs = await db
      .select()
      .from(systemActivityLogs)
      .where(
        or(
          eq(systemActivityLogs.action, 'login'),
          eq(systemActivityLogs.action, 'login_failed')
        )
      )
      .orderBy(desc(systemActivityLogs.createdAt))
      .limit(5);
    
    let foundCoordinates = false;
    
    loginLogs.forEach((log, index) => {
      if (log.details && typeof log.details === 'object') {
        const loginAttempt = (log.details as any).loginAttempt;
        if (loginAttempt?.location) {
          const location = loginAttempt.location;
          
          console.log(`\n${index + 1}. Login #${log.id} (${log.userEmail || 'unknown'}):`);
          console.log(`   IP: ${location.ip || log.ipAddress}`);
          console.log(`   City: ${location.city}, ${location.region}, ${location.country}`);
          
          if (location.coordinates) {
            console.log(`   📍 GPS COORDINATES: ${location.coordinates}`);
            const [lat, lng] = location.coordinates.split(',');
            console.log(`   📍 Latitude: ${lat}`);
            console.log(`   📍 Longitude: ${lng}`);
            console.log(`   🗺️  Google Maps: https://maps.google.com/?q=${lat},${lng}`);
            foundCoordinates = true;
          } else if (location.latitude && location.longitude) {
            console.log(`   📍 GPS COORDINATES: ${location.latitude},${location.longitude}`);
            console.log(`   📍 Latitude: ${location.latitude}`);
            console.log(`   📍 Longitude: ${location.longitude}`);
            console.log(`   🗺️  Google Maps: https://maps.google.com/?q=${location.latitude},${location.longitude}`);
            foundCoordinates = true;
          } else {
            console.log(`   ⚠️  No coordinates stored (likely localhost IP)`);
          }
          
          console.log(`   🏢 ISP: ${location.isp}`);
          console.log(`   🕒 Time: ${new Date(log.createdAt).toLocaleString()}`);
        }
      }
    });
    
    if (!foundCoordinates) {
      console.log('\n❌ No coordinates found in stored logs. This happens when:');
      console.log('   1. All logins are from localhost/local network');
      console.log('   2. Location API didn\'t return coordinates');
      console.log('   3. Coordinates weren\'t saved to database');
    }
    
    // 2. Get live coordinates for current external IP
    console.log('\n\n🌐 Getting LIVE coordinates for current external IP:');
    
    try {
      const fetch = (await import('node-fetch')).default;
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json() as { ip: string };
      const currentIP = ipData.ip;
      
      console.log(`📡 Current external IP: ${currentIP}`);
      
      if (currentIP && !locationService['isLocalIP'](currentIP)) {
        const locationData = await locationService.getLocationData(currentIP);
        
        if (locationData.latitude && locationData.longitude) {
          console.log('\n🎯 EXACT CURRENT LOCATION:');
          console.log(`📍 GPS Coordinates: ${locationData.latitude},${locationData.longitude}`);
          console.log(`📍 Latitude: ${locationData.latitude}`);
          console.log(`📍 Longitude: ${locationData.longitude}`);
          console.log(`🏙️  City: ${locationData.city}`);
          console.log(`🏛️  Region: ${locationData.region}`);
          console.log(`🏳️  Country: ${locationData.country} (${locationData.countryCode})`);
          console.log(`🏢 ISP: ${locationData.isp}`);
          console.log(`🕒 Timezone: ${locationData.timezone}`);
          console.log(`🗺️  Google Maps: https://maps.google.com/?q=${locationData.latitude},${locationData.longitude}`);
          console.log(`🗺️  OpenStreetMap: https://www.openstreetmap.org/?mlat=${locationData.latitude}&mlon=${locationData.longitude}&zoom=15`);
          
          // Security flags
          if (locationData.proxy) console.log(`⚠️  WARNING: Proxy/VPN detected`);
          if (locationData.hosting) console.log(`⚠️  WARNING: Hosting provider IP`);
          if (locationData.mobile) console.log(`📱 Mobile network detected`);
          
        } else {
          console.log(`❌ No coordinates available for IP: ${currentIP}`);
          console.log(`   Location: ${locationData.city}, ${locationData.region}, ${locationData.country}`);
        }
      } else {
        console.log(`⚠️  Current IP (${currentIP}) is local/private - no coordinates available`);
      }
      
    } catch (error) {
      console.error('❌ Error getting live coordinates:', error.message);
    }
    
    // 3. Instructions for better coordinate tracking
    console.log('\n\n💡 How to get coordinates for future logins:');
    console.log('1. 🌐 Access your application from external IP (not localhost)');
    console.log('2. 📱 Use mobile data or different network');
    console.log('3. 🔐 Login normally - coordinates will be automatically captured');
    console.log('4. 📊 Check logs again with this script');
    
    console.log('\n🔧 To force coordinate capture for localhost testing:');
    console.log('   Run: npx tsx scripts/enable-coordinate-capture.ts');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error getting coordinates:', error);
    process.exit(1);
  }
}

getExactCoordinates(); 