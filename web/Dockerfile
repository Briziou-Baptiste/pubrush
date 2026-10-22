# ==============================================================================
# PUBRUSH WEB - DOCKERFILE NEXT.JS STANDALONE MULTI-STAGE
# Image ultra-légère (<180Mo) et sécurisée (non-root)
# ==============================================================================

# --- Étape 1 : Image de base Alpine sécurisée & patchée ---
FROM node:22.23.4-alpine AS base
WORKDIR /app
# Dépendances système Alpine et certificats racine à jour
RUN apk add --no-cache libc6-compat ca-certificates

# --- Étape 2 : Installation des dépendances (cache optimisé) ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- Étape 3 : Build de production Next.js ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Désactiver la télémétrie Next.js pendant le build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# --- Étape 4 : Image d'exécution de production (Runner minimal sécurisé) ---
FROM node:22.23.4-alpine AS runner
WORKDIR /app

# Certificats racine à jour pour les requêtes TLS sécurisées
RUN apk add --no-cache ca-certificates

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Sécurité : Création d'un groupe et utilisateur système non-root dédié
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copie des assets statiques publics
COPY --from=builder /app/public ./public

# Configuration des permissions pour le répertoire cache Next.js
RUN mkdir .next && chown nextjs:nodejs .next

# Copie exclusive des fichiers requis pour le mode standalone
# (réduit l'empreinte de 1Go+ de node_modules à seulement les dépendances nécessaires)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Exécution sous l'utilisateur non-root
USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
