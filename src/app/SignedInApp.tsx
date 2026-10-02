import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router";
import type { Device, Family } from "./api";
import { SignedInContext } from "./family";
import { deviceLanguage } from "./i18n";
import { PersonPage } from "./persons/PersonForm";
import { SettingsPage } from "./settings/SettingsPage";
import { Header } from "./shell/Header";
import { DayView, MonthView, TasksView, TodayRedirect, WeekView, YearView } from "./views/Views";

function Layout() {
  return (
    <div className="min-h-dvh">
      <Header />
      <Outlet />
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
      { path: "/settings", element: <SettingsPage /> },
      { path: "/settings/persons/:id", element: <PersonPage /> },
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
