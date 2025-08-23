-- Update a timestamp to trigger recalculation when the backend processes scans
-- This simulates what happens when a scan is updated, which triggers recalculateAllScores()

UPDATE dexa_scans 
SET updated_at = strftime('%s', 'now') * 1000 
WHERE user_id IN (
    SELECT u.id FROM users u WHERE u.username = 'jaron' LIMIT 1
) 
AND is_baseline = 0;