# Décisions techniques (ADR léger)

Chaque décision est datée et justifiée. Format : contexte → décision → conséquences.

---

## 2026-03-14 : Port serveur 3002 au lieu de 3001

**Contexte** : Le port 3001 est souvent occupé par d'autres services de dev (Next.js, etc.).

**Décision** : Utiliser 3002 par défaut, configurable via `DASHBOARD_PORT`.

**Conséquences** : Les hooks installés dans `~/.claude/settings.json` utilisent `config.port` dynamiquement. Changer le port nécessite de relancer le serveur (les hooks seront réinstallés).

---

## 2026-03-14 : Chokidar v4 — watch répertoires, pas globs

**Contexte** : Chokidar v4 ne supporte plus les glob patterns dans `watch()`. Les watchers initiaux ne détectaient aucun fichier.

**Décision** : Watcher sur les répertoires parents avec filtrage manuel des fichiers dans les callbacks (`filePath.endsWith(".json")`, etc.).

**Conséquences** : Plus de fichiers transitent par les callbacks, le filtrage est fait en amont dans chaque handler. Fonctionne de manière fiable sur Linux.

---

## 2026-03-14 : Champ agentType dans meta.json

**Contexte** : Les fichiers `agent-*.meta.json` de Claude Code utilisent le champ `agentType` (pas `type` ni `agent_type`). Les agents étaient tous détectés comme "custom".

**Décision** : Vérifier `data.agentType` en priorité, puis `data.type`, puis `data.agent_type` comme fallback.

**Conséquences** : Les types Explore, Plan, general-purpose, claude-code-guide sont correctement détectés.

---

## 2026-03-14 : startedAt peut être epoch ms ou ISO string

**Contexte** : Le fichier session `~/.claude/sessions/{pid}.json` stocke `startedAt` en millisecondes epoch (nombre), pas en ISO string.

**Décision** : Le SessionWatcher détecte le type (`typeof rawStarted === "number"`) et convertit en ISO string via `new Date(epoch).toISOString()`.

**Conséquences** : Compatible avec les deux formats. Si Claude Code change son format, les deux cas sont gérés.

---

## 2026-03-14 : SessionId dérivé du chemin fichier pour les agents

**Contexte** : Les fichiers meta.json des agents ne contiennent souvent que `{"agentType": "..."}` sans sessionId.

**Décision** : Dériver le sessionId depuis le chemin : `.../projects/{encoded-path}/{sessionId}/subagents/agent-*.meta.json`.

**Conséquences** : Dépendance sur la structure de répertoires de Claude Code. Si la structure change, le parsing cassera.

---

## 2026-03-14 : WS URL via window.location (pas URL en dur)

**Contexte** : En dev, le client tourne sur un port Vite différent du serveur. Une URL en dur vers `:3002` bypass le proxy Vite.

**Décision** : Construire l'URL WS depuis `window.location.host` pour passer par le proxy Vite en dev. En prod, même chose — le serveur sert tout.

**Conséquences** : Le proxy Vite doit être configuré pour `/ws` avec `ws: true`. Fonctionne en dev et en prod sans changement.

---

## 2026-03-14 : Hook marker pour identification

**Contexte** : Le hookInstaller doit pouvoir ajouter et retirer ses hooks de `settings.json` sans toucher aux hooks utilisateur.

**Décision** : Ajouter un commentaire marker `#dashboard-claude-hook` dans la commande curl. Détection via `command.includes(HOOK_MARKER)`.

**Conséquences** : Les hooks dashboard sont identifiables de manière unique. `uninstallHooks()` ne retire que les hooks dashboard. Le marker n'affecte pas l'exécution de la commande curl.

---

## 2026-03-14 : Communication CLI via stream-json

**Contexte** : Claude Code n'expose pas d'API pour injecter des messages dans une session existante. Il faut un moyen de maintenir un dialogue interactif avec le processus Claude.

**Décision** : Utiliser `claude -p --input-format stream-json --output-format stream-json` pour spawner des processus avec stdin/stdout en mode streaming JSON. Cela permet d'envoyer des messages via stdin et de recevoir les réponses en streaming via stdout.

**Conséquences** : Les sessions managées par le dashboard sont pleinement interactives. Les sessions lancées depuis un terminal externe restent en lecture seule (pas d'accès à leur stdin). Le format stream-json nécessite un parsing ligne par ligne côté serveur.

---

## 2026-03-14 : Sessions externes en lecture seule vs sessions dashboard interactives

**Contexte** : Le dashboard détecte les sessions Claude de deux sources : les sessions lancées depuis un terminal (file watching) et les sessions démarrées depuis le dashboard (SessionManager).

**Décision** : Distinguer les deux types. Les sessions externes sont en lecture seule (monitoring uniquement). Les sessions dashboard sont interactives (chat bidirectionnel). L'UI affiche un indicateur "Lecture seule — session externe" quand applicable.

**Conséquences** : Pas de risque d'interférence avec les sessions utilisateur existantes. L'utilisateur sait clairement quelles sessions peuvent recevoir des messages.

---

## 2026-03-14 : bypassPermissions comme mode par défaut

**Contexte** : Les sessions spawned depuis le dashboard doivent pouvoir exécuter des outils sans blocage interactif (l'utilisateur n'a pas de terminal pour accepter les prompts de permission).

**Décision** : Utiliser `--permission-mode bypassPermissions` par défaut pour les sessions managées.

**Conséquences** : Les sessions dashboard ont un accès complet aux outils sans confirmation. C'est acceptable car l'utilisateur a explicitement démarré la session depuis le dashboard. Un avertissement dans la documentation est recommandé.

---

## 2026-03-14 : react-markdown pour le rendu des messages

**Contexte** : Les réponses de Claude contiennent du markdown riche (code blocks, listes, liens, tableaux). Il faut un rendu fidèle dans l'interface chat.

**Décision** : Utiliser `react-markdown` avec `remark-gfm` pour le rendu des messages assistant. Les autres rôles (tool_call, tool_result) utilisent un rendu mono formaté manuellement.

**Conséquences** : Bonne fidélité de rendu markdown. Dépendance supplémentaire (~50KB gzip). Le plugin remark-gfm ajoute le support des tableaux GitHub-flavored.

---

## 2026-03-14 : Format hooks Claude Code — matcher + hooks array

**Contexte** : Claude Code v2.1+ exige le format `{ "matcher": "", "hooks": [{ "type": "command", "command": "..." }] }` pour chaque événement. Le hookInstaller écrivait `{ "type": "command", "command": "..." }` directement, causant `Invalid Settings` au démarrage de Claude.

**Décision** : Corriger le hookInstaller pour wrapper chaque hook dans un objet `{ matcher: "", hooks: [...] }`. Le `matcher: ""` signifie "match all" (tous les outils).

**Conséquences** : Les hooks sont maintenant compatibles avec Claude Code v2.1+. Le format précédent cassait le lancement de Claude dans le terminal.
