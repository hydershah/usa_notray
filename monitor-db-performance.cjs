#!/usr/bin/env node

// 📊 Database Performance Monitoring Script
// Track database performance improvements over time

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 5
});

// Performance test configuration
const PERFORMANCE_TESTS = [
  {
    name: 'Basic Connection',
    query: 'SELECT 1 as test',
    target: 50, // Target: <50ms
    priority: 'HIGH'
  },
  {
    name: 'Users Count',
    query: 'SELECT COUNT(*) as count FROM users',
    target: 100, // Target: <100ms
    priority: 'HIGH'
  },
  {
    name: 'Jobs Count',
    query: 'SELECT COUNT(*) as count FROM jobs',
    target: 100, // Target: <100ms
    priority: 'HIGH'
  },
  {
    name: 'Recent Jobs (Complex)',
    query: `
      SELECT j.id, j.title_company, j.created_at, j.job_status, 
             COUNT(s.id) as signer_count
      FROM jobs j 
      LEFT JOIN signers s ON j.id = s.job_id 
      WHERE j.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY j.id, j.title_company, j.created_at, j.job_status
      ORDER BY j.created_at DESC 
      LIMIT 10
    `,
    target: 500, // Target: <500ms
    priority: 'CRITICAL'
  },
  {
    name: 'Job with Signers (JOIN)',
    query: `
      SELECT j.id, j.title_company, s.signer_name, s.signer_email
      FROM jobs j 
      INNER JOIN signers s ON j.id = s.job_id 
      ORDER BY j.created_at DESC 
      LIMIT 5
    `,
    target: 300, // Target: <300ms
    priority: 'HIGH'
  },
  {
    name: 'Users with Profile Data',
    query: `
      SELECT u.id, u.username, u.email, u.role, u.created_at
      FROM users u 
      WHERE u.is_active = true 
      ORDER BY u.created_at DESC 
      LIMIT 20
    `,
    target: 200, // Target: <200ms
    priority: 'MEDIUM'
  }
];

// Database health checks
const HEALTH_CHECKS = [
  {
    name: 'Active Connections',
    query: `
      SELECT count(*) as active_connections
      FROM pg_stat_activity 
      WHERE state = 'active'
    `,
    evaluate: (result) => {
      const count = parseInt(result.rows[0].active_connections);
      return {
        status: count < 10 ? 'HEALTHY' : count < 20 ? 'WARNING' : 'CRITICAL',
        value: count,
        message: `${count} active connections`
      };
    }
  },
  {
    name: 'Database Size',
    query: `
      SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
    `,
    evaluate: (result) => ({
      status: 'INFO',
      value: result.rows[0].db_size,
      message: `Database size: ${result.rows[0].db_size}`
    })
  },
  {
    name: 'Index Usage',
    query: `
      SELECT 
        schemaname,
        COUNT(*) as index_count,
        COUNT(*) FILTER (WHERE indexname LIKE 'idx_%') as custom_indexes
      FROM pg_indexes 
      WHERE schemaname = 'public'
      GROUP BY schemaname
    `,
    evaluate: (result) => {
      if (result.rows.length === 0) return { status: 'CRITICAL', message: 'No indexes found' };
      
      const row = result.rows[0];
      const customIndexes = parseInt(row.custom_indexes || 0);
      const totalIndexes = parseInt(row.index_count);
      
      return {
        status: customIndexes > 10 ? 'HEALTHY' : customIndexes > 5 ? 'WARNING' : 'CRITICAL',
        value: `${customIndexes}/${totalIndexes}`,
        message: `${customIndexes} custom indexes out of ${totalIndexes} total`
      };
    }
  }
];

async function runPerformanceTest() {
  console.log('🔍 Database Performance Monitor');
  console.log('================================');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log('');

  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    health: [],
    summary: {
      total: 0,
      passed: 0,
      warnings: 0,
      failures: 0
    }
  };

  // Run performance tests
  console.log('⚡ PERFORMANCE TESTS');
  console.log('-------------------');
  
  for (const test of PERFORMANCE_TESTS) {
    const start = Date.now();
    let status, duration, error;
    
    try {
      await pool.query(test.query);
      duration = Date.now() - start;
      
      if (duration <= test.target) {
        status = 'PASS';
        results.summary.passed++;
      } else if (duration <= test.target * 2) {
        status = 'WARN';
        results.summary.warnings++;
      } else {
        status = 'FAIL';
        results.summary.failures++;
      }
      
    } catch (err) {
      duration = Date.now() - start;
      status = 'ERROR';
      error = err.message;
      results.summary.failures++;
    }
    
    results.summary.total++;
    
    const testResult = {
      name: test.name,
      duration,
      target: test.target,
      status,
      priority: test.priority,
      error
    };
    
    results.tests.push(testResult);
    
    // Format output
    const statusIcon = {
      'PASS': '✅',
      'WARN': '⚠️',
      'FAIL': '❌',
      'ERROR': '💥'
    }[status];
    
    const priorityIcon = {
      'CRITICAL': '🚨',
      'HIGH': '🔴',
      'MEDIUM': '🟡',
      'LOW': '🟢'
    }[test.priority];
    
    console.log(`${statusIcon} ${priorityIcon} ${test.name}: ${duration}ms (target: ${test.target}ms)`);
    if (error) console.log(`   Error: ${error}`);
  }

  // Run health checks
  console.log('');
  console.log('🏥 HEALTH CHECKS');
  console.log('----------------');
  
  for (const check of HEALTH_CHECKS) {
    try {
      const result = await pool.query(check.query);
      const health = check.evaluate(result);
      
      results.health.push({
        name: check.name,
        status: health.status,
        value: health.value,
        message: health.message
      });
      
      const statusIcon = {
        'HEALTHY': '✅',
        'WARNING': '⚠️',
        'CRITICAL': '❌',
        'INFO': '📊'
      }[health.status];
      
      console.log(`${statusIcon} ${check.name}: ${health.message}`);
      
    } catch (err) {
      console.log(`❌ ${check.name}: ERROR - ${err.message}`);
      results.health.push({
        name: check.name,
        status: 'ERROR',
        message: err.message
      });
    }
  }

  // Connection pool stats
  console.log('');
  console.log('🔗 CONNECTION POOL');
  console.log('------------------');
  console.log(`📊 Total: ${pool.totalCount}`);
  console.log(`💤 Idle: ${pool.idleCount}`);
  console.log(`⏳ Waiting: ${pool.waitingCount}`);
  console.log(`⚡ Active: ${pool.totalCount - pool.idleCount}`);

  // Performance summary
  console.log('');
  console.log('📈 SUMMARY');
  console.log('----------');
  
  const passRate = Math.round((results.summary.passed / results.summary.total) * 100);
  console.log(`✅ Passed: ${results.summary.passed}/${results.summary.total} (${passRate}%)`);
  
  if (results.summary.warnings > 0) {
    console.log(`⚠️  Warnings: ${results.summary.warnings}`);
  }
  
  if (results.summary.failures > 0) {
    console.log(`❌ Failures: ${results.summary.failures}`);
  }

  // Overall health assessment
  let overallStatus;
  if (results.summary.failures === 0 && results.summary.warnings <= 1) {
    overallStatus = 'HEALTHY';
    console.log('🎉 Overall Status: HEALTHY');
  } else if (results.summary.failures <= 2) {
    overallStatus = 'WARNING';
    console.log('⚠️  Overall Status: NEEDS ATTENTION');
  } else {
    overallStatus = 'CRITICAL';
    console.log('🚨 Overall Status: CRITICAL - IMMEDIATE ACTION NEEDED');
  }

  results.overallStatus = overallStatus;

  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const filename = `db-performance-${timestamp}.json`;
  
  try {
    if (!fs.existsSync('performance-logs')) {
      fs.mkdirSync('performance-logs');
    }
    
    fs.writeFileSync(path.join('performance-logs', filename), JSON.stringify(results, null, 2));
    console.log(`📝 Results saved to: performance-logs/${filename}`);
  } catch (err) {
    console.log(`⚠️  Could not save results: ${err.message}`);
  }

  // Recommendations
  console.log('');
  console.log('💡 RECOMMENDATIONS');
  console.log('------------------');
  
  if (results.summary.failures > 0) {
    console.log('🚨 Critical actions needed:');
    console.log('   1. Deploy database indexes: ./optimize-database-performance.sh');
    console.log('   2. Add caching to slow endpoints');
    console.log('   3. Review connection pool settings');
  } else if (results.summary.warnings > 0) {
    console.log('⚠️  Optimization opportunities:');
    console.log('   1. Add more caching for better performance');
    console.log('   2. Consider query optimization');
  } else {
    console.log('✅ Performance looks good! Continue monitoring.');
  }

  await pool.end();
  return results;
}

// Main execution
if (require.main === module) {
  runPerformanceTest()
    .then(() => {
      console.log('\n🏁 Performance monitoring completed');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Performance monitoring failed:', err);
      process.exit(1);
    });
}

module.exports = { runPerformanceTest }; 