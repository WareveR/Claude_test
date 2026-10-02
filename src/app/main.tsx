import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ApiError, NetworkError } from "./api";
import { ErrorNotices } from "./errors/ErrorNotices";
import { reportFailure, watchForErrors } from "./errors/store";
import i18n from "./i18n";
import { persistOptions, wipeOfflineCopy } from "./offline/persist";
import { registerServiceWorker } from "./offline/service-worker";
import "./index.css";

const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // An answer like 401 or 404 won't change by asking again.
      retry: (failures, error) =>
        !(error instanceof ApiError && error.status < 500) && failures < 3,
      // Refresh every minute and on focus; there is no live connection.
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
      // Kept as long as the offline copy, so it can be read without a connection.
      gcTime: persistOptions.maxAge,
    },
    mutations: {
      // An edit tried offline fails at once with "No connection" instead of waiting.
      networkMode: "always",
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      // A rejected session wipes the offline copy and sends the browser back to sign-in.
      if (error instanceof ApiError && error.status === 401) {
        wipeOfflineCopy(queryClient);
        void queryClient.invalidateQueries({ queryKey: ["status"] });
      }
      // Offline the banner already says so; a refresh that can't connect isn't news.
      if (error instanceof NetworkError && !navigator.onLine) return;
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
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <CrashBoundary>
        <App />
      </CrashBoundary>
      <ErrorNotices />
    </PersistQueryClientProvider>
  </StrictMode>,
);
