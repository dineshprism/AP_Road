// Test transformers directly
const { pipeline } = require('@xenova/transformers');

async function testTransformers() {
  try {
    console.log('Testing transformers...');
    
    // Create pipeline
    const pipe = await pipeline('text-generation', 'microsoft/phi-3-mini-4k-instruct');
    
    // Test the pipeline
    const result = await pipe('Analyze this traffic accident: A car crashed into a tree on NH-16 during rainy season. What were the main causes?', {
      max_new_tokens: 512
    });
    
    console.log('✅ Transformers working!');
    console.log('Response:', result[0]?.generated_text);
    
    return result[0]?.generated_text;
  } catch (error) {
    console.error('❌ Transformers error:', error);
    return null;
  }
}

testTransformers().then(response => {
  if (response) {
    console.log('🎉 SUCCESS: Transformers is working perfectly!');
    console.log('📝 Response:', response);
  } else {
    console.log('❌ FAILED: Transformers not working');
  }
});
