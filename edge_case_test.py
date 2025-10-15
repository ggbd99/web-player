#!/usr/bin/env python3
"""
Edge case tests for TMDB API
"""

import requests
import json

BASE_URL = "https://adaptive-tv-layout.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def test_edge_cases():
    """Test various edge cases"""
    print("🧪 Testing TMDB API Edge Cases")
    print("=" * 40)
    
    session = requests.Session()
    
    # Test 1: Search with special characters
    print("Test 1: Search with special characters...")
    response = session.get(f"{API_BASE}/tmdb/search", params={"q": "Spider-Man: No Way Home"})
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Special characters handled correctly - {len(data.get('results', []))} results")
    else:
        print(f"❌ Special characters failed - Status: {response.status_code}")
    
    # Test 2: Search with empty query
    print("\nTest 2: Search with empty query...")
    response = session.get(f"{API_BASE}/tmdb/search", params={"q": ""})
    if response.status_code == 400:
        print("✅ Empty query correctly rejected")
    else:
        print(f"❌ Empty query should return 400 - Got: {response.status_code}")
    
    # Test 3: Large page numbers
    print("\nTest 3: Large page numbers...")
    response = session.get(f"{API_BASE}/tmdb/popular/movies", params={"page": "999"})
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Large page number handled - {len(data.get('results', []))} results")
    else:
        print(f"❌ Large page number failed - Status: {response.status_code}")
    
    # Test 4: Invalid TV season
    print("\nTest 4: Invalid TV season...")
    response = session.get(f"{API_BASE}/tmdb/tv/1396/season/999")
    if response.status_code in [404, 500]:
        print("✅ Invalid season correctly handled")
    else:
        print(f"⚠️  Invalid season returned: {response.status_code}")
    
    # Test 5: Discover with filters
    print("\nTest 5: Discover with multiple filters...")
    params = {
        "type": "movie",
        "genre": "28",  # Action
        "year": "2023",
        "sort_by": "vote_average.desc"
    }
    response = session.get(f"{API_BASE}/tmdb/discover", params=params)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Filtered discover works - {len(data.get('results', []))} results")
    else:
        print(f"❌ Filtered discover failed - Status: {response.status_code}")
    
    # Test 6: Trending with different time windows
    print("\nTest 6: Trending with different time windows...")
    for time_window in ["day", "week"]:
        response = session.get(f"{API_BASE}/tmdb/trending", params={"time": time_window})
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Trending {time_window} works - {len(data.get('results', []))} results")
        else:
            print(f"❌ Trending {time_window} failed - Status: {response.status_code}")
    
    print("\n" + "=" * 40)
    print("Edge case testing completed!")

if __name__ == "__main__":
    test_edge_cases()