import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ApiError } from "./api";
import "./i18n";
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
    // A rejected session sends the browser back to sign-in.
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        void queryClient.invalidateQueries({ queryKey: ["status"] });
      }
    },
  }),
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
