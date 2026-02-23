# ✅ Deployment Checklist

Бесплатный деплой за 20 минут!

---

## Step 1: Backend на Render.com (5 мин)

- [ ] Откройте https://render.com
- [ ] **Sign Up with GitHub** (используйте ваш GitHub аккаунт)
- [ ] **+ New** → **Web Service**
- [ ] Выберите репо: `goszakup-ai`
- [ ] Настройки:
  - [ ] Name: `goszakup-api`
  - [ ] Environment: `Python 3`
  - [ ] Build: `pip install -r requirements.txt`
  - [ ] Start: `uvicorn src.api.routes:app --host 0.0.0.0 --port 8000`
- [ ] Env vars:
  ```
  PYTHONUNBUFFERED=1
  FORCE_TRAIN=false
  GOSZAKUP_TOKEN=demo
  ```
- [ ] **Create Web Service** → Ждите 3-5 мин
- [ ] Тест: `curl https://goszakup-api-xxxx.onrender.com/api/health`
- [ ] Результат:获得URL (например `goszakup-api-abc123.onrender.com`)

---

## Step 2: Frontend на GitHub Pages (10 мин)

### 2.1 Создание репо

- [ ] На https://github.com нажмите **+** → **New repository**
- [ ] Название: `goszakup-frontend`
- [ ] Public
- [ ] **Create repository**

### 2.2 Загрузка файлов

```bash
git clone https://github.com/YOUR_USERNAME/goszakup-frontend.git
cd goszakup-frontend
```

- [ ] Скопируйте файлы из документации ([DEPLOY_RENDER_GITHUB.md](DEPLOY_RENDER_GITHUB.md)):
  - [ ] `index.html`
  - [ ] `app.js` (⚠️ **Измените `yourdomain.com` на вашу ссылку!**)
  - [ ] `styles.css`
  - [ ] `.gitignore`

- [ ] Обновите в `app.js`:
  ```javascript
  const API_URL = 'https://goszakup-api-xxxx.onrender.com'; // ← ВАШ URL
  ```

### 2.3 Публикация

```bash
git add .
git commit -m "Initial frontend"
git push -u origin main
```

- [ ] Зайдите в репо → **Settings** → **Pages**
- [ ] Source: `Deploy from a branch`
- [ ] Branch: `main` / `(root)`
- [ ] **Save**
- [ ] Ждите ~1 минуту
- [ ] Ваш фронтенд: `https://YOUR_USERNAME.github.io/goszakup-frontend`

---

## Step 3: Custom Domain (5 мин, опционально)

Если у вас есть свой домен (например `yourdomain.com`):

### 3.1 Backend subdomain

- [ ] Render Dashboard → ваш service → **Settings**
- [ ] **Custom Domains** → **Add Custom Domain**: `api.yourdomain.com`
- [ ] Вы получите CNAME запись

### 3.2 Обновите DNS

У вашего регистратора домена (Namecheap, Route53 и т.д.):

- [ ] Добавьте CNAME:
  ```
  Name:   api
  Type:   CNAME
  Value:  goszakup-api-xxxx.onrender.com
  TTL:    3600
  ```
- [ ] Нажмите **Save**
- [ ] Ждите 5-30 мин пока DNS обновится

### 3.3 Проверка

```bash
dig api.yourdomain.com
# Должно показать ваш CNAME
```

- [ ] Тест: `curl https://api.yourdomain.com/api/health`

### 3.4 Обновите frontend

В `app.js` измените:
```javascript
const API_URL = 'https://api.yourdomain.com';  // ← ВАШ CUSTOM DOMAIN
```

```bash
git add app.js
git commit -m "Update API URL to custom domain"
git push
```

---

## Step 4: Проверка работы

### Локально

```bash
# Backend работает?
curl https://goszakup-api-xxxx.onrender.com/api/health

# Frontend работает?
# Откройте в браузере: https://YOUR_USERNAME.github.io/goszakup-frontend
# Введите ID лота (например: 100000001)
# Нажмите кнопку анализа
# Должны увидеть результаты
```

---

## ❓ Troubleshooting

### Backend не загружается

```bash
# Проверьте логи на Render
# Dashboard → ваш service → Logs

# Скорее всего нужно установить зависимости
# Убедитесь что requirements.txt есть в репо
git add requirements.txt
git commit -m "Add requirements"
git push
# Render автоматически перезагрузится
```

### Frontend говорит "API Offline"

- [ ] Проверьте URL в `app.js` - совпадает ли с Render URL?
- [ ] Checked: `https://goszakup-api-xxx.onrender.com/api/health` в браузере?
- [ ] Ждите 1-2 минуты - первый запрос медленный после простоя

### Custom domain не работает

- [ ] Проверьте CNAME запись: `dig api.yourdomain.com`
- [ ] Ждите 5-30 минут для распространения DNS
- [ ] Очистите кеш браузера (Ctrl+Shift+Delete)

---

## 🎉 Готово!

Ваш проект теперь доступен в интернете:

```
Frontend:  https://YOUR_USERNAME.github.io/goszakup-frontend
Backend:   https://goszakup-api-xxxx.onrender.com
Custom:    https://api.yourdomain.com (если настроили)
```

**Стоимость: 0$ в месяц** (только домен ~10$/год)

Для разработки локально:

```bash
# Terminal 1: Backend
source .venv311/bin/activate
uvicorn src.api.routes:app --port 8006

# Terminal 2: Frontend
cd goszakup-frontend
python3 -m http.server 3000
# Откройте: http://localhost:3000
```
