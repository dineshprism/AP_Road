# 🔧 Gemini AI RAG Troubleshooting Guide

## **❌ Problem: "AI Analysis Failed: undefined"**

### **🔍 Root Cause Analysis:**
This error typically occurs when:
1. ❌ **Server not running properly**
2. ❌ **Gemini API key issues**
3. ❌ **Environment variables not loaded**
4. ❌ **Database connection problems**
5. ❌ **CORS issues**

## **🚀 Step-by-Step Fix:**

### **Step 1: Verify Server is Running**
```bash
# Check if server responds
curl http://localhost:3000/api/health

# Should return: {"status":"ok","timestamp":"..."}

# If no response, server is not running
```

### **Step 2: Check Environment Variables**
```bash
# Check if Gemini API key is set
cd server
cat .env | grep GEMINI_API_KEY

# Should show: GEMINI_API_KEY=AIzaSyDOzvVEl2ixsUtWvz87YIerN2gqNeofPAQ

# If not set, add it to .env file
```

### **Step 3: Start Server Manually**
```bash
# Option 1: Using npm start
cd server
npm start

# Option 2: Direct node execution
cd server
node dist/index.js

# Option 3: With error logging
cd server
node simple-start.js
```

### **Step 4: Check Server Logs**
```bash
# Look for these specific errors:
- "Cannot find module '@google/generative-ai'"
- "GEMINI_API_KEY not found"
- "Database connection failed"
- "Port 3000 already in use"
```

## **🔧 Common Issues & Solutions:**

### **Issue 1: Port 3000 Already in Use**
```bash
# Kill existing processes
taskkill /F /IM node.exe /T

# Or check what's using port 3000
netstat -an | findstr :3000

# Then restart server
cd server && npm start
```

### **Issue 2: Gemini API Key Problems**
```bash
# Verify API key format
# Should be like: AIzaSyDOzvVEl2ixsUtWvz87YIerN2gqNeofPAQ

# Test API key directly
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent" \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: YOUR_API_KEY" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

### **Issue 3: Environment Variables Not Loading**
```bash
# Check .env file location
cd server
ls -la .env*

# Ensure .env file contains:
GEMINI_API_KEY=AIzaSyDOzvVEl2ixsUtWvz87YIerN2gqNeofPAQ
DATABASE_URL=postgresql://postgres:Github%2320262027@localhost:5432/road_accident_db
JWT_SECRET=aP_rOaD_sAfEtY_sEcReT_kEy_2026_cHaNgE_tHiS_iN_pRoDuCtIoN_x9k2m
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:8080
```

### **Issue 4: Database Connection Problems**
```bash
# Test database connection
psql "postgresql://postgres:Github%2320262027@localhost:5432/road_accident_db" -c "\l"

# If connection fails, check:
# 1. PostgreSQL is running
# 2. Database exists
# 3. Credentials are correct
```

## **🧪 Advanced Debugging:**

### **Debug Mode 1: Verbose Server**
```bash
cd server
DEBUG=* npm start
```

### **Debug Mode 2: Test Individual Components**
```bash
# Test Gemini API only
node test-gemini.js

# Test database only
node -e "require('./db.js').query('SELECT 1').then(r => console.log('DB OK')).catch(e => console.error('DB Error:', e))"
```

### **Debug Mode 3: Check Network**
```bash
# Test if port 3000 is accessible
telnet localhost 3000

# Check CORS
curl -H "Origin: http://localhost:8080" http://localhost:3000/api/health
```

## **🎯 Expected Working State:**

### **✅ Server Running:**
- 🟢 Health check: `{"status":"ok"}`
- 🟢 Port 3000: Listening
- 🟢 No console errors
- 🟢 Gemini API key loaded

### **✅ Gemini Working:**
- 🟢 API key valid
- 🟢 Model responding: `gemini-1.5-flash`
- 🟢 Test requests successful
- 🟢 Analysis responses within 2-5 seconds

### **✅ Frontend Working:**
- 🟢 App loads at http://localhost:8080
- 🟢 Login works
- 🟢 "🤖 Gemini AI" button visible
- 🟢 "Analyse" button responds
- 🟢 AI responses appear

## **🔥 Quick Fix Commands:**

### **Complete Reset:**
```bash
# 1. Kill all Node processes
taskkill /F /IM node.exe /T

# 2. Clean and rebuild
cd server
rm -rf dist
npm run build

# 3. Start fresh
npm start

# 4. Test immediately
curl http://localhost:3000/api/health
```

### **Environment Check:**
```bash
cd server
echo "=== Environment Check ==="
echo "Node version:" $(node --version)
echo "NPM version:" $(npm --version)
echo "Gemini API Key:" $(grep GEMINI_API_KEY .env || echo "NOT SET")
echo "Database URL:" $(grep DATABASE_URL .env || echo "NOT SET")
```

## **📞 If Still Not Working:**

### **Check These Files:**
1. **server/.env** - Contains correct Gemini API key?
2. **server/dist/index.js** - Compiled successfully?
3. **server/package.json** - Has @google/generative-ai?
4. **browser console** - Any JavaScript errors?

### **Test This Sequence:**
1. `cd server && npm start`
2. Wait for "Server running on port 3000"
3. `curl http://localhost:3000/api/health`
4. Open http://localhost:8080
5. Login and click "Analyse"

## **🎉 Success Indicators:**

### **✅ When Working:**
- 🟢 Server console: "Server running on port 3000"
- 🟢 Health check: `{"status":"ok"}`
- 🟢 Gemini test: "✅ Gemini Response: ..."
- 🟢 Frontend: "🤖 Gemini AI" button works
- 🟢 Analysis: AI responses within 2-5 seconds

### **❌ When Broken:**
- 🔴 Server: No "running on port 3000" message
- 🔴 Health check: Connection refused
- 🔴 Gemini: API key errors
- 🔴 Frontend: "AI Analysis Failed: undefined"

## **🚀 Final Verification:**

Once everything is working, you should see:
1. ✅ **Backend**: Running on port 3000
2. ✅ **Gemini AI**: Responding to requests
3. ✅ **Frontend**: Loading at http://localhost:8080
4. ✅ **Analysis**: Working with 2-5 second responses
5. ✅ **Chat**: Smooth AI conversation

**Your Gemini AI RAG system should now be fully functional!** 🎉✨
