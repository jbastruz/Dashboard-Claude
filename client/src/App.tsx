import { useWebSocket } from "./hooks/useWebSocket";
import { useActiveSession } from "./stores/sessionStore";
import NoSessionScreen from "./components/screens/NoSessionScreen";
import Shell from "./components/layout/Shell";

export default function App() {
  useWebSocket();
  const activeSession = useActiveSession();

  if (!activeSession) {
    return <NoSessionScreen />;
  }

  return <Shell session={activeSession} />;
}
