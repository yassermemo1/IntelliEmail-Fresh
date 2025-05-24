// Simple API key test script
import { OpenAI } from 'openai';

const TEST_KEY = process.env.OPENAI_API_KEY || 'your-openai-api-key-here';

async function testOpenAIKey() {
  console.log("Testing OpenAI API key...");
  
  try {
    const openai = new OpenAI({
      apiKey: TEST_KEY,
    });
    
    console.log("Making API call to list models...");
    const response = await openai.models.list();
    
    if (response && Array.isArray(response.data)) {
      console.log(`Success! Found ${response.data.length} models available.`);
      console.log("First few models:", response.data.slice(0, 3).map(m => m.id));
      return true;
    } else {
      console.log("API call succeeded but returned unexpected data format");
      console.log("Response:", response);
      return false;
    }
  } catch (error) {
    console.error("API call failed with error:", error.message);
    if (error.response) {
      console.error("Error response:", error.response.data);
    }
    return false;
  }
}

// Run the test
testOpenAIKey().then(result => {
  console.log("Test completed with result:", result ? "SUCCESS" : "FAILURE");
});