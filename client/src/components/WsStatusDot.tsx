import type { WsStatus } from "../api/ws";
import { fr } from "../lib/fr";

interface WsStatusDotProps {
  status: WsStatus;
}

const STATUS_COLORS: Record<WsStatus, string> = {
  connected: "bg-emerald-400",
  connecting: "bg-amber-400",
  reconnecting: "bg-amber-400",
  disconnected: "bg-red-400",
};

export default function WsStatusDot({ status }: WsStatusDotProps) {
  return (
    <div className="flex items-center gap-2" title={fr.ws[status]}>
      <span className={`inline-block h-2 w-2 rounded-full ${STATUS_COLORS[status]}`} />
    </div>
  );
}
