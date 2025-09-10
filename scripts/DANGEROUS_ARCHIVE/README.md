# DANGEROUS DATABASE SCRIPTS ARCHIVE

⚠️ **WARNING: THESE SCRIPTS CAN CAUSE COMPLETE DATA LOSS** ⚠️

## Scripts in This Archive

### reset-user-scans.sql
- **DANGER LEVEL: CRITICAL** 
- **PURPOSE**: Originally used to reset all user DEXA scan data for testing
- **DESTRUCTIVE OPERATIONS**: 
  - `DELETE FROM dexa_scans;` - DELETES ALL USER SCAN DATA
  - `DELETE FROM scoring_data;` - DELETES ALL SCORING DATA
- **INCIDENT**: This script caused the complete loss of user "Jackie's" account and DEXA scan data on September 8, 2025
- **STATUS**: ARCHIVED - DO NOT USE IN PRODUCTION

## Safety Measures Implemented

1. **Scripts Moved to Archive**: All dangerous scripts moved out of main scripts directory
2. **Environment Checks**: New scripts will include production environment guards
3. **Backup Verification**: Mandatory backup verification before any destructive operations
4. **Confirmation Prompts**: Multi-step confirmation required for data deletion
5. **Audit Logging**: All database operations now logged with timestamps and user information

## Recovery from This Archive

If you need to recover any functionality from these scripts:

1. **NEVER run the archived scripts directly**
2. Review the SQL operations carefully
3. Create new, safer versions with proper guards
4. Test thoroughly in development environment
5. Implement proper backup and rollback procedures

## Incident Report - Jackie Data Loss

**Date**: September 8, 2025
**Cause**: reset-user-scans.sql executed, deleting all DEXA scan data
**Impact**: Complete loss of user "Jackie" account and scan data
**Recovery**: Data could not be recovered due to backup being taken after reset
**Prevention**: Scripts archived, safety measures implemented

---

**Remember**: A single `DELETE FROM` statement can destroy months of user data. Always implement proper safeguards.