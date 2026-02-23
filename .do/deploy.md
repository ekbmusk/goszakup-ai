# Деплой на DigitalOcean

## Вариант 1: App Platform (Рекомендуется для быстрого старта)

### Стоимость
- **Basic (512MB RAM)**: $5/мес - для тестирования
- **Basic-S (1GB RAM)**: $12/мес - рекомендуется
- **Professional (2GB RAM)**: $24/мес - для production

### Шаги:

1. **Войдите в DigitalOcean**
   - https://cloud.digitalocean.com

2. **Создайте App**
   - Create → Apps
   - Source: GitHub
   - Repository: `ekbmusk/goszakup-ai`
   - Branch: `main`
   - Autodeploy: Yes

3. **Настройте Environment Variables**
   - `GOSZAKUP_TOKEN` = [ваш токен]
   - `API_KEY` = [создайте сильный ключ]
   - `FORCE_TRAIN` = false
   - `EXPORT_TRAIN_DATA` = false

4. **Выберите план**
   - Basic-S ($12/мес) - 1GB RAM

5. **Deploy!**
   - Деплой займёт 3-5 минут
   - URL: https://goszakup-ai-xxxxx.ondigitalocean.app

### Альтернативный метод (через CLI):

```bash
# Используя конфигурацию из .do/app.yaml
doctl apps create --spec .do/app.yaml

# Или обновить существующее приложение
doctl apps update YOUR_APP_ID --spec .do/app.yaml
```

---

## Вариант 2: Droplet (Больше контроля, дешевле)

### Стоимость
- **4GB RAM / 2 vCPU**: $24/мес
- **8GB RAM / 4 vCPU**: $48/мес (рекомендуется)

### Шаги:

1. **Создайте Droplet**
   ```
   Region: Frankfurt (ближе к KZ)
   Image: Ubuntu 22.04 LTS
   Size: 8GB / 4 vCPU ($48/мес)
   SSH Keys: Добавьте свой ключ
   ```

2. **Подключитесь к серверу**
   ```bash
   ssh root@YOUR_DROPLET_IP
   ```

3. **Установите Docker**
   ```bash
   curl -fsSL https://get.docker.com | sh
   apt install docker-compose -y
   ```

4. **Клонируйте проект**
   ```bash
   git clone https://github.com/ekbmusk/goszakup-ai.git
   cd goszakup-ai
   ```

5. **Настройте .env**
   ```bash
   nano .env
   ```
   
   Содержимое:
   ```
   GOSZAKUP_TOKEN=your_token_here
   FORCE_TRAIN=false
   EXPORT_TRAIN_DATA=false
   API_KEY=your_api_key_here
   DB_PASSWORD=strong_password_123
   ```

6. **Запустите через Docker Compose**
   ```bash
   docker-compose up -d
   
   # Проверьте логи
   docker-compose logs -f api
   ```

7. **Настройте Nginx + SSL**
   ```bash
   apt install nginx certbot python3-certbot-nginx -y
   
   # Создайте конфиг
   nano /etc/nginx/sites-available/goszakup-ai
   ```
   
   Содержимое:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```
   
   ```bash
   ln -s /etc/nginx/sites-available/goszakup-ai /etc/nginx/sites-enabled/
   nginx -t
   systemctl restart nginx
   
   # Получите SSL
   certbot --nginx -d your-domain.com
   ```

8. **Настройте Firewall**
   ```bash
   ufw allow OpenSSH
   ufw allow 'Nginx Full'
   ufw enable
   ```

---

## После деплоя

### Тестирование API

```bash
# Замените URL на ваш
API_URL="https://goszakup-ai-xxxxx.ondigitalocean.app"

# Health check
curl $API_URL/api/health

# Список лотов
curl "$API_URL/api/lots?page=0&size=5"

# Анализ
curl -X POST $API_URL/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Требуется Apple MacBook Pro",
    "budget": 5000000,
    "participants_count": 2
  }'
```

### Мониторинг

- **App Platform**: Metrics встроены в дашборд
- **Droplet**: `docker stats` или установите Grafana

### Обновление

- **App Platform**: Автоматически при push в GitHub
- **Droplet**: 
  ```bash
  cd ~/goszakup-ai
  git pull
  docker-compose up -d --build
  ```

---

## Оценка стоимости на $200 кредита

| Конфигурация | Стоимость/мес | Время работы |
|--------------|---------------|--------------|
| App Platform (Basic-S) | $12 | ~16 месяцев |
| Droplet 4GB | $24 | ~8 месяцев |
| Droplet 8GB | $48 | ~4 месяца |
| Droplet 8GB + PostgreSQL | $63 | ~3 месяца |

**Рекомендация**: Начните с App Platform ($12/мес), перейдите на Droplet когда нужен больший контроль.
