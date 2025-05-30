# 🚀 Déploiement GitHub → Coolify

## 📋 **Statut Actuel**

✅ **Git Repository** configuré localement  
✅ **Commits** créés avec le code complet  
✅ **Configuration** Git utilisateur définie  
✅ **Fichiers** optimisés pour GitHub  

## 🌐 **Étape 1: Créer le Repository GitHub**

### **1.1 Via l'interface GitHub**
1. Allez sur [github.com](https://github.com)
2. Cliquez **"New repository"**
3. **Nom** : `obd-saas-server`
4. **Description** : `🚗 Serveur SaaS professionnel pour boîtiers OBD NR-B80 - Architecture multi-tenant avec TCP server, API REST, WebSocket`
5. **Visibilité** : Public ou Private selon votre choix
6. ❌ **N'ajoutez PAS** de README, .gitignore, ou licence (déjà créés)
7. Cliquez **"Create repository"**

### **1.2 URLs du repository**
```
HTTPS: https://github.com/votre-username/obd-saas-server.git
SSH:   git@github.com:votre-username/obd-saas-server.git
```

## 📤 **Étape 2: Pousser vers GitHub**

### **2.1 Ajouter le remote GitHub**
```bash
# Remplacez 'votre-username' par votre nom d'utilisateur GitHub
git remote add origin https://github.com/votre-username/obd-saas-server.git
```

### **2.2 Pousser le code**
```bash
# Première poussée
git push -u origin master

# Ou si GitHub utilise 'main' par défaut:
git branch -M main
git push -u origin main
```

### **2.3 Vérification**
- Allez sur votre repository GitHub
- Vérifiez que tous les fichiers sont présents
- Le README.md devrait s'afficher automatiquement

## 🛠️ **Étape 3: Préparer pour Coolify**

### **3.1 Vérifier la configuration**
Votre repository GitHub contient maintenant :

```
✅ package.json          # Dépendances Node.js
✅ Dockerfile           # Image Docker optimisée  
✅ docker-compose.yml   # Configuration Coolify
✅ .dockerignore        # Optimisation build
✅ .gitignore          # Fichiers Git exclus
✅ index.js            # Point d'entrée
✅ healthcheck.js      # Health check Docker
✅ src/                # Code source complet
✅ Documentation/      # Guides déploiement
```

### **3.2 URLs importantes**
```
🌐 Repository: https://github.com/votre-username/obd-saas-server
📚 README: https://github.com/votre-username/obd-saas-server#readme
🚀 Coolify Guide: COOLIFY_DEPLOY.md
```

## ☁️ **Étape 4: Déployer sur Coolify**

### **4.1 Connexion Coolify**
1. Connectez-vous à votre **interface Coolify**
2. Cliquez **"New Application"**

### **4.2 Configuration Source**
```yaml
Type: Docker Compose
Source: GitHub
Repository: https://github.com/votre-username/obd-saas-server.git
Branch: main (ou master)
Build Path: /
Docker Compose File: docker-compose.yml
```

### **4.3 Variables d'environnement**

**📝 Variables ESSENTIELLES à configurer :**

```env
# 🌐 Serveur
NODE_ENV=production
PORT=3000
TCP_PORT=6909

# 🔐 Sécurité (IMPORTANT: Changez ces valeurs!)
JWT_SECRET=votre-cle-jwt-super-secrete-unique-ici
CORS_ORIGIN=https://obd.votredomaine.com
SOCKET_CORS_ORIGIN=https://obd.votredomaine.com

# 📊 Supabase (optionnel - sinon base locale)
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_KEY=votre-cle-service-supabase

# 🛡️ Performance
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
LOG_LEVEL=info
```

### **4.4 Configuration Réseau**

**🌐 Domaines & Ports :**
- **Domaine principal** : `obd.votredomaine.com` → Port `3000`
- **Port TCP OBD** : `6909` (exposition publique requise)

**📡 Enregistrements DNS :**
```dns
A    obd.votredomaine.com    →    IP_VPS_COOLIFY
```

### **4.5 Déploiement**
1. Cliquez **"Deploy"**
2. Surveillez les **logs de build**
3. Attendez le **health check** ✅

## ✅ **Étape 5: Vérification**

### **5.1 Tests post-déploiement**
```bash
# Test API
curl https://obd.votredomaine.com/health

# Test endpoint principal  
curl https://obd.votredomaine.com/

# Test connectivité TCP OBD
telnet votre-ip-vps 6909
```

### **5.2 URLs finales**
```
🌐 Interface Web: https://obd.votredomaine.com
📊 API REST:     https://obd.votredomaine.com/api
❤️ Health Check: https://obd.votredomaine.com/health
🔌 TCP OBD:      votre-ip-vps:6909
📡 WebSocket:    wss://obd.votredomaine.com
```

## 📱 **Étape 6: Configuration Boîtiers OBD**

### **6.1 Paramètres NR-B80**
```
IP Serveur : votre-ip-vps
Port       : 6909
Protocole  : TCP
```

### **6.2 Test de connexion**
1. Configurez un boîtier de test
2. Surveillez les logs Coolify
3. Vérifiez les données dans l'interface

## 🔄 **Mises à Jour Futures**

### **Workflow automatique :**
```bash
# 1. Modifications locales
git add .
git commit -m "🔧 Amélioration fonctionnalité X"
git push origin main

# 2. Coolify redéploie automatiquement !
```

## 🎯 **Commandes de Déploiement Rapide**

### **Script complet :**
```bash
# Depuis votre dossier nodejs-server
git remote add origin https://github.com/VOTRE-USERNAME/obd-saas-server.git
git branch -M main  
git push -u origin main

echo "🎉 Code poussé vers GitHub!"
echo "📋 Prochaine étape: Configurer dans Coolify"
echo "🌐 Repository: https://github.com/VOTRE-USERNAME/obd-saas-server"
```

## 📚 **Ressources**

- [📖 Guide Coolify Détaillé](COOLIFY_DEPLOY.md)
- [🔧 Guide d'Utilisation](GUIDE_UTILISATION.md)  
- [🌐 Configuration Internet](ACCES_INTERNET.md)
- [✅ Status Projet](DEPLOY_READY.md)

---

## 🎊 **FÉLICITATIONS !**

Une fois ces étapes terminées, vous aurez :

✅ **Code sur GitHub** accessible publiquement  
✅ **Déploiement Coolify** automatique  
✅ **Serveur en production** avec IP publique  
✅ **Boîtiers OBD** connectables immédiatement  

**🚀 Votre serveur OBD SaaS sera opérationnel !** 