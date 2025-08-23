-- Create 5 new test users with only 1 DEXA scan each
-- This will test the leaderboard behavior for users who don't meet the 2-scan minimum

-- Create test users
INSERT INTO users (id, username, password, name, gender, created_at, updated_at) VALUES
('single1-' || hex(randomblob(8)), 'alice', '$2a$10$example.hash.for.testing.purposes.only', 'Alice Chen', 'female', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('single2-' || hex(randomblob(8)), 'mike', '$2a$10$example.hash.for.testing.purposes.only', 'Mike Johnson', 'male', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('single3-' || hex(randomblob(8)), 'sara', '$2a$10$example.hash.for.testing.purposes.only', 'Sara Williams', 'female', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('single4-' || hex(randomblob(8)), 'alex', '$2a$10$example.hash.for.testing.purposes.only', 'Alex Rodriguez', 'male', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('single5-' || hex(randomblob(8)), 'emma', '$2a$10$example.hash.for.testing.purposes.only', 'Emma Davis', 'female', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Create baseline DEXA scans for each user (only 1 scan each)
-- Alice Chen (Female) - 24% BF, 115 lbs LM
INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, fat_mass, is_baseline, scan_name, notes, created_at, updated_at)
SELECT 
    'baseline-alice-' || hex(randomblob(8)),
    u.id,
    strftime('%s', '2025-08-10') * 1000, -- 6 days after challenge start
    24.0,
    115.0,
    151.3, -- calculated total weight
    36.3, -- calculated fat mass
    1, -- is_baseline = true
    'Baseline DEXA Scan',
    'Just joined the challenge',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
FROM users u WHERE u.username = 'alice';

-- Mike Johnson (Male) - 19% BF, 170 lbs LM  
INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, fat_mass, is_baseline, scan_name, notes, created_at, updated_at)
SELECT 
    'baseline-mike-' || hex(randomblob(8)),
    u.id,
    strftime('%s', '2025-08-12') * 1000, -- 8 days after challenge start
    19.0,
    170.0,
    209.9, -- calculated total weight
    39.9, -- calculated fat mass
    1,
    'Baseline DEXA Scan',
    'First time doing DEXA',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
FROM users u WHERE u.username = 'mike';

-- Sara Williams (Female) - 28% BF, 125 lbs LM
INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, fat_mass, is_baseline, scan_name, notes, created_at, updated_at)
SELECT 
    'baseline-sara-' || hex(randomblob(8)),
    u.id,
    strftime('%s', '2025-08-15') * 1000, -- 11 days after challenge start
    28.0,
    125.0,
    173.6, -- calculated total weight
    48.6, -- calculated fat mass
    1,
    'Baseline DEXA Scan',
    'Ready to start my journey',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
FROM users u WHERE u.username = 'sara';

-- Alex Rodriguez (Male) - 15% BF, 165 lbs LM
INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, fat_mass, is_baseline, scan_name, notes, created_at, updated_at)
SELECT 
    'baseline-alex-' || hex(randomblob(8)),
    u.id,
    strftime('%s', '2025-08-18') * 1000, -- 14 days after challenge start
    15.0,
    165.0,
    194.1, -- calculated total weight
    29.1, -- calculated fat mass
    1,
    'Baseline DEXA Scan',
    'Already pretty lean',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
FROM users u WHERE u.username = 'alex';

-- Emma Davis (Female) - 22% BF, 130 lbs LM
INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, fat_mass, is_baseline, scan_name, notes, created_at, updated_at)
SELECT 
    'baseline-emma-' || hex(randomblob(8)),
    u.id,
    strftime('%s', '2025-08-20') * 1000, -- 16 days after challenge start
    22.0,
    130.0,
    166.7, -- calculated total weight
    36.7, -- calculated fat mass
    1,
    'Baseline DEXA Scan',
    'Excited for the challenge',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
FROM users u WHERE u.username = 'emma';