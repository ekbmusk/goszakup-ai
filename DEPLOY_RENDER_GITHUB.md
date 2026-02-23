# 🚀 Бесплатный деплой: Backend на Render.com + Frontend на GitHub Pages

## 🏗️ Архитектура

```
Frontend (GitHub Pages)          Backend (Render.com)
yourdomain.com              →    api.yourdomain.com
    ├── index.html                    ├── FastAPI
    ├── app.js                        ├── ML модели
    └── styles.css                    └── Python
```

## 💰 Стоимость: **0$ / месяц** + домен ~10$/год

Полностью бесплатное решение без необходимости держать Mac включенным!

---

## 📊 Часть 1: Backend на Render.com

### 1.1 Регистрация на Render.com

1. Откройте https://render.com
2. **Sign Up with GitHub** (используйте ваш GitHub аккаунт)
3. Авторизуйте доступ к репозиториям

### 1.2 Создание Web Service

1. Dashboard → **+ New** → **Web Service**
2. Выберите репозиторий: `goszakup-ai`
3. **Import and Deploy**

### 1.3 Конфигурация

Заполните параметры:

```yaml
Name:                   goszakup-api
Environment:            Python 3
Region:                 Frankfurt (или Europe-Amsterdam)
Branch:                 main
Build Command:          pip install -r requirements.txt
Start Command:          uvicorn src.api.routes:app --host 0.0.0.0 --port 8000
```

### 1.4 Переменные окружения

В разделе **Environment** добавьте:

```
PYTHONUNBUFFERED=1
FORCE_TRAIN=false
GOSZAKUP_TOKEN=demo
CORS_ALLOWED_ORIGINS=https://*.github.io,https://api.yourdomain.com,http://localhost:3000
```

### 1.5 Сохраните и дождитесь деплоя

Нажмите **Create Web Service** и ждите ~3-5 минут.

**Результат:** Render выдаст вам URL например:
```
https://goszakup-api-xxxx.onrender.com
```

**Проверьте:**
```bash
curl https://goszakup-api-xxxx.onrender.com/api/health
# Ожидается: {"status": "healthy"}
```

---

## 🌐 Часть 2: Привязка Custom Domain (опционально)

Если у вас есть свой домен `yourdomain.com`:

### 2.1 В Render Dashboard

1. Откройте ваш service → **Settings**
2. **Custom Domain** → **Add Custom Domain**
3. Введите: `api.yourdomain.com`

Вы увидите инструкцию:
```
Name: api
Type: CNAME  
Target: goszakup-api-xxxx.onrender.com
```

### 2.2 В провайдере домена (Namecheap, Route53, Google Domains и т.д.)

Добавьте CNAME запись:

```
Subdomain: api
Type:      CNAME
Value:     goszakup-api-xxxx.onrender.com
TTL:       3600
```

Приблизительно 5-30 минут и домен будет работать!

---

## 📱 Часть 3: Frontend на GitHub Pages

### 3.1 Создайте новый репозиторий

На GitHub создайте новый репозиторий: `goszakup-frontend`

```bash
git clone https://github.com/YOUR_USERNAME/goszakup-frontend.git
cd goszakup-frontend
```

### 3.2 Создайте структуру файлов

```
goszakup-frontend/
├── index.html
├── app.js
├── styles.css
└── .gitignore
```

### 3.3 `index.html`

```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GoszakupAI - Анализ рисков закупок</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>GoszakupAI</h1>
            <p>🔍 Анализ рисков государственных закупок Казахстана</p>
        </header>
        
        <main>
            <section class="search-section">
                <div class="input-group">
                    <input 
                        type="text" 
                        id="lotInput" 
                        placeholder="Введите ID лота (например: 100000001)"
                        autocomplete="off"
                    >
                    <button onclick="searchLot()">🔎 Анализ</button>
                </div>
            </section>
            
            <section class="api-indicators">
                <div class="indicator">
                    <span>API статус:</span>
                    <span id="apiStatus" class="status-unknown">?</span>
                </div>
                <div class="indicator">
                    <span>Версия:</span>
                    <span>1.0</span>
                </div>
            </section>
            
            <div id="results" class="results"></div>
            <div id="loading" class="loading" style="display:none;">
                <div class="spinner"></div>
                <p>Анализирую лот...</p>
            </div>
            <div id="error" class="error" style="display:none;"></div>
        </main>
        
        <footer>
            <p>© 2024 GoszakupAI | Open Source</p>
        </footer>
    </div>
    
    <script src="app.js"></script>
</body>
</html>
```

