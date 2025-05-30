# 🚗 OBD SaaS Server - Serveur Multi-Tenant pour Boîtiers OBD NR-B80

## 📋 Description

Serveur SaaS moderne pour la gestion de multiples boîtiers OBD NR-B80 avec architecture multi-tenant. Permet la collecte, l'analyse et la visualisation en temps réel des données véhicules pour plusieurs organisations.

## ✨ Fonctionnalités

- **🏢 Multi-Tenant**: Support de plusieurs organisations avec isolation des données
- **📡 TCP Server**: Serveur TCP pour recevoir les données des boîtiers OBD NR-B80
- **🔄 Temps Réel**: WebSocket pour diffusion des données en temps réel
- **🔐 Sécurité**: Authentification JWT avec gestion des rôles
- **📊 Base de Données**: Intégration Supabase/PostgreSQL
- **🚨 Alertes**: Système d'alertes automatiques (survitesse, surchauffe, etc.)
- **📈 Analytics**: Rapports de voyages et statistiques de conduite
- **🛡️ Robustesse**: Gestion d'erreurs, logging professionnel, rate limiting

## 🏗️ Architecture

```
src/
├── api/              # Routes API REST
├── decoders/         # Décodeurs de protocole OBD
├── database/         # Interface base de données
├── middleware/       # Middlewares (auth, logging, etc.)
├── tcp/              # Serveur TCP OBD
└── utils/            # Utilitaires (logger, etc.)
```

## 🚀 Installation

### Prérequis

- **Node.js** >= 16.0.0
- **NPM** >= 8.0.0
- **PostgreSQL** (via Supabase)
- **Compte Supabase**

### Étapes d'installation

1. **Cloner le projet**
```bash
git clone <repository-url>
cd OBD-Modern-Server/nodejs-server
```

2. **Installer les dépendances**
```bash
npm run setup
```

3. **Configuration**
```bash
cp .env.example .env
# Éditer le fichier .env avec vos configurations
```

4. **Démarrer le serveur**
```bash
# Mode développement
npm run dev

# Mode production
npm start
```

## ⚙️ Configuration

### Variables d'environnement principales

```env
# Serveur
PORT=3000
TCP_PORT=6909

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key

# JWT
JWT_SECRET=your_secret_key
```

### Configuration Supabase

1. Créer un projet Supabase
2. Copier l'URL et la clé de service
3. Configurer les tables (voir section Schéma)

## 🗄️ Schéma de Base de Données

### Tables principales

```sql
-- Organisations (multi-tenant)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subscription_plan VARCHAR(50) DEFAULT 'basic',
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Appareils OBD
CREATE TABLE obd_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(50) UNIQUE NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255),
    model VARCHAR(100) DEFAULT 'NR-B80',
    status VARCHAR(20) DEFAULT 'offline',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP
);

-- Données temps réel
CREATE TABLE obd_realtime_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(50) REFERENCES obd_devices(device_id),
    timestamp TIMESTAMP NOT NULL,
    -- GPS
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    speed_gps INTEGER,
    direction INTEGER,
    satellites INTEGER,
    -- Moteur
    engine_load DECIMAL(5,2),
    engine_speed DECIMAL(7,2),
    coolant_temp INTEGER,
    intake_temp INTEGER,
    -- Carburant
    fuel_consumption_instant DECIMAL(6,2),
    fuel_pressure INTEGER,
    -- Véhicule
    speed_obd INTEGER,
    odometer INTEGER,
    throttle_position DECIMAL(5,2),
    -- Système
    voltage DECIMAL(4,1),
    gsm_signal INTEGER,
    status_flags JSONB,
    raw_data TEXT
);

-- Rapports de voyages
CREATE TABLE trip_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(50) REFERENCES obd_devices(device_id),
    trip_id VARCHAR(50),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    distance DECIMAL(10,2),
    fuel_consumed DECIMAL(8,2),
    max_speed INTEGER,
    avg_speed DECIMAL(5,2),
    driving_time INTEGER,
    idle_time INTEGER,
    harsh_accelerations INTEGER,
    harsh_brakes INTEGER,
    speeding_events INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Alertes
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(50) REFERENCES obd_devices(device_id),
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium',
    message TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔌 API Endpoints

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/register` - Inscription

### Appareils
- `GET /api/devices` - Liste des appareils
- `POST /api/devices` - Enregistrer un appareil
- `GET /api/devices/:deviceId` - Détails d'un appareil

### Données
- `GET /api/data/realtime/:deviceId` - Données temps réel
- `GET /api/data/trips/:deviceId` - Historique des voyages

### Alertes
- `GET /api/alerts` - Liste des alertes
- `PATCH /api/alerts/:alertId/read` - Marquer comme lu

### Dashboard
- `GET /api/dashboard/stats` - Statistiques

### Administration
- `GET /api/admin/tcp-status` - Statut serveur TCP
- `GET /api/admin/logs` - Logs système

## 🔌 WebSocket Events

### Connexion
```javascript
const socket = io('ws://localhost:3000');

// Authentification
socket.emit('authenticate', 'your_jwt_token');

// Rejoindre une organisation
socket.emit('join-organization', 'org_id');
```

### Événements
- `obd-data` - Nouvelles données OBD
- `alert` - Nouvelle alerte
- `device-status` - Changement statut appareil

## 🚗 Protocole OBD NR-B80

### Format de trame
```
[Header][Device ID][Command][Length][Data][Checksum][Tail]
  0x24     6 bytes    2 bytes  2 bytes  N bytes  1 byte   0x0D
```

### Commandes supportées
- `3080` - Données GPS + OBD combinées
- `3089` - Rapport allumage/extinction
- `308a` - Statut lecture OBD
- `308b` - Consommation moyenne

## 🧪 Tests

```bash
# Tests unitaires
npm test

# Tests en mode watch
npm run test:watch

# Lint
npm run lint
npm run lint:fix
```

## 🔧 Scripts de développement

```bash
npm run dev      # Mode développement avec nodemon
npm start        # Mode production
npm run setup    # Installation + création dossiers
```

## 📊 Monitoring

### Health Check
```bash
GET /health
```

Retourne:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "activeOBDConnections": 5,
  "uptime": 86400
}
```

### Logs
- Fichiers de logs dans `/logs/`
- Logging structuré avec Winston
- Catégories: OBD_DATA, TCP_CONNECTION, AUTHENTICATION, PERFORMANCE, ALERT

## 🛡️ Sécurité

- **JWT** pour l'authentification
- **Helmet** pour sécuriser Express
- **Rate limiting** par utilisateur
- **CORS** configuré
- **Validation** des données entrantes
- **Hachage bcrypt** des mots de passe

## 🚀 Déploiement

### Docker (recommandé)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000 6909
CMD ["npm", "start"]
```

### Variables d'environnement production
```env
NODE_ENV=production
PORT=3000
TCP_PORT=6909
LOG_LEVEL=warn
```

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit (`git commit -m 'Add some AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

MIT License - voir [LICENSE](LICENSE) pour plus de détails.

## 👨‍💻 Auteur

**Cheikhouna FALL**
- GitHub: [@your-username](https://github.com/your-username)
- Email: your.email@example.com

## 🙏 Remerciements

- Analyse du protocole basée sur le code Java original du fournisseur
- Inspiration architecturale: SaaS multi-tenant modernes
- Communauté OBD pour le support du protocole 