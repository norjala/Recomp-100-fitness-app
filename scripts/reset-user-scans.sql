-- Reset all users to have exactly 2 DEXA scans each
-- First, clear all existing scans and scoring data
DELETE FROM dexa_scans;
DELETE FROM scoring_data;

-- Generate new UUIDs for scans (using random hex strings as approximation)
-- User: jaron (16.0% -> 13.2% BF, 155->160 lbs LM)
INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, fat_mass, is_baseline, scan_name, notes, created_at, updated_at)
SELECT 
    'baseline-jaron-' || CAST((RANDOM() & 0x7FFFFFFF) AS TEXT),
    u.id,
    strftime('%s', '2025-08-04') * 1000, -- Challenge start date
    16.0,
    155.0,
    184.5, -- calculated total weight
    29.5, -- calculated fat mass  
    1, -- is_baseline = true
    'Baseline DEXA Scan',
    'Challenge baseline measurement',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
FROM users u WHERE u.username = 'jaron';

INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, fat_mass, is_baseline, scan_name, notes, created_at, updated_at)
SELECT 
    'progress-jaron-' || CAST((RANDOM() & 0x7FFFFFFF) AS TEXT),
    u.id,
    strftime('%s', '2025-08-23') * 1000, -- Current date
    13.2,
    160.0,
    184.3, -- calculated total weight (less fat, more muscle)
    24.3, -- calculated fat mass
    0, -- is_baseline = false
    'Progress DEXA Scan',
    '19 days into the challenge',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
FROM users u WHERE u.username = 'jaron';

-- User: ben (8.0% -> 9.0% BF, 135->140 lbs LM) - harder to lose fat when already lean
INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, fat_mass, is_baseline, scan_name, notes, created_at, updated_at)
SELECT 
    'baseline-ben-' || CAST((RANDOM() & 0x7FFFFFFF) AS TEXT),
    u.id,
    strftime('%s', '2025-08-04') * 1000,
    8.0,
    135.0,
    146.7, -- calculated total weight
    11.7, -- calculated fat mass
    1,
    'Baseline DEXA Scan',
    'Challenge baseline measurement',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
FROM users u WHERE u.username = 'ben';

INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, fat_mass, is_baseline, scan_name, notes, created_at, updated_at)
SELECT 
    'progress-ben-' || CAST((RANDOM() & 0x7FFFFFFF) AS TEXT),
    u.id,
    strftime('%s', '2025-08-23') * 1000,
    9.0,
    140.0,
    153.8, -- calculated total weight
    13.8, -- calculated fat mass
    0,
    'Progress DEXA Scan',
    '19 days into the challenge',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
FROM users u WHERE u.username = 'ben';

-- User: danny (22.0% -> 18.2% BF, 180->185 lbs LM)
INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, fat_mass, is_baseline, scan_name, notes, created_at, updated_at)
SELECT 
    'baseline-danny-' || CAST((RANDOM() & 0x7FFFFFFF) AS TEXT),
    u.id,
    strftime('%s', '2025-08-04') * 1000,
    22.0,
    180.0,
    230.8, -- calculated total weight
    50.8, -- calculated fat mass
    1,
    'Baseline DEXA Scan',
    'Challenge baseline measurement',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
FROM users u WHERE u.username = 'danny';

INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, fat_mass, is_baseline, scan_name, notes, created_at, updated_at)
SELECT 
    'progress-danny-' || CAST((RANDOM() & 0x7FFFFFFF) AS TEXT),
    u.id,
    strftime('%s', '2025-08-23') * 1000,
    18.2,
    185.0,
    226.1, -- calculated total weight
    41.1, -- calculated fat mass
    0,
    'Progress DEXA Scan',
    '19 days into the challenge',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
FROM users u WHERE u.username = 'danny';

-- User: joe (12.0% -> 10.5% BF, 145->150 lbs LM)
INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, fat_mass, is_baseline, scan_name, notes, created_at, updated_at)
SELECT 
    'baseline-joe-' || CAST((RANDOM() & 0x7FFFFFFF) AS TEXT),
    u.id,
    strftime('%s', '2025-08-04') * 1000,
    12.0,
    145.0,
    164.8, -- calculated total weight
    19.8, -- calculated fat mass
    1,
    'Baseline DEXA Scan',
    'Challenge baseline measurement',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
