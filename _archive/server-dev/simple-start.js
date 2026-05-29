console.log("🚀 Simple Server Start Test");
console.log("Node version:", process.version);
console.log("Current directory:", process.cwd());
console.log("Environment GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "SET" : "NOT SET");

try {
  require('./dist/index.js');
  console.log("✅ Server started successfully");
} catch (error) {
  console.error("❌ Server start failed:", error.message);
  console.error("Full error:", error);
}
