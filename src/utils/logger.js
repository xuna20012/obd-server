/**
 * 📝 Logger Configuration avec Winston
 * 
 * Système de logging professionnel pour le SaaS OBD
 */

const winston = require('winston');
const path = require('path');

// Configuration des niveaux de log
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Configuration des couleurs
const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};

winston.addColors(logColors);

// Format personnalisé pour les logs
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        
        // Ajouter les métadonnées s'il y en a
        if (Object.keys(meta).length > 0) {
            msg += ` | ${JSON.stringify(meta)}`;
        }
        
        // Ajouter la stack trace pour les erreurs
        if (stack) {
            msg += `\n${stack}`;
        }
        
        return msg;
    })
);

// Configuration des transports
const transports = [
    // Console transport
    new winston.transports.Console({
        level: process.env.LOG_LEVEL || 'info',
        format: logFormat
    }),
    
    // Fichier pour tous les logs
    new winston.transports.File({
        filename: path.join('logs', 'obd-server.log'),
        level: 'info',
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        ),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }),
    
    // Fichier spécifique pour les erreurs
    new winston.transports.File({
        filename: path.join('logs', 'error.log'),
        level: 'error',
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        ),
        maxsize: 5242880, // 5MB
        maxFiles: 3,
    })
];

// Créer le logger
const logger = winston.createLogger({
    levels: logLevels,
    transports,
    exitOnError: false,
});

// Logger spécialisé pour les données OBD
logger.obdData = (deviceId, command, data) => {
    logger.info('OBD Data Received', {
        deviceId,
        command,
        dataLength: data ? data.length : 0,
        timestamp: new Date().toISOString(),
        category: 'OBD_DATA'
    });
};

// Logger pour les connexions TCP
logger.tcpConnection = (action, deviceId, clientInfo) => {
    logger.info(`TCP ${action}`, {
        deviceId,
        clientIP: clientInfo?.remoteAddress,
        clientPort: clientInfo?.remotePort,
        timestamp: new Date().toISOString(),
        category: 'TCP_CONNECTION'
    });
};

// Logger pour les authentifications
logger.auth = (action, userId, result) => {
    logger.info(`Auth ${action}`, {
        userId,
        result,
        timestamp: new Date().toISOString(),
        category: 'AUTHENTICATION'
    });
};

// Logger pour les performances
logger.performance = (operation, duration, metadata = {}) => {
    logger.info(`Performance: ${operation}`, {
        duration: `${duration}ms`,
        ...metadata,
        timestamp: new Date().toISOString(),
        category: 'PERFORMANCE'
    });
};

// Logger pour les alertes
logger.alert = (alertType, deviceId, message, severity = 'medium') => {
    const logMethod = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
    logger[logMethod](`Alert: ${alertType}`, {
        deviceId,
        message,
        severity,
        timestamp: new Date().toISOString(),
        category: 'ALERT'
    });
};

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = logger; 