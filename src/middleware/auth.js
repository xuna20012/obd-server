/**
 * 🔐 Middleware d'authentification
 * 
 * Gestion de l'authentification JWT et autorisation basée sur les rôles
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');
const { supabase } = require('../database/supabase');

// Secret JWT (en production, utiliser une clé plus sécurisée)
const JWT_SECRET = process.env.JWT_SECRET || 'obd_saas_secret_key_2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Génère un token JWT
 */
const generateToken = (user) => {
    try {
        const payload = {
            id: user.id,
            email: user.email,
            organizationId: user.organizationId,
            role: user.role,
            iat: Math.floor(Date.now() / 1000)
        };

        return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    } catch (error) {
        logger.error('Erreur génération token JWT:', error);
        throw error;
    }
};

/**
 * Vérifie un token JWT
 */
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('Token expiré');
        } else if (error.name === 'JsonWebTokenError') {
            throw new Error('Token invalide');
        } else {
            throw new Error('Erreur vérification token');
        }
    }
};

/**
 * Middleware d'authentification
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ 
                error: 'Token d\'authentification requis',
                code: 'MISSING_TOKEN'
            });
        }

        const decoded = verifyToken(token);
        
        // Vérifier que l'utilisateur existe toujours
        const users = await supabase.getUsersByOrganization(decoded.organizationId);
        const user = users.find(u => u.id === decoded.id);

        if (!user) {
            return res.status(401).json({ 
                error: 'Utilisateur non trouvé',
                code: 'USER_NOT_FOUND'
            });
        }

        // Ajouter l'utilisateur à la requête
        req.user = {
            id: decoded.id,
            email: decoded.email,
            organizationId: decoded.organizationId,
            role: decoded.role
        };

        logger.info(`Utilisateur authentifié: ${decoded.email}`);
        next();

    } catch (error) {
        logger.warn(`Échec authentification: ${error.message}`);
        
        if (error.message.includes('expiré')) {
            return res.status(401).json({ 
                error: 'Token expiré',
                code: 'TOKEN_EXPIRED'
            });
        }
        
        return res.status(401).json({ 
            error: 'Token invalide',
            code: 'INVALID_TOKEN'
        });
    }
};

/**
 * Middleware d'autorisation basé sur les rôles
 */
const authorize = (allowedRoles = []) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ 
                    error: 'Utilisateur non authentifié',
                    code: 'NOT_AUTHENTICATED'
                });
            }

            if (allowedRoles.length === 0) {
                // Pas de restriction de rôle
                return next();
            }

            if (!allowedRoles.includes(req.user.role)) {
                logger.warn(`Accès refusé pour ${req.user.email} (rôle: ${req.user.role})`);
                return res.status(403).json({ 
                    error: 'Accès refusé - Permissions insuffisantes',
                    code: 'INSUFFICIENT_PERMISSIONS',
                    requiredRoles: allowedRoles,
                    userRole: req.user.role
                });
            }

            next();

        } catch (error) {
            logger.error('Erreur autorisation:', error);
            return res.status(500).json({ 
                error: 'Erreur serveur lors de l\'autorisation',
                code: 'AUTHORIZATION_ERROR'
            });
        }
    };
};

/**
 * Middleware pour vérifier l'appartenance à l'organisation
 */
const checkOrganizationAccess = (req, res, next) => {
    try {
        const { organizationId } = req.params;
        
        if (organizationId && organizationId !== req.user.organizationId) {
            logger.warn(`Tentative d'accès à une autre organisation par ${req.user.email}`);
            return res.status(403).json({ 
                error: 'Accès refusé - Organisation différente',
                code: 'WRONG_ORGANIZATION'
            });
        }

        next();

    } catch (error) {
        logger.error('Erreur vérification organisation:', error);
        return res.status(500).json({ 
            error: 'Erreur vérification organisation',
            code: 'ORGANIZATION_CHECK_ERROR'
        });
    }
};

/**
 * Utilitaires de hachage de mot de passe
 */
const hashPassword = async (password) => {
    try {
        const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
        return await bcrypt.hash(password, saltRounds);
    } catch (error) {
        logger.error('Erreur hachage mot de passe:', error);
        throw error;
    }
};

const comparePassword = async (password, hashedPassword) => {
    try {
        return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
        logger.error('Erreur comparaison mot de passe:', error);
        throw error;
    }
};

/**
 * Middleware de validation des données d'authentification
 */
const validateAuthData = (req, res, next) => {
    const { email, password } = req.body;
    
    // Validation email
    if (!email || !email.includes('@')) {
        return res.status(400).json({ 
            error: 'Email valide requis',
            code: 'INVALID_EMAIL'
        });
    }
    
    // Validation mot de passe
    if (!password || password.length < 6) {
        return res.status(400).json({ 
            error: 'Mot de passe d\'au moins 6 caractères requis',
            code: 'WEAK_PASSWORD'
        });
    }
    
    next();
};

/**
 * Middleware optionnel d'authentification (pour les routes publiques avec données optionnelles)
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            // Pas de token, continuer sans authentification
            req.user = null;
            return next();
        }

        const decoded = verifyToken(token);
        req.user = {
            id: decoded.id,
            email: decoded.email,
            organizationId: decoded.organizationId,
            role: decoded.role
        };

        next();

    } catch (error) {
        // En cas d'erreur, continuer sans authentification
        req.user = null;
        next();
    }
};

/**
 * Middleware de limitation de taux par utilisateur
 */
const rateLimitByUser = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    const userRequests = new Map();
    
    return (req, res, next) => {
        const userId = req.user?.id || req.ip;
        const now = Date.now();
        
        if (!userRequests.has(userId)) {
            userRequests.set(userId, []);
        }
        
        const requests = userRequests.get(userId);
        
        // Nettoyer les anciennes requêtes
        const validRequests = requests.filter(time => now - time < windowMs);
        
        if (validRequests.length >= maxRequests) {
            return res.status(429).json({ 
                error: 'Trop de requêtes',
                code: 'RATE_LIMIT_EXCEEDED',
                resetTime: new Date(now + windowMs).toISOString()
            });
        }
        
        validRequests.push(now);
        userRequests.set(userId, validRequests);
        
        next();
    };
};

/**
 * Middleware de log des accès
 */
const logAccess = (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        logger.info('API Access', {
            method: req.method,
            path: req.path,
            userId: req.user?.id,
            organizationId: req.user?.organizationId,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
    });
    
    next();
};

module.exports = {
    generateToken,
    verifyToken,
    authenticateToken,
    authorize,
    checkOrganizationAccess,
    hashPassword,
    comparePassword,
    validateAuthData,
    optionalAuth,
    rateLimitByUser,
    logAccess
}; 