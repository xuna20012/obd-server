# 🚗 Serveur OBD SaaS - Architecture Multi-Tenant

> **Serveur Node.js professionnel pour boîtiers OBD NR-B80 avec architecture SaaS complète**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)
[![Coolify](https://img.shields.io/badge/coolify-deployable-purple.svg)](https://coolify.io/)

## 🎯 **Vue d'Ensemble**

Serveur SaaS moderne et robuste pour la gestion de **flottes de boîtiers OBD NR-B80**. Architecture multi-tenant complète avec TCP server, API REST, WebSocket temps réel, et décodage protocolaire avancé.

### ✨ **Fonctionnalités Principales**

🔌 **Serveur TCP Multi-Connexions**
- Port 6909 pour boîtiers OBD NR-B80
- Décodage protocole complet (commandes 3080, 3089, 308a, 308b)
- Gestion automatique des déconnexions/reconnexions
- Heartbeat et timeouts configurables

🌐 **API REST Complète**
- Authentification JWT sécurisée
- Endpoints CRUD pour appareils et organisations
- Statistiques temps réel et métriques
- Documentation Swagger intégrée

📡 **WebSocket Temps Réel**
- Diffusion instantanée des données OBD
- Abonnements par appareil/organisation
- Alertes en temps réel
- Support multi-client simultané

🚨 **Système d'Alertes Intelligent**
- Surchauffe moteur (>100°C)
- Excès de vitesse (>120 km/h)  
- Batterie faible (<11V)
- Perte signal GPS/connexion

🏗️ **Architecture Multi-Tenant**
- Isolation complète par organisation
- Gestion des utilisateurs et rôles
- Scalabilité horizontale
- Base de données flexible (locale/Supabase)

## 📊 **Données Décodées**

### 🛰️ **GPS & Géolocalisation**
- Coordonnées latitude/longitude
- Vitesse GPS et direction
- Nombre de satellites
- Correction timezone Beijing

### 🚗 **Données Moteur**
- Charge moteur (%)
- Température liquide refroidissement
- Régime moteur (RPM)
- Température admission air

### ⛽ **Carburant & Consommation**
- Consommation instantanée (L/100km)
- Consommation moyenne
- Pression carburant
- Calculs d'économie

### 🔋 **Système Véhicule**
- Tension batterie
- Signal GSM/4G
- Odométre kilométrage
- Position papillon des gaz
- Flags de statut système

## 🚀 **Déploiement Rapide**

### **Option 1: Coolify (Recommandé)**

```bash
# 1. Fork/Clone ce repository
git clone https://github.com/votre-username/obd-saas-server.git

# 2. Dans Coolify:
# - Nouvelle Application → Docker Compose
# - Repository: votre-repo
# - Variables d'environnement (voir COOLIFY_DEPLOY.md)
# - Ports: 3000 (HTTP) + 6909 (TCP)

# 3. Déployer !
```

### **Option 2: Docker Local**

```bash
# Clone et démarrage
git clone https://github.com/votre-username/obd-saas-server.git
cd obd-saas-server
docker-compose up -d

# Serveur disponible sur:
# HTTP/API: http://localhost:3000
# TCP OBD: localhost:6909
```

### **Option 3: Node.js Direct**

```bash
git clone https://github.com/votre-username/obd-saas-server.git
cd obd-saas-server
npm install
npm start
```

## 🔧 **Configuration**

### **Variables d'Environnement**

```env
# Serveur
NODE_ENV=production
PORT=3000
TCP_PORT=6909

# Sécurité
JWT_SECRET=votre-cle-super-secrete
CORS_ORIGIN=https://votre-domaine.com

# Base de données (optionnel)
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_KEY=votre-cle-service

# Logs & Performance
LOG_LEVEL=info
RATE_LIMIT_MAX=100
```

### **Configuration Boîtiers OBD**

```
IP Serveur : votre-ip-serveur
Port       : 6909
Protocole  : TCP
```

## 📈 **Endpoints API**

### **Authentification**
- `POST /api/auth/login` - Connexion utilisateur
- `POST /api/auth/register` - Inscription
- `POST /api/auth/refresh` - Refresh token

### **Appareils**
- `GET /api/devices` - Liste appareils
- `POST /api/devices` - Ajouter appareil
- `GET /api/devices/:id/data` - Données temps réel
- `PUT /api/devices/:id` - Modifier appareil

### **Dashboard**
- `GET /api/dashboard/stats` - Statistiques globales
- `GET /api/dashboard/alerts` - Alertes récentes
- `GET /api/dashboard/trips` - Historique trajets

### **Monitoring**
- `GET /health` - Health check
- `GET /` - Informations serveur

## 🔗 **WebSocket Events**

```javascript
// Connexion
const socket = io('wss://votre-serveur.com', {
  auth: { token: 'jwt-token' }
});

// Abonnement aux données
socket.emit('subscribe-device', 'device-id');

// Réception données
socket.on('obd-data', (data) => {
  console.log('Données OBD:', data);
});

// Alertes
socket.on('alert', (alert) => {
  console.log('Alerte:', alert.message);
});
```

## 📚 **Documentation**

- [🚀 Guide Déploiement Coolify](COOLIFY_DEPLOY.md)
- [📖 Guide d'Utilisation](GUIDE_UTILISATION.md)
- [🌐 Accès Internet](ACCES_INTERNET.md)
- [✅ Status Projet](DEPLOY_READY.md)

## 🧪 **Tests & Développement**

```bash
# Développement local
npm run dev

# Tests (à implémenter)
npm test

# Docker build
npm run docker:build

# Logs Docker
npm run docker:logs
```

## 📦 **Structure Projet**

```
nodejs-server/
├── 📄 package.json          # Dépendances et scripts
├── 🚀 index.js             # Point d'entrée principal
├── ❤️ healthcheck.js        # Health check Docker
├── 🐳 Dockerfile           # Image Docker optimisée
├── 🐳 docker-compose.yml   # Stack complète
├── src/
│   ├── 🛠️ utils/logger.js    # Logging professionnel
│   ├── 💾 database/         # Interfaces base de données
│   ├── 🔌 tcp/tcpServer.js  # Serveur TCP OBD
│   ├── 🔓 decoders/         # Décodeurs protocole
│   ├── 🌐 api/routes.js     # API REST
│   └── 🔐 middleware/auth.js # Authentification
└── 📚 Documentation/
```

## 🤝 **Contribution**

Les contributions sont les bienvenues ! 

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📝 **Licence**

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour les détails.

## 👨‍💻 **Auteur**

**Cheikhouna FALL**
- 🚗 Spécialiste OBD & IoT
- 🏗️ Architecte SaaS
- 📧 Contact: [votre-email@domain.com]

## 🌟 **Support**

Si ce projet vous aide, donnez-lui une ⭐ !

---

**🚀 Prêt pour la production • 🔒 Sécurisé • 📈 Scalable • 🐳 Docker Ready** 