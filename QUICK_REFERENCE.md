# 🎯 Quick Reference Card

Print this or keep in your browser tab while deploying!

---

## 🚀 DEPLOY IN 3 STEPS (20 min)

### Step 1: Backend to Render.com (5 min)
```
1. Go to: https://render.com
2. Sign Up with GitHub
3. New → Web Service
4. Select: goszakup-ai repo
5. Fill in:
   Name:    goszakup-api
   Environment: Python 3
   Build:   pip install -r requirements.txt
   Start:   uvicorn src.api.routes:app --host 0.0.0.0 --port 8000
6. Add Environment Variables:
   PYTHONUNBUFFERED=1
   FORCE_TRAIN=false
   GOSZAKUP_TOKEN=demo
7. CREATE & WAIT 3-5 MIN
8. COPY YOUR URL: https://goszakup-api-xxxx.onrender.com
```

### Step 2: Frontend to GitHub Pages (10 min)
```
1. Create new repo: goszakup-frontend
2. Clone it locally
3. Copy files (from deployment guide):
   - index.html
   - app.js (⚠️ UPDATE API_URL!)
   - styles.css
   - .gitignore
4. In app.js line 2, change:
   const API_URL = 'https://goszakup-api-xxxx.onrender.com';
5. Push:
   git add .
   git commit -m "Initial"
   git push -u origin main
6. Settings → Pages → Deploy from main
7. WAIT 1 MIN FOR GITHUB TO BUILD
8. YOUR FRONTEND: https://USERNAME.github.io/goszakup-frontend
```

### Step 3: Test! (3 min)
```
1. Open your frontend URL in browser
2. Enter lot ID: 100000001
3. Click "Анализ" button
4. See risk score appear!
5. ✅ You're live!
```

---

## 🌍 Add Custom Domain (Optional, 5 min)

### At Render Dashboard
```
Settings → Custom Domains → Add Custom Domain
Enter: api.yourdomain.com
Copy the CNAME value
```

### At Your Domain Registrar
```
Add CNAME record:
Name:   api
Type:   CNAME
Value:  goszakup-api-xxxx.onrender.com
TTL:    3600
Save!
```

### Wait & Test
```
Ждите 5-30 min для DNS распространения
curl https://api.yourdomain.com/api/health
```

---

## 🔧 Local Development

### Terminal 1: Backend
```bash
cd ~/Projects/claude/goszakup-ai
source .venv311/bin/activate
uvicorn src.api.routes:app --port 8006
# Visit: http://localhost:8006/docs
```

### Terminal 2: Frontend
```bash
cd goszakup-frontend
python3 -m http.server 3000
# Visit: http://localhost:3000
```

---

## ✅ API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Check if API is alive |
| `/api/lots` | GET | Get all 100 mock lots |
| `/api/lot/{id}` | GET | Analyze single lot |
| `/api/analyze` | POST | Batch analysis |
| `/api/export` | GET | Download as CSV |
| `/docs` | GET | Swagger UI |

---

## 🆘 Troubleshooting

### Backend says "500 error"
```
→ Check Render logs
→ Make sure runtime.txt exists with "python-3.11.9"
→ Push changes to GitHub, Render auto-redeploys
```

### Frontend says "API Offline"
```
→ Check API_URL in app.js matches your Render URL
→ First request is slow (10 sec) - wait for Free tier to wake up
→ Check: curl YOUR_API_URL/api/health
```

### DNS not working
```
→ Wait 5-30 minutes
→ Use: dig api.yourdomain.com
→ Clear browser cache (Ctrl+Shift+Delete)
```

### "Cannot find module" error
```
→ Requirements not installed
→ Add file to git: git add requirements.txt
→ Push: git push
→ Render auto-rebuilds
```

---

## 💰 Costs

| Item | Free Plan | Paid Plan |
|------|-----------|-----------|
| Backend | $0 (spins down) | $12/mo |
| Frontend | $0 | $0 (always free) |
| Domain | - | $10/yo |
| **Total** | **$0/mo** | **$12-22/mo** |

---

## 📋 File Checklist

Before deploying, make sure you have:

- ✅ `requirements.txt` — Python dependencies
- ✅ `runtime.txt` — Contains `python-3.11.9`
- ✅ `src/api/routes.py` — FastAPI endpoints
- ✅ `src/model/analyzer.py` — Main ML logic
- ✅ `src/model/scorer.py` — Risk scoring
- ✅ `src/model/rules.py` — 30+ rules
- ✅ `data/models/risk_scorer.cbm` — Pre-trained CatBoost
- ✅ `.gitignore` — Updated
- ✅ `README.md` — Documentation

All should be in your github.com/ekbmusk/goszakup-ai repository

---

## 🎁 You Get After Deploying

✅ **Backend URL** (Render):
```
https://goszakup-api-xxxx.onrender.com
→ API documentation: /docs
→ Health check: /api/health
```

✅ **Frontend URL** (GitHub Pages):
```
https://USERNAME.github.io/goszakup-frontend
→ Live web dashboard for analyzing lots
```

✅ **Optional Custom Domain**:
```
https://api.yourdomain.com
→ Professional URL for your API
→ Works with https automatically
```

---

## 📞 Need Help?

1. **See exact steps**: [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)
2. **See full code**: [DEPLOY_RENDER_GITHUB.md](DEPLOY_RENDER_GITHUB.md)
3. **General info**: [README.md](README.md)
4. **Getting started**: [START_HERE.md](START_HERE.md)

---

## ⏱️ Time Estimate

- Backend setup: 5 min
- Frontend setup: 10 min  
- Testing: 3 min
- Custom domain: 5 min (optional)
- **TOTAL: 20 min**

---

**You're ready! Follow the 3 steps above and you'll be live in 20 minutes! 🚀**
