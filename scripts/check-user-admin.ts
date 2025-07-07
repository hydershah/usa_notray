import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function checkUserAdmin() {
  console.log("🔍 Checking user admin status...\n");

  try {
    // Get all users and their roles
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      privileges: users.privileges,
      isActive: users.isActive
    }).from(users);

    console.log("👥 All Users:");
    allUsers.forEach(user => {
      const isAdmin = user.role === 'admin' || (user.privileges && user.privileges.includes('admin'));
      console.log(`  ID: ${user.id}`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Privileges: ${user.privileges || 'none'}`);
      console.log(`  Is Admin: ${isAdmin ? '✅' : '❌'}`);
      console.log(`  Active: ${user.isActive ? '✅' : '❌'}`);
      console.log("");
    });

    // Check which user is likely the one having issues
    const currentUser = allUsers.find(u => u.email === 'admin@usanotaryservices.com') || allUsers[0];
    
    if (currentUser) {
      const isAdmin = currentUser.role === 'admin' || (currentUser.privileges && currentUser.privileges.includes('admin'));
      console.log("🎯 Current User Analysis:");
      console.log(`  User: ${currentUser.username} (${currentUser.email})`);
      console.log(`  Role: ${currentUser.role}`);
      console.log(`  Has Admin Access: ${isAdmin ? '✅' : '❌'}`);
      
      if (!isAdmin && currentUser.role !== 'admin') {
        console.log("\n🔧 Fix Required:");
        console.log("  This user needs admin role to access email settings");
        console.log(`  Run: UPDATE users SET role = 'admin' WHERE id = ${currentUser.id};`);
      }
    }

  } catch (error) {
    console.error("❌ Error checking user admin status:", error);
  } finally {
    process.exit();
  }
}

// Run the check
checkUserAdmin(); 