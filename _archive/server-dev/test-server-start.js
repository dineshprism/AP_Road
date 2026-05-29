const http = require('http');
const { spawn } = require('child_process');

console.log('🔍 Testing server startup...');

// Test 1: Check if port 3000 is available
const testPort = () => {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/health',
      timeout: 2000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('✅ Server is running!');
        console.log('Response:', data);
        resolve(true);
      });
    });

    req.on('error', (err) => {
      console.log('❌ Server not responding:', err.message);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log('❌ Server timeout');
      req.destroy();
      resolve(false);
    });

    req.end();
  });
};

// Test 2: Try to start server
const startServer = () => {
  console.log('🚀 Attempting to start server...');
  
  const serverProcess = spawn('node', ['dist/index.js'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    shell: true
  });

  let output = '';
  serverProcess.stdout.on('data', (data) => {
    output += data.toString();
    console.log('Server:', data.toString().trim());
  });

  serverProcess.stderr.on('data', (data) => {
    console.error('Server Error:', data.toString().trim());
  });

  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code: ${code}`);
  });

  // Wait a bit and test
  setTimeout(async () => {
    const isRunning = await testPort();
    if (isRunning) {
      console.log('✅ SUCCESS: Server is running on port 3000');
      console.log('🎯 You can now test your Gemini AI system!');
    } else {
      console.log('❌ FAILED: Server is not responding');
      console.log('🔧 Check the server output above for errors');
    }
  }, 5000);
};

// Run the test
startServer();
