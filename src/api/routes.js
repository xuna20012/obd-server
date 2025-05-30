/**
 * 🌐 API Routes pour OBD SaaS
 * 
 * Routes REST complètes pour la gestion multi-tenant du SaaS OBD
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const { supabase } = require('../database/supabase');
const logger = require('../utils/logger');
const tcpServer = require('../tcp/tcpServer');

// ==================== AUTHENTIFICATION ====================

/**
 * POST /auth/login - Connexion utilisateur
 */
router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        // TODO: Implémenter authentification avec Supabase Auth
        // Pour l'instant, retour de données mockées
        const mockUser = {
            id: 'user123',
            email,
            organizationId: 'org123',
            role: 'admin'
        };

        const token = 'mock_jwt_token'; // TODO: Générer vrai JWT

        logger.auth('LOGIN', mockUser.id, 'success');

        res.json({
            success: true,
            user: mockUser,
            token,
            expiresIn: '7d'
        });

    } catch (error) {
        logger.error('Erreur connexion:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /auth/register - Inscription utilisateur
 */
router.post('/auth/register', async (req, res) => {
    try {
        const { email, password, organizationName } = req.body;
        
        if (!email || !password || !organizationName) {
            return res.status(400).json({ 
                error: 'Email, mot de passe et nom organisation requis' 
            });
        }

        // Créer l'organisation
        const organization = await supabase.createOrganization({
            name: organizationName,
            plan: 'basic'
        });

        // TODO: Créer l'utilisateur avec Supabase Auth
        const mockUser = {
            id: 'user123',
            email,
            organizationId: organization.id,
            role: 'admin'
        };

        const token = 'mock_jwt_token';

        logger.auth('REGISTER', mockUser.id, 'success');

        res.status(201).json({
            success: true,
            user: mockUser,
            organization,
            token
        });

    } catch (error) {
        logger.error('Erreur inscription:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== DEVICES ====================

/**
 * GET /devices - Liste des appareils OBD
 */
router.get('/devices', authenticateToken, async (req, res) => {
    try {
        const { organizationId } = req.user;
        const devices = await supabase.getDevicesByOrganization(organizationId);
        
        // Ajouter le statut de connexion TCP
        const tcpStats = tcpServer.getStats();
        const enrichedDevices = devices.map(device => ({
            ...device,
            isConnected: tcpStats.connections.some(conn => conn.deviceId === device.device_id),
            lastActivity: tcpStats.connections.find(conn => conn.deviceId === device.device_id)?.lastActivity
        }));

        res.json({
            success: true,
            devices: enrichedDevices,
            totalCount: devices.length
        });

    } catch (error) {
        logger.error('Erreur récupération appareils:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /devices - Enregistrer un nouvel appareil OBD
 */
router.post('/devices', authenticateToken, async (req, res) => {
    try {
        const { deviceId, name } = req.body;
        const { organizationId } = req.user;

        if (!deviceId) {
            return res.status(400).json({ error: 'ID appareil requis' });
        }

        const device = await supabase.registerDevice({
            deviceId,
            name: name || `OBD-${deviceId}`,
            organizationId
        });

        logger.info('Appareil enregistré:', { deviceId, organizationId });

        res.status(201).json({
            success: true,
            device
        });

    } catch (error) {
        logger.error('Erreur enregistrement appareil:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /devices/:deviceId - Détails d'un appareil
 */
router.get('/devices/:deviceId', authenticateToken, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { organizationId } = req.user;

        // Vérifier que l'appareil appartient à l'organisation
        const devices = await supabase.getDevicesByOrganization(organizationId);
        const device = devices.find(d => d.device_id === deviceId);

        if (!device) {
            return res.status(404).json({ error: 'Appareil non trouvé' });
        }

        // Ajouter les données temps réel
        const realtimeData = await supabase.getLatestDeviceData(deviceId, 1);
        const tcpStats = tcpServer.getStats();
        const connection = tcpStats.connections.find(conn => conn.deviceId === deviceId);

        res.json({
            success: true,
            device: {
                ...device,
                isConnected: !!connection,
                lastActivity: connection?.lastActivity,
                latestData: realtimeData[0] || null
            }
        });

    } catch (error) {
        logger.error('Erreur récupération appareil:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== DONNÉES TEMPS RÉEL ====================

/**
 * GET /data/realtime/:deviceId - Données temps réel d'un appareil
 */
router.get('/data/realtime/:deviceId', authenticateToken, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { limit = 10 } = req.query;
        const { organizationId } = req.user;

        // Vérifier que l'appareil appartient à l'organisation
        const devices = await supabase.getDevicesByOrganization(organizationId);
        const device = devices.find(d => d.device_id === deviceId);

        if (!device) {
            return res.status(404).json({ error: 'Appareil non trouvé' });
        }

        const data = await supabase.getLatestDeviceData(deviceId, parseInt(limit));

        res.json({
            success: true,
            deviceId,
            data,
            count: data.length
        });

    } catch (error) {
        logger.error('Erreur récupération données temps réel:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /data/trips/:deviceId - Historique des voyages
 */
router.get('/data/trips/:deviceId', authenticateToken, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { organizationId } = req.user;

        // Vérifier que l'appareil appartient à l'organisation
        const devices = await supabase.getDevicesByOrganization(organizationId);
        const device = devices.find(d => d.device_id === deviceId);

        if (!device) {
            return res.status(404).json({ error: 'Appareil non trouvé' });
        }

        // TODO: Implémenter récupération des voyages
        const trips = []; // await supabase.getTripsByDevice(deviceId);

        res.json({
            success: true,
            deviceId,
            trips,
            count: trips.length
        });

    } catch (error) {
        logger.error('Erreur récupération voyages:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== ALERTES ====================

/**
 * GET /alerts - Liste des alertes
 */
router.get('/alerts', authenticateToken, async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { unreadOnly = false, limit = 50 } = req.query;

        // TODO: Implémenter récupération des alertes avec filtrage par organisation
        const alerts = []; // await supabase.getAlertsByOrganization(organizationId, { unreadOnly, limit });

        res.json({
            success: true,
            alerts,
            count: alerts.length
        });

    } catch (error) {
        logger.error('Erreur récupération alertes:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * PATCH /alerts/:alertId/read - Marquer une alerte comme lue
 */
router.patch('/alerts/:alertId/read', authenticateToken, async (req, res) => {
    try {
        const { alertId } = req.params;

        // TODO: Implémenter marquage alerte comme lue
        // await supabase.markAlertAsRead(alertId);

        res.json({
            success: true,
            message: 'Alerte marquée comme lue'
        });

    } catch (error) {
        logger.error('Erreur marquage alerte:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== DASHBOARD ====================

/**
 * GET /dashboard/stats - Statistiques du tableau de bord
 */
router.get('/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const { organizationId } = req.user;

        // Récupérer les appareils
        const devices = await supabase.getDevicesByOrganization(organizationId);
        
        // Statuts des connexions
        const tcpStats = tcpServer.getStats();
        const onlineDevices = devices.filter(device => 
            tcpStats.connections.some(conn => conn.deviceId === device.device_id)
        );

        // TODO: Calculer d'autres métriques
        const stats = {
            totalDevices: devices.length,
            onlineDevices: onlineDevices.length,
            offlineDevices: devices.length - onlineDevices.length,
            totalTrips: 0, // await supabase.getTotalTrips(organizationId),
            totalDistance: 0, // await supabase.getTotalDistance(organizationId),
            totalFuelConsumed: 0, // await supabase.getTotalFuelConsumed(organizationId),
            unreadAlerts: 0, // await supabase.getUnreadAlertsCount(organizationId),
            activeConnections: tcpStats.activeConnections
        };

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        logger.error('Erreur récupération statistiques:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== ADMINISTRATION ====================

/**
 * GET /admin/tcp-status - Statut du serveur TCP (admin seulement)
 */
router.get('/admin/tcp-status', authenticateToken, authorize(['admin']), (req, res) => {
    try {
        const stats = tcpServer.getStats();
        
        res.json({
            success: true,
            tcpServer: stats,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Erreur récupération statut TCP:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /admin/logs - Logs récents (admin seulement)
 */
router.get('/admin/logs', authenticateToken, authorize(['admin']), async (req, res) => {
    try {
        const { limit = 100, level = 'info' } = req.query;
        
        // TODO: Implémenter récupération des logs depuis les fichiers
        const logs = [
            {
                timestamp: new Date().toISOString(),
                level: 'info',
                message: 'Exemple de log',
                category: 'SYSTEM'
            }
        ];

        res.json({
            success: true,
            logs,
            count: logs.length
        });

    } catch (error) {
        logger.error('Erreur récupération logs:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== GESTION D'ERREURS ====================

// Middleware de gestion d'erreurs pour les routes API
router.use((error, req, res, next) => {
    logger.error('Erreur API:', error);
    
    if (error.type === 'validation') {
        return res.status(400).json({ error: error.message });
    }
    
    if (error.type === 'authentication') {
        return res.status(401).json({ error: 'Non autorisé' });
    }
    
    if (error.type === 'authorization') {
        return res.status(403).json({ error: 'Accès refusé' });
    }
    
    res.status(500).json({ error: 'Erreur serveur interne' });
});

module.exports = router; 