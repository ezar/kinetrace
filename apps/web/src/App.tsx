import type { JSX } from 'react';
import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { ProfilesScreen } from './screens/ProfilesScreen.js';
import { WelcomeScreen } from './screens/WelcomeScreen.js';
const ReviewScreen = lazy(() =>
  import('./screens/ReviewScreen.js').then((module) => ({ default: module.ReviewScreen })),
);
import { LibraryScreen } from './screens/LibraryScreen.js';
import { ExerciseDetailScreen } from './screens/ExerciseDetailScreen.js';
import { RoutineBuilderScreen } from './screens/RoutineBuilderScreen.js';
// Eager: it sits between tapping Start and the session, so a chunk to fetch
// here is a wait nobody asked for.
import { PrepareScreen } from './screens/PrepareScreen.js';
const SessionScreen = lazy(() =>
  import('./screens/SessionScreen.js').then((module) => ({ default: module.SessionScreen })),
);
const GuidedSessionScreen = lazy(() =>
  import('./screens/GuidedSessionScreen.js').then((module) => ({
    default: module.GuidedSessionScreen,
  })),
);
const SummaryScreen = lazy(() =>
  import('./screens/SummaryScreen.js').then((module) => ({ default: module.SummaryScreen })),
);
const ProgressScreen = lazy(() =>
  import('./screens/ProgressScreen.js').then((module) => ({ default: module.ProgressScreen })),
);
const SheetImportScreen = lazy(() =>
  import('./screens/SheetImportScreen.js').then((module) => ({
    default: module.SheetImportScreen,
  })),
);
import { SettingsScreen } from './screens/SettingsScreen.js';
import { HelpScreen } from './screens/HelpScreen.js';
const ReportScreen = lazy(() =>
  import('./screens/ReportScreen.js').then((module) => ({ default: module.ReportScreen })),
);
import { PrivacyScreen } from './screens/PrivacyScreen.js';
import { AboutScreen } from './screens/AboutScreen.js';
import { useSettingsStore } from './store/useSettingsStore.js';
import { BASE_PATH } from './assets.js';

export function App(): JSX.Element {
  const load = useSettingsStore((state) => state.load);
  const loaded = useSettingsStore((state) => state.loaded);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded) return <div className="p-8 text-muted">…</div>;

  return (
    <BrowserRouter basename={BASE_PATH}>
      {/* The camera, the charts and the import models are only loaded when the
          user actually opens those screens, which keeps the first load small. */}
      <Suspense fallback={<div className="p-8 text-muted">…</div>}>
        <Routes>
          {/* The first run, the session and its summary run full screen,
              without the navigation: each is one thing at a time. */}
          <Route path="/welcome" element={<WelcomeScreen />} />
          <Route path="/review/:routineId" element={<ReviewScreen />} />
          <Route path="/prepare/:routineId" element={<PrepareScreen />} />
          <Route path="/session/:routineId" element={<SessionScreen />} />
          <Route path="/guided/:routineId" element={<GuidedSessionScreen />} />
          <Route path="/summary/:sessionId" element={<SummaryScreen />} />
          <Route element={<Layout />}>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/profiles" element={<ProfilesScreen />} />
            <Route path="/library" element={<LibraryScreen />} />
            <Route path="/library/:exerciseId" element={<ExerciseDetailScreen />} />
            <Route path="/routines/new" element={<RoutineBuilderScreen />} />
            <Route path="/routines/:routineId" element={<RoutineBuilderScreen />} />
            <Route path="/progress" element={<ProgressScreen />} />
            <Route path="/import" element={<SheetImportScreen />} />
            <Route path="/report" element={<ReportScreen />} />
            <Route path="/help" element={<HelpScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="/settings/privacy" element={<PrivacyScreen />} />
            <Route path="/settings/about" element={<AboutScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
