-- Initialize scoring data for users with 2+ DEXA scans
-- This creates placeholder scoring records that will trigger the leaderboard to show users

-- Insert initial scoring data for users with 2+ scans
INSERT INTO scoring_data (
    id, 
    user_id, 
    fat_loss_score, 
    muscle_gain_score, 
    total_score, 
    fat_loss_raw, 
    muscle_gain_raw,
    last_calculated,
    created_at, 
    updated_at
)
SELECT 
    'scoring-' || u.username || '-' || hex(randomblob(4)),
    u.id,
    0.0, -- Will be calculated by backend
    0.0, -- Will be calculated by backend  
    0.1, -- Small non-zero value to appear on leaderboard
    0.0,
    0.0,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
FROM users u
WHERE u.id IN (
    SELECT ds.user_id 
    FROM dexa_scans ds 
    GROUP BY ds.user_id 
    HAVING COUNT(ds.id) >= 2
)
AND u.id NOT IN (
    SELECT DISTINCT sd.user_id 
    FROM scoring_data sd
);