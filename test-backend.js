// Simple test to verify backend is working
const testBackend = async () => {
    console.log('🔍 Testing backend connectivity...');
    
    try {
        // Test 1: Health check
        console.log('Testing health endpoint...');
        const healthResponse = await fetch('http://localhost:3000/api/health');
        if (healthResponse.ok) {
            console.log('✅ Backend health check passed');
        } else {
            console.log('❌ Backend health check failed');
        }
        
        // Test 2: Ultra-optimized RAG
        console.log('Testing ultra-optimized RAG...');
        const ragResponse = await fetch('http://localhost:3000/api/rag/analyze-ultra', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token'
            },
            body: JSON.stringify({
                submissionId: 'test-id',
                question: 'What are the main causes of traffic accidents?'
            })
        });
        
        if (ragResponse.ok) {
            const data = await ragResponse.json();
            console.log('✅ Ultra-optimized RAG working!');
            console.log('📊 Response length:', data.response?.length || 0);
            console.log('⚡ Response preview:', data.response?.substring(0, 100) || 'No response');
        } else {
            console.log('❌ Ultra-optimized RAG failed');
            const errorData = await ragResponse.json().catch(() => ({}));
            console.log('Error:', errorData.error || 'Unknown error');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
};

testBackend();