### 3.4 `app.js`

```javascript
// Определяем API URL
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8006'
    : 'https://api.yourdomain.com';  // ← ИЗМЕНИТЕ НА ВАШ ДОМЕН

console.log('🚀 Frontend инициализирован');
console.log('📡 API URL:', API_URL);

// Проверяем статус API при загрузке
window.addEventListener('load', checkApiStatus);

async function checkApiStatus() {
    try {
        const response = await fetch(`${API_URL}/api/health`);
        if (response.ok) {
            document.getElementById('apiStatus').textContent = '✅ OK';
            document.getElementById('apiStatus').className = 'status-ok';
        }
    } catch (error) {
        document.getElementById('apiStatus').textContent = '❌ Offline';
        document.getElementById('apiStatus').className = 'status-error';
        console.error('API недоступен:', error);
    }
}

async function searchLot() {
    const lotId = document.getElementById('lotInput').value.trim();
    
    if (!lotId) {
        showError('Пожалуйста, введите ID лота');
        return;
    }
    
    document.getElementById('loading').style.display = 'block';
    document.getElementById('error').style.display = 'none';
    document.getElementById('results').innerHTML = '';
    
    try {
        const response = await fetch(`${API_URL}/api/lot/${lotId}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                showError('Лот не найден');
            } else {
                showError(`Ошибка сервера: ${response.statusText}`);
            }
            return;
        }
        
        const lot = await response.json();
        displayResults(lot);
    } catch (error) {
        showError(`Ошибка подключения: ${error.message}`);
        console.error(error);
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

function displayResults(lot) {
    const riskLevel = getRiskLevel(lot.risk_score || 0);
    
    let html = `
        <div class="lot-card">
            <div class="lot-header">
                <h2>Лот #${lot.id}</h2>
                <div class="risk-badge ${riskLevel.class}">
                    ${riskLevel.icon} ${lot.risk_score?.toFixed(1) || 0}%
                </div>
            </div>
            
            <div class="lot-details">
                <p><strong>📋 Название:</strong> ${lot.name || 'N/A'}</p>
                <p><strong>💰 Бюджет:</strong> ${formatCurrency(lot.budget)} KZT</p>
                <p><strong>🏢 Заказчик:</strong> ${lot.customer_name || 'N/A'}</p>
    `;
    
    // Добавляем нарушения если есть
    if (lot.violations && lot.violations.length > 0) {
        html += `
            <div class="violations">
                <h3>⚠️ Обнаруженные нарушения:</h3>
                <ul>
        `;
        lot.violations.forEach(v => {
            html += `<li class="violation-${v.severity?.toLowerCase()}">
                [${v.severity}] ${v.rule}
            </li>`;
        });
        html += `
                </ul>
            </div>
        `;
    }
    
    // Индикаторы если есть
    if (lot.indicators && lot.indicators.length > 0) {
        html += `
            <div class="indicators">
                <h3>🔍 ML Индикаторы:</h3>
                <ul>
        `;
        lot.indicators.slice(0, 5).forEach(ind => {
            html += `<li>${ind}</li>`;
        });
        if (lot.indicators.length > 5) {
            html += `<li>+ ${lot.indicators.length - 5} еще...</li>`;
        }
        html += `
                </ul>
            </div>
        `;
    }
    
    html += `
            </div>
            <div class="lot-footer">
                <small>Анализирован: ${new Date().toLocaleString('ru-RU')}</small>
            </div>
        </div>
    `;
    
    document.getElementById('results').innerHTML = html;
}

function getRiskLevel(score) {
    if (score >= 70) return { class: 'risk-high', icon: '🔴', label: 'Высокий' };
    if (score >= 40) return { class: 'risk-medium', icon: '🟡', label: 'Средний' };
    return { class: 'risk-low', icon: '🟢', label: 'Низкий' };
}

function formatCurrency(value) {
    if (!value) return '0';
    return new Intl.NumberFormat('ru-RU').format(value);
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

// Поиск при нажатии Enter
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('lotInput');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchLot();
        });
    }
});
```

### 3.5 `styles.css`

```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

