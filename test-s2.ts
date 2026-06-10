import { searchSemanticScholar } from './lib/semanticScholarClient';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env.local manually since dotenv isn't installed
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
} catch {
  console.error("Could not load .env.local natively.");
}

async function run() {
  console.log('Testing Semantic Scholar API key:', process.env.SEMANTIC_SCHOLAR_API_KEY ? 'Loaded' : 'Not Found');
  
  try {
    const results = await searchSemanticScholar('transformer models in NLP');
    console.log(`\nSuccess! Found ${results.length} results.`);
    if (results.length > 0) {
      console.log('\nTop result:');
      console.log(`- Title: ${results[0].title}`);
      console.log(`- Authors: ${results[0].authors.join(', ')}`);
      console.log(`- Year: ${results[0].year}`);
      console.log(`- Citations: ${results[0].citationCount}`);
    }
  } catch (err) {
    console.error('Error during search:', err);
  }
}

run();
