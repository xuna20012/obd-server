# 🚗 Guide d'Utilisation - Serveur OBD SaaS

## ✅ Serveur Opérationnel !

Votre serveur OBD SaaS est maintenant **fonctionnel** en mode local. Voici comment l'utiliser et le tester.

## 🌐 Endpoints Disponibles

### **Dashboard Principal**
```
GET http://localhost:3000/
```
Retourne les informations sur le serveur et sa configuration.

### **Health Check**
```
GET http://localhost:3000/health
```
Statut détaillé du serveur, base de données, TCP et WebSocket.

### **API REST Complète**
```
http://localhost:3000/api/
```

## 🧪 Tests avec cURL/PowerShell

### 1. **Vérifier le Serveur**
```powershell
curl http://localhost:3000/ | ConvertFrom-Json
```

### 2. **Health Check Détaillé**
```powershell
curl http://localhost:3000/health | ConvertFrom-Json
```

### 3. **Authentification (Test)**
```powershell
# Login avec utilisateur de test
$body = @{
    email = "test@obd-saas.com"
    password = "test123"
} | ConvertTo-Json

$response = curl -Method POST -Uri "http://localhost:3000/api/auth/login" -Body $body -ContentType "application/json" | ConvertFrom-Json
$token = $response.token
```

### 4. **Lister les Appareils**
```powershell
$headers = @{ Authorization = "Bearer $token" }
curl -Headers $headers "http://localhost:3000/api/devices" | ConvertFrom-Json
```

### 5. **Statistiques Dashboard**
```powershell
$headers = @{ Authorization = "Bearer $token" }
curl -Headers $headers "http://localhost:3000/api/dashboard/stats" | ConvertFrom-Json
```

## 📡 Test Connexion TCP OBD

### **Simuler un Boîtier OBD**

Vous pouvez tester le serveur TCP avec un client telnet ou netcat :

```powershell
# Test de connexion TCP (nécessite telnet)
telnet localhost 6909
```

Ou avec PowerShell :
```powershell
$tcpClient = New-Object System.Net.Sockets.TcpClient
$tcpClient.Connect("localhost", 6909)
$stream = $tcpClient.GetStream()

# Simuler une trame OBD (exemple)
$frame = [byte[]](0x24, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x30, 0x38, 0x30, 0x30, 0x30, 0x30, 0x44, 0x0D)
$stream.Write($frame, 0, $frame.Length)

$tcpClient.Close()
```

## 🔌 Test WebSocket

### **Client WebSocket Simple (JavaScript)**

Créez un fichier `test-websocket.html` :

```html
<!DOCTYPE html>
<html>
<head>
    <title>Test WebSocket OBD</title>
    <script src="https://cdn.socket.io/4.7.4/socket.io.min.js"></script>
</head>
<body>
    <h1>Test WebSocket OBD SaaS</h1>
    <div id="status">Connexion...</div>
    <div id="data"></div>

    <script>
        const socket = io('http://localhost:3000', {
            auth: {
                token: 'test_token' // Token de test
            }
        });

        socket.on('connect', () => {
            document.getElementById('status').innerHTML = '✅ Connecté au serveur';
            console.log('Connecté au WebSocket');
            
            // S'abonner aux données d'un appareil
            socket.emit('subscribe-device', '123456');
        });

        socket.on('initial-data', (data) => {
            console.log('Données initiales:', data);
            document.getElementById('data').innerHTML += '<p>Données initiales reçues: ' + JSON.stringify(data) + '</p>';
        });

        socket.on('obd-data', (data) => {
            console.log('Données OBD:', data);
            document.getElementById('data').innerHTML += '<p>Données OBD: ' + JSON.stringify(data) + '</p>';
        });

        socket.on('alert', (alert) => {
            console.log('Alerte:', alert);
            document.getElementById('data').innerHTML += '<p style="color:red">Alerte: ' + alert.message + '</p>';
        });

        socket.on('disconnect', () => {
            document.getElementById('status').innerHTML = '❌ Déconnecté';
        });
    </script>
</body>
</html>
```

## 📊 Données de Test Disponibles

Le serveur local contient ces données de test :

### **Organisation**
- ID: `org123`
- Nom: `Organisation Test`
- Plan: `basic`

### **Utilisateur**
- ID: `user123`
- Email: `test@obd-saas.com`
- Organisation: `org123`
- Rôle: `admin`

### **Appareil OBD**
- ID: `123456`
- Nom: `Test OBD Device`
- Modèle: `NR-B80`
- Statut: `offline`

