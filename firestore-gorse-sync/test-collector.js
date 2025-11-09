/**
 * Test script for content collection system
 * 
 * Tests individual fetchers and validates data normalization
 */

const { 
  testSource,
  fetchNewsContent,
  fetchAITechContent,
  fetchScienceContent,
  fetchPoetryContent,
  fetchEnvironmentContent,
} = require('./collector');

async function runTests() {
  console.log('🧪 Testing Content Collection System\n');
  console.log('='.repeat(60));
  
  const results = {
    passed: 0,
    failed: 0,
    tests: [],
  };
  
  // Test 1: Test BBC RSS fetcher
  console.log('\n📰 Test 1: BBC RSS Fetcher');
  try {
    const result = await testSource('bbc');
    if (result.success && result.itemCount > 0) {
      console.log(`✓ PASS: Fetched ${result.itemCount} items from BBC`);
      console.log(`  Sample: "${result.titles[0]}"`);
      results.passed++;
      results.tests.push({ name: 'BBC RSS', status: 'PASS', items: result.itemCount });
    } else {
      console.log(`✗ FAIL: ${result.error || 'No items fetched'}`);
      results.failed++;
      results.tests.push({ name: 'BBC RSS', status: 'FAIL', error: result.error });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'BBC RSS', status: 'FAIL', error: error.message });
  }
  
  // Test 2: Test Medium RSS fetcher
  console.log('\n🤖 Test 2: Medium AI RSS Fetcher');
  try {
    const result = await testSource('medium');
    if (result.success && result.itemCount > 0) {
      console.log(`✓ PASS: Fetched ${result.itemCount} items from Medium`);
      console.log(`  Sample: "${result.titles[0]}"`);
      results.passed++;
      results.tests.push({ name: 'Medium AI', status: 'PASS', items: result.itemCount });
    } else {
      console.log(`✗ FAIL: ${result.error || 'No items fetched'}`);
      results.failed++;
      results.tests.push({ name: 'Medium AI', status: 'FAIL', error: result.error });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Medium AI', status: 'FAIL', error: error.message });
  }
  
  // Test 3: Test arXiv API fetcher
  console.log('\n🔬 Test 3: arXiv API Fetcher');
  try {
    const result = await testSource('arxiv');
    if (result.success && result.itemCount > 0) {
      console.log(`✓ PASS: Fetched ${result.itemCount} items from arXiv`);
      console.log(`  Sample: "${result.titles[0]}"`);
      results.passed++;
      results.tests.push({ name: 'arXiv API', status: 'PASS', items: result.itemCount });
    } else {
      console.log(`✗ FAIL: ${result.error || 'No items fetched'}`);
      results.failed++;
      results.tests.push({ name: 'arXiv API', status: 'FAIL', error: result.error });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'arXiv API', status: 'FAIL', error: error.message });
  }
  
  // Test 4: Test News content group
  console.log('\n📰 Test 4: News Content Group');
  try {
    const newsResults = await fetchNewsContent();
    const totalItems = newsResults.reduce((sum, r) => sum + r.items.length, 0);
    const successCount = newsResults.filter(r => r.success).length;
    
    if (successCount > 0 && totalItems > 0) {
      console.log(`✓ PASS: ${successCount}/${newsResults.length} news sources succeeded`);
      console.log(`  Total items: ${totalItems}`);
      results.passed++;
      results.tests.push({ 
        name: 'News Group', 
        status: 'PASS', 
        sources: successCount,
        items: totalItems 
      });
    } else {
      console.log(`✗ FAIL: No news items fetched`);
      results.failed++;
      results.tests.push({ name: 'News Group', status: 'FAIL' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'News Group', status: 'FAIL', error: error.message });
  }
  
  // Test 5: Test AI/Tech content group
  console.log('\n🤖 Test 5: AI/Tech Content Group');
  try {
    const aiResults = await fetchAITechContent();
    const totalItems = aiResults.reduce((sum, r) => sum + r.items.length, 0);
    const successCount = aiResults.filter(r => r.success).length;
    
    if (successCount > 0 && totalItems > 0) {
      console.log(`✓ PASS: ${successCount}/${aiResults.length} AI/tech sources succeeded`);
      console.log(`  Total items: ${totalItems}`);
      results.passed++;
      results.tests.push({ 
        name: 'AI/Tech Group', 
        status: 'PASS', 
        sources: successCount,
        items: totalItems 
      });
    } else {
      console.log(`✗ FAIL: No AI/tech items fetched`);
      results.failed++;
      results.tests.push({ name: 'AI/Tech Group', status: 'FAIL' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'AI/Tech Group', status: 'FAIL', error: error.message });
  }
  
  // Test 6: Validate data structure
  console.log('\n📋 Test 6: Data Structure Validation');
  try {
    const result = await testSource('bbc');
    if (result.success && result.itemCount > 0) {
      // Get first item from BBC test
      const sampleResult = await fetchNewsContent();
      const firstSource = sampleResult.find(r => r.success && r.items.length > 0);
      
      if (firstSource) {
        const item = firstSource.items[0];
        const requiredFields = ['docId', 'data'];
        const requiredDataFields = ['title', 'excerpt', 'plain_text', 'tags', 'publishedAt', 'source', 'url', 'license', 'contentType'];
        
        const hasAllFields = requiredFields.every(field => item.hasOwnProperty(field));
        const hasAllDataFields = requiredDataFields.every(field => item.data.hasOwnProperty(field));
        
        if (hasAllFields && hasAllDataFields) {
          console.log(`✓ PASS: Data structure is valid`);
          console.log(`  Fields: ${Object.keys(item.data).join(', ')}`);
          console.log(`  License: ${item.data.license}`);
          console.log(`  Content type: ${item.data.contentType}`);
          console.log(`  Tags: ${item.data.tags.join(', ')}`);
          results.passed++;
          results.tests.push({ name: 'Data Structure', status: 'PASS' });
        } else {
          console.log(`✗ FAIL: Missing required fields`);
          results.failed++;
          results.tests.push({ name: 'Data Structure', status: 'FAIL' });
        }
      } else {
        console.log(`✗ FAIL: No items to validate`);
        results.failed++;
        results.tests.push({ name: 'Data Structure', status: 'FAIL' });
      }
    } else {
      console.log(`✗ FAIL: Could not fetch test data`);
      results.failed++;
      results.tests.push({ name: 'Data Structure', status: 'FAIL' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Data Structure', status: 'FAIL', error: error.message });
  }
  
  // Test 7: Validate deduplication (docId generation)
  console.log('\n🔑 Test 7: Deduplication (DocId Generation)');
  try {
    const result = await testSource('bbc');
    if (result.success && result.itemCount > 0) {
      const newsResults = await fetchNewsContent();
      const firstSource = newsResults.find(r => r.success && r.items.length > 0);
      
      if (firstSource && firstSource.items.length >= 2) {
        const item1 = firstSource.items[0];
        const item2 = firstSource.items[1];
        
        // Check that docIds are unique
        const hasDocId = item1.docId && item2.docId;
        const areUnique = item1.docId !== item2.docId;
        const correctLength = item1.docId.length === 20; // MD5 hash truncated to 20 chars
        
        if (hasDocId && areUnique && correctLength) {
          console.log(`✓ PASS: DocId generation works correctly`);
          console.log(`  Sample docId: ${item1.docId}`);
          console.log(`  Length: ${item1.docId.length} chars`);
          results.passed++;
          results.tests.push({ name: 'Deduplication', status: 'PASS' });
        } else {
          console.log(`✗ FAIL: DocId generation issue`);
          results.failed++;
          results.tests.push({ name: 'Deduplication', status: 'FAIL' });
        }
      } else {
        console.log(`⚠ SKIP: Not enough items to test deduplication`);
        results.tests.push({ name: 'Deduplication', status: 'SKIP' });
      }
    } else {
      console.log(`✗ FAIL: Could not fetch test data`);
      results.failed++;
      results.tests.push({ name: 'Deduplication', status: 'FAIL' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Deduplication', status: 'FAIL', error: error.message });
  }
  
  // Test 8: Validate copyright compliance
  console.log('\n⚖️  Test 8: Copyright Compliance');
  try {
    const newsResults = await fetchNewsContent();
    const firstSource = newsResults.find(r => r.success && r.items.length > 0);
    
    if (firstSource) {
      const item = firstSource.items[0];
      const hasLicense = item.data.license !== undefined;
      const excerptLength = item.data.excerpt.length;
      const isExcerptLimited = excerptLength <= 200;
      const hasUrl = item.data.url && item.data.url.length > 0;
      
      if (hasLicense && isExcerptLimited && hasUrl) {
        console.log(`✓ PASS: Copyright compliance validated`);
        console.log(`  License: ${item.data.license}`);
        console.log(`  Excerpt length: ${excerptLength} chars (max 200)`);
        console.log(`  Has URL: ${hasUrl}`);
        results.passed++;
        results.tests.push({ name: 'Copyright Compliance', status: 'PASS' });
      } else {
        console.log(`✗ FAIL: Copyright compliance issue`);
        results.failed++;
        results.tests.push({ name: 'Copyright Compliance', status: 'FAIL' });
      }
    } else {
      console.log(`✗ FAIL: No items to validate`);
      results.failed++;
      results.tests.push({ name: 'Copyright Compliance', status: 'FAIL' });
    }
  } catch (error) {
    console.log(`✗ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Copyright Compliance', status: 'FAIL', error: error.message });
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`Total tests: ${results.passed + results.failed}`);
  console.log(`Passed: ${results.passed} ✓`);
  console.log(`Failed: ${results.failed} ✗`);
  console.log(`Success rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  console.log('\n📋 Detailed Results:');
  results.tests.forEach((test, i) => {
    const icon = test.status === 'PASS' ? '✓' : test.status === 'SKIP' ? '⊘' : '✗';
    console.log(`  ${i + 1}. ${icon} ${test.name}: ${test.status}`);
    if (test.items) console.log(`     Items: ${test.items}`);
    if (test.sources) console.log(`     Sources: ${test.sources}`);
    if (test.error) console.log(`     Error: ${test.error}`);
  });
  
  console.log('\n' + '='.repeat(60));
  
  if (results.failed === 0) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Check errors above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
