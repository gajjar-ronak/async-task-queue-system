#!/usr/bin/env node

/**
 * Dashboard API Test Script
 * Tests all the API endpoints used by the dashboard to ensure they're working correctly
 */

const baseUrl = 'http://localhost:3002';

const endpoints = [
    // Core task endpoints
    { name: 'Task Stats', url: '/tasks/stats' },
    { name: 'Recent Tasks', url: '/tasks?limit=10' },
    { name: 'Branching/Dependent Tasks', url: '/tasks/recent-branching-dependent?page=1&limit=5' },
    
    // Health endpoints
    { name: 'Health Status', url: '/health' },
    { name: 'Health Stats', url: '/health/stats' },
    { name: 'Health Queue', url: '/health/queue' },
    
    // System endpoints
    { name: 'Performance Summary', url: '/system/performance/summary' },
    { name: 'Active Nodes', url: '/system/nodes/active-count' },
    
    // Workflow endpoints
    { name: 'Workflows', url: '/workflows' },
    
    // CRON endpoints
    { name: 'CRON Stats', url: '/cron/stats' },
    { name: 'CRON Jobs', url: '/cron' },
    
    // DLQ endpoints
    { name: 'DLQ Stats', url: '/api/dlq/stats' },
    { name: 'DLQ Tasks', url: '/api/dlq/tasks?limit=5' },
    
    // Auto-scaling endpoints
    { name: 'Auto-scaling Stats', url: '/api/auto-scaling/stats' },
];

async function testEndpoint(endpoint) {
    try {
        const response = await fetch(`${baseUrl}${endpoint.url}`);
        const data = await response.json();
        
        if (response.ok) {
            console.log(`✅ ${endpoint.name}: OK`);
            return { success: true, endpoint: endpoint.name, data };
        } else {
            console.log(`❌ ${endpoint.name}: HTTP ${response.status}`);
            return { success: false, endpoint: endpoint.name, error: `HTTP ${response.status}` };
        }
    } catch (error) {
        console.log(`❌ ${endpoint.name}: ${error.message}`);
        return { success: false, endpoint: endpoint.name, error: error.message };
    }
}

async function testStressTest() {
    console.log('\n🧪 Testing Stress Test Functionality...');
    
    try {
        // Start a small stress test
        const startResponse = await fetch(`${baseUrl}/stress-test/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                totalTasks: 3,
                durationMinutes: 1,
                taskTypes: ['api-call', 'database-operation'],
                priorityDistribution: { high: 20, medium: 50, low: 30 }
            })
        });
        
        const startData = await startResponse.json();
        
        if (startResponse.ok) {
            console.log(`✅ Stress Test Start: OK (Test ID: ${startData.testId})`);
            
            // Wait a moment and check results
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const resultsResponse = await fetch(`${baseUrl}/stress-test/results/${startData.testId}`);
            const resultsData = await resultsResponse.json();
            
            if (resultsResponse.ok) {
                console.log(`✅ Stress Test Results: OK (Status: ${resultsData.status}, Tasks Created: ${resultsData.tasksCreated})`);
                return { success: true };
            } else {
                console.log(`❌ Stress Test Results: HTTP ${resultsResponse.status}`);
                return { success: false };
            }
        } else {
            console.log(`❌ Stress Test Start: HTTP ${startResponse.status}`);
            return { success: false };
        }
    } catch (error) {
        console.log(`❌ Stress Test: ${error.message}`);
        return { success: false };
    }
}

async function runTests() {
    console.log('🚀 Testing Dashboard API Endpoints...\n');
    
    const results = [];
    
    // Test all endpoints
    for (const endpoint of endpoints) {
        const result = await testEndpoint(endpoint);
        results.push(result);
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between requests
    }
    
    // Test stress test functionality
    const stressTestResult = await testStressTest();
    results.push({ ...stressTestResult, endpoint: 'Stress Test' });
    
    // Summary
    console.log('\n📊 Test Summary:');
    const successful = results.filter(r => r.success).length;
    const total = results.length;
    
    console.log(`✅ Successful: ${successful}/${total}`);
    console.log(`❌ Failed: ${total - successful}/${total}`);
    
    if (successful === total) {
        console.log('\n🎉 All tests passed! Dashboard should be working correctly.');
    } else {
        console.log('\n⚠️  Some tests failed. Check the output above for details.');
        
        const failed = results.filter(r => !r.success);
        console.log('\nFailed endpoints:');
        failed.forEach(f => console.log(`  - ${f.endpoint}: ${f.error || 'Unknown error'}`));
    }
    
    return successful === total;
}

// Run the tests
if (require.main === module) {
    runTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test runner error:', error);
        process.exit(1);
    });
}

module.exports = { runTests, testEndpoint, testStressTest };
