import requests
import json

def test_average_calculation():
    """Test that average calculation is correct (6.5 for votes of 5 and 8)"""
    base_url = "https://poker-mvp-1.preview.emergentagent.com"
    api_url = f"{base_url}/api"
    
    # Login as existing user
    login_response = requests.post(f"{api_url}/auth/login", 
                                 json={"email": "po@test.com", "password": "test123456"})
    
    if login_response.status_code != 200:
        print("❌ Login failed")
        return False
        
    token = login_response.json()['token']
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    
    # Create a new room
    room_response = requests.post(f"{api_url}/rooms", 
                                json={"name": "Average Test Room"}, 
                                headers=headers)
    
    if room_response.status_code != 200:
        print("❌ Room creation failed")
        return False
        
    room_hash = room_response.json()['link_hash']
    print(f"✅ Created room: {room_hash}")
    
    # Create a story
    story_response = requests.post(f"{api_url}/rooms/{room_hash}/stories",
                                 json={"title": "Average Test Story", "description": "Testing average calculation"},
                                 headers=headers)
    
    if story_response.status_code != 200:
        print("❌ Story creation failed")
        return False
        
    story_id = story_response.json()['id']
    print(f"✅ Created story: {story_id}")
    
    # Start voting
    voting_response = requests.patch(f"{api_url}/stories/{story_id}",
                                   json={"status": "voting"},
                                   headers=headers)
    
    if voting_response.status_code != 200:
        print("❌ Start voting failed")
        return False
        
    print("✅ Started voting")
    
    # Submit vote of 5
    vote1_response = requests.post(f"{api_url}/stories/{story_id}/vote",
                                 json={"voter_name": "Voter 1", "voter_id": "voter1", "value": "5"})
    
    if vote1_response.status_code != 200:
        print("❌ Vote 1 submission failed")
        return False
        
    print("✅ Submitted vote: 5")
    
    # Submit vote of 8
    vote2_response = requests.post(f"{api_url}/stories/{story_id}/vote",
                                 json={"voter_name": "Voter 2", "voter_id": "voter2", "value": "8"})
    
    if vote2_response.status_code != 200:
        print("❌ Vote 2 submission failed")
        return False
        
    print("✅ Submitted vote: 8")
    
    # Reveal votes (complete story)
    reveal_response = requests.patch(f"{api_url}/stories/{story_id}",
                                   json={"status": "completed"},
                                   headers=headers)
    
    if reveal_response.status_code != 200:
        print("❌ Reveal failed")
        return False
        
    story_data = reveal_response.json()
    avg_points = story_data.get('avg_points')
    
    print(f"✅ Revealed votes. Average: {avg_points}")
    
    # Check if average is 6.5
    if avg_points == "6.5":
        print("🎉 Average calculation is correct: 6.5")
        return True
    else:
        print(f"❌ Average calculation is incorrect. Expected: 6.5, Got: {avg_points}")
        return False

if __name__ == "__main__":
    success = test_average_calculation()
    print(f"\nAverage calculation test: {'PASSED' if success else 'FAILED'}")