# Choix techniques

Choix de stack, librairies et patterns avec les alternatives considérées.

---

## Stack principale

| Couche | Choix | Version | Alternatives considérées | Raison du choix |
|--------|-------|---------|-------------------------|-----------------|
| Runtime | Node.js | 22+ | Deno, Bun | Écosystème npm natif, compatibilité chokidar |
| Backend | Express | 5 | Fastify, Hono | Simplicité, WS upgrade natif via http server |
| Temps réel | ws | 8.18 | Socket.io | Léger, pas besoin de fallback polling |
| File watching | chokidar | 4 | fs.watch, Parcel watcher | Fiable cross-platform, recursive |
| Frontend | React | 19 | Svelte, Vue, Solid | Écosystème React Flow, familiarité |
| Bundler | Vite | 6 | Webpack, Turbopack | HMR rapide, ESM natif, proxy intégré |
| Styling | Tailwind CSS | 4 | CSS Modules, Styled Components | Dark theme facile, pas de CSS-in-JS runtime |
| State | Zustand | 5 | Redux, Jotai, Signals | Selectors granulaires, `getState()` hors React pour WS |
| Graphe | @xyflow/react (React Flow) | 12 | D3, vis.js, Cytoscape | Nœuds = composants React natifs, layout dagre |
| Layout graphe | @dagrejs/dagre | 1.1 | ELK, Cola.js | Léger, hiérarchie TB déterministe |
| Icônes | lucide-react | 0.474 | Heroicons, Phosphor | Tree-shakeable, MIT, cohérent |
| Dates | date-fns | 4 | Day.js, Luxon | Léger, locale FR native, "il y a 2 min" |
| Monorepo | npm workspaces | — | Turborepo, pnpm workspaces | Zéro config supplémentaire |
| Dev runner | concurrently | 9 | npm-run-all, Turbo | Simple, coloré, fiable |
| TS runner | tsx | 4 | ts-node, swc-node | Watch mode intégré, rapide |

---

## Patterns architecturaux

### Store EventEmitter (server)
- **Choix** : Maps en mémoire + EventEmitter natif Node.js
- **Alternative** : SQLite, Redis
- **Raison** : Données éphémères (durée de vie = session Claude), pas besoin de persistance. EventEmitter permet le broadcast WS sans couplage.

### Zustand stores séparés (client)
- **Choix** : Un store par domaine (session, agent, task, interaction, ws)
- **Alternative** : Store monolithique
- **Raison** : Selectors granulaires évitent les re-renders inutiles sur événements WS haute fréquence. `getState()` permet le dispatch depuis le callback WS hors contexte React.

### Approche hybride Hooks + File scanning
- **Choix** : Hooks HTTP comme source primaire, chokidar comme source secondaire
- **Alternative** : Hooks seuls, ou file scanning seul
- **Raison** : Les hooks donnent les événements en temps réel mais ne couvrent pas l'état initial. Le file scanning capte l'état existant au démarrage. Les deux se complètent.

### Proxy Vite pour WS en dev
- **Choix** : Le client se connecte via `window.location.host` (proxy Vite)
- **Alternative** : URL directe vers le serveur backend
- **Raison** : Évite les problèmes CORS et de ports en dev. Fonctionne aussi en prod sans changement.

---

## Couleurs agents

| Type | Couleur | Hex |
|------|---------|-----|
| Explore | Bleu | blue-500 |
| Plan | Violet | purple-500 |
| general-purpose | Vert | emerald-500 |
| statusline-setup | Ambre | amber-500 |
| claude-code-guide | Cyan | cyan-500 |
| custom | Gris | gray-500 |

Status : actif = vert pulse, idle = ambre, terminé = gris.

---

## Monitoring tmux

### Polling tmux vs alternatives

- **Choix** : Polling `tmux capture-pane` toutes les 2 secondes
- **Alternatives considérées** :
  - **tmux control mode** (`tmux -C`) : streaming natif des changements, mais complexe à parser et nécessite une connexion persistante par session
  - **inotify sur le socket tmux** : détecte l'activité mais ne donne pas le contenu des panes
  - **ptrace / pty proxy** : trop invasif, risques de sécurité
- **Raison** : Le polling est simple, fiable, et ne nécessite aucune configuration tmux spéciale. Le cache de contenu évite les broadcasts inutiles. La charge CPU est négligeable à 2s d'intervalle.

### UI terminal custom vs xterm.js

- **Choix** : Rendu custom avec `<pre>` stylisé (fond `#0a0a0f`, texte `green-400`)
- **Alternative** : xterm.js (émulateur de terminal complet dans le navigateur)
- **Raison** : xterm.js (~200KB gzip) est surdimensionné pour du contenu en lecture seule. Un `<pre>` avec scroll automatique suffit pour afficher la sortie capturée. Pas besoin de gestion des séquences d'échappement ANSI complexes, le contenu de `capture-pane` est du texte brut.
