import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "../../stores/useThemeStore";
import { fr } from "../../lib/fr";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  const label = theme === "dark" ? fr.header.lightMode : fr.header.darkMode;

  return (
    <button
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      className="flex items-center justify-center rounded-md p-1.5 text-claude-text-secondary transition-colors hover:bg-claude-surface-hover hover:text-claude-text"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