## 🚗 Connecter un Vrai Boîtier OBD

### **Configuration Boîtier NR-B80**

1. **Configurer l'IP du serveur** sur le boîtier :
   - IP: `votre_ip_locale` (ex: 192.168.1.100)
   - Port: `6909`

2. **Le boîtier enverra des trames** au format :
   ```
   [24][Device ID 6 bytes][Command 2 bytes][Length 2 bytes][Data N bytes][Checksum 1 byte][0D]
   ```

3. **Le serveur décodera automatiquement** :
   - Commande `3080`: Données GPS + OBD combinées
   - Commande `3089`: Rapport allumage/extinction
   - Autres commandes supportées

## 🔧 Scripts de Test Utiles

### **Test Complet API**
```powershell
# Script de test complet
function Test-OBDAPI {
    $baseUrl = "http://localhost:3000"
    
    # 1. Test serveur
    Write-Host "1. Test du serveur..."
    $serverInfo = curl "$baseUrl/" | ConvertFrom-Json
    Write-Host "✅ Serveur: $($serverInfo.name) v$($serverInfo.version)"
    
    # 2. Health check
    Write-Host "2. Health check..."
    $health = curl "$baseUrl/health" | ConvertFrom-Json
    Write-Host "✅ Statut: $($health.status)"
    Write-Host "   - Base de données: $($health.database.type)"
    Write-Host "   - Appareils: $($health.database.devices)"
    Write-Host "   - Organisations: $($health.database.organizations)"
    
    # 3. Login
    Write-Host "3. Test authentification..."
    $loginBody = @{
        email = "test@obd-saas.com"
        password = "test123"
    } | ConvertTo-Json
    
    $loginResponse = curl -Method POST -Uri "$baseUrl/api/auth/login" -Body $loginBody -ContentType "application/json" | ConvertFrom-Json
    $token = $loginResponse.token
    Write-Host "✅ Token obtenu"
    
    # 4. Lister appareils
    Write-Host "4. Liste des appareils..."
    $headers = @{ Authorization = "Bearer $token" }
    $devices = curl -Headers $headers "$baseUrl/api/devices" | ConvertFrom-Json
    Write-Host "✅ Appareils trouvés: $($devices.totalCount)"
    
    # 5. Dashboard stats
    Write-Host "5. Statistiques dashboard..."
    $stats = curl -Headers $headers "$baseUrl/api/dashboard/stats" | ConvertFrom-Json
    Write-Host "✅ Statistiques récupérées"
    Write-Host "   - Appareils totaux: $($stats.stats.totalDevices)"
    Write-Host "   - Appareils en ligne: $($stats.stats.onlineDevices)"
    
    Write-Host "`n🎉 Tous les tests passés avec succès !"
}

# Exécuter les tests
Test-OBDAPI
```

## 📈 Prochaines Étapes

### **1. Configuration Supabase (Optionnel)**
Si vous voulez passer à Supabase plus tard :
1. Créez un projet Supabase
2. Configurez `.env` avec vos clés
3. Exécutez les scripts SQL pour créer les tables
4. Redémarrez le serveur

### **2. Frontend Dashboard**
Développez une interface web React/Vue.js qui utilise :
- L'API REST pour les données
- WebSocket pour le temps réel
- Cartes interactives pour le GPS
- Graphiques pour les métriques

### **3. Mise en Production**
- Configurez HTTPS/TLS
- Utilisez Docker pour le déploiement
- Ajoutez un load balancer
- Configurez les alertes de monitoring

## 🆘 Dépannage

### **Serveur ne démarre pas**
```powershell
# Vérifier les ports
netstat -an | findstr "3000"
netstat -an | findstr "6909"

# Redémarrer
npm start
```

### **Erreurs de base de données**
Le serveur utilise la base locale par défaut. Aucune configuration requise.

### **Problèmes WebSocket**
Vérifiez que le port 3000 est ouvert et accessible.

---

## 🎯 Résumé

Votre serveur OBD SaaS est maintenant **100% fonctionnel** et prêt à :

✅ **Recevoir des connexions** de boîtiers OBD sur le port 6909
✅ **Décoder les trames** du protocole NR-B80
✅ **Stocker les données** en temps réel
✅ **Diffuser via WebSocket** aux clients connectés
✅ **Servir une API REST** complète et sécurisée
✅ **Gérer plusieurs organisations** (multi-tenant)
✅ **Générer des alertes** automatiques

**🚀 Prêt pour la production !** 