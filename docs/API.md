# GoszakupAI Backend API Documentation

## Общие сведения

**Базовый URL**: `http://localhost:8000` (или `http://<server>:8000`)

**Версия API**: 1.0

**Формат обмена данными**: JSON

### Особенности

- **CORS**: Включены запросы с `localhost:3000`, `localhost:8006` и других развернутых источников
- **Rate Limiting**: Ограничение частоты запросов (настраивается по эндпоинтам)
- **Таймауты**: Рекомендуемый таймаут для анализа: 30 сек
- **Кодировка**: UTF-8

### Коды ошибок

| Код | Описание |
|-----|---------|
| 200 | Успешный запрос |
| 400 | Неверный запрос (неправильные параметры) |
| 404 | Лот не найден |
| 503 | Service Unavailable (анализатор не готов, модели загружаются) |
| 500 | Внутренняя ошибка сервера |

---

## 1. Health Check (Проверка статуса)

### 1.1 Простая проверка статуса

**`GET /health`**

Быстрая проверка, используется для Docker healthcheck.

**Response:**
```json
{
  "status": "ok"
}
```

**Пример curl:**
```bash
curl http://localhost:8000/health
```

---

### 1.2 Расширенная проверка статуса

**`GET /api/health`**

Полная проверка здоровья с информацией о готовности анализатора.

**Response:**
```json
{
  "status": "ok",
  "total_lots": 5432,
  "analyzer_ready": true
}
```

**Пример curl:**
```bash
curl http://localhost:8000/api/health
```

---

## 2. Лоты (Lots)

### 2.1 Получение списка лотов

**`GET /api/lots`**

Получение списка лотов с фильтрацией, сортировкой и пагинацией. Лоты сортируются по risk_score по умолчанию (от высокого риска к низкому).

**Query параметры:**

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|-------------|---------|
| `page` | integer | 0 | Номер страницы (с 0) |
| `size` | integer | 20 | Размер страницы (1-100) |
| `risk_level` | string | (все) | Фильтр уровня риска: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `search` | string | (отключен) | Поиск по названию лота или описанию товара |
| `sort_by` | string | `risk_score` | Сортировка по: `risk_score`, `budget`, `deadline_days` |
| `sort_desc` | boolean | true | Порядок сортировки (true = по убыванию) |

**Response:**
```json
{
  "total": 542,
  "page": 0,
  "size": 20,
  "items": [
    {
      "lot_id": "85653799-КППТСОПО1",
      "name_ru": "Говядина охлажденная, туша, I категория",
      "category_name": "Продукты питания",
      "budget": 1872200.0,
      "participants_count": 3,
      "deadline_days": 14,
      "city": "Западно-Казахстанская область",
      "risk_score": 87.5,
      "risk_level": "HIGH",
      "rules_count": 5
    },
    {
      "lot_id": "84230103-ОК1",
      "name_ru": "Работы по текущему ремонту отдельных элементов зданий",
      "category_name": "Услуги",
      "budget": 81049202.0,
      "participants_count": 0,
      "deadline_days": 7,
      "city": "Алматы",
      "risk_score": 72.3,
      "risk_level": "HIGH",
      "rules_count": 3
    }
  ]
}
```

**Примеры curl:**

```bash
# Получить первую страницу со значением по умолчанию
curl "http://localhost:8000/api/lots"

# Получить лоты HIGH риска, страница 1, размер 10
curl "http://localhost:8000/api/lots?page=1&size=10&risk_level=HIGH"

# Поиск по названию с сортировкой по бюджету
curl "http://localhost:8000/api/lots?search=говядина&sort_by=budget&sort_desc=false"

# Отфильтровать по CRITICAL риску и сортировать по сроку сдачи
curl "http://localhost:8000/api/lots?risk_level=CRITICAL&sort_by=deadline_days"
```

**Примеры на JavaScript:**

```javascript
// Получить лоты HIGH риска
const response = await fetch(
  'http://localhost:8000/api/lots?risk_level=HIGH&page=0&size=20'
);
const data = await response.json();
console.log(data.items);

// Поиск с фильтрацией
const searchByName = async (query) => {
  const response = await fetch(
    `http://localhost:8000/api/lots?search=${encodeURIComponent(query)}`
  );
  return response.json();
};
```

---

### 2.2 Полный анализ конкретного лота

**`GET /api/lots/{lot_id}/analysis`**

Получить детальный анализ конкретного лота с разбором всех риск-факторов, ML-предсказаниями, сетевыми флагами и объяснениями на русском языке.

**Path параметры:**

| Параметр | Тип | Описание |
|----------|-----|---------|
| `lot_id` | string | Уникальный идентификатор лота (например: `85653799-КППТСОПО1`) |

**Response (FullAnalysis):**

```json
{
  "lot_id": "85653799-КППТСОПО1",
  "lot_data": {
    "name_ru": "Говядина охлажденная, туша, I категория",
    "category_code": "101111.400.000006",
    "category_name": "Продукты питания",
    "budget": 1872200.0,
    "participants_count": 3,
    "deadline_days": 14,
    "city": "Западно-Казахстанская область"
  },
  "final_score": 87.5,
  "final_level": "HIGH",
  "rule_analysis": {
    "lot_id": "85653799-КППТСОПО1",
    "risk_score": 85.2,
    "risk_level": "HIGH",
    "rules_triggered": [
      {
        "rule_id": "brand_lock_in",
        "datanomix_code": "DATANOMIX_001",
        "rule_name_ru": "Блокировка по брендам",
        "category": "specification",
        "weight": 15.0,
        "raw_score": 92.0,
        "explanation_ru": "В спецификации указаны конкретные бренды без указания аналогов",
        "evidence": "бренд: 'Angus Prime', без уточнения 'или эквивалент'",
        "severity": "critical",
        "law_reference": "Закон РК 'О государственных закупках', статья 7"
      },
      {
        "rule_id": "exclusive_supplier",
        "datanomix_code": "DATANOMIX_002",
        "rule_name_ru": "Исключительный поставщик",
        "category": "supplier_restriction",
        "weight": 12.0,
        "raw_score": 78.0,
        "explanation_ru": "Описание ограничивает участников через требования к сертификации",
        "evidence": "требование: 'сертификат ISO 9001 выданный в Казахстане'",
        "severity": "high",
        "law_reference": "Закон РК 'О государственных закупках', статья 12, подпункт 2"
      }
    ],
    "rules_passed_count": 18,
    "total_rules_checked": 23,
    "summary_ru": "Лот содержит высокие риски ограничивающих требований. Выявлены потенциальные нарушения правил конкурентности.",
    "highlights": [
      "⚠️ CRITICAL: Блокировка по брендам (score: 92)",
      "⚠️ HIGH: Исключительный поставщик (score: 78)",
      "⚠️ MEDIUM: Короткий срок подачи заявок (score: 65)"
    ],
    "datanomix_codes": ["DATANOMIX_001", "DATANOMIX_002"]
  },
  "features": {
    "lot_id": "85653799-КППТСОПО1",
    "has_brand": true,
    "brand_count": 2,
    "brand_names": ["Angus Prime", "Premium Beef"],
    "has_exclusive_phrase": true,
    "has_no_analogs": true,
    "dealer_requirement": true,
    "geo_restriction": true,
    "standard_count": 3,
    "text_length": 2847,
    "participants_count": 3,
    "deadline_days": 14,
    "budget": 1872200.0,
    "is_copypaste": false,
    "is_unique": true,
    "category_code": "101111.400.000006"
  },
  "similar_lots": [
    {
      "lot_id": "85653798-КППТСОПО2",
      "similarity": 0.87,
      "name_ru": "Говядина копчена-вареная, I категория"
    },
    {
      "lot_id": "84230105-ОК3",
      "similarity": 0.72,
      "name_ru": "Мясо птицы охлажденное, туша"
    }
  ],
  "ml_prediction": {
    "isolation_anomaly": true,
    "isolation_score": 0.78,
    "catboost_proba": 0.84,
    "ml_score": 81.0
  },
  "network_flags": [
    "suspicious_supplier_network",
    "multiple_contracts_same_supplier",
    "price_anomaly_detected"
  ],
  "explanation": [
    "Лот имеет высокий риск из-за явной блокировки по брендам",
    "Выявлены сетевые аномалии: один и тот же поставщик выигрывает множество связанных тендеров",
    "ML-модель классифицирует как аномальный с вероятностью 84%",
    "Рекомендация: потребовать переформулировку спецификации без указания конкретных брендов"
  ]
}
```

**Пример curl:**

```bash
curl "http://localhost:8000/api/lots/85653799-КППТСОПО1/analysis"
```

**Пример на JavaScript:**

```javascript
const analyzeLot = async (lotId) => {
  try {
    const response = await fetch(
      `http://localhost:8000/api/lots/${encodeURIComponent(lotId)}/analysis`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const analysis = await response.json();
    return analysis;
  } catch (error) {
    console.error('Error analyzing lot:', error);
  }
};

// Использование
const result = await analyzeLot('85653799-КППТСОПО1');
console.log(`Risk Level: ${result.final_level}`);
console.log(`Score: ${result.final_score}`);
result.rule_analysis.highlights.forEach(h => console.log(h));
```

---

## 3. Анализ текста (Text Analysis)

### 3.1 Анализ произвольного текста ТЗ

**`POST /api/analyze`**

Проанализировать произвольный текст технического задания (ТЗ) или описания товара. Полезно для проверки текста ДО публикации на портале.

**Request Body (AnalyzeTextRequest):**

```json
{
  "text": "Бензин для двигателей с искровым зажиганием марка АИ-92. Требуемое качество согласно требованиям стандарта ГОСТ 32513-2013",
  "budget": 153240.0,
  "participants_count": 5,
  "deadline_days": 7,
  "category_code": "192021.530.000001"
}
```

**Параметры:**

| Параметр | Тип | Обязательно | Описание |
|----------|-----|------------|---------|
| `text` | string | ✅ Да | Основной текст для анализа |
| `budget` | float | ❌ Нет | Бюджет лота (по умолчанию: 0) |
| `participants_count` | integer | ❌ Нет | Ожидаемое количество участников (по умолчанию: 0) |
| `deadline_days` | integer | ❌ Нет | Количество дней до окончания приема заявок (по умолчанию: 0) |
| `category_code` | string | ❌ Нет | Код ТРУ (по умолчанию: "") |

**Response:** Возвращает тот же FullAnalysis объект, что и эндпоинт анализа лота (см. раздел 2.2)

**Примеры curl:**

```bash
# Минимальный запрос (только текст)
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Говядина охлажденная высшего сорта"
  }'

# Полный запрос со всеми параметрами
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Говядина охлажденная, туша, I категория. Требуется сертификат ISO 9001.",
    "budget": 1872200.0,
    "participants_count": 3,
    "deadline_days": 14,
    "category_code": "101111.400.000006"
  }'
```

**Примеры на JavaScript:**

```javascript
const analyzeText = async (text, options = {}) => {
  try {
    const response = await fetch('http://localhost:8000/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        budget: options.budget || 0,
        participants_count: options.participants_count || 0,
        deadline_days: options.deadline_days || 0,
        category_code: options.category_code || ''
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error analyzing text:', error);
    throw error;
  }
};

// Использование
const analysis = await analyzeText(
  'Проектные работы по подготовке помещения для установки медицинской техники',
  {
    budget: 81049202.0,
    deadline_days: 60,
    category_code: '410040.300.000007'
  }
);

console.log(`Risk Score: ${analysis.final_score}`);
analysis.rule_analysis.rules_triggered.forEach(rule => {
  console.log(`- [${rule.severity}] ${rule.rule_name_ru}: ${rule.explanation_ru}`);
});
```

---

## 4. Обратная связь (Feedback)

### 4.1 Отправить обратную связь о лоте

**`POST /api/feedback`**

Сохранить оценку (метку) о лоте: осуществим (0) или рискованный (1). Данные используются для улучшения ML-моделей.

**Request Body (FeedbackRequest):**

```json
{
  "lot_id": "85653799-КППТСОПО1",
  "label": 1,
  "comment": "Действительно рискованный лот, очень узкая спецификация"
}
```

**Параметры:**

| Параметр | Тип | Обязательно | Описание |
|----------|-----|------------|---------|
| `lot_id` | string | ✅ Да | Уникальный идентификатор лота |
| `label` | integer | ✅ Да | 0 = осуществим/нормальный, 1 = рискованный |
| `comment` | string | ❌ Нет | Дополнительный комментарий |

**Response:**
```json
{
  "status": "ok"
}
```

**Пример curl:**

```bash
curl -X POST http://localhost:8000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "lot_id": "85653799-КППТСОПО1",
    "label": 1,
    "comment": "Спецификация очень узкая, только один поставщик может участвовать"
  }'
```

**Пример на JavaScript:**

```javascript
const submitFeedback = async (lotId, label, comment = null) => {
  try {
    const response = await fetch('http://localhost:8000/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        lot_id: lotId,
        label: label,
        comment: comment
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error submitting feedback:', error);
  }
};

// Использование
await submitFeedback('85653799-КППТСОПО1', 1, 'Узкая спецификация');
```

**Примечание:** Обратная связь сохраняется в CSV файле со столбцами: `lot_id`, `label`, `comment`, `created_at`

---

## 5. Статистика и Дашборд (Dashboard Stats)

### 5.1 Получить статистику для дашборда

**`GET /api/stats/dashboard`**

Получить агрегированную статистику всех лотов, распределение по уровням риска, категориям, среднее значение риска и топ-10 рискованных лотов.

**Response (DashboardStats):**

```json
{
  "total_lots": 5432,
  "processed_lots": 4821,
  "all_lots": 5432,
  "by_level": {
    "LOW": 1543,
    "MEDIUM": 1876,
    "HIGH": 1234,
    "CRITICAL": 779
  },
  "avg_score": 54.3,
  "total_budget": 285000000000.0,
  "by_category": {
    "Продукты питания": {
      "count": 432,
      "high_risk": 126,
      "avg_score": 62.5
    },
    "Услуги": {
      "count": 1876,
      "high_risk": 342,
      "avg_score": 58.2
    },
    "Строительство": {
      "count": 342,
      "high_risk": 89,
      "avg_score": 51.3
    },
    "Медикаменты": {
      "count": 234,
      "high_risk": 78,
      "avg_score": 65.8
    }
  },
  "top_risks": [
    {
      "lot_id": "85653799-КППТСОПО1",
      "final_score": 92.3,
      "final_level": "CRITICAL",
      "lot_data": {
        "name_ru": "Говядина охлажденная, туша, I категория",
        "budget": 1872200.0,
        "city": "Западно-Казахстанская область"
      },
      "rule_analysis": {
        "highlights": [
          "⚠️ CRITICAL: Блокировка по брендам (score: 92)",
          "⚠️ HIGH: Исключительный поставщик (score: 78)"
        ]
      }
    }
  ]
}
```

**Пример curl:**

```bash
curl "http://localhost:8000/api/stats/dashboard"
```

**Пример на JavaScript:**

```javascript
const getDashboardStats = async () => {
  try {
    const response = await fetch('http://localhost:8000/api/stats/dashboard');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const stats = await response.json();
    return stats;
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
  }
};

// Использование
const stats = await getDashboardStats();

console.log(`📊 Всего лотов: ${stats.total_lots}`);
console.log(`✅ Обработано: ${stats.processed_lots}`);
console.log(`📈 Средний риск: ${stats.avg_score.toFixed(1)}`);
console.log(`💰 Общий бюджет: ${(stats.total_budget / 1e9).toFixed(1)}B тенге`);

console.log('\n📋 Распределение по уровням риска:');
Object.entries(stats.by_level).forEach(([level, count]) => {
  console.log(`  ${level}: ${count} лотов`);
});

console.log('\n🔝 ТОП-10 рискованных лотов:');
stats.top_risks.forEach((lot, idx) => {
  console.log(`  ${idx + 1}. [${lot.final_level}] ${lot.lot_data.name_ru} (score: ${lot.final_score})`);
});
```

---

## 6. Сетевой анализ (Network Analysis)

### 6.1 Анализ взаимоотношений заказчик-поставщик

**`GET /api/network/{bin_id}`**

Получить анализ сетевых взаимоотношений организации (по БИН - номер бизнес-идентификации): количество контрактов, связи с другими организациями, сетевые аномалии.

**Path параметры:**

| Параметр | Тип | Описание |
|----------|-----|---------|
| `bin_id` | string | БИН (Business Identification Number) организации, например: `980740002192` |

**Response (NetworkAnalysisResult):**

```json
{
  "bin": "980740002192",
  "node": {
    "type": "supplier",
    "degree": 42,
    "centrality": 0.78,
    "community_id": 5,
    "total_contracts": 127
  },
  "connections_count": 42,
  "flags": [
    "high_centrality",
    "multiple_communities",
    "rapid_growth",
    "price_anomalies"
  ],
  "community_size": 156
}
```

**Пример curl:**

```bash
curl "http://localhost:8000/api/network/980740002192"
```

**Пример на JavaScript:**

```javascript
const analyzeNetwork = async (binId) => {
  try {
    const response = await fetch(
      `http://localhost:8000/api/network/${encodeURIComponent(binId)}`
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('БИН не найден в сети');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const networkData = await response.json();
    return networkData;
  } catch (error) {
    console.error('Error analyzing network:', error);
  }
};

// Использование
const network = await analyzeNetwork('980740002192');

console.log(`🔗 БИН: ${network.bin}`);
console.log(`📊 Количество связей: ${network.connections_count}`);
console.log(`💼 Общее количество контрактов: ${network.node.total_contracts}`);
console.log(`🎯 Централизованность: ${(network.node.centrality * 100).toFixed(1)}%`);
console.log(`⚠️ Флаги: ${network.flags.join(', ')}`);
```

---

## Структуры данных (Data Structures)

### RuleMatch (Срабатывание правила риска)

Объект, описывающий одно срабатывание правила детектирования риска.

```json
{
  "rule_id": "brand_lock_in",
  "datanomix_code": "DATANOMIX_001",
  "rule_name_ru": "Блокировка по брендам",
  "category": "specification",
  "weight": 15.0,
  "raw_score": 92.0,
  "explanation_ru": "В спецификации указаны конкретные бренды без указания аналогов",
  "evidence": "найденный текст: '...'",
  "severity": "critical",
  "law_reference": "Закон РК 'О государственных закупках'"
}
```

**Значения severity:**
- `low` - низкая серьезность
- `medium` - средняя серьезность
- `high` - высокая серьезность
- `critical` - критическая серьезность

### LotFeatures (Признаки для ML-модели)

```json
{
  "lot_id": "85653799-КППТСОПО1",
  "has_brand": true,
  "brand_count": 2,
  "brand_names": ["Angus Prime", "Premium Beef"],
  "has_exclusive_phrase": true,
  "has_no_analogs": true,
  "dealer_requirement": true,
  "geo_restriction": true,
  "standard_count": 3,
  "text_length": 2847,
  "participants_count": 3,
  "deadline_days": 14,
  "budget": 1872200.0,
  "is_copypaste": false,
  "is_unique": true,
  "category_code": "101111.400.000006"
}
```

### RiskLevel (Уровни риска)

- `LOW` - низкий риск (score: 0-25)
- `MEDIUM` - средний риск (score: 25-50)
- `HIGH` - высокий риск (score: 50-75)
- `CRITICAL` - критический риск (score: 75-100)

---

## Примеры использования (Usage Examples)

### Сценарий 1: Просмотр списка рискованных лотов

```javascript
// 1. Получить статистику
const stats = await fetch('http://localhost:8000/api/stats/dashboard')
  .then(r => r.json());

console.log(`Критических лотов: ${stats.by_level.CRITICAL}`);

// 2. Получить лоты HIGH риска
const highRiskLots = await fetch(
  'http://localhost:8000/api/lots?risk_level=HIGH&sort_by=risk_score'
)
  .then(r => r.json());

// 3. Для каждого топ-достаточно, получить полный анализ
for (const lot of highRiskLots.items.slice(0, 5)) {
  const analysis = await fetch(
    `http://localhost:8000/api/lots/${lot.lot_id}/analysis`
  )
    .then(r => r.json());
  
  console.log(`\n${lot.name_ru} (score: ${analysis.final_score})`);
  analysis.rule_analysis.highlights.forEach(h => console.log(`  ${h}`));
}
```

### Сценарий 2: Проверить новое описание перед публикацией

```javascript
const specificationText = `
Говядина охлажденная, туша, I категория.
Требуется сертификат ISO 9001.
Поставщик должен иметь опыт работы с ГП не менее 5 лет.
`;

const analysis = await fetch('http://localhost:8000/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: specificationText,
    budget: 1872200.0,
    deadline_days: 14
  })
}).then(r => r.json());

