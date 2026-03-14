# Architecture

## Vue d'ensemble

Monorepo npm workspaces avec deux packages : `server/` et `client/`.

```
Dashboard-Claude/
├── package.json              # Workspaces root
├── server/                   # Backend Node.js
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts              # Entry point : startup sequence
│       ├── config.ts             # Chemins ~/.claude/, port, intervals
│       ├── server.ts             # Express app + HTTP server
│       ├── hooks/
│       │   ├── hookReceiver.ts   # POST /hooks — reçoit les events Claude Code
│       │   └── hookInstaller.ts  # Installe/désinstalle les hooks dans settings.json
│       ├── watchers/
│       │   ├── WatcherManager.ts   # Orchestre tous les watchers
│       │   ├── SessionWatcher.ts   # ~/.claude/sessions/*.json
│       │   ├── SubagentWatcher.ts  # **/subagents/agent-*.{meta.json,jsonl}
│       │   ├── TaskWatcher.ts      # ~/.claude/tasks/**/*.json
│       │   └── TeamWatcher.ts      # ~/.claude/teams/**/config.json
│       ├── parsers/
│       │   ├── JsonlParser.ts          # Lecture incrémentale JSONL (offset bytes)
│       │   └── InteractionExtractor.ts # Extrait spawn/SendMessage des JSONL
│       ├── store/
│       │   └── Store.ts           # State en mémoire (Maps + EventEmitter) — inclut AgentLastAction
│       ├── services/
│       │   ├── PidChecker.ts      # Vérifie les PID alive toutes les 5s
│       │   ├── TmuxDetector.ts    # Détection tmux (graceful degrade)
│       │   └── TmuxMonitor.ts     # Monitoring tmux : polling sessions/panes + capture contenu
│       ├── routes/
│       │   └── api.ts             # GET /api/state, /sessions, /agents/:id
│       └── ws/
│           ├── WebSocketManager.ts # Broadcast delta events aux clients
│           └── events.ts           # Types WsEvent discriminated union
└── client/                   # Frontend React
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx               # Conditionnel : NoSessionScreen | Shell
        ├── types/
        │   ├── models.ts         # Session, Agent, Task, Team, Interaction, TmuxSession, TmuxPane
        │   └── ws-events.ts      # WsEvent discriminated union (+ tmux:sessions, tmux:update)
        ├── api/
        │   ├── rest.ts           # Fetch /api/state initial
        │   └── ws.ts             # Client WS + reconnexion exponentielle
        ├── stores/               # Zustand stores (un par domaine)
        │   ├── sessionStore.ts
        │   ├── agentStore.ts
        │   ├── taskStore.ts
        │   ├── interactionStore.ts
        │   ├── wsStore.ts
        │   └── tmuxStore.ts         # État tmux (sessions, panes, disponibilité)
        ├── hooks/
        │   ├── useWebSocket.ts   # Connect + dispatch events vers stores
        │   ├── useAgentGraph.ts  # Dérive React Flow nodes/edges
        │   └── useAutoLayout.ts  # Dagre layout computation
        ├── components/
        │   ├── layout/
        │   │   ├── Shell.tsx     # Grid : sidebar + content + detail panel
        │   │   ├── Sidebar.tsx   # 5 onglets verticaux (+ Monitoring)
        │   │   └── Header.tsx    # Info session + indicateur WS
        │   ├── screens/
        │   │   └── NoSessionScreen.tsx
        │   ├── agents/
        │   │   ├── AgentGrid.tsx
        │   │   ├── AgentCard.tsx
        │   │   ├── AgentTypeBadge.tsx
        │   │   ├── AgentStatusDot.tsx
        │   │   └── AgentDetailPanel.tsx
        │   ├── graph/
        │   │   ├── InteractionGraph.tsx
        │   │   ├── AgentNode.tsx
        │   │   └── MessageEdge.tsx
        │   ├── tasks/
        │   │   ├── TaskBoard.tsx
        │   │   ├── TaskColumn.tsx
        │   │   └── TaskCard.tsx
        │   ├── timeline/
        │   │   ├── Timeline.tsx
        │   │   └── TimelineEvent.tsx
        │   └── monitoring/
        │       └── MonitoringView.tsx  # Onglet Monitoring : grille terminaux tmux
        ├── lib/
        │   ├── fr.ts             # Strings FR centralisées
        │   ├── constants.ts      # Couleurs, URLs, config WS
        │   └── formatters.ts     # Dates FR, truncation
        └── styles/
            └── index.css         # Tailwind directives + animations custom
```

