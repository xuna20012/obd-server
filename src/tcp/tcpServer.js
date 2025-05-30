/**
 * 🔌 TCP Server pour OBD NR-B80
 * 
 * Serveur TCP pour recevoir les données des boîtiers OBD
 * Gestion multi-connexions avec pool de threads
 */

const net = require('net');
const { EventEmitter } = require('events');
const logger = require('../utils/logger');
const FrameDecoder = require('../decoders/frameDecoder');
const OBDDecoder = require('../decoders/obdDecoder');
const { supabase } = require('../database/supabase');

class TCPServer extends EventEmitter {
    constructor() {
        super();
        this.server = null;
        this.activeConnections = new Map();
        this.frameDecoder = new FrameDecoder();
        this.obdDecoder = new OBDDecoder();
        this.isRunning = false;
        this.connectionCount = 0;
    }

    start(port, mainServer) {
        return new Promise((resolve, reject) => {
            try {
                this.mainServer = mainServer;
                this.server = net.createServer();
                
                this.server.on('connection', (socket) => {
                    this.handleConnection(socket);
                });

                this.server.on('error', (error) => {
                    logger.error('Erreur serveur TCP:', error);
                    reject(error);
                });

                this.server.listen(port, () => {
                    this.isRunning = true;
                    logger.info(`🚗 Serveur TCP OBD démarré sur le port ${port}`);
                    resolve();
                });

            } catch (error) {
                logger.error('Erreur démarrage serveur TCP:', error);
                reject(error);
            }
        });
    }

    handleConnection(socket) {
        const connectionId = `${socket.remoteAddress}:${socket.remotePort}`;
        this.connectionCount++;
        
        logger.tcpConnection('CONNECTED', 'unknown', {
            remoteAddress: socket.remoteAddress,
            remotePort: socket.remotePort,
            connectionId,
            totalConnections: this.connectionCount
        });

        // Configuration du socket
        socket.setTimeout(parseInt(process.env.OBD_TIMEOUT) || 30000);
        socket.setKeepAlive(true, 60000);

        // État de la connexion
        const connectionState = {
            id: connectionId,
            deviceId: null,
            organizationId: null,
            authenticated: false,
            lastActivity: Date.now(),
            dataBuffer: Buffer.alloc(0),
            heartbeatInterval: null
        };

        this.activeConnections.set(connectionId, connectionState);

        // Démarrer le heartbeat
        this.startHeartbeat(connectionState, socket);

        // Gestionnaires d'événements
        socket.on('data', (data) => {
            this.handleData(socket, connectionState, data);
        });

        socket.on('timeout', () => {
            logger.tcpConnection('TIMEOUT', connectionState.deviceId, { connectionId });
            this.closeConnection(socket, connectionState, 'timeout');
        });

        socket.on('error', (error) => {
            logger.error(`Erreur socket ${connectionId}:`, error);
            this.closeConnection(socket, connectionState, 'error');
        });

        socket.on('close', () => {
            logger.tcpConnection('DISCONNECTED', connectionState.deviceId, { connectionId });
            this.closeConnection(socket, connectionState, 'close');
        });
    }

    async handleData(socket, connectionState, data) {
        try {
            connectionState.lastActivity = Date.now();
            
            // Ajouter les données au buffer
            connectionState.dataBuffer = Buffer.concat([connectionState.dataBuffer, data]);
            
            // Traiter les trames complètes
            let processedBytes = 0;
            
            while (connectionState.dataBuffer.length > processedBytes) {
                const remainingBuffer = connectionState.dataBuffer.subarray(processedBytes);
                
                // Rechercher une trame complète
                const frameResult = this.frameDecoder.extractFrame(remainingBuffer);
                
                if (!frameResult.success) {
                    // Pas assez de données pour une trame complète
                    break;
                }
                
                const { frame, bytesConsumed } = frameResult;
                processedBytes += bytesConsumed;
                
                // Traiter la trame
                await this.processFrame(socket, connectionState, frame);
            }
            
            // Nettoyer le buffer
            if (processedBytes > 0) {
                connectionState.dataBuffer = connectionState.dataBuffer.subarray(processedBytes);
            }
            
            // Limiter la taille du buffer pour éviter les fuites mémoire
            if (connectionState.dataBuffer.length > 8192) {
                logger.warn(`Buffer trop grand pour ${connectionState.id}, réinitialisation`);
                connectionState.dataBuffer = Buffer.alloc(0);
            }
            
        } catch (error) {
            logger.error(`Erreur traitement données ${connectionState.id}:`, error);
        }
    }

    async processFrame(socket, connectionState, frame) {
        try {
            // Décoder la trame
            const decodedFrame = this.frameDecoder.decode(frame);
            
            if (!decodedFrame) {
                logger.warn(`Trame invalide de ${connectionState.id}`);
                return;
            }

            // Extraire l'ID du device si pas encore fait
            if (!connectionState.deviceId && decodedFrame.deviceId) {
                connectionState.deviceId = decodedFrame.deviceId;
                logger.tcpConnection('IDENTIFIED', connectionState.deviceId, {
                    connectionId: connectionState.id
                });
                
                // Mettre à jour le statut du device en base
                await this.updateDeviceStatus(connectionState.deviceId, 'online', {
                    connectionId: connectionState.id,
                    lastConnection: new Date().toISOString()
                });
            }

            // Logger les données reçues
            logger.obdData(connectionState.deviceId, decodedFrame.command, frame);

            // Décoder selon le type de commande
            const obdData = await this.obdDecoder.decode(decodedFrame);
            
            if (obdData) {
                // Sauvegarder en base de données
                await this.saveOBDData(connectionState.deviceId, obdData);
                
                // Diffuser via WebSocket si un serveur principal est défini
                if (this.mainServer && connectionState.organizationId) {
                    this.mainServer.broadcastOBDData(
                        connectionState.deviceId, 
                        obdData, 
                        connectionState.organizationId
                    );
                }
                
                // Vérifier les alertes
                await this.checkAlerts(connectionState.deviceId, obdData);
            }

            // Envoyer l'accusé de réception si nécessaire
            if (this.needsAcknowledgment(decodedFrame.command)) {
                this.sendAcknowledgment(socket, decodedFrame);
            }

        } catch (error) {
            logger.error(`Erreur traitement trame ${connectionState.id}:`, error);
        }
    }

