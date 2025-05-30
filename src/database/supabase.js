/**
 * 🗄️ Interface Base de Données - Supabase ou Local
 * 
 * Utilise Supabase si configuré, sinon bascule sur la base locale
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');
const { getLocalDatabase } = require('./localDatabase');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

let supabaseClient = null;
let useLocalDB = true;

// Initialiser Supabase si les clés sont présentes
if (supabaseUrl && supabaseKey && supabaseUrl !== 'https://your-project.supabase.co') {
    try {
        supabaseClient = createClient(supabaseUrl, supabaseKey);
        useLocalDB = false;
        logger.info('✅ Connexion Supabase configurée');
    } catch (error) {
        logger.warn('⚠️ Erreur configuration Supabase, utilisation base locale:', error.message);
        useLocalDB = true;
    }
} else {
    logger.info('📁 Utilisation de la base de données locale (Supabase non configuré)');
    useLocalDB = true;
}

const localDB = getLocalDatabase();

/**
 * Interface unifiée pour la base de données
 */
const database = {
    // ==================== ORGANIZATIONS ====================
    
    async createOrganization(data) {
        if (useLocalDB) {
            return await localDB.createOrganization(data);
        }
        
        const { data: organization, error } = await supabaseClient
            .from('organizations')
            .insert({
                name: data.name,
                subscription_plan: data.plan || 'basic'
            })
            .select()
            .single();

        if (error) {
            logger.error('Erreur création organisation:', error);
            throw error;
        }

        return organization;
    },

    async getOrganizationById(id) {
        if (useLocalDB) {
            return await localDB.getOrganizationById(id);
        }
        
        const { data, error } = await supabaseClient
            .from('organizations')
            .select('*')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') {
            logger.error('Erreur récupération organisation:', error);
            throw error;
        }

        return data;
    },

    // ==================== USERS ====================

    async getUsersByOrganization(organizationId) {
        if (useLocalDB) {
            return await localDB.getUsersByOrganization(organizationId);
        }
        
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('organization_id', organizationId);

        if (error) {
            logger.error('Erreur récupération utilisateurs:', error);
            throw error;
        }

        return data || [];
    },

    async createUser(userData) {
        if (useLocalDB) {
            return await localDB.createUser(userData);
        }
        
        const { data, error } = await supabaseClient
            .from('users')
            .insert(userData)
            .select()
            .single();

        if (error) {
            logger.error('Erreur création utilisateur:', error);
            throw error;
        }

        return data;
    },

    // ==================== DEVICES ====================

    async registerDevice(data) {
        if (useLocalDB) {
            return await localDB.registerDevice(data);
        }
        
        const { data: device, error } = await supabaseClient
            .from('obd_devices')
            .insert({
                device_id: data.deviceId,
                organization_id: data.organizationId,
                name: data.name,
                model: 'NR-B80',
                status: 'offline'
            })
            .select()
            .single();

        if (error) {
            logger.error('Erreur enregistrement appareil:', error);
            throw error;
        }

        return device;
    },

    async getDevicesByOrganization(organizationId) {
        if (useLocalDB) {
            return await localDB.getDevicesByOrganization(organizationId);
        }
        
        const { data, error } = await supabaseClient
            .from('obd_devices')
            .select('*')
            .eq('organization_id', organizationId);

        if (error) {
            logger.error('Erreur récupération appareils:', error);
            throw error;
        }

        return data || [];
    },

    async updateDeviceStatus(deviceId, status) {
        if (useLocalDB) {
            return await localDB.updateDeviceStatus(deviceId, status);
        }
        
        const { data, error } = await supabaseClient
            .from('obd_devices')
            .update({
                status,
                last_seen: new Date().toISOString()
            })
            .eq('device_id', deviceId)
            .select()
            .single();

        if (error) {
            logger.error('Erreur mise à jour statut appareil:', error);
            return null;
        }

        return data;
    },

    async getDeviceById(deviceId) {
        if (useLocalDB) {
            return await localDB.getDeviceById(deviceId);
        }
        
        const { data, error } = await supabaseClient
            .from('obd_devices')
            .select('*')
            .eq('device_id', deviceId)
            .single();

        if (error && error.code !== 'PGRST116') {
            logger.error('Erreur récupération appareil:', error);
            return null;
        }

        return data;
    },

    // ==================== REALTIME DATA ====================

    async storeRealtimeData(deviceId, data) {
        if (useLocalDB) {
            return await localDB.storeRealtimeData(deviceId, data);
        }
        
        const record = {
            device_id: deviceId,
            timestamp: new Date().toISOString(),
            latitude: data.gps?.latitude,
            longitude: data.gps?.longitude,
            speed_gps: data.gps?.speed,
            direction: data.gps?.direction,
            satellites: data.gps?.satellites,
            engine_load: data.engine?.load,
            engine_speed: data.engine?.speed,
            coolant_temp: data.engine?.coolantTemp,
            intake_temp: data.engine?.intakeTemp,
            fuel_consumption_instant: data.fuel?.instantConsumption,
            fuel_pressure: data.fuel?.pressure,
            speed_obd: data.vehicle?.speed,
            odometer: data.vehicle?.odometer,
            throttle_position: data.vehicle?.throttlePosition,
            voltage: data.system?.voltage,
            gsm_signal: data.system?.gsmSignal,
            status_flags: data.system?.statusFlags,
            raw_data: data.raw || ''
        };

        const { data: result, error } = await supabaseClient
            .from('obd_realtime_data')
            .insert(record)
            .select()
            .single();

        if (error) {
            logger.error('Erreur stockage données temps réel:', error);
            return null;
        }

        return result;
    },

    async getLatestDeviceData(deviceId, limit = 10) {
        if (useLocalDB) {
            return await localDB.getLatestDeviceData(deviceId, limit);
        }
        
        const { data, error } = await supabaseClient
            .from('obd_realtime_data')
            .select('*')
            .eq('device_id', deviceId)
            .order('timestamp', { ascending: false })
            .limit(limit);

        if (error) {
            logger.error('Erreur récupération données récentes:', error);
            return [];
        }

        return data || [];
    },

    async getDeviceDataInRange(deviceId, startDate, endDate) {
        if (useLocalDB) {
            return await localDB.getDeviceDataInRange(deviceId, startDate, endDate);
        }
        
        const { data, error } = await supabaseClient
            .from('obd_realtime_data')
            .select('*')
            .eq('device_id', deviceId)
            .gte('timestamp', startDate.toISOString())
            .lte('timestamp', endDate.toISOString())
            .order('timestamp', { ascending: true });

        if (error) {
            logger.error('Erreur récupération données par période:', error);
            return [];
        }

        return data || [];
    },

    // ==================== ALERTS ====================

    async storeAlert(deviceId, alertData) {
        if (useLocalDB) {
            return await localDB.storeAlert(deviceId, alertData);
        }
        
        const { data, error } = await supabaseClient
            .from('alerts')
            .insert({
                device_id: deviceId,
                alert_type: alertData.type,
                severity: alertData.severity,
                message: alertData.message,
                data: alertData.data || {}
            })
            .select()
            .single();

        if (error) {
            logger.error('Erreur stockage alerte:', error);
            return null;
        }

        return data;
    },

    async getAlertsByOrganization(organizationId, options = {}) {
        if (useLocalDB) {
            return await localDB.getAlertsByOrganization(organizationId, options);
        }
        
        let query = supabaseClient
            .from('alerts')
            .select(`
                *,
                obd_devices!inner(organization_id)
            `)
            .eq('obd_devices.organization_id', organizationId);

        if (options.unreadOnly) {
            query = query.eq('is_read', false);
        }

        query = query.order('created_at', { ascending: false });

        if (options.limit) {
            query = query.limit(options.limit);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('Erreur récupération alertes:', error);
            return [];
        }

        return data || [];
    },

    async markAlertAsRead(alertId) {
        if (useLocalDB) {
            return await localDB.markAlertAsRead(alertId);
        }
        
        const { data, error } = await supabaseClient
            .from('alerts')
            .update({ is_read: true })
            .eq('id', alertId)
            .select()
            .single();

        if (error) {
            logger.error('Erreur marquage alerte:', error);
            return null;
        }

        return data;
    },

    // ==================== STATISTICS ====================

    async getTotalTrips(organizationId) {
        if (useLocalDB) {
            return await localDB.getTotalTrips(organizationId);
        }
        
        const { count, error } = await supabaseClient
            .from('trip_reports')
            .select('*', { count: 'exact', head: true })
            .eq('device_id.organization_id', organizationId);

        if (error) {
            logger.error('Erreur comptage voyages:', error);
            return 0;
        }

        return count || 0;
    },

    async getTotalDistance(organizationId) {
        if (useLocalDB) {
            return await localDB.getTotalDistance(organizationId);
        }
        
        // Requête SQL complexe, simulé pour l'instant
        return Math.floor(Math.random() * 10000) + 5000;
    },

    async getTotalFuelConsumed(organizationId) {
        if (useLocalDB) {
            return await localDB.getTotalFuelConsumed(organizationId);
        }
        
        // Requête SQL complexe, simulé pour l'instant
        return Math.floor(Math.random() * 1000) + 500;
    },

    async getUnreadAlertsCount(organizationId) {
        if (useLocalDB) {
            return await localDB.getUnreadAlertsCount(organizationId);
        }
        
        const { count, error } = await supabaseClient
            .from('alerts')
            .select('*', { count: 'exact', head: true })
            .eq('obd_devices.organization_id', organizationId)
            .eq('is_read', false);

        if (error) {
            logger.error('Erreur comptage alertes non lues:', error);
            return 0;
        }

        return count || 0;
    },

    // ==================== UTILS ====================

    isLocal() {
        return useLocalDB;
    },

    getStats() {
        if (useLocalDB) {
            return localDB.getStats();
        }
        
        return {
            provider: 'supabase',
            connected: !!supabaseClient
        };
    }
};

// Export de l'interface unifiée
module.exports = {
    supabase: database,
    isLocal: () => useLocalDB
}; 