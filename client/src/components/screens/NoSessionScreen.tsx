import { useState } from "react";
import { Bot } from "lucide-react";
import { fr } from "../../lib/fr";
import { useWsStore } from "../../stores/wsStore";
import { startSession } from "../../api/rest";
import WsStatusDot from "../WsStatusDot";

export default function NoSessionScreen() {
  const wsStatus = useWsStore((s) => s.status);
  const [prompt, setPrompt] = useState("");
  const [cwd, setCwd] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setIsStarting(true);
    setError(null);
    try {
      await startSession(prompt, cwd || undefined);
      // Success: WS session:start event will trigger the transition automatically
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.noSession.startError);
      setIsStarting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-claude-bg">
      <div className="flex flex-col items-center gap-6 fade-in">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-claude-orange/10">
          <Bot className="h-10 w-10 text-claude-orange" />
        </div>

        <h1 className="text-2xl font-semibold text-claude-text">
          {fr.noSession.title}
        </h1>

        <p className="flex items-center gap-2 text-claude-text-secondary">
          <span className="inline-block h-2 w-2 rounded-full bg-claude-orange status-pulse" />
          {fr.noSession.subtitle}
        </p>

        <p className="mt-4 text-sm text-claude-text-secondary">
          {fr.noSession.hint}
        </p>

        <div className="my-6 h-px w-48 bg-claude-border" />

        <textarea
          className="w-96 resize-none rounded-lg border border-claude-border bg-claude-bg p-3 text-sm text-claude-text placeholder-claude-text-secondary focus:border-claude-orange/50 focus:outline-none"
          placeholder={fr.noSession.startPrompt}
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <div className="flex w-96 flex-col">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs text-claude-text-secondary transition-colors hover:text-claude-text"
          >
            <span>{showAdvanced ? "▾" : "▸"}</span>
            {fr.noSession.advancedOptions}
          </button>

          {showAdvanced && (
            <input
              className="mt-2 w-full rounded-lg border border-claude-border bg-claude-bg p-3 text-sm text-claude-text placeholder-claude-text-secondary focus:border-claude-orange/50 focus:outline-none"
              placeholder={fr.noSession.cwdLabel}
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
            />
          )}
        </div>

        <button
          type="button"
          className="mt-3 rounded-lg bg-claude-orange px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-claude-orange/80 disabled:opacity-50"
          disabled={!prompt.trim() || isStarting}
          onClick={handleStart}
        >
          {isStarting ? fr.noSession.starting : fr.noSession.startButton}
        </button>

        {error && (
          <p className="mt-2 text-sm text-red-400">{error}</p>
        )}
      </div>

      <div className="fixed bottom-6 flex items-center gap-2 text-xs text-claude-text-secondary">
        <WsStatusDot status={wsStatus} />
        {fr.ws[wsStatus]}
      </div>
    </div>
  );
}