    async updateDeviceStatus(deviceId, status, metadata = {}) {
        try {
            await supabase.updateDeviceStatus(deviceId, status, metadata);
        } catch (error) {
            logger.error(`Erreur mise à jour statut device ${deviceId}:`, error);
        }
    }

    async saveOBDData(deviceId, obdData) {
        try {
            await supabase.saveOBDData(deviceId, obdData);
        } catch (error) {
            logger.error(`Erreur sauvegarde données OBD ${deviceId}:`, error);
        }
    }

    async checkAlerts(deviceId, obdData) {
        try {
            const alerts = [];
            
            // Vérification température moteur
            if (obdData.engine?.coolantTemp > 105) {
                alerts.push({
                    type: 'engine_overheat',
                    severity: 'high',
                    message: `Température moteur élevée: ${obdData.engine.coolantTemp}°C`,
                    data: { temperature: obdData.engine.coolantTemp }
                });
            }
            
            // Vérification survitesse
            if (obdData.vehicle?.speed > 130) {
                alerts.push({
                    type: 'speeding',
                    severity: 'medium',
                    message: `Survitesse détectée: ${obdData.vehicle.speed} km/h`,
                    data: { speed: obdData.vehicle.speed }
                });
            }
            
            // Vérification batterie faible
            if (obdData.system?.voltage < 11.5) {
                alerts.push({
                    type: 'low_battery',
                    severity: 'medium',
                    message: `Tension batterie faible: ${obdData.system.voltage}V`,
                    data: { voltage: obdData.system.voltage }
                });
            }
            
            // Sauvegarder et diffuser les alertes
            for (const alert of alerts) {
                await supabase.saveAlert(deviceId, alert);
                
                if (this.mainServer) {
                    this.mainServer.broadcastAlert(alert, null); // TODO: récupérer orgId
                }
                
                logger.alert(alert.type, deviceId, alert.message, alert.severity);
            }
            
        } catch (error) {
            logger.error(`Erreur vérification alertes ${deviceId}:`, error);
        }
    }

    needsAcknowledgment(command) {
        // Commandes nécessitant un accusé de réception
        const ackCommands = ['3080', '3089', '308a', '308b'];
        return ackCommands.includes(command);
    }

    sendAcknowledgment(socket, decodedFrame) {
        try {
            // Créer un accusé de réception simple
            const ackFrame = Buffer.from([0x24, 0x24, 0x00, 0x01, 0x00, 0x0D]);
            socket.write(ackFrame);
        } catch (error) {
            logger.error('Erreur envoi accusé réception:', error);
        }
    }

    startHeartbeat(connectionState, socket) {
        const interval = parseInt(process.env.HEARTBEAT_INTERVAL) || 60000;
        
        connectionState.heartbeatInterval = setInterval(() => {
            const now = Date.now();
            const timeSinceLastActivity = now - connectionState.lastActivity;
            
            if (timeSinceLastActivity > interval * 2) {
                logger.warn(`Heartbeat timeout pour ${connectionState.id}`);
                this.closeConnection(socket, connectionState, 'heartbeat_timeout');
            }
        }, interval);
    }

    closeConnection(socket, connectionState, reason) {
        try {
            // Nettoyer les intervalles
            if (connectionState.heartbeatInterval) {
                clearInterval(connectionState.heartbeatInterval);
            }
            
            // Mettre à jour le statut du device
            if (connectionState.deviceId) {
                this.updateDeviceStatus(connectionState.deviceId, 'offline', {
                    disconnectReason: reason,
                    disconnectTime: new Date().toISOString()
                });
            }
            
            // Supprimer de la liste des connexions actives
            this.activeConnections.delete(connectionState.id);
            
            // Fermer le socket
            if (!socket.destroyed) {
                socket.destroy();
            }
            
            this.connectionCount--;
            
        } catch (error) {
            logger.error('Erreur fermeture connexion:', error);
        }
    }

    stop() {
        return new Promise((resolve) => {
            if (!this.server || !this.isRunning) {
                resolve();
                return;
            }
            
            logger.info('🛑 Arrêt du serveur TCP...');
            
            // Fermer toutes les connexions actives
            for (const [connectionId, connectionState] of this.activeConnections) {
                const socket = connectionState.socket;
                if (socket && !socket.destroyed) {
                    socket.destroy();
                }
            }
            
            this.activeConnections.clear();
            
            // Fermer le serveur
            this.server.close(() => {
                this.isRunning = false;
                logger.info('✅ Serveur TCP fermé');
                resolve();
            });
        });
    }

    getStats() {
        return {
            isRunning: this.isRunning,
            activeConnections: this.activeConnections.size,
            totalConnections: this.connectionCount,
            connections: Array.from(this.activeConnections.values()).map(conn => ({
                id: conn.id,
                deviceId: conn.deviceId,
                authenticated: conn.authenticated,
                lastActivity: new Date(conn.lastActivity).toISOString()
            }))
        };
    }
}

// Instance singleton
const tcpServer = new TCPServer();

module.exports = tcpServer; 