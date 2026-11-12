// infra/smoke-bifrost.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { bifrostChat } from '../src/server/bifrost/client';
import { getAllModelProfiles } from '../src/server/bifrost/profiles';

async function testBifrost() {
  console.log('Testing Bifrost Gateway connection with Gemini...');
  
  const profiles = getAllModelProfiles();
  console.log('Resolved profiles:', JSON.stringify(profiles, null, 2));

  try {
    const response = await bifrostChat({
      model: 'gemini/gemini-3.5-flash-lite',
      messages: [{ role: 'user', content: 'Hello, how are you?' }],
      timeoutMs: 15000,
      temperature: 2.0,
    });

    console.log('\nSuccess! Response from gateway:');
    console.log(response.trim());
    console.log('\nBifrost smoke test PASSED successfully.');
  } catch (error) {
    console.error('\nBifrost smoke test FAILED:', error);
  }
}

testBifrost();