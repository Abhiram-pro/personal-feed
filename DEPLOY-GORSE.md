# Deploy Gorse to Cloud (Free)

Since Docker isn't working on your system, let's deploy Gorse to a free cloud service!

## 🚀 Easiest Option: Render.com (Recommended)

### Step 1: Push to GitHub
Your code is already on GitHub at: `https://github.com/Abhiram-pro/personal-feed`

### Step 2: Deploy to Render

1. **Go to Render**: https://render.com
2. **Sign up** with your GitHub account
3. **New** → **Blueprint**
4. **Connect** your `personal-feed` repository
5. Render will auto-detect `render.yaml` and deploy Gorse
6. Wait 5-10 minutes for deployment

### Step 3: Get Your Gorse URL

After deployment, Render will give you a URL like:
```
https://gorse-recommender.onrender.com
```

### Step 4: Update Your Backend

Update `firestore-gorse-sync/.env`:
```bash
GORSE_BASE_URL=https://gorse-recommender.onrender.com
GORSE_API_KEY=<copy from Render dashboard>
```

### Step 5: Restart Your Backend
```bash
# Stop current backend (if running)
# Then restart:
cd firestore-gorse-sync
npm run dev
```

## 🎯 Alternative: Railway.app

1. **Go to Railway**: https://railway.app
2. **Login** with GitHub
3. **New Project** → **Deploy from GitHub**
4. Select `personal-feed` repo
5. Set root directory to `gorse-deploy`
6. Railway auto-deploys!

Get URL from Railway dashboard and update your `.env`

## 🔧 Alternative: Fly.io

```bash
# Install flyctl
brew install flyctl

# Login
flyctl auth login

# Deploy
cd gorse-deploy
flyctl launch --dockerfile Dockerfile
flyctl deploy
```

## ✅ Verify It's Working

Test your deployed Gorse:
```bash
curl https://your-gorse-url.onrender.com/api/health
```

Should return: `{"status":"ok"}`

## 📊 What You Get (Free Tier)

- **Render**: 750 hours/month (enough for 24/7)
- **Railway**: 500 hours/month  
- **Fly.io**: 3 VMs free

All are perfect for your personal feed app!

## 🎉 After Deployment

Once Gorse is deployed:
1. Your feed will automatically use ML recommendations
2. Recommendations improve as you interact with articles
3. No more "fallback" - pure Gorse power!

---

**Need help?** The deployment files are ready in the `gorse-deploy/` folder!
