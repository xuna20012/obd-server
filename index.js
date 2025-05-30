/**
 * 🚗 OBD SaaS Server - Main Entry Point
 * 
 * Serveur moderne pour gérer plusieurs boîtiers OBD NR-B80 en SaaS
 * Auteur: Cheikhouna FALL
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Import modules personnalisés
const logger = require('./src/utils/logger');
const { supabase, isLocal } = require('./src/database/supabase');
const tcpServer = require('./src/tcp/tcpServer');
const apiRoutes = require('./src/api/routes');
const { authenticateToken } = require('./src/middleware/auth');

// Configuration
const PORT = process.env.PORT || 3000;
const TCP_PORT = process.env.TCP_PORT || 6909;

class OBDSaaSServer {
    constructor() {
        this.app = express();
        this.server = createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: process.env.SOCKET_CORS_ORIGIN || "http://localhost:3001",
                methods: ["GET", "POST"]
            }
        });
        this.activeConnections = new Map(); // Stockage des connexions OBD actives
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }

    setupMiddleware() {
        // Sécurité
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "https:"]
                }
            }
        }));

        // CORS
        this.app.use(cors({
            origin: process.env.CORS_ORIGIN || "http://localhost:3001",
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization"]
        }));

        // Compression
        this.app.use(compression());

        // Rate limiting
        const limiter = rateLimit({
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000, // 15 minutes
            max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // limite par IP
            message: {
                error: 'Trop de requêtes, réessayez plus tard',
                retryAfter: '15 minutes'
            },
            standardHeaders: true,
            legacyHeaders: false
        });

        this.app.use('/api/', limiter);

        // Parsing JSON
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Logging des requêtes
        this.app.use((req, res, next) => {
            const start = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - start;
                logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
            });
            next();
        });
    }

    setupRoutes() {
        // Route de santé
        this.app.get('/health', (req, res) => {
            const dbStats = supabase.getStats();
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                server: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    version: process.version
                },
                database: {
                    type: isLocal() ? 'local' : 'supabase',
                    ...dbStats
                },
                tcp: {
                    port: TCP_PORT,
                    activeConnections: this.activeConnections.size
                },
                websocket: {
                    connected: this.io.engine.clientsCount
                }
            });
        });

        // Documentation API
        this.app.get('/', (req, res) => {
            res.json({
                name: 'OBD SaaS Server',
                version: '1.0.0',
                description: 'Serveur SaaS pour boîtiers OBD NR-B80',
                author: 'Cheikhouna FALL',
                endpoints: {
                    health: '/health',
                    api: '/api/*',
                    docs: '/'
                },
                database: isLocal() ? 'Local (en mémoire)' : 'Supabase',
                tcpPort: TCP_PORT,
                webSocketEnabled: true
            });
        });

        // Routes API
        this.app.use('/api', apiRoutes);

        // Gestion des erreurs 404
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Route non trouvée',
                path: req.originalUrl,
                method: req.method,
                timestamp: new Date().toISOString()
            });
        });

        // Gestion d'erreurs globales
        this.app.use((error, req, res, next) => {
            logger.error('Erreur serveur:', error);
            res.status(500).json({
                error: 'Erreur serveur interne',
                message: process.env.NODE_ENV === 'development' ? error.message : undefined,
                timestamp: new Date().toISOString()
            });
        });
    }

    setupWebSocket() {
        // Middleware d'authentification WebSocket
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
                
                if (!token) {
                    return next(new Error('Token d\'authentification requis'));
                }

                // TODO: Vérifier le token JWT ici
                // Pour l'instant, on accepte tous les tokens pour les tests
                socket.userId = 'user123';
                socket.organizationId = 'org123';
                
                next();
            } catch (error) {
                next(new Error('Token invalide'));
            }
        });

        // Gestion des connexions WebSocket
        this.io.on('connection', (socket) => {
            logger.info(`WebSocket connecté: ${socket.id} (User: ${socket.userId})`);

            // Rejoindre la salle de l'organisation
            socket.join(`org_${socket.organizationId}`);

            // Envoyer les statistiques initiales
            socket.emit('initial-data', {
                connected: true,
                organizationId: socket.organizationId,
                serverTime: new Date().toISOString()
            });

            // Gestion de la déconnexion
            socket.on('disconnect', () => {
                logger.info(`WebSocket déconnecté: ${socket.id}`);
            });

            // Événements personnalisés
            socket.on('subscribe-device', (deviceId) => {
                socket.join(`device_${deviceId}`);
                logger.info(`Client ${socket.id} abonné aux données de l'appareil ${deviceId}`);
            });

            socket.on('unsubscribe-device', (deviceId) => {
                socket.leave(`device_${deviceId}`);
                logger.info(`Client ${socket.id} désabonné de l'appareil ${deviceId}`);
            });
        });
    }

    async start() {
        try {
            // Afficher le mode de base de données
            if (isLocal()) {
                logger.info('🏠 Mode Base de Données: LOCALE (en mémoire)');
                logger.info('💡 Pour utiliser Supabase, configurez SUPABASE_URL et SUPABASE_SERVICE_KEY dans .env');
            } else {
                logger.info('☁️ Mode Base de Données: SUPABASE');
            }

            // Démarrer le serveur TCP OBD
            logger.info(`🔌 Démarrage serveur TCP OBD sur port ${TCP_PORT}...`);
            await tcpServer.start(TCP_PORT, this.io);
            logger.info(`✅ Serveur TCP OBD démarré sur port ${TCP_PORT}`);

            // Démarrer le serveur HTTP/WebSocket
            this.server.listen(PORT, () => {
                logger.info(`🚀 Serveur OBD SaaS démarré sur port ${PORT}`);
                logger.info(`📡 WebSocket activé sur port ${PORT}`);
                logger.info(`🌐 API disponible sur http://localhost:${PORT}/api`);
                logger.info(`❤️ Health check: http://localhost:${PORT}/health`);
                
                console.log('\n🎉 SERVEUR OBD SAAS PRÊT !');
                console.log(`📊 Dashboard: http://localhost:${PORT}`);
                console.log(`🔗 TCP OBD: localhost:${TCP_PORT}`);
                console.log(`💾 Base de données: ${isLocal() ? 'Locale' : 'Supabase'}`);
            });

            // Gestion de l'arrêt propre
            this.setupGracefulShutdown();

        } catch (error) {
            logger.error('❌ Erreur démarrage serveur:', error);
            process.exit(1);
        }
    }

    setupGracefulShutdown() {
        const gracefulShutdown = async (signal) => {
            logger.info(`📤 Signal ${signal} reçu, arrêt en cours...`);
            
            try {
                // Fermer les connexions WebSocket
                this.io.close();
                
                // Arrêter le serveur TCP
                await tcpServer.stop();
                
                // Fermer le serveur HTTP
                this.server.close(() => {
                    logger.info('✅ Serveur arrêté proprement');
                    process.exit(0);
                });
                
                // Force l'arrêt après 30 secondes
                setTimeout(() => {
                    logger.warn('⚠️ Arrêt forcé après timeout');
                    process.exit(1);
                }, 30000);
                
            } catch (error) {
                logger.error('❌ Erreur lors de l\'arrêt:', error);
                process.exit(1);
            }
        };

        // Gérer les signaux d'arrêt
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
        // Gérer les erreurs non capturées
        process.on('uncaughtException', (error) => {
            logger.error('❌ Exception non gérée:', error);
            gracefulShutdown('uncaughtException');
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('❌ Promesse rejetée non gérée:', { reason, promise });
            gracefulShutdown('unhandledRejection');
        });
    }
}

// Démarrage du serveur
const server = new OBDSaaSServer();
server.start().catch(error => {
    logger.error('❌ Échec démarrage serveur:', error);
    process.exit(1);
}); 