:root {
    --primary: #667eea;
    --secondary: #764ba2;
    --success: #10b981;
    --warning: #f59e0b;
    --danger: #ef4444;
    --light-bg: #f3f4f6;
    --dark-text: #1f2937;
}

html {
    scroll-behavior: smooth;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
    min-height: 100vh;
    padding: 20px;
    color: var(--dark-text);
}

.container {
    max-width: 900px;
    margin: 0 auto;
}

/* Header */
header {
    text-align: center;
    color: white;
    margin-bottom: 40px;
    padding: 20px;
}

header h1 {
    font-size: 48px;
    margin-bottom: 10px;
    text-shadow: 0 2px 10px rgba(0,0,0,0.2);
}

header p {
    font-size: 16px;
    opacity: 0.95;
}

/* Search Section */
.search-section {
    margin-bottom: 30px;
}

.input-group {
    display: flex;
    gap: 10px;
    margin-bottom: 15px;
}

#lotInput {
    flex: 1;
    padding: 14px 18px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    background: white;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    transition: box-shadow 0.3s;
}

#lotInput:focus {
    outline: none;
    box-shadow: 0 6px 20px rgba(0,0,0,0.15);
}

button {
    padding: 14px 28px;
    background: white;
    color: var(--primary);
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.15);
}

button:active {
    transform: translateY(0);
}

/* API Indicators */
.api-indicators {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
    justify-content: center;
}

.indicator {
    background: rgba(255,255,255,0.2);
    padding: 10px 16px;
    border-radius: 6px;
    color: white;
    font-size: 14px;
    backdrop-filter: blur(10px);
}

