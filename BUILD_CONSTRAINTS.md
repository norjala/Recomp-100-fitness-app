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

✅ **Working Configuration:**
- `forms-*.js` - React Hook Form + dependencies (intact)
- `react-vendor-*.js` - React core
- `ui-vendor-*.js` - Safe UI components
- `vendor-*.js` - Other libraries

❌ **Broken Configuration:**
- RHF split across multiple chunks
- Form controllers in different chunks than field components

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

### Emergency Recovery

If forms break in production:
1. Revert to single chunk: `manualChunks: undefined`
2. Deploy immediately
3. Debug chunking strategy in development
4. Re-implement intelligent chunking with testing

---

**Last Updated:** September 2025  
**Critical Issue Resolved:** React Hook Form production runtime failures