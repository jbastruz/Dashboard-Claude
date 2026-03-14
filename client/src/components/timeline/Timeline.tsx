import { useMemo } from "react";
import { useInteractionStore } from "../../stores/interactionStore";
import { fr } from "../../lib/fr";
import TimelineEvent from "./TimelineEvent";

export default function Timeline() {
  const interactions = useInteractionStore((s) => s.interactions);

  const sorted = useMemo(
    () =>
      [...interactions].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [interactions],
  );

  if (sorted.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-claude-text-secondary">{fr.timeline.noEvents}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
      {sorted.map((interaction) => (
        <TimelineEvent key={interaction.id} interaction={interaction} />
      ))}
    </div>
  );
}
