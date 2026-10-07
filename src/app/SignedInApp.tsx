import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from "react-router";
import { displayAllows } from "../core/display";
import type { Device, Family } from "./api";
import { DisplayBoard } from "./display/DisplayBoard";
import { DisplayEffects } from "./display/DisplayEffects";
import { EntryDetails } from "./display/EntryDetails";
import { useDisplayMode } from "./display/mode";
import { paths } from "./paths";
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

/** On a wall tablet the entry address shows read-only details instead of the form. */
function EntryRoute() {
  return useDisplayMode() ? <EntryDetails /> : <EntryPage />;
}

function Layout() {
  const display = useDisplayMode();
  const { pathname } = useLocation();
  // A Display Mode device only ever opens the board (and an Entry's details); the board is
  // nothing to a device that is not in Display Mode.
  if (display && !displayAllows(pathname)) return <Navigate to={paths.display()} replace />;
  if (!display && pathname === paths.display()) return <Navigate to={paths.today()} replace />;
  return (
    <div className="flex h-dvh flex-col">
      {display && <DisplayEffects />}
      <Header showVoice={!display} />
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
      { path: "/entries/:id", element: <EntryRoute /> },
      { path: paths.display(), element: <DisplayBoard /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/settings/:area", element: <SettingsPage /> },
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
  const display = useDisplayMode();
  // Display Mode enlarges the text of the whole app.
  useEffect(() => {
    document.documentElement.classList.toggle("display-mode", display);
  }, [display]);
  const value = useMemo(() => ({ family, device, language }), [family, device, language]);

  return (
    <SignedInContext.Provider value={value}>
      <RouterProvider router={router} />
    </SignedInContext.Provider>
  );
}
