# GoszakupAI Frontend

React + TypeScript + Vite frontend for the GoszakupAI procurement risk analysis system.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📡 Backend API Integration

The frontend communicates with the GoszakupAI backend API. All API endpoints are fully documented with TypeScript types.

### 📚 Documentation

- **[Full API Documentation](../../docs/API.md)** - Complete reference with examples
- **[TypeScript Types & Client](./src/types/api.ts)** - Ready-to-use API client

### 🔧 Using the API Client

```typescript
import { GoszakupApiClient, RiskLevel } from './types/api';

// Initialize client (defaults to localhost:8000)
const client = new GoszakupApiClient({
  baseUrl: 'http://localhost:8000',
  timeout: 30000
});

// Get high-risk lots
const lots = await client.getHighRiskLots(page, size);

// Analyze specific lot
const analysis = await client.analyzeLot(lotId);

// Analyze text before publication
const textAnalysis = await client.analyzeTextFull(
  "Specification text",
  budget,
  participants_count,
  deadline_days,
  category_code
);

// Get dashboard statistics
const stats = await client.getDashboardStats();

// Submit feedback (0 = normal, 1 = risky)
await client.submitFeedbackFull(lotId, label, comment);
```

### 📋 API Methods

| Method | Purpose |
|--------|---------|
| `getLots(params)` | Get filterable list of lots |
| `getHighRiskLots()` | Get HIGH and CRITICAL risk lots |
| `getCriticalRiskLots()` | Get only CRITICAL risk lots |
| `searchLots(query)` | Search lots by name/description |
| `analyzeLot(lotId)` | Get full analysis of a lot |
| `analyzeText(request)` | Analyze custom text specification |
| `submitFeedback(request)` | Submit feedback about a lot |
| `getDashboardStats()` | Get aggregated statistics |
| `analyzeNetwork(binId)` | Analyze organization network |

### 📊 Available Risk Levels

- `RiskLevel.LOW` (0-25)
- `RiskLevel.MEDIUM` (25-50)
- `RiskLevel.HIGH` (50-75)
- `RiskLevel.CRITICAL` (75-100)

### 🎨 Utility Functions

```typescript
import {
  formatRiskScore,
  getRiskLevelColor,
  formatBudget,
  getSeverityBadge
} from './types/api';

// Format risk score with emoji: "🔴 87.5"
formatRiskScore(87.5);

// Get color for UI: "#dc2626"
getRiskLevelColor(RiskLevel.CRITICAL);

// Format budget: "1.9M ₸"
formatBudget(1872200);

// Get severity badge: { text: 'CRITICAL', emoji: '🔴' }
getSeverityBadge(RuleSeverity.CRITICAL);
```

## 🏗️ Project Setup

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
