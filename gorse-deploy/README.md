# Deploy Gorse to Railway

This directory contains configuration files to deploy Gorse recommendation engine to Railway.

## Quick Deploy to Railway

### Option 1: One-Click Deploy (Easiest)

1. Go to [Railway](https://railway.app)
2. Sign up/Login with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select this repository
5. Railway will auto-detect the Dockerfile and deploy

### Option 2: Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

### Option 3: Manual Setup

1. **Create Railway Account**: https://railway.app
2. **New Project** → **Empty Project**
3. **Add Service** → **GitHub Repo** → Select your repo
4. **Settings**:
   - Root Directory: `gorse-deploy`
   - Build Command: (auto-detected from Dockerfile)
   - Start Command: `gorse-master -c /etc/gorse/config.toml`

## Environment Variables

Set these in Railway dashboard:

```
GORSE_API_KEY=your_secure_api_key_here
```

## After Deployment

1. Railway will provide a public URL like: `https://your-app.railway.app`
2. Gorse API will be available at: `https://your-app.railway.app:8087`
3. Update your `.env` file:
   ```
   GORSE_BASE_URL=https://your-app.railway.app:8087
   GORSE_API_KEY=your_secure_api_key_here
   ```

## Alternative: Render.com (Also Free)

1. Go to [Render](https://render.com)
2. New → Web Service
3. Connect your GitHub repo
4. Settings:
   - Environment: Docker
   - Dockerfile Path: `gorse-deploy/Dockerfile`
   - Port: 8087

## Alternative: Fly.io (Also Free)

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Launch (from gorse-deploy directory)
cd gorse-deploy
flyctl launch

# Deploy
flyctl deploy
```

## Verify Deployment

Once deployed, test the health endpoint:

```bash
curl https://your-app-url:8087/api/health
```

Should return:
```json
{"status":"ok"}
```

## Cost

- **Railway**: 500 hours/month free (enough for 24/7 operation)
- **Render**: 750 hours/month free
- **Fly.io**: 3 shared-cpu VMs free

All options are sufficient for a personal feed app!
