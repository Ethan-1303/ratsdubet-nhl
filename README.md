# RATSDUBET NHL — VERSION FINALE V1

Site web complet du moteur RDB NHL.

## Fonctionnalités

### Analyse RDB
- 32 franchises NHL 2026-27 : Utah Mammoth = `UTA`, aucune Arizona.
- Domicile / extérieur.
- Expected Goals et Expected Shots.
- **Stats avancées** : SAT% (Corsi), USAT% (Fenwick), PP%, PK%, Faceoffs, Zone Start %, Sh%/Sv% 5v5, PDO, Hits/Blocks.
- Ajustement xG par possession, spécialités (PP vs PK) et régression PDO.
- Modèle de Poisson pour les marchés.
- Score exact le plus probable.
- Victoire 60 minutes.
- Victoire OT incluse.
- Over / Under 4.5, 5.5, 6.5.
- BTTS.
- Cotes justes = 1 / probabilité.
- Forme des 5 derniers matchs.
- Back-to-back / repos.
- Facteur gardien.
- Statut `NO BET` quand les données sont insuffisantes.

### Player Props
- Top 3 buts.
- Top 3 passes.
- Top 3 points.
- Top 3 tirs.
- Tableau complet des joueurs exploitables du match.
- Probabilité de 1+ et projection individuelle.

### Données
- Base saison 2025-26 pour la pré-saison / le démarrage 2026-27.
- Effectif actuel quand l'API NHL le fournit.
- Audit des valeurs réellement utilisées.
- Calendrier NHL.
- Tableau des 32 équipes.
- Historique local des analyses dans le navigateur.

## Architecture

```text
Navigateur
   │
   ├── index.html
   ├── styles.css
   └── app.js
          │
          ▼
     /api (Pages Function)
          │
          ├── api.nhle.com
          └── api-web.nhle.com
```

Le proxy serveur est volontaire : il évite de faire dépendre l'application des restrictions CORS du navigateur.

## Déploiement Cloudflare Pages

Cloudflare Pages Functions se placent dans un dossier `/functions` à la racine du projet.

### Méthode recommandée

1. Créer un dépôt GitHub privé ou public.
2. Copier les fichiers du projet à la racine.
3. Conserver :
   - `index.html`
   - `styles.css`
   - `app.js`
   - `functions/api.js`
   - `_headers`
4. Cloudflare → Workers & Pages → Create → Pages → Connect to Git.
5. Sélectionner le dépôt.
6. Build command : vide.
7. Build output directory : `/`.
8. Déployer.

Important : le déploiement direct depuis le dashboard Cloudflare n'est pas la méthode à utiliser pour un projet contenant des Pages Functions ; Cloudflare recommande Git/Wrangler pour ce type de projet.

## Gratuit

Les fichiers statiques sont gratuits sur Pages. Les appels `/api` passent par une Pages Function et sont donc comptabilisés dans le quota Workers Free.

## Données NHL

Le site utilise les endpoints NHL exploités par le moteur RDB. Les données et conditions d'utilisation de la NHL doivent être vérifiées avant une exploitation commerciale ou une redistribution publique importante.

## Pré-saison 2026-27

La saison régulière 2026-27 commence le 29 septembre 2026. Avant le début de la saison régulière, le moteur conserve donc 2025-26 comme baseline afin d'éviter de surinterpréter quelques matchs de pré-saison.

## Important

Les probabilités sont des sorties de modèle statistique. Elles ne constituent pas des garanties de résultat et ne remplacent pas la vérification des compositions, gardiens titulaires, blessures et informations de dernière minute.
