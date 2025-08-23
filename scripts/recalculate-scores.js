// Script to trigger score recalculation for all users
// This simulates what happens when scans are uploaded/updated

const API_BASE = 'http://localhost:3001';

async function triggerScoreRecalculation() {
  console.log('Triggering score recalculation...');
  
  try {
    // We'll make a request to the leaderboard endpoint which should trigger score calculation
    // But first let's try to find a user and make a scan request to trigger recalculation
    
    // Get all users first
    const usersResponse = await fetch(`${API_BASE}/api/contestants`);
    if (!usersResponse.ok) {
      throw new Error(`Failed to fetch users: ${usersResponse.status}`);
    }
    
    const users = await usersResponse.json();
    console.log(`Found ${users.length} users`);
    
    // For users with 2+ scans, we need to trigger score calculation
    // We can do this by making a request that would normally trigger recalculation
    
    // Let's check the leaderboard endpoint
    const leaderboardResponse = await fetch(`${API_BASE}/api/leaderboard`);
    if (!leaderboardResponse.ok) {
      throw new Error(`Failed to fetch leaderboard: ${leaderboardResponse.status}`);
    }
    
    const leaderboard = await leaderboardResponse.json();
    console.log(`Leaderboard has ${leaderboard.length} entries`);
    
    if (leaderboard.length === 0) {
      console.log('No leaderboard entries found. The scoring system needs manual database intervention.');
      console.log('This is expected after a database reset. The backend needs to calculate scores for users with 2+ scans.');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the script
triggerScoreRecalculation();