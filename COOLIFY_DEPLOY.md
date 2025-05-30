# 🚀 Guide de Déploiement Coolify - Serveur OBD SaaS

## 🎯 **AVANTAGES du Déploiement Coolify**

✅ **IP publique fixe** pour vos boîtiers OBD  
✅ **Haute disponibilité** 24/7  
✅ **Scaling automatique** selon la charge  
✅ **Logs centralisés** et monitoring  
✅ **Déploiement automatique** depuis Git  
✅ **HTTPS automatique** avec Let's Encrypt  

## 📋 **Prérequis**

- ✅ VPS avec Coolify installé
- ✅ Nom de domaine (ex: `obd.votredomaine.com`)
- ✅ Accès à l'interface Coolify
- ✅ Repository Git (GitHub/GitLab)

## 🌟 **Étape 1: Préparer le Repository**

### **1.1 Pousser le code vers Git**
```bash
cd OBD-Modern-Server/nodejs-server
git init
git add .
git commit -m "🚀 Serveur OBD SaaS v1.0 - Prêt pour Coolify"
git remote add origin https://github.com/votre-username/obd-saas-server.git
git push -u origin main
```

### **1.2 Structure finale du projet**
```
nodejs-server/
├── 📄 package.json
├── 🐳 Dockerfile
├── 🐳 docker-compose.yml
├── 🐳 .dockerignore
├── 🚀 index.js
├── ❤️ healthcheck.js
├── src/
│   ├── utils/logger.js
│   ├── database/
│   ├── tcp/tcpServer.js
│   ├── decoders/
│   ├── api/routes.js
│   └── middleware/auth.js
└── 📚 Documentation/
```

## ⚙️ **Étape 2: Configuration Coolify**

### **2.1 Créer une nouvelle application**
1. Connectez-vous à votre **interface Coolify**
2. Cliquez **"New Application"**
3. Choisissez **"Docker Compose"**
4. Connectez votre **repository Git**

### **2.2 Configuration de base**
```yaml
Application Name: obd-saas-server
Repository: https://github.com/votre-username/obd-saas-server.git
Branch: main
Build Path: /
Docker Compose File: docker-compose.yml
```

### **2.3 Variables d'environnement**

**Variables OBLIGATOIRES à configurer dans Coolify :**

```env
# 🌐 Serveur
NODE_ENV=production
PORT=3000
TCP_PORT=6909

# 🔐 Sécurité
JWT_SECRET=votre-cle-jwt-super-secrete-changez-la
CORS_ORIGIN=https://obd.votredomaine.com
SOCKET_CORS_ORIGIN=https://obd.votredomaine.com

# 📊 Supabase (optionnel - sinon base locale)
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_KEY=votre-cle-service-supabase

# 🛡️ Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# 📝 Logs
LOG_LEVEL=info
```

## 🌐 **Étape 3: Configuration Domaine & Ports**

### **3.1 Domaine principal**
- **Domaine** : `obd.votredomaine.com`
- **Port** : `3000` (Interface web/API)
- **HTTPS** : ✅ Activé automatiquement

### **3.2 Port TCP pour OBD (IMPORTANT)**
- **Port TCP** : `6909`
- **Exposition** : ✅ Publique
- **Type** : TCP Raw (pas HTTP)

### **3.3 Configuration DNS**
```dns
# Enregistrements DNS à ajouter
A     obd.votredomaine.com      → IP_VPS
A     tcp.votredomaine.com      → IP_VPS (optionnel)
```

## 🚀 **Étape 4: Déploiement**

### **4.1 Lancer le déploiement**
1. Cliquez **"Deploy"** dans Coolify
2. Surveillez les **logs de build**
3. Vérifiez le **health check**

### **4.2 Vérification post-déploiement**
```bash
# Test API REST
curl https://obd.votredomaine.com/health

# Test endpoint principal
curl https://obd.votredomaine.com/

# Test connectivité TCP OBD
telnet votre-ip-vps 6909
```

## 📱 **Étape 5: Configuration Boîtiers OBD**

### **5.1 Paramètres pour NR-B80**
```
IP Serveur : votre-ip-vps
Port       : 6909
Protocole  : TCP
```

### **5.2 Alternative avec domaine**
```
IP Serveur : tcp.votredomaine.com
Port       : 6909
Protocole  : TCP
```

## 📊 **Étape 6: Monitoring & Logs**

### **6.1 Health Check**
- **URL** : `https://obd.votredomaine.com/health`
- **Fréquence** : 30 secondes
- **Timeout** : 10 secondes

### **6.2 Logs en temps réel**
```bash
# Dans Coolify, onglet "Logs"
# Ou via CLI :
docker logs obd-saas-server -f
```

### **6.3 Métriques importantes**
- 🟢 **Connexions TCP actives**
- 🟢 **Requêtes API/minute**
- 🟢 **Erreurs/minute**
- 🟢 **Utilisation mémoire**

## 🔧 **Configuration Avancée**

### **7.1 Base de données Supabase**
Si vous utilisez Supabase :
```env
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **7.2 Scaling automatique**
```yaml
# Dans docker-compose.yml
deploy:
  replicas: 2
  resources:
    limits:
      memory: 1G
      cpus: '1.0'
```

### **7.3 Load Balancer**
Pour plusieurs instances :
- Utilisez le **load balancer Coolify**
- Configurez **sticky sessions** pour WebSocket

## 🚨 **Sécurité Production**

### **8.1 Checklist sécurité**
- ✅ **JWT_SECRET** fort et unique
- ✅ **HTTPS** activé partout
- ✅ **Rate limiting** configuré
- ✅ **CORS** restricitif en production
- ✅ **Logs** surveillés
- ✅ **Firewall** VPS configuré

### **8.2 Backup**
- **Base de données** : Backup Supabase automatique
- **Logs** : Rotation automatique
- **Code** : Repository Git

## 🎯 **URLs Finales**

Après déploiement réussi :

### **📊 Interface & API**
- **Dashboard** : `https://obd.votredomaine.com`
- **API REST** : `https://obd.votredomaine.com/api`
- **Health Check** : `https://obd.votredomaine.com/health`
- **WebSocket** : `wss://obd.votredomaine.com`

### **🔌 Connexion OBD**
- **IP** : `votre-ip-vps`
- **Port** : `6909`
- **Protocole** : TCP

## ✅ **Validation Finale**

### **Test complet**
```bash
# 1. API fonctionne
curl https://obd.votredomaine.com/health

# 2. TCP OBD accessible
nc -zv votre-ip-vps 6909

# 3. WebSocket disponible
# Utilisez le test HTML fourni précédemment
```

## 🎉 **FÉLICITATIONS !**

Votre **serveur OBD SaaS** est maintenant :
- ✅ **Déployé en production** sur Coolify
- ✅ **Accessible publiquement** avec IP fixe
- ✅ **Prêt pour vos boîtiers OBD** NR-B80
- ✅ **Scalable** et **monitoré**
- ✅ **Sécurisé** avec HTTPS

**🚗 Vos boîtiers OBD peuvent maintenant se connecter à `votre-ip-vps:6909` !** 