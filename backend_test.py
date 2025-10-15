#!/usr/bin/env python3
"""
VidKing Backend API Test Suite
Tests all TMDB API endpoints for functionality, caching, CORS, and error handling
"""

import requests
import json
import time
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://adaptive-tv-layout.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class TMDBAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.cache_test_results = []
        
    def log_result(self, test_name: str, success: bool, message: str, details: Optional[Dict] = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {}
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def make_request(self, endpoint: str, params: Optional[Dict] = None) -> tuple[bool, Dict, int]:
        """Make API request and return success, data, status_code"""
        try:
            url = f"{API_BASE}{endpoint}"
            response = self.session.get(url, params=params, timeout=30)
            
            # Check if response is JSON
            try:
                data = response.json()
            except json.JSONDecodeError:
                return False, {"error": "Invalid JSON response", "text": response.text[:200]}, response.status_code
            
            return response.status_code == 200, data, response.status_code
            
        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0
    
    def test_health_check(self):
        """Test basic API health"""
        success, data, status = self.make_request("/")
        
        if success and "message" in data:
            self.log_result("Health Check", True, "API is responding correctly")
        else:
            self.log_result("Health Check", False, f"API health check failed", 
                          {"status": status, "data": data})
    
    def test_cors_headers(self):
        """Test CORS headers are properly set"""
        try:
            response = self.session.options(f"{API_BASE}/tmdb/trending")
            headers = response.headers
            
            cors_headers = {
                'Access-Control-Allow-Origin': headers.get('Access-Control-Allow-Origin'),
                'Access-Control-Allow-Methods': headers.get('Access-Control-Allow-Methods'),
                'Access-Control-Allow-Headers': headers.get('Access-Control-Allow-Headers')
            }
            
            if cors_headers['Access-Control-Allow-Origin']:
                self.log_result("CORS Headers", True, "CORS headers properly configured", cors_headers)
            else:
                self.log_result("CORS Headers", False, "CORS headers missing", cors_headers)
                
        except Exception as e:
            self.log_result("CORS Headers", False, f"CORS test failed: {str(e)}")
    
    def test_search_endpoint(self):
        """Test /api/tmdb/search endpoint"""
        # Test with valid query
        success, data, status = self.make_request("/tmdb/search", {"q": "Avengers"})
        
        if success and "results" in data:
            results_count = len(data["results"])
            self.log_result("Search - Valid Query", True, 
                          f"Search returned {results_count} results")
        else:
            self.log_result("Search - Valid Query", False, 
                          "Search failed or invalid response structure", 
                          {"status": status, "data": data})
        
        # Test without query parameter
        success, data, status = self.make_request("/tmdb/search")
        
        if not success and status == 400:
            self.log_result("Search - Missing Query", True, 
                          "Correctly returns 400 for missing query parameter")
        else:
            self.log_result("Search - Missing Query", False, 
                          "Should return 400 for missing query parameter",
                          {"status": status, "data": data})
    
    def test_trending_endpoint(self):
        """Test /api/tmdb/trending endpoint"""
        # Test default trending
        success, data, status = self.make_request("/tmdb/trending")
        
        if success and "results" in data:
            results_count = len(data["results"])
            self.log_result("Trending - Default", True, 
                          f"Trending returned {results_count} results")
        else:
            self.log_result("Trending - Default", False, 
                          "Trending failed or invalid response", 
                          {"status": status, "data": data})
        
        # Test with parameters
        success, data, status = self.make_request("/tmdb/trending", 
                                                {"type": "movie", "time": "day"})
        
        if success and "results" in data:
            self.log_result("Trending - With Params", True, 
                          "Trending with parameters works correctly")
        else:
            self.log_result("Trending - With Params", False, 
                          "Trending with parameters failed",
                          {"status": status, "data": data})
    
    def test_popular_movies(self):
        """Test /api/tmdb/popular/movies endpoint"""
        success, data, status = self.make_request("/tmdb/popular/movies")
        
        if success and "results" in data:
            results_count = len(data["results"])
            self.log_result("Popular Movies", True, 
                          f"Popular movies returned {results_count} results")
        else:
            self.log_result("Popular Movies", False, 
                          "Popular movies failed", 
                          {"status": status, "data": data})
    
    def test_popular_tv(self):
        """Test /api/tmdb/popular/tv endpoint"""
        success, data, status = self.make_request("/tmdb/popular/tv")
        
        if success and "results" in data:
            results_count = len(data["results"])
            self.log_result("Popular TV Shows", True, 
                          f"Popular TV shows returned {results_count} results")
        else:
            self.log_result("Popular TV Shows", False, 
                          "Popular TV shows failed", 
                          {"status": status, "data": data})
    
    def test_movie_details(self):
        """Test /api/tmdb/movie/{id} endpoint"""
        # Test with a known movie ID (The Avengers)
        movie_id = "24428"
        success, data, status = self.make_request(f"/tmdb/movie/{movie_id}")
        
        if success and "title" in data and "id" in data:
            self.log_result("Movie Details", True, 
                          f"Movie details retrieved for '{data.get('title', 'Unknown')}'")
        else:
            self.log_result("Movie Details", False, 
                          "Movie details failed", 
                          {"status": status, "data": data})
        
        # Test with invalid movie ID
        success, data, status = self.make_request("/tmdb/movie/999999999")
        
        if not success:
            self.log_result("Movie Details - Invalid ID", True, 
                          "Correctly handles invalid movie ID")
        else:
            self.log_result("Movie Details - Invalid ID", False, 
                          "Should fail for invalid movie ID")
    
    def test_tv_details(self):
        """Test /api/tmdb/tv/{id} endpoint"""
        # Test with a known TV show ID (Breaking Bad)
        tv_id = "1396"
        success, data, status = self.make_request(f"/tmdb/tv/{tv_id}")
        
        if success and "name" in data and "id" in data:
            self.log_result("TV Details", True, 
                          f"TV details retrieved for '{data.get('name', 'Unknown')}'")
        else:
            self.log_result("TV Details", False, 
                          "TV details failed", 
                          {"status": status, "data": data})
    
    def test_tv_season_details(self):
        """Test /api/tmdb/tv/{id}/season/{season} endpoint"""
        # Test with Breaking Bad Season 1
        tv_id = "1396"
        season = "1"
        success, data, status = self.make_request(f"/tmdb/tv/{tv_id}/season/{season}")
        
        if success and "episodes" in data:
            episodes_count = len(data["episodes"])
            self.log_result("TV Season Details", True, 
                          f"Season details retrieved with {episodes_count} episodes")
        else:
            self.log_result("TV Season Details", False, 
                          "TV season details failed", 
                          {"status": status, "data": data})
    
    def test_caching_functionality(self):
        """Test that caching is working (15-minute TTL)"""
        endpoint = "/tmdb/trending"
        
        # First request
        start_time = time.time()
        success1, data1, status1 = self.make_request(endpoint)
        first_request_time = time.time() - start_time
        
        # Second request (should be cached)
        start_time = time.time()
        success2, data2, status2 = self.make_request(endpoint)
        second_request_time = time.time() - start_time
        
        if success1 and success2:
            # Cache should make second request significantly faster
            if second_request_time < first_request_time * 0.5:
                self.log_result("Caching Functionality", True, 
                              f"Caching appears to be working (1st: {first_request_time:.2f}s, 2nd: {second_request_time:.2f}s)")
            else:
                self.log_result("Caching Functionality", False, 
                              f"Caching may not be working (1st: {first_request_time:.2f}s, 2nd: {second_request_time:.2f}s)")
        else:
            self.log_result("Caching Functionality", False, 
                          "Cannot test caching due to request failures")
    
    def test_additional_endpoints(self):
        """Test additional TMDB endpoints"""
        endpoints = [
            ("/tmdb/top-rated/movies", "Top Rated Movies"),
            ("/tmdb/top-rated/tv", "Top Rated TV"),
            ("/tmdb/now-playing", "Now Playing Movies"),
            ("/tmdb/upcoming", "Upcoming Movies"),
            ("/tmdb/discover?type=movie", "Discover Movies")
        ]
        
        for endpoint, name in endpoints:
            success, data, status = self.make_request(endpoint)
            
            if success and "results" in data:
                results_count = len(data["results"])
                self.log_result(name, True, f"Returned {results_count} results")
            else:
                self.log_result(name, False, f"Failed to retrieve data", 
                              {"status": status, "data": data})
    
    def test_error_handling(self):
        """Test error handling for invalid routes"""
        success, data, status = self.make_request("/tmdb/invalid-route")
        
        if not success and status == 404:
            self.log_result("Error Handling - Invalid Route", True, 
                          "Correctly returns 404 for invalid routes")
        else:
            self.log_result("Error Handling - Invalid Route", False, 
                          "Should return 404 for invalid routes",
                          {"status": status, "data": data})
    
    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting VidKing TMDB API Backend Tests")
        print("=" * 60)
        
        # Core functionality tests
        self.test_health_check()
        self.test_cors_headers()
        self.test_search_endpoint()
        self.test_trending_endpoint()
        self.test_popular_movies()
        self.test_popular_tv()
        self.test_movie_details()
        self.test_tv_details()
        self.test_tv_season_details()
        
        # Performance and additional tests
        self.test_caching_functionality()
        self.test_additional_endpoints()
        self.test_error_handling()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        return passed == total

if __name__ == "__main__":
    tester = TMDBAPITester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed! TMDB API backend is working correctly.")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Please check the issues above.")
        sys.exit(1)