.status-ok { color: var(--success); font-weight: 600; }
.status-error { color: var(--danger); font-weight: 600; }
.status-unknown { color: #d1d5db; font-weight: 600; }

/* Results */
.results {
    margin-top: 20px;
}

.lot-card {
    background: white;
    padding: 28px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.lot-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 2px solid var(--light-bg);
}

.lot-header h2 {
    color: var(--primary);
    font-size: 28px;
}

.risk-badge {
    padding: 10px 16px;
    border-radius: 20px;
    font-weight: 600;
    font-size: 18px;
    min-width: 100px;
    text-align: center;
}

.risk-high {
    background: #fee2e2;
    color: var(--danger);
}

.risk-medium {
    background: #fef3c7;
    color: #d97706;
}

.risk-low {
    background: #dcfce7;
    color: var(--success);
}

.lot-details {
    margin: 20px 0;
}

.lot-details p {
    padding: 8px 0;
    font-size: 15px;
    line-height: 1.6;
    color: #4b5563;
}

.lot-details strong {
    color: var(--dark-text);
}

/* Violations */
.violations {
    margin-top: 20px;
    padding: 16px;
    background: var(--light-bg);
    border-left: 4px solid var(--warning);
    border-radius: 6px;
}

.violations h3 {
    color: var(--dark-text);
    margin-bottom: 12px;
    font-size: 16px;
}

.violations ul {
    list-style: none;
    margin: 0;
}

.violations li {
    padding: 8px 12px;
    margin: 6px 0;
    background: white;
    border-left: 3px solid transparent;
    border-radius: 4px;
    font-size: 14px;
}

.violation-high {
    background: #fee2e2;
    border-left-color: var(--danger);
    color: #7f1d1d;
}

.violation-medium {
    background: #fef3c7;
    border-left-color: #f59e0b;
    color: #78350f;
}

.violation-low {
    background: #dbeafe;
    border-left-color: #3b82f6;
    color: #1e3a8a;
}

/* Indicators */
.indicators {
    margin-top: 20px;
    padding: 16px;
    background: #f0f4ff;
    border-left: 4px solid var(--primary);
    border-radius: 6px;
}

.indicators h3 {
    color: var(--primary);
    margin-bottom: 12px;
    font-size: 16px;
}

.indicators ul {
    list-style: none;
    margin: 0;
}

.indicators li {
    padding: 6px 12px;
    margin: 4px 0;
    background: white;
    border-radius: 4px;
    font-size: 13px;
    color: #4b5563;
}

.lot-footer {
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid var(--light-bg);
    text-align: right;
    color: #9ca3af;
    font-size: 12px;
}

/* Loading */
.loading {
    text-align: center;
    color: white;
    padding: 40px;
}

.spinner {
    border: 4px solid rgba(255,255,255,0.3);
    border-top: 4px solid white;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Error */
.error {
    background: rgba(239, 68, 68, 0.2);
    border: 2px solid var(--danger);
    color: white;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 20px;
}

/* Footer */
footer {
    text-align: center;
    color: rgba(255,255,255,0.7);
    margin-top: 60px;
    padding-top: 20px;
    border-top: 1px solid rgba(255,255,255,0.1);
    font-size: 14px;
}

/* Responsive */
@media (max-width: 768px) {
    header h1 {
        font-size: 36px;
    }
    
    .search-section {
        flex-direction: column;
    }
    
    .input-group {
        flex-direction: column;
    }
    
    .lot-header {
        flex-direction: column;
        gap: 12px;
        align-items: flex-start;
    }
    
    .risk-badge {
        width: 100%;
    }
    
    .api-indicators {
        flex-direction: column;
        gap: 10px;
    }
}
```

### 3.6 `.gitignore`

```
.DS_Store
node_modules/
.env.local
.idea/
*.log
```

### 3.7 Публикуйте на GitHub Pages

```bash
# Инициализируйте репо
git init
git add .
git commit -m "Initial frontend commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/goszakup-frontend.git
git push -u origin main
```

Зайдите на GitHub → ваш репозиторий → **Settings** → **Pages**:
- Source: `Deploy from a branch`
- Branch: `main` / `(root)`
- Нажмите **Save**

**Ваш фронтенд будет доступен:** `https://YOUR_USERNAME.github.io/goszakup-frontend`

---

## 🌍 Привязка frontend к вашему домену (опционально)

Если хотите фронтенд тоже на вашем домене `yourdomain.com`:

### В Render Dashboard (для frontend)

1. Создайте еще один service но для **Static Site**
2. Укажите репо `goszakup-frontend`
3. Build Command: `echo "Static site"`
4. Publish directory: `/`
5. Добавьте custom domain: `yourdomain.com`

---

## ✅ Итоговые компоненты

| Компонент | Платформа | Стоимость | URL |
|-----------|-----------|----------|-----|
| **Backend** | Render.com | **0$** | `https://api.yourdomain.com` или `.onrender.com` |
| **Frontend** | GitHub Pages | **0$** | `https://YOUR_USERNAME.github.io/goszakup-frontend` |
| **Domain** | Namecheap/Route53/etc | ~10$/год | `yourdomain.com` |

### ИТОГО: **0$ / месяц** (только домен ~10$/год)

---

## 🎯 Запуск локально для разработки

```bash
# Backend (в терминале 1)
source .venv311/bin/activate
uvicorn src.api.routes:app --host 127.0.0.1 --port 8006

# Frontend (в терминале 2)
cd goszakup-frontend
python3 -m http.server 3000
# Откройте: http://localhost:3000
```

---

## 🔐 Безопасность

В `src/utils/config.py` уже добавлена конфигурация CORS для всех публичных компонентов:

```python
CORS_ALLOWED_ORIGINS = [
    "https://YOUR_USERNAME.github.io",
    "https://yourdomain.com",
    "https://api.yourdomain.com",
    "http://localhost:3000",
    "http://127.0.0.1",
]
```

---

## 🚀 Преимущества этого подхода

✅ **Полностью бесплатно** (кроме домена ~10$/год)
✅ **Ваш собственный домен** со своими поддоменами
✅ **Автоматические HTTPS** от Render и GitHub
✅ **Масштабируемость** - обе части независимы
✅ **Нет привязки к Mac** - всё на облаке
✅ **CI/CD на GitHub** - автоматический деплой при push
✅ **Мониторинг** - Render показывает логи и статус

---

Успехов с деплоем! 🎉
