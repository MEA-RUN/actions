# Manta Academy actions

Automatisation réutilisable des sujets Reef. Un dépôt créé depuis
`subject-template` publie son propre site sur sa branche `gh-pages` à chaque
push sur `main`. Aucun dépôt supplémentaire, GitHub App ou secret n'est requis.

## Workflow

`reef-deploy.yml` :

1. vérifie que l'auteur possède un droit d'écriture lorsque le dépôt appartient
   à une organisation ;
2. récupère `reef-site-template` comme base de build ;
3. copie les sujets, assets et outils ;
4. construit le site avec Bun 1.4 ;
5. remplace la branche `gh-pages` du dépôt source.

Le dépôt doit autoriser les workflows en lecture/écriture et GitHub Pages doit
être configuré sur **Deploy from a branch**, branche `gh-pages`, dossier `/`.

## Contrat `metadata.yml`

```yaml
tools:
  - id: match
    repository: MEA-RUN/match
    ref: main

  - id: mon-outil
    path: tools/mon-outil
    name: Mon outil
```

Un outil distant doit être public et `ref` accepte une branche, un tag ou un
SHA. Un outil local est un dossier du dépôt contenant au minimum `index.html`.
Dans les deux cas, `public/tools` est entièrement reconstruit à chaque build.
Reusable GitHub Actions for MEA-RUN projects
