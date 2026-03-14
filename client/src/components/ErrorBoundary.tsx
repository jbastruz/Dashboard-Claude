import { Component, type ReactNode } from "react";
import { fr } from "../lib/fr";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center p-8" role="alert">
          <div className="max-w-lg rounded-lg border border-red-500/40 bg-red-500/10 p-6">
            <h2 className="mb-2 text-lg font-semibold text-red-400">
              {fr.error.renderError}
            </h2>
            <pre className="whitespace-pre-wrap text-sm text-red-300">
              {this.state.error.message}
            </pre>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-red-300/60">
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 rounded bg-red-500/20 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/30"
            >
              {fr.error.retry}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