FROM users u WHERE u.username = 'joe';

INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, fat_mass, is_baseline, scan_name, notes, created_at, updated_at)
SELECT 
    'progress-joe-' || CAST((RANDOM() & 0x7FFFFFFF) AS TEXT),
    u.id,
    strftime('%s', '2025-08-23') * 1000,
    10.5,
    150.0,
    167.6, -- calculated total weight
    17.6, -- calculated fat mass
    0,
    'Progress DEXA Scan',
    '19 days into the challenge',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
FROM users u WHERE u.username = 'joe';

-- User: olarn (28.0% -> 22.8% BF, 140->142 lbs LM)
INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, fat_mass, is_baseline, scan_name, notes, created_at, updated_at)
SELECT 
    'baseline-olarn-' || CAST((RANDOM() & 0x7FFFFFFF) AS TEXT),
    u.id,
    strftime('%s', '2025-08-04') * 1000,
    28.0,
    140.0,
    194.4, -- calculated total weight
    54.4, -- calculated fat mass
    1,
    'Baseline DEXA Scan',
    'Challenge baseline measurement',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
FROM users u WHERE u.username = 'olarn';

INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, fat_mass, is_baseline, scan_name, notes, created_at, updated_at)
SELECT 
    'progress-olarn-' || CAST((RANDOM() & 0x7FFFFFFF) AS TEXT),
    u.id,
    strftime('%s', '2025-08-23') * 1000,
    22.8,
    142.0,
    183.9, -- calculated total weight  
    41.9, -- calculated fat mass
    0,
    'Progress DEXA Scan',
    '19 days into the challenge',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
FROM users u WHERE u.username = 'olarn';

-- User: takeshi (18.0% -> 14.5% BF, 160->165 lbs LM)
INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, fat_mass, is_baseline, scan_name, notes, created_at, updated_at)
SELECT 
    'baseline-takeshi-' || CAST((RANDOM() & 0x7FFFFFFF) AS TEXT),
    u.id,
    strftime('%s', '2025-08-04') * 1000,
    18.0,
    160.0,
    195.1, -- calculated total weight
    35.1, -- calculated fat mass
    1,
    'Baseline DEXA Scan',
    'Challenge baseline measurement',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
FROM users u WHERE u.username = 'takeshi';

INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, fat_mass, is_baseline, scan_name, notes, created_at, updated_at)
SELECT 
    'progress-takeshi-' || CAST((RANDOM() & 0x7FFFFFFF) AS TEXT),
    u.id,
    strftime('%s', '2025-08-23') * 1000,
    14.5,
    165.0,
    192.9, -- calculated total weight
    27.9, -- calculated fat mass
    0,
    'Progress DEXA Scan',
    '19 days into the challenge',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
FROM users u WHERE u.username = 'takeshi';

-- User: testuser (16.9% -> 18.0% BF, 123.2->146 lbs LM) - different trajectory
INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, fat_mass, is_baseline, scan_name, notes, created_at, updated_at)
SELECT 
    'baseline-testuser-' || CAST((RANDOM() & 0x7FFFFFFF) AS TEXT),
    u.id,
    strftime('%s', '2025-08-04') * 1000,
    16.9,
    123.2,
    148.3, -- calculated total weight
    25.1, -- calculated fat mass
    1,
    'Baseline DEXA Scan',
    'Challenge baseline measurement',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
FROM users u WHERE u.username = 'testuser';

INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, fat_mass, is_baseline, scan_name, notes, created_at, updated_at)
SELECT 
    'progress-testuser-' || CAST((RANDOM() & 0x7FFFFFFF) AS TEXT),
    u.id,
    strftime('%s', '2025-08-23') * 1000,
    18.0,
    146.0,
    178.0, -- calculated total weight
    32.0, -- calculated fat mass
    0,
    'Progress DEXA Scan',
    '19 days into the challenge',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
FROM users u WHERE u.username = 'testuser';