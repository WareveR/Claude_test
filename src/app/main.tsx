import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ApiError } from "./api";
import { ErrorNotices } from "./errors/ErrorNotices";
import { reportFailure, watchForErrors } from "./errors/store";
import i18n from "./i18n";
import "./index.css";

const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // An answer like 401 or 404 won't change by asking again.
      retry: (failures, error) =>
        !(error instanceof ApiError && error.status < 500) && failures < 3,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      // A rejected session sends the browser back to sign-in.
      if (error instanceof ApiError && error.status === 401) {
        void queryClient.invalidateQueries({ queryKey: ["status"] });
      }
      reportFailure(error, "load", `load ${JSON.stringify(query.queryKey)}`);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => reportFailure(error, "save"),
  }),
});

/** A crash while drawing a screen: logged, with a way back. */
class CrashBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch(error: unknown) {
    reportFailure(error, "app", `render ${window.location.pathname}`);
  }
  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <main className="flex flex-col items-center gap-3 p-8">
        <p>{i18n.t("errors.notice.app")}</p>
        <button type="button" className="underline" onClick={() => window.location.reload()}>
          {i18n.t("errors.reload")}
        </button>
      </main>
    );
  }
}

watchForErrors();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <CrashBoundary>
        <App />
      </CrashBoundary>
      <ErrorNotices />
    </QueryClientProvider>
  </StrictMode>,
);
