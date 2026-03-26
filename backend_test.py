import requests
import sys
import json
from datetime import datetime

class PlanningPokerAPITester:
    def __init__(self, base_url="https://poker-mvp-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.room_hash = None
        self.story_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test API health endpoint"""
        success, response = self.run_test(
            "API Health Check",
            "GET",
            "",
            200
        )
        return success

    def test_signup(self, name, email, password):
        """Test user signup"""
        success, response = self.run_test(
            "User Signup",
            "POST",
            "auth/signup",
            200,
            data={"name": name, "email": email, "password": password}
        )
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_login(self, email, password):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_auth_me(self):
        """Test auth session check"""
        success, response = self.run_test(
            "Auth Session Check",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_create_room(self, room_name="Test Planning Poker"):
        """Test room creation"""
        success, response = self.run_test(
            "Create Room",
            "POST",
            "rooms",
            200,
            data={"name": room_name}
        )
        if success and 'link_hash' in response:
            self.room_hash = response['link_hash']
            print(f"   Room hash: {self.room_hash}")
            return True
        return False

    def test_get_room(self, room_hash=None):
        """Test get room with stories"""
        hash_to_use = room_hash or self.room_hash
        if not hash_to_use:
            print("❌ No room hash available")
            return False
            
        success, response = self.run_test(
            "Get Room",
            "GET",
            f"rooms/{hash_to_use}",
            200
        )
        return success

    def test_create_story(self, title="Test Story", description="Test description"):
        """Test story creation"""
        if not self.room_hash:
            print("❌ No room hash available")
            return False
            
        success, response = self.run_test(
            "Create Story",
            "POST",
            f"rooms/{self.room_hash}/stories",
            200,
            data={"title": title, "description": description}
        )
        if success and 'id' in response:
            self.story_id = response['id']
            print(f"   Story ID: {self.story_id}")
            return True
        return False

    def test_update_story_status(self, status="voting"):
        """Test story status update"""
        if not self.story_id:
            print("❌ No story ID available")
            return False
            
        success, response = self.run_test(
            f"Update Story Status to {status}",
            "PATCH",
            f"stories/{self.story_id}",
            200,
            data={"status": status}
        )
        return success

    def test_submit_vote(self, value="5"):
        """Test vote submission"""
        if not self.story_id:
            print("❌ No story ID available")
            return False
            
        success, response = self.run_test(
            "Submit Vote",
            "POST",
            f"stories/{self.story_id}/vote",
            200,
            data={
                "voter_name": "Test Voter",
                "voter_id": f"test_voter_{datetime.now().strftime('%H%M%S')}",
                "value": value
            }
        )
        return success

    def test_csv_export(self):
        """Test CSV export"""
        if not self.room_hash:
            print("❌ No room hash available")
            return False
            
        # For CSV export, we expect different content type
        url = f"{self.api_url}/rooms/{self.room_hash}/export"
        headers = {}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
            
        self.tests_run += 1
        print(f"\n🔍 Testing CSV Export...")
        print(f"   URL: {url}")
        
        try:
            response = requests.get(url, headers=headers)
            success = response.status_code == 200
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                print(f"   Content-Type: {response.headers.get('content-type', 'N/A')}")
                print(f"   Content preview: {response.text[:100]}...")
                return True
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

    def test_existing_room(self, room_hash="49ec9ac815b3"):
        """Test existing room with stories"""
        success, response = self.run_test(
            f"Get Existing Room {room_hash}",
            "GET",
            f"rooms/{room_hash}",
            200
        )
        if success:
            stories = response.get('stories', [])
            print(f"   Found {len(stories)} stories")
            for story in stories[:3]:  # Show first 3 stories
                print(f"   - {story['title']} ({story['status']})")
        return success

def main():
    # Setup
    tester = PlanningPokerAPITester()
    timestamp = datetime.now().strftime('%H%M%S')
    test_email = f"test_user_{timestamp}@test.com"
    test_password = "TestPass123!"
    test_name = f"Test User {timestamp}"

    print("🚀 Starting Planning Poker API Tests")
    print(f"Backend URL: {tester.base_url}")
    print("=" * 50)

    # Test 1: Health Check
    if not tester.test_health_check():
        print("❌ Health check failed, stopping tests")
        return 1

    # Test 2: Test existing room first
    tester.test_existing_room()

    # Test 3: Test with existing user
    print(f"\n📝 Testing with existing user: po@test.com")
    if tester.test_login("po@test.com", "test123456"):
        # Test authenticated endpoints
        tester.test_auth_me()
        
        # Test room creation
        if tester.test_create_room("Test Room from API"):
            tester.test_get_room()
            
            # Test story operations
            if tester.test_create_story("API Test Story", "Testing story creation via API"):
                # Test voting flow
                tester.test_update_story_status("voting")
                tester.test_submit_vote("8")
                tester.test_update_story_status("completed")
                tester.test_update_story_status("ready")
                
                # Test CSV export
                tester.test_csv_export()

    # Test 4: Test signup with new user
    print(f"\n📝 Testing signup with new user: {test_email}")
    if tester.test_signup(test_name, test_email, test_password):
        tester.test_auth_me()

    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Tests completed: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())