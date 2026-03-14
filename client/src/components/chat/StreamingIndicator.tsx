export default function StreamingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      <span className="h-2 w-2 rounded-full bg-claude-orange animate-bounce [animation-delay:0ms]" />
      <span className="h-2 w-2 rounded-full bg-claude-orange animate-bounce [animation-delay:150ms]" />
      <span className="h-2 w-2 rounded-full bg-claude-orange animate-bounce [animation-delay:300ms]" />
    </div>
  );
}
