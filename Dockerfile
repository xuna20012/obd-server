# 🐳 Dockerfile - Serveur OBD SaaS pour Coolify
FROM node:18-alpine

# Métadonnées
LABEL maintainer="Cheikhouna FALL"
LABEL description="Serveur SaaS pour boîtiers OBD NR-B80"
LABEL version="1.0.0"

# Créer le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production && npm cache clean --force

# Copier le code source
COPY . .

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Changer la propriété des fichiers
RUN chown -R nodeuser:nodejs /app

# Passer à l'utilisateur non-root
USER nodeuser

# Exposer les ports
EXPOSE 3000 6909

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=3000
ENV TCP_PORT=6909

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Commande de démarrage
CMD ["npm", "start"] 