## Flux de données

```
Claude Code Session
    │
    ├── Hooks HTTP POST ──→ hookReceiver.ts ──→ Store.upsert*()
    │                                               │
    ├── Fichiers ~/.claude/ ──→ chokidar watchers ──┘
    │                                               │
    │                                               ▼
    │                                         Store (EventEmitter)
    │                                               │
    │                          ┌────────────────────┴──────────────────┐
    │                          │                                      │
    │                   WebSocketManager                        REST API
    │                   (broadcast deltas)                  (GET /api/state)
    │                          │                                      │
    │                          ▼                                      ▼
    │                   React Frontend ◄──────────────────────────────┘
    │                          │
    │                   Zustand Stores
    │                          │
    │                   React Components
```

### Sources de données

1. **Hooks Claude Code** (source primaire) : 9 événements lifecycle envoyés en HTTP POST au serveur
2. **File scanning** (source secondaire) : chokidar watche `~/.claude/` pour l'état initial et les changements fichiers
   - `sessions/` — sessions actives (pid, sessionId, cwd, startedAt)
   - `projects/{path}/{sessionId}/subagents/` — agents (meta.json = type, jsonl = conversation)
   - `tasks/` — tâches (id, subject, status, blocks, blockedBy, owner)
   - `teams/` — équipes (members, config)

### Communication temps réel

- **Snapshot initial** : envoyé via WS à chaque nouvelle connexion client
- **Delta updates** : chaque mutation du Store émet un événement typé, broadcasté via WS
- **Reconnexion** : backoff exponentiel (1s, 2s, 4s... max 30s)
- **Fallback REST** : le client fetch `/api/state` au démarrage comme filet de sécurité

## Communication bidirectionnelle et chat

### SessionManager (`server/src/services/SessionManager.ts`)

Le dashboard peut désormais spawner et piloter des processus Claude CLI. Le `SessionManager` utilise `--input-format stream-json --output-format stream-json` pour maintenir un canal stdin/stdout ouvert avec chaque processus Claude. Les sessions démarrées depuis le dashboard sont interactives (chat bidirectionnel), tandis que les sessions détectées depuis un terminal externe restent en lecture seule.

### ConversationStore (`server/src/services/ConversationStore.ts`)

Stockage en mémoire des conversations par agent/session. Alimenté par le parsing des fichiers JSONL (sessions externes) et par le stream stdout (sessions managées). Émet des événements `conversation:update` pour le broadcast temps réel.

### Interface de chat

Le panneau droit (`RightPanel`) propose des onglets Infos/Chat/Historique. L'onglet Chat permet d'envoyer des messages à un agent et de voir les réponses en streaming. Les messages sont rendus par rôle (user, assistant, thinking, tool_call, tool_result) avec `react-markdown` pour le contenu assistant.

### Démarrage de session depuis le dashboard

L'écran `NoSessionScreen` propose un formulaire pour démarrer une session Claude directement depuis le dashboard. Le prompt est envoyé via `POST /api/sessions/start`, le serveur spawne un processus Claude, et le client bascule automatiquement vers le Shell quand la session est détectée.

### Visualisation des relations de blocage

Le graphe d'interactions affiche des edges pointillés animés (dash-flow) entre agents bloquants et agents bloqués. Les nœuds agents montrent des badges indiquant le nombre de tâches en cours et l'état d'attente.

### WebSocket bidirectionnel

Le WebSocket supporte désormais les messages client→serveur pour les commandes :
- `command:start-session` — démarrer une nouvelle session
- `command:send-message` — envoyer un message à un agent
- `command:stop-session` — arrêter une session

Les événements serveur→client ajoutés :
- `conversation:update` — mise à jour de conversation
- `session:output` — sortie streaming d'une session
- `command:ack` / `command:error` — accusé de réception/erreur

### Endpoints REST ajoutés

```
POST /api/sessions/start        → démarrer une session managée
POST /api/sessions/:id/message  → envoyer un message à une session
DELETE /api/sessions/:id        → arrêter une session
GET /api/agents/:id/conversation → historique de conversation d'un agent
```

## Dernière action des agents (lastAction)

Chaque agent expose un champ `lastAction: AgentLastAction | null` qui décrit sa dernière activité significative.

### Structure

```typescript
interface AgentLastAction {
  type: string;       // "started" | "completed" | "idle" | "tool"
  detail: string;     // ex: nom de l'outil utilisé, raison de l'arrêt
  timestamp: string;  // ISO 8601
}
```

### Alimentation

Le `hookReceiver.ts` peuple `lastAction` à chaque événement lifecycle reçu via les hooks Claude Code :
- **SubagentStart** → `{ type: "started", detail: agentType }`
- **SubagentCompleted/Stop** → `{ type: "completed", detail: "" }`
- **SubagentIdle** → `{ type: "idle", detail: "" }`
- **ToolUse** → `{ type: "tool", detail: toolName }`

### Affichage frontend

Le composant `AgentCard.tsx` affiche la dernière action avec une icône colorée (claude-orange), un label traduit en FR, le détail tronqué et le temps relatif (`timeAgo`). Le type `AgentActionType` côté client est défini dans `models.ts`.

## Monitoring tmux

### TmuxMonitor (`server/src/services/TmuxMonitor.ts`)

Service de monitoring des sessions tmux, utile pour observer les terminaux des agents Claude Code exécutés dans tmux.

**Fonctionnement :**
1. Vérifie la disponibilité de tmux au démarrage (`which tmux` + `tmux list-sessions`)
2. Polling toutes les 2 secondes via `setInterval` (timer `.unref()` pour ne pas bloquer le shutdown)
3. Liste les sessions et panes via `tmux list-sessions` et `tmux list-panes`
4. Capture le contenu des panes via `tmux capture-pane -p` (200 dernières lignes)
5. Détecte les changements de contenu via un cache en mémoire (`paneContentCache`)
6. Émet des événements typés : `tmux:sessions` (liste changée) et `tmux:update` (contenu pane changé)

**Dégradation gracieuse :** Si tmux n'est pas installé ou indisponible, le service se désactive silencieusement. L'UI affiche un état "indisponible".

### Routes REST tmux

```
GET /api/tmux/available      → { available: boolean, reason?: string }
GET /api/tmux/sessions       → TmuxSession[]
GET /api/tmux/pane/:s/:w/:p  → contenu texte d'un pane spécifique
```

### Événements WebSocket tmux

- `tmux:sessions` → `{ available: boolean, sessions: TmuxSession[] }` — liste des sessions mise à jour
- `tmux:update` → `TmuxPane` — contenu d'un pane mis à jour

### Frontend : onglet Monitoring

Le 5e onglet de la sidebar ("Monitoring", icône `Monitor` de lucide-react) affiche :
- **État indisponible** : message explicatif si tmux n'est pas détecté
- **État vide** : message si aucune session tmux n'est active
- **Grille de terminaux** : chaque pane tmux est rendu dans un bloc stylisé terminal (fond `#0a0a0f`, texte `green-400`) avec scroll automatique vers le bas. Grille responsive 1 col / 2 cols en `lg`.

Le state est géré par `tmuxStore.ts` (Zustand) avec deux actions : `setSessions` et `updatePane`. Les événements WS sont dispatchés dans `useWebSocket.ts`.

## Ports

| Service | Port | Configurable |
|---------|------|-------------|
| Server API + WS | 3002 | `DASHBOARD_PORT` env var |
| Client Vite (dev) | 5173 | vite.config.ts |

Le client Vite proxie `/api`, `/hooks` et `/ws` vers le serveur en dev.
