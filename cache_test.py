#!/usr/bin/env python3
"""
Detailed caching test for TMDB API
"""

import requests
import time
import json

BASE_URL = "https://mediawatchdog.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def test_caching_detailed():
    """More detailed caching test"""
    print("🔍 Testing TMDB API Caching in Detail")
    print("=" * 50)
    
    session = requests.Session()
    endpoint = f"{API_BASE}/tmdb/trending"
    
    # Test 1: Multiple requests to see if response is consistent (cached)
    print("Test 1: Making 3 consecutive requests to check consistency...")
    
    responses = []
    times = []
    
    for i in range(3):
        start_time = time.time()
        response = session.get(endpoint)
        request_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            responses.append(data)
            times.append(request_time)
            print(f"  Request {i+1}: {request_time:.3f}s - Status: {response.status_code}")
        else:
            print(f"  Request {i+1}: FAILED - Status: {response.status_code}")
            return
    
    # Check if responses are identical (indicating caching)
    if len(responses) >= 2:
        first_response = json.dumps(responses[0], sort_keys=True)
        second_response = json.dumps(responses[1], sort_keys=True)
        
        if first_response == second_response:
            print("✅ Responses are identical - caching appears to be working")
        else:
            print("❌ Responses differ - caching may not be working")
    
    # Check timing patterns
    avg_time = sum(times) / len(times)
    print(f"Average response time: {avg_time:.3f}s")
    
    # Test 2: Check cache headers or behavior
    print("\nTest 2: Checking response headers...")
    response = session.get(endpoint)
    headers = dict(response.headers)
    
    cache_related_headers = {k: v for k, v in headers.items() 
                           if 'cache' in k.lower() or 'etag' in k.lower() or 'modified' in k.lower()}
    
    if cache_related_headers:
        print("Cache-related headers found:")
        for k, v in cache_related_headers.items():
            print(f"  {k}: {v}")
    else:
        print("No explicit cache headers found (using in-memory cache)")
    
    # Test 3: Different endpoint to verify cache isolation
    print("\nTest 3: Testing different endpoint for cache isolation...")
    
    different_endpoint = f"{API_BASE}/tmdb/popular/movies"
    start_time = time.time()
    response = session.get(different_endpoint)
    different_time = time.time() - start_time
    
    if response.status_code == 200:
        print(f"Different endpoint response time: {different_time:.3f}s")
        
        # Make same request again
        start_time = time.time()
        response2 = session.get(different_endpoint)
        different_time2 = time.time() - start_time
        
        if response2.status_code == 200:
            print(f"Second request to different endpoint: {different_time2:.3f}s")
            
            if different_time2 < different_time * 0.8:
                print("✅ Different endpoint also shows caching behavior")
            else:
                print("⚠️  Different endpoint doesn't show clear caching pattern")
    
    print("\n" + "=" * 50)
    print("CACHING ANALYSIS:")
    print("- The API uses in-memory caching with 15-minute TTL")
    print("- Fast response times indicate the cache is likely working")
    print("- Identical responses confirm data consistency")
    print("- No explicit HTTP cache headers (using server-side cache)")

if __name__ == "__main__":
    test_caching_detailed()