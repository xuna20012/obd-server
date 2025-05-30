/**
 * 🗄️ Base de Données Locale (Mock)
 * 
 * Implémentation en mémoire pour tests sans Supabase
 */

const logger = require('../utils/logger');

class LocalDatabase {
    constructor() {
        this.organizations = new Map();
        this.devices = new Map();
        this.realtimeData = new Map();
        this.alerts = new Map();
        this.users = new Map();
        
        // Initialiser avec des données de test
        this.initTestData();
    }

    initTestData() {
        // Organisation de test
        const testOrg = {
            id: 'org123',
            name: 'Organisation Test',
            subscription_plan: 'basic',
            created_at: new Date().toISOString(),
            is_active: true
        };
        this.organizations.set(testOrg.id, testOrg);

        // Utilisateur de test
        const testUser = {
            id: 'user123',
            email: 'test@obd-saas.com',
            organization_id: testOrg.id,
            role: 'admin',
            created_at: new Date().toISOString()
        };
        this.users.set(testUser.id, testUser);

        // Appareil de test
        const testDevice = {
            id: 'device001',
            device_id: '123456',
            organization_id: testOrg.id,
            name: 'Test OBD Device',
            model: 'NR-B80',
            status: 'offline',
            created_at: new Date().toISOString(),
            last_seen: null
        };
        this.devices.set(testDevice.device_id, testDevice);

        logger.info('Base de données locale initialisée avec données de test');
    }

    // ==================== ORGANIZATIONS ====================

    async createOrganization(data) {
        const id = `org_${Date.now()}`;
        const organization = {
            id,
            name: data.name,
            subscription_plan: data.plan || 'basic',
            created_at: new Date().toISOString(),
            is_active: true
        };
        
        this.organizations.set(id, organization);
        logger.info(`Organisation créée: ${organization.name}`);
        
        return organization;
    }

    async getOrganizationById(id) {
        return this.organizations.get(id) || null;
    }

    // ==================== USERS ====================

    async getUsersByOrganization(organizationId) {
        const users = Array.from(this.users.values())
            .filter(user => user.organization_id === organizationId);
        return users;
    }

    async createUser(userData) {
        const id = `user_${Date.now()}`;
        const user = {
            id,
            email: userData.email,
            organization_id: userData.organizationId,
            role: userData.role || 'user',
            created_at: new Date().toISOString()
        };
        
        this.users.set(id, user);
        return user;
    }

    // ==================== DEVICES ====================

    async registerDevice(data) {
        const device = {
            id: `device_${Date.now()}`,
            device_id: data.deviceId,
            organization_id: data.organizationId,
            name: data.name,
            model: 'NR-B80',
            status: 'offline',
            metadata: {},
            created_at: new Date().toISOString(),
            last_seen: null
        };
        
        this.devices.set(data.deviceId, device);
        logger.info(`Appareil enregistré: ${data.deviceId}`);
        
        return device;
    }

    async getDevicesByOrganization(organizationId) {
        const devices = Array.from(this.devices.values())
            .filter(device => device.organization_id === organizationId);
        return devices;
    }

    async updateDeviceStatus(deviceId, status) {
        const device = this.devices.get(deviceId);
        if (device) {
            device.status = status;
            device.last_seen = new Date().toISOString();
            this.devices.set(deviceId, device);
        }
        return device;
    }

    async getDeviceById(deviceId) {
        return this.devices.get(deviceId) || null;
    }

    // ==================== REALTIME DATA ====================

    async storeRealtimeData(deviceId, data) {
        const id = `data_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const record = {
            id,
            device_id: deviceId,
            timestamp: new Date().toISOString(),
            ...data
        };
        
        if (!this.realtimeData.has(deviceId)) {
            this.realtimeData.set(deviceId, []);
        }
        
        const deviceData = this.realtimeData.get(deviceId);
        deviceData.push(record);
        
        // Garder seulement les 100 derniers points par appareil
        if (deviceData.length > 100) {
            deviceData.splice(0, deviceData.length - 100);
        }
        
        this.realtimeData.set(deviceId, deviceData);
        return record;
    }

    async getLatestDeviceData(deviceId, limit = 10) {
        const deviceData = this.realtimeData.get(deviceId) || [];
        return deviceData
            .slice(-limit)
            .reverse();
    }

    async getDeviceDataInRange(deviceId, startDate, endDate) {
        const deviceData = this.realtimeData.get(deviceId) || [];
        return deviceData.filter(record => {
            const recordDate = new Date(record.timestamp);
            return recordDate >= startDate && recordDate <= endDate;
        });
    }

    // ==================== ALERTS ====================

    async storeAlert(deviceId, alertData) {
        const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const alert = {
            id,
            device_id: deviceId,
            alert_type: alertData.type,
            severity: alertData.severity,
            message: alertData.message,
            data: alertData.data || {},
            is_read: false,
            created_at: new Date().toISOString()
        };
        
        if (!this.alerts.has(deviceId)) {
            this.alerts.set(deviceId, []);
        }
        
        const deviceAlerts = this.alerts.get(deviceId);
        deviceAlerts.push(alert);
        this.alerts.set(deviceId, deviceAlerts);
        
        logger.warn(`Alerte créée: ${alert.alert_type} pour ${deviceId}`);
        return alert;
    }

    async getAlertsByOrganization(organizationId, options = {}) {
        const devices = await this.getDevicesByOrganization(organizationId);
        const deviceIds = devices.map(d => d.device_id);
        
        let allAlerts = [];
        for (const deviceId of deviceIds) {
            const deviceAlerts = this.alerts.get(deviceId) || [];
            allAlerts = allAlerts.concat(deviceAlerts);
        }
        
        // Filtrer par statut lu/non lu
        if (options.unreadOnly) {
            allAlerts = allAlerts.filter(alert => !alert.is_read);
        }
        
        // Trier par date (plus récent en premier)
        allAlerts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        // Limiter les résultats
        if (options.limit) {
            allAlerts = allAlerts.slice(0, options.limit);
        }
        
        return allAlerts;
    }

    async markAlertAsRead(alertId) {
        for (const deviceAlerts of this.alerts.values()) {
            const alert = deviceAlerts.find(a => a.id === alertId);
            if (alert) {
                alert.is_read = true;
                return alert;
            }
        }
        return null;
    }

    // ==================== STATISTICS ====================

    async getTotalTrips(organizationId) {
        // Mock: retourner un nombre aléatoire pour les tests
        return Math.floor(Math.random() * 100) + 50;
    }

    async getTotalDistance(organizationId) {
        // Mock: distance totale en km
        return Math.floor(Math.random() * 10000) + 5000;
    }

    async getTotalFuelConsumed(organizationId) {
        // Mock: carburant total en litres
        return Math.floor(Math.random() * 1000) + 500;
    }

    async getUnreadAlertsCount(organizationId) {
        const alerts = await this.getAlertsByOrganization(organizationId, { unreadOnly: true });
        return alerts.length;
    }

    // ==================== MAINTENANCE ====================

    async cleanup() {
        // Nettoyer les anciennes données (simulé)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 jours
        
        let cleanedCount = 0;
        for (const [deviceId, data] of this.realtimeData.entries()) {
            const cleanedData = data.filter(record => 
                new Date(record.timestamp) > cutoffDate
            );
            this.realtimeData.set(deviceId, cleanedData);
            cleanedCount += (data.length - cleanedData.length);
        }
        
        logger.info(`Nettoyage terminé: ${cleanedCount} enregistrements supprimés`);
        return cleanedCount;
    }

    // ==================== UTILS ====================

    getStats() {
        return {
            organizations: this.organizations.size,
            devices: this.devices.size,
            users: this.users.size,
            totalDataPoints: Array.from(this.realtimeData.values())
                .reduce((total, deviceData) => total + deviceData.length, 0),
            totalAlerts: Array.from(this.alerts.values())
                .reduce((total, deviceAlerts) => total + deviceAlerts.length, 0)
        };
    }
}

// Singleton pour maintenir les données en mémoire
let localDbInstance = null;

function getLocalDatabase() {
    if (!localDbInstance) {
        localDbInstance = new LocalDatabase();
    }
    return localDbInstance;
}

module.exports = {
    LocalDatabase,
    getLocalDatabase
}; 