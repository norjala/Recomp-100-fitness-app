# Gender Field Bug Fix - Manual Testing Guide

## Overview
This guide provides step-by-step testing instructions to verify the gender field functionality works correctly across both the upload form and edit scan dialog.

## Test Environment Setup

### Prerequisites
1. **Test User**: User "Jaron" with NULL gender (already exists in the system)
2. **Browser**: Chrome/Firefox with Developer Tools enabled
3. **Database Access**: Ability to check database state before/after tests

### Debug Console Setup
1. Open browser Developer Tools (F12)
2. Navigate to Console tab
3. Monitor debug output during testing

## Test Scenarios

### Test Group 1: Upload Form Gender Field Visibility

#### Test 1.1: Gender Field Visibility for NULL Gender User
**Objective**: Verify gender field appears for users with NULL/missing gender

**Steps**:
1. Login as user "Jaron" (known to have NULL gender)
2. Navigate to `/upload` page
3. Observe debug panels and console output

**Expected Results**:
- ✅ Red debug panel visible at top-left with gender field information
- ✅ Gender field visible in upload form with red border highlighting
- ✅ Console shows debug output: `userProfile.gender: null`
- ✅ Console shows: `shouldShow (!hasValidGender || isFirstScan): true`
- ✅ Gender field appears as Select dropdown with Male/Female options

**Debug Console Verification**:
```
=== UPLOAD DEBUG - User Profile Loading ===
userProfile.gender: null (type: object)
hasValidGender: false
shouldShow (!hasValidGender || isFirstScan): true
Final condition: true
```

#### Test 1.2: Gender Field Pre-population
**Objective**: Verify gender field pre-populates from AI extraction

**Steps**:
1. Upload a DEXA scan image with gender information
2. Wait for AI extraction to complete
3. Check if gender field is populated

**Expected Results**:
- ✅ If gender detected, field should auto-populate
- ✅ Console should show: `Gender field onChange: [detected_gender]`

#### Test 1.3: Manual Gender Selection
**Objective**: Verify manual gender selection works

**Steps**:
1. Click on gender dropdown
2. Select "Male"
3. Observe console output and form state

**Expected Results**:
- ✅ Console shows: `Gender field onChange: male`
- ✅ Form data updates correctly
- ✅ Debug panel shows updated gender value

### Test Group 2: Gender Field Functionality During Scan Creation

#### Test 2.1: Successful Scan Creation with Gender
**Objective**: Verify scan creation updates user profile with gender

**Pre-conditions**: User has NULL gender

**Steps**:
1. Fill out complete scan form including gender selection
2. Submit the form
3. Check success notification
4. Verify user profile update

**Expected Results**:
- ✅ Success toast: "DEXA scan data saved successfully!"
- ✅ User profile updated with selected gender
- ✅ Database shows gender is not NULL
- ✅ Scores recalculated with gender-specific multipliers

**Database Verification**:
```sql
SELECT id, username, gender FROM users WHERE username = 'jaron';
-- Should show gender as 'male' or 'female', not NULL
```

#### Test 2.2: Scan Creation without Gender Selection
**Objective**: Verify scan creation works when gender is left unselected

**Steps**:
1. Fill out scan form but leave gender unselected
2. Submit the form
3. Verify scan creation and user profile state

**Expected Results**:
- ✅ Scan created successfully
- ✅ User profile gender remains NULL
- ✅ No errors in console

### Test Group 3: Edit Scan Dialog Gender Field

#### Test 3.1: Edit Dialog Gender Field Visibility
**Objective**: Verify gender field appears in edit dialog

**Pre-conditions**: User has at least one scan

**Steps**:
1. Navigate to My Scans page
2. Click edit button on any scan
3. Observe edit dialog contents

**Expected Results**:
- ✅ Edit dialog opens
- ✅ Gender field is NOT visible in edit dialog (gender updates happen via profile, not scan edit)
- ✅ Name fields (firstName, lastName) are visible
- ✅ Target goals section is visible

#### Test 3.2: Profile Update via Scan Edit
**Objective**: Verify profile updates work through scan edit

**Steps**:
1. Open edit dialog for a scan
2. Update firstName and lastName fields
3. Submit the changes
4. Verify profile update

**Expected Results**:
- ✅ Success toast: "Scan updated"
- ✅ User profile updated with new name
- ✅ Changes reflected in UI immediately

### Test Group 4: Backend API Testing

#### Test 4.1: PUT /api/scans/:scanId with Gender
**Objective**: Verify backend endpoint handles gender updates

**Steps**:
1. Open Network tab in DevTools
2. Edit a scan and include gender data in request
3. Monitor network request/response

**Expected Results**:
- ✅ PUT request to `/api/scans/{scanId}` with gender data
- ✅ Response status 200
- ✅ Console shows: `User profile updated with: ["gender"]`
- ✅ Console shows: `Gender updated to {gender} - scores will be recalculated`

**Example Request Body**:
```json
{
  "bodyFatPercent": 15.2,
  "firstName": "Jaron",
  "lastName": "Parnala",
  "gender": "male"
}
```

#### Test 4.2: POST /api/scans with Gender
**Objective**: Verify scan creation endpoint handles gender

**Steps**:
1. Create new scan with gender field
2. Monitor network request in DevTools
3. Verify response and profile update

**Expected Results**:
- ✅ POST request to `/api/scans` includes gender
- ✅ Profile update attempt logged in console
- ✅ User profile updated successfully

### Test Group 5: Score Recalculation Verification

#### Test 5.1: Score Changes After Gender Update
**Objective**: Verify scores recalculate when gender is added

**Pre-conditions**: User with NULL gender and existing scans

**Steps**:
1. Check current scores: GET `/api/scoring/{userId}`
2. Update user gender via scan edit
3. Check scores again after update
4. Compare before/after values

**Expected Results**:
- ✅ Scores may change after gender update
- ✅ Gender-specific multipliers applied
- ✅ Console shows score recalculation activity

**API Verification**:
```bash
# Before gender update
curl -X GET http://localhost:5000/api/scoring/{userId}

# After gender update
curl -X GET http://localhost:5000/api/scoring/{userId}
```

### Test Group 6: Edge Cases

#### Test 6.1: Invalid Gender Values
**Objective**: Verify system rejects invalid gender values

**Steps**:
1. Use browser console to modify form data
2. Try submitting with invalid gender: `formData.gender = 'invalid'`
3. Observe error handling

**Expected Results**:
- ✅ Validation error displayed
- ✅ Form submission blocked
- ✅ User profile not updated

#### Test 6.2: Empty String Gender
**Objective**: Verify empty string handling

**Steps**:
1. Set gender to empty string: `formData.gender = ''`
2. Submit form
3. Verify handling

**Expected Results**:
- ✅ Treated as no gender selection
- ✅ User profile gender remains NULL

#### Test 6.3: Network Error During Gender Update
**Objective**: Verify error handling for network failures

**Steps**:
1. Open DevTools → Network tab
2. Enable "Offline" mode
3. Try to update gender
4. Observe error handling

**Expected Results**:
- ✅ Error toast displayed
- ✅ Form state preserved
- ✅ User can retry when connection restored

## Debug Console Monitoring

### Key Debug Messages to Watch For

#### Upload Page Debug Output:
```
=== UPLOAD DEBUG - User Profile Loading ===
userProfile.gender: null (type: object)
hasValidGender: false
shouldShow: true
Final condition: true
🔍 DEBUG: Field visible! userProfile.gender=null
```

#### Scan Creation Debug Output:
```
📊 [REQUEST_ID] POST /api/scans - Creating new DEXA scan
✅ [REQUEST_ID] User profile updated with: ["gender"]
📊 [REQUEST_ID] Gender updated to male - scores will be recalculated
```

#### Edit Dialog Debug Output:
```
📊 [REQUEST_ID] PUT /api/scans/{scanId} - Updating DEXA scan
✅ [REQUEST_ID] User profile updated with: ["firstName", "lastName", "gender"]
```

## Troubleshooting Common Issues

### Issue 1: Gender Field Not Visible
**Symptoms**: Gender field doesn't appear in upload form
**Debug Steps**:
1. Check debug panel values
2. Verify `userProfile.gender` is null
3. Check console for loading states
4. Use "Force Show Gender Field" debug button

### Issue 2: Gender Not Saving
**Symptoms**: Gender selection doesn't persist after form submission
**Debug Steps**:
1. Monitor network requests in DevTools
2. Check request payload includes gender
3. Verify backend logs show profile update
4. Check database state directly

### Issue 3: Scores Not Recalculating
**Symptoms**: Scores remain same after gender update
**Debug Steps**:
1. Check backend logs for recalculation messages
2. Verify gender multipliers are being applied
3. Compare scores before/after gender update

## Test Results Documentation

### Test Execution Checklist
- [ ] Test 1.1: Gender Field Visibility ✅ PASS / ❌ FAIL
- [ ] Test 1.2: Gender Field Pre-population ✅ PASS / ❌ FAIL
- [ ] Test 1.3: Manual Gender Selection ✅ PASS / ❌ FAIL
- [ ] Test 2.1: Scan Creation with Gender ✅ PASS / ❌ FAIL
- [ ] Test 2.2: Scan Creation without Gender ✅ PASS / ❌ FAIL
- [ ] Test 3.1: Edit Dialog Visibility ✅ PASS / ❌ FAIL
- [ ] Test 3.2: Profile Update via Edit ✅ PASS / ❌ FAIL
- [ ] Test 4.1: PUT API with Gender ✅ PASS / ❌ FAIL
- [ ] Test 4.2: POST API with Gender ✅ PASS / ❌ FAIL
- [ ] Test 5.1: Score Recalculation ✅ PASS / ❌ FAIL
- [ ] Test 6.1: Invalid Gender Values ✅ PASS / ❌ FAIL
- [ ] Test 6.2: Empty String Gender ✅ PASS / ❌ FAIL
- [ ] Test 6.3: Network Error Handling ✅ PASS / ❌ FAIL

### Notes Section
```
Test Date: _____________
Tester: _____________
Environment: _____________
Browser: _____________

Issues Found:
1. _________________________
2. _________________________
3. _________________________

Overall Result: ✅ ALL TESTS PASS / ❌ ISSUES FOUND
```