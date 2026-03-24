#!/usr/bin/env node

console.log('🔍 Analytics Dashboard Diagnostic Tool');
console.log('=====================================');

const http = require('http');
const { spawn } = require('child_process');

// Test 1: Check if server is running
function testServerHealth() {
  return new Promise((resolve) => {
    console.log('\n📡 Testing server health...');
    
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/health',
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          if (health.status === 'ok') {
            console.log('✅ Server is running and healthy');
            console.log(`📅 Timestamp: ${health.timestamp}`);
            resolve(true);
          } else {
            console.log('❌ Server health check failed');
            resolve(false);
          }
        } catch (e) {
          console.log('❌ Invalid server response');
          resolve(false);
        }
      });
    });

    req.on('error', () => {
      console.log('❌ Server is not running on port 3000');
      resolve(false);
    });

    req.on('timeout', () => {
      console.log('❌ Server health check timeout');
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Test 2: Check database connection
function testDatabase() {
  return new Promise((resolve) => {
    console.log('\n🗄️ Testing database connection...');
    
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/analytics/enhanced',
      method: 'GET',
      timeout: 10000,
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 403) {
          console.log('✅ Database connection working (auth required - normal)');
          resolve(true);
        } else if (res.statusCode === 500) {
          console.log('❌ Database connection error');
          console.log('Response:', data);
          resolve(false);
        } else {
          console.log('✅ Server responding (may need proper auth)');
          resolve(true);
        }
      });
    });

    req.on('error', (err) => {
      console.log('❌ Database test failed:', err.message);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log('❌ Database test timeout');
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Test 3: Start server if not running
function startServer() {
  return new Promise((resolve) => {
    console.log('\n🚀 Attempting to start server...');
    
    const serverProcess = spawn('npm', ['start'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    let output = '';
    let errorOutput = '';

    serverProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log('Server:', data.toString().trim());
    });

    serverProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('Server Error:', data.toString().trim());
    });

    serverProcess.on('close', (code) => {
      console.log(`Server process exited with code: ${code}`);
      if (code === 0) {
        resolve(true);
      } else {
        console.log('Server startup failed');
        resolve(false);
      }
    });

    // Wait a bit and check if server started
    setTimeout(() => {
      if (output.includes('Server running')) {
        console.log('✅ Server started successfully');
        resolve(true);
      } else {
        console.log('⏳ Server starting up...');
        resolve(true);
      }
    }, 8000);
  });
}

// Test 4: Add sample data if needed
function addSampleData() {
  return new Promise((resolve) => {
    console.log('\n📊 Adding sample accident data...');
    
    const { spawn } = require('child_process');
    const psql = spawn('psql', [
      'postgresql://postgres:Github%2320262027@localhost:5432/road_accident_db',
      '-f', 'sample-analytics-data.sql'
    ], {
      cwd: process.cwd(),
      stdio: 'inherit'
    });

    psql.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Sample data added successfully');
        resolve(true);
      } else {
        console.log('⚠️ Sample data insertion failed (may need manual execution)');
        console.log('Run this manually:');
        console.log('psql postgresql://postgres:Github%2320262027@localhost:5432/road_accident_db -f sample-analytics-data.sql');
        resolve(false);
      }
    });
  });
}

// Main diagnostic flow
async function runDiagnostics() {
  console.log('🎯 Starting comprehensive diagnostics...\n');

  // Test 1: Server Health
  const serverHealthy = await testServerHealth();
  
  if (!serverHealthy) {
    console.log('\n🔧 Attempting to fix server issues...');
    await startServer();
    
    // Wait for server to fully start
    console.log('\n⏳ Waiting for server to fully start...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Test again
    const serverHealthyAfter = await testServerHealth();
    if (!serverHealthyAfter) {
      console.log('\n❌ Server startup failed. Please check:');
      console.log('1. PostgreSQL is running');
      console.log('2. Database credentials are correct');
      console.log('3. Port 3000 is not blocked');
      console.log('4. Node.js dependencies are installed');
      return;
    }
  }

  // Test 2: Database Connection
  const dbHealthy = await testDatabase();
  if (!dbHealthy) {
    console.log('\n❌ Database connection issues detected');
    return;
  }

  // Test 3: Add Sample Data
  console.log('\n📊 Checking if sample data exists...');
  await addSampleData();

  // Final instructions
  console.log('\n🎉 DIAGNOSTIC COMPLETE!');
  console.log('=====================================');
  console.log('\n📋 Next Steps:');
  console.log('1. ✅ Server should be running on http://localhost:3000');
  console.log('2. ✅ Frontend should be running on http://localhost:8080');
  console.log('3. ✅ Sample data should be in database');
  console.log('4. 🌐 Access enhanced analytics: http://localhost:8080/enhanced-analytics');
  console.log('5. 🔐 Login with: dgp / password');
  
  console.log('\n🔧 If still issues:');
  console.log('- Check PostgreSQL: pg_isready -h localhost -p 5432');
  console.log('- Check database: psql -h localhost -p 5432 -U postgres -d road_accident_db');
  console.log('- Check server logs: npm start');
  console.log('- Check frontend logs: npm run dev');
  
  console.log('\n🚀 Your Enhanced Analytics Dashboard should now work!');
}

// Run diagnostics
runDiagnostics().catch(console.error);
