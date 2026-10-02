import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router";
import type { Device, Family } from "./api";
import { SignedInContext } from "./family";
import { deviceLanguage } from "./i18n";
import { EntryPage } from "./entries/EntryForm";
import { EntryTypePage } from "./entry-types/EntryTypeForm";
import { PersonPage } from "./persons/PersonForm";
import { ErrorLogPage } from "./settings/ErrorLogPage";
import { SettingsPage } from "./settings/SettingsPage";
import { Header } from "./shell/Header";
import { OfflineBanner } from "./offline/OfflineBanner";
import { ChecklistPage } from "./checklists/ChecklistForm";
import { TaskPage } from "./tasks/TaskForm";
import { TasksView } from "./tasks/TasksView";
import { DayView, MonthView, TodayRedirect, WeekView, YearView } from "./views/Views";

function Layout() {
  return (
    <div className="flex h-dvh flex-col">
      <Header />
      <OfflineBanner />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <TodayRedirect /> },
      { path: "/day/:date", element: <DayView /> },
      { path: "/week/:date", element: <WeekView /> },
      { path: "/month/:month", element: <MonthView /> },
      { path: "/year/:year", element: <YearView /> },
      { path: "/tasks", element: <TasksView /> },
      { path: "/tasks/:id", element: <TaskPage /> },
      { path: "/checklists/:id", element: <ChecklistPage /> },
      { path: "/entries/:id", element: <EntryPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/settings/errors", element: <ErrorLogPage /> },
      { path: "/settings/persons/:id", element: <PersonPage /> },
      { path: "/settings/entry-types/:id", element: <EntryTypePage /> },
      { path: "*", element: <TodayRedirect /> },
    ],
  },
]);

export function SignedInApp({ family, device }: { family: Family; device: Device }) {
  const { i18n } = useTranslation();
  const language = deviceLanguage(device.language, family.language);
  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language);
    document.documentElement.lang = language;
  }, [i18n, language]);
  const value = useMemo(() => ({ family, device, language }), [family, device, language]);

  return (
    <SignedInContext.Provider value={value}>
      <RouterProvider router={router} />
    </SignedInContext.Provider>
  );
}
