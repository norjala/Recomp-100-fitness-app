# Build Constraints & Monitoring

## Critical React Hook Form Constraints

### ⚠️ **DO NOT BREAK THESE RULES**

1. **Keep Form Libraries Together**: React Hook Form, @hookform/resolvers, and Zod MUST stay in the same chunk
2. **Never Split RHF Across Chunks**: This causes `TypeError: r.field is not a function` in production
3. **Test Production Build Locally**: Always verify forms work before deploying

### Current Chunking Strategy

```typescript
// In vite.config.ts - manualChunks function
manualChunks(id) {
  // Keep form-related libraries together to prevent cross-chunk issues
  if (id.includes('react-hook-form') || 
      id.includes('@hookform/resolvers') || 
      id.includes('zod')) {
    return 'forms';
  }
}
```

### Expected Build Output

✅ **Working Configuration (Current - Single Chunk):**
- `index-*.js` - Single chunk with all modules (1,142 kB)
- No loading order issues, React Hook Form intact

✅ **Future Optimized Configuration (Dependency-Aware):**
- `react-core-*.js` - React/React-DOM (must load first)
- `forms-*.js` - React Hook Form + Zod + resolvers (intact)
- `ui-libs-*.js` - Radix UI components (safe)
- `vendor-*.js` - Other libraries (loads after React)

❌ **Broken Configuration:**
- RHF split across multiple chunks
- React loading after libraries that depend on it
- Module loading race conditions

### Monitoring Commands

```bash
# Build and analyze chunks
npm run build
ls -la dist/public/assets/

# Test production build locally
npm run rebuild && NODE_ENV=production node dist/server/index.js

# Check for form errors in browser console
# Look for: "TypeError: r.field is not a function"
```

### Production Deployment Checklist

- [ ] Build completes without errors
- [ ] Forms chunk exists and contains RHF dependencies
- [ ] No "field is not a function" errors in console
- [ ] Registration/login forms work in production
- [ ] Profile and scan entry forms functional

### Module Loading Order Lessons

**Critical Discovery:** Vite's modulepreload order doesn't always match chunk dependency order!

**Issue Pattern:**
```html
<!-- ❌ Wrong loading order causes runtime errors -->
<link rel="modulepreload" href="/assets/vendor-*.js">      <!-- Loads first -->
<link rel="modulepreload" href="/assets/react-core-*.js"> <!-- Should load first -->
```

**Error Symptoms:**
- `TypeError: Cannot read properties of undefined (reading 'unstable')`  
- `r.field is not a function`
- Blank screen with vendor chunk errors

**Root Cause:** Libraries try to access React APIs before React is available.

### Emergency Recovery

**Priority 1 - Immediate Fix:**
1. Revert to single chunk: `manualChunks: undefined`
2. Deploy immediately to restore functionality
3. Debug chunking strategy in development

**Priority 2 - Optimize Later:**
1. Test dependency-aware chunking locally
2. Verify modulepreload order in generated HTML
3. Check for runtime errors in browser console
4. Re-implement with proper dependency sequencing

### Future Optimization Strategy

**Safe Chunking Rules:**
1. ✅ Single chunk always works (current solution)
2. ⚠️ Dependency-aware chunking needs careful testing
3. ❌ Never separate React from React-dependent libraries
4. 🔍 Always verify modulepreload order in build output

---

**Last Updated:** September 2025  
**Critical Issues Resolved:** 
- React Hook Form production runtime failures
- Module loading order race conditions