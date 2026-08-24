# Manta Academy actions

Workflows réutilisables employés par les dépôts Subject et les sites Reef
générés. Les templates ne contiennent que de petits wrappers ; toute la logique
de création, synchronisation et déploiement vit ici.

## Workflows publics

- `reef-create.yml` crée `<subject>-site` depuis `MEA-RUN/reef-site-template`,
  puis demande une synchronisation complète.
- `reef-update.yml` remplace les sujets et assets du site.
- `reef-tools.yml` retélécharge intégralement les outils.

`reef-sync.yml` est le récepteur interne utilisé par le site généré.

## GitHub App

Les dépôts appelants doivent avoir accès aux secrets d'organisation :

- `REEF_APP_CLIENT_ID`
- `REEF_APP_PRIVATE_KEY`

L'application doit être installée sur **tous les dépôts** de l'organisation afin
qu'un site tout juste créé soit immédiatement accessible. Permissions minimales :

- Repository administration: read and write
- Contents: read and write
- Metadata: read
- Pages: read and write

Les dépôts générés sont publics par défaut afin de pouvoir utiliser GitHub Pages
sur une organisation GitHub Free.

## Contrat `metadata.yml`

```yaml
tools:
  - id: match
    repository: MEA-RUN/match
    ref: main
```

`ref` accepte une branche, un tag ou un SHA. Lors d'une mise à jour, le contenu
de `public/tools` est supprimé puis reconstruit ; aucun ancien outil ne subsiste.
Reusable GitHub Actions for MEA-RUN projects