if (analysis.final_score > 75) {
  console.warn(`⚠️ РИСК! Рекомендуется переформулировать спецификацию`);
  analysis.rule_analysis.rules_triggered.forEach(rule => {
    console.log(`  - [${rule.severity}] ${rule.rule_name_ru}`);
    console.log(`    ${rule.explanation_ru}`);
  });
} else {
  console.log('✅ Спецификация принята');
}
```

### Сценарий 3: Поиск и фильтрация лотов

```javascript
// Поиск лотов "говядина", фильтр HIGH и CRITICAL риск
const searchAndFilter = async (query, riskLevels = ['HIGH', 'CRITICAL']) => {
  const results = [];
  
  for (const riskLevel of riskLevels) {
    const response = await fetch(
      `http://localhost:8000/api/lots?search=${encodeURIComponent(query)}&risk_level=${riskLevel}&size=50`
    );
    const data = await response.json();
    results.push(...data.items);
  }
  
  // Сортировать по риску
  return results.sort((a, b) => b.risk_score - a.risk_score);
};

const risky = await searchAndFilter('говядина');
console.log(`Найдено рискованных лотов: ${risky.length}`);
risky.forEach(lot => {
  console.log(`${lot.name_ru} - ${lot.risk_level} (${lot.risk_score})`);
});
```

---

## Обработка ошибок

### 400 Bad Request

```json
{
  "detail": "Invalid parameters: search parameter is too long"
}
```

### 404 Not Found

```json
{
  "detail": "Lot not found: 85653799-INVALID"
}
```

### 503 Service Unavailable

```json
{
  "detail": "Analyzer is not ready. Models are still loading..."
}
```

**JavaScript обработка:**

```javascript
const handleApiError = async (response) => {
  if (!response.ok) {
    const error = await response.json();
    
    switch (response.status) {
      case 400:
        console.error('Неверные параметры:', error.detail);
        break;
      case 404:
        console.error('Ресурс не найден:', error.detail);
        break;
      case 503:
        console.error('Сервис недоступен. Попробуйте позже.');
        break;
      default:
        console.error('Ошибка:', error.detail);
    }
    
    throw new Error(error.detail);
  }
  
  return response;
};

// Использование
try {
  const response = await fetch('http://localhost:8000/api/lots/invalid-id/analysis');
  await handleApiError(response);
} catch (error) {
  console.error('Handled error:', error.message);
}
```

---

## Рекомендации по интеграции

1. **Кэширование**: Кэшируйте результаты анализа на 1-2 часа, т.к. вычисления дорогие
2. **Пагинация**: Всегда используйте параметры `page` и `size` для больших наборов данных
3. **Таймауты**: Установите таймаут 30-60 секунд для POST `/api/analyze`
4. **Обработка 503**: Реализуйте retry логику с exponential backoff
5. **Поиск**: Используйте debouncing при вводе в поле поиска (200-300ms)

---

## Версия документации

- **API Version**: 1.0
- **Дата последнего обновления**: 2026-02-24
- **Состояние**: ✅ Production-ready
