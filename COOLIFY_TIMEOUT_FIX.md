# Coolify Gateway Timeout Fix

## Changes Made

### 1. Frontend Nginx Configuration (`frontend/nginx.conf`)
- Added proxy timeout settings (300s for all operations)
- Added buffer settings for large responses
- Added cache headers for static assets

### 2. Docker Compose (`docker-compose.yml`)
- Added `NODE_OPTIONS=--max-old-space-size=2048` for better memory handling
- Added `start_period: 40s` to health check (gives more time for startup)
- Added memory limits and reservations

### 3. Backend Server (`backend/src/index.ts`)
- Set `httpServer.timeout = 300000` (5 minutes)
- Set `httpServer.keepAliveTimeout = 65000` (65 seconds)
- Set `httpServer.headersTimeout = 66000` (66 seconds)

## Coolify Configuration

### In Coolify Dashboard:

1. **Environment Variables** - Ensure these are set:
   ```
   POSTGRES_PASSWORD=<your-secure-password>
   JWT_SECRET=<your-jwt-secret>
   CREDENTIAL_ENCRYPTION_KEY=<64-char-hex-key>
   FRONTEND_URL=https://your-domain.com
   VITE_API_URL=https://your-domain.com
   ```

2. **Proxy Settings** (if using Coolify's built-in proxy):
   - Go to your application settings
   - Under "Proxy" or "Advanced" settings
   - Add custom Nginx configuration:
   ```nginx
   proxy_connect_timeout 300s;
   proxy_send_timeout 300s;
   proxy_read_timeout 300s;
   proxy_buffering on;
   proxy_buffer_size 128k;
   proxy_buffers 4 256k;
   ```

3. **Health Check Settings**:
   - Health Check Path: `/health`
   - Health Check Interval: 30s
   - Health Check Timeout: 10s
   - Health Check Retries: 3
   - Health Check Start Period: 40s

4. **Resource Limits**:
   - Memory Limit: 2GB (or adjust based on your plan)
   - CPU Limit: 1-2 cores recommended

## Deployment Steps

1. **Commit and push changes**:
   ```bash
   git add .
   git commit -m "Fix: Add timeout configurations for Coolify production"
   git push
   ```

2. **In Coolify**:
   - Trigger a new deployment
   - Monitor logs during deployment
   - Check health endpoint after deployment

3. **Verify**:
   ```bash
   curl https://your-domain.com/health
   ```

## Monitoring

### Check Logs in Coolify:
- Backend logs: Look for "Server running on port 4000"
- Frontend logs: Should show nginx starting
- Database logs: Check for connection issues

### Common Issues:

1. **Still getting timeouts?**
   - Check Coolify's proxy timeout settings
   - Increase timeout values further if needed
   - Check if workflows are taking longer than 5 minutes

2. **Memory issues?**
   - Increase memory limits in docker-compose.yml
   - Check for memory leaks in long-running workflows

3. **Database connection issues?**
   - Verify DATABASE_URL is correct
   - Check postgres container is healthy
   - Verify network connectivity between containers

## Additional Optimizations

### For Long-Running Workflows:
If you have workflows that take longer than 5 minutes, consider:

1. **Increase timeouts** in `backend/src/services/ExecutionEngine.ts`:
   ```typescript
   timeout: options.timeout || 600000, // 10 minutes
   ```

2. **Use async execution** with webhooks for completion notifications

3. **Implement job queuing** with Bull (already configured) for background processing

### For High Traffic:
1. Scale backend horizontally in Coolify
2. Add Redis caching for frequently accessed data
3. Enable connection pooling for PostgreSQL

## Testing

Test the timeout fix locally:
```bash
# Start services
docker-compose up --build

# Test health endpoint
curl http://localhost:4000/health

# Test a long-running workflow (if you have one)
# Monitor for timeouts
```

## Rollback Plan

If issues persist, you can rollback by reverting these commits:
```bash
git revert HEAD
git push
```

Then investigate specific timeout sources in Coolify logs.
