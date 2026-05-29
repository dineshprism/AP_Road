const { spawn } = require('child_process');
const path = require('path');

console.log("🚀 Starting server with error handling...");

const serverProcess = spawn('node', ['dist/index.js'], {
  cwd: path.resolve(__dirname),
  stdio: 'inherit',
  shell: true
});

serverProcess.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
});

serverProcess.on('close', (code) => {
  console.log(`Server process exited with code: ${code}`);
});

serverProcess.on('stdout', (data) => {
  console.log(`Server: ${data}`);
});

serverProcess.on('stderr', (data) => {
  console.error(`Server Error: ${data}`);
});
