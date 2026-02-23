# Деплой: Backend на Mac + Frontend на GitHub Pages

## 🏗️ Архитектура

```
Frontend (GitHub Pages)          Backend (Ваш Mac)
yourdomain.com              →    api.yourdomain.com
    ├── index.html                    ├── FastAPI
    ├── app.js                        ├── ML модели
    └── styles.css                    └── Python
```

## 🚀 Часть 1: Backend на Mac через Cloudflare Tunnel

### 1.1 Авторизация в Cloudflare

```bash
cloudflared tunnel login
```

Откроется браузер - выберите ваш домен (например `yourdomain.com`)

### 1.2 Создание туннеля

```bash
# Создайте туннель
cloudflared tunnel create goszakup-api

# Запомните Tunnel ID (будет показан)
```

### 1.3 Настройка DNS

```bash
# Привяжите субдомен к туннелю
cloudflared tunnel route dns goszakup-api api.yourdomain.com
```

Или вручную в Cloudflare Dashboard:
- DNS → Add record
- Type: `CNAME`
- Name: `api`
- Target: `<tunnel-id>.cfargotunnel.com`
- Proxy: ✅ Proxied

### 1.4 Конфигурация туннеля

Создайте файл конфигурации:

```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Содержимое:

```yaml
tunnel: <ваш-tunnel-id>
credentials-file: /Users/beka/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:8006
  - service: http_status:404
```

### 1.5 Запуск backend

**Терминал 1 - FastAPI:**
```bash
cd ~/Projects/claude/goszakup-ai
source .venv311/bin/activate
uvicorn src.api.routes:app --host 127.0.0.1 --port 8006
```

**Терминал 2 - Cloudflare Tunnel:**
```bash
cloudflared tunnel run goszakup-api
```

✅ Теперь API доступен по `https://api.yourdomain.com`

### 1.6 Автозапуск (опционально)

Чтобы туннель запускался при включении Mac:

```bash
sudo cloudflared service install
```

Для автозапуска FastAPI создайте launchd service или используйте Docker.

---

## 🎨 Часть 2: Frontend на GitHub Pages

### 2.1 Создание frontend репозитория

```bash
cd ~/Projects
mkdir goszakup-frontend
cd goszakup-frontend
git init
```

### 2.2 Создание простого frontend

Создайте файлы:

**index.html:**
```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GoszakupAI - Анализ рисков</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <h1>🇰🇿 GoszakupAI</h1>
        <p>Система анализа рисков в государственных закупках</p>
        
        <div class="api-test">
            <h2>Тест API</h2>
            <button onclick="testAPI()">Проверить здоровье API</button>
            <pre id="result"></pre>
        </div>

        <div class="analyze-form">
            <h2>Анализ текста закупки</h2>
            <textarea id="text" placeholder="Введите текст закупки..." rows="5"></textarea>
            <button onclick="analyzeText()">Анализировать</button>
            <div id="analysis"></div>
        </div>
    </div>

    <script src="app.js"></script>
</body>
</html>
```

**app.js:**
```javascript
const API_URL = 'https://api.yourdomain.com';  // Замените на ваш домен

async function testAPI() {
    const result = document.getElementById('result');
    result.textContent = 'Загрузка...';
    
    try {
        const response = await fetch(`${API_URL}/api/health`);
        const data = await response.json();
        result.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        result.textContent = `Ошибка: ${error.message}`;
    }
}

async function analyzeText() {
    const text = document.getElementById('text').value;
    const analysis = document.getElementById('analysis');
    
    if (!text) {
        alert('Введите текст для анализа');
        return;
    }
    
    analysis.innerHTML = '<p>Анализируем...</p>';
    
    try {
        const response = await fetch(`${API_URL}/api/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                budget: 5000000,
                participants_count: 2,
                deadline_days: 7
            })
        });
        
        const data = await response.json();
        
        // Отображение результата
        analysis.innerHTML = `
            <div class="result-card">
                <h3>Результат анализа</h3>
                <p><strong>Итоговый балл:</strong> ${data.final_score}</p>
                <p><strong>Уровень риска:</strong> 
                    <span class="risk-${data.final_level}">${data.final_level}</span>
                </p>
                <h4>Сработавшие правила:</h4>
                <ul>
                    ${data.rule_analysis?.rules_triggered?.map(r => 
                        `<li>${r.rule_name_ru} (${r.weight} баллов)</li>`
                    ).join('') || '<li>Нет</li>'}
                </ul>
            </div>
        `;
    } catch (error) {
        analysis.innerHTML = `<p class="error">Ошибка: ${error.message}</p>`;
    }
}
```

**styles.css:**
```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    padding: 20px;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    background: white;
    border-radius: 10px;
    padding: 40px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
}

h1 {
    color: #667eea;
    margin-bottom: 10px;
}

h2 {
    color: #333;
    margin: 30px 0 15px;
}

button {
    background: #667eea;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
    transition: background 0.3s;
}

button:hover {
    background: #5568d3;
}

textarea {
    width: 100%;
    padding: 12px;
    border: 2px solid #e0e0e0;
    border-radius: 5px;
    font-family: inherit;
    font-size: 14px;
    margin-bottom: 10px;
}

pre {
    background: #f5f5f5;
    padding: 15px;
    border-radius: 5px;
    overflow-x: auto;
    margin-top: 10px;
}

.result-card {
    background: #f9f9f9;
    padding: 20px;
    border-radius: 5px;
    margin-top: 15px;
}

.risk-HIGH {
    color: #d32f2f;
    font-weight: bold;
}

.risk-MEDIUM {
    color: #f57c00;
    font-weight: bold;
}

.risk-LOW {
    color: #388e3c;
    font-weight: bold;
}

.error {
    color: #d32f2f;
}
```

### 2.3 Подготовка к GitHub Pages

```bash
# Добавьте все файлы
git add .
git commit -m "Initial frontend for GoszakupAI"

# Создайте репозиторий на GitHub (например, goszakup-frontend)
# Затем:
git remote add origin https://github.com/ekbmusk/goszakup-frontend.git
git branch -M main
git push -u origin main
```

### 2.4 Включение GitHub Pages

1. Идите в Settings репозитория `goszakup-frontend`
2. **Pages** → **Source**: `main` branch, `/ (root)`
3. **Save**
4. GitHub сгенерирует URL: `https://ekbmusk.github.io/goszakup-frontend/`

### 2.5 Настройка custom domain

Если хотите использовать `yourdomain.com` вместо GitHub URL:

1. **В репозитории** создайте файл `CNAME`:
   ```
   yourdomain.com
   ```

2. **В Cloudflare DNS** добавьте записи:
   ```
   Type: A, Name: @, Value: 185.199.108.153
   Type: A, Name: @, Value: 185.199.109.153
   Type: A, Name: @, Value: 185.199.110.153
   Type: A, Name: @, Value: 185.199.111.153
   ```

3. Подождите 5-10 минут

---

## 🔧 Часть 3: Настройка CORS на backend

Обновите `src/utils/config.py`:

```python
CORS_ALLOWED_ORIGINS = _parse_csv_env(
    os.getenv("CORS_ALLOWED_ORIGINS", ""),
    ["https://yourdomain.com", "https://ekbmusk.github.io"],
)
```

И перезапустите FastAPI.

---

## 🧪 Тестирование

1. **Backend**: `https://api.yourdomain.com/api/health`
2. **Frontend**: `https://yourdomain.com` или `https://ekbmusk.github.io/goszakup-frontend/`

---

## 🔐 Безопасность

### Рекомендации:

1. **API Key**: Добавьте аутентификацию для API
2. **Rate Limiting**: Уже есть в middleware.py
3. **Firewall**: Mac Firewall включите
4. **HTTPS**: Cloudflare автоматически обеспечивает SSL

---

## 💰 Стоимость

- **Cloudflare Tunnel**: Бесплатно
- **GitHub Pages**: Бесплатно
- **Домен**: ~$10-15/год
- **Электричество Mac**: ~$5-10/месяц

**Итого**: Почти бесплатно! 🎉

---

## 🚨 Важные моменты

### При выключении Mac:
- Backend перестанет работать
- Frontend будет работать, но API недоступен

### Решение:
- Держите Mac включенным 24/7
- Или используйте Raspberry Pi / старый ноутбук
- Или всё-таки деплойте на DigitalOcean ($12/мес)

---

## 📱 Автозапуск при включении Mac

### FastAPI как системный сервис:

Создайте `~/Library/LaunchAgents/com.goszakup.api.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.goszakup.api</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/beka/Projects/claude/goszakup-ai/.venv311/bin/uvicorn</string>
        <string>src.api.routes:app</string>
        <string>--host</string>
        <string>127.0.0.1</string>
        <string>--port</string>
        <string>8006</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/beka/Projects/claude/goszakup-ai</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/beka/goszakup-api.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/beka/goszakup-api.error.log</string>
</dict>
</plist>
```

Загрузите:
```bash
launchctl load ~/Library/LaunchAgents/com.goszakup.api.plist
```

---

Готово! Теперь у вас:
- ✅ Backend на Mac (бесплатно, полный контроль)
- ✅ Frontend на GitHub Pages (бесплатно, быстро)
- ✅ Свой домен
- ✅ HTTPS везде
