# Street Control Backend

Backend server per Street Control - Sistema di gestione gare di Streetlifting

## 🚀 Quick Start

```bash
# Installa dipendenze
npm install

# Crea file .env dalla template
cp .env.example .env

# Inizializza database locale
npm run init-db

# Popola con dati di test
npm run seed

# Avvia server
npm run dev
```

## 📦 Struttura

- `src/server.js` - Entry point
- `src/config/` - Configurazioni (DB, JWT, constants)
- `src/database/` - Schema e inizializzazione DB
- `src/models/` - Models per accesso DB
- `src/controllers/` - Business logic
- `src/routes/` - API endpoints
- `src/middleware/` - Middleware (auth, validation, errors)
- `src/services/` - Servizi (Socket.IO, QR, State Machine)
- `src/utils/` - Utilities

## 🗄️ Database

- **SQLite locale**: Gestione gara offline
- **PostgreSQL remoto**: Record storici e ranking

## 🔧 Tecnologie

- Node.js + Express.js
- Socket.IO (real-time)
- SQLite (locale)
- PostgreSQL (remoto)
- JWT (autenticazione)
