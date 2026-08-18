import { useEffect, type ReactElement } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { EditorPage } from './pages/EditorPage';
import { ExamplesPage } from './pages/ExamplesPage';
import { ExampleDetailPage } from './pages/ExampleDetailPage';
import { ExampleEditorPage } from './pages/ExampleEditorPage';
import { ProjectByIdPage } from './pages/ProjectByIdPage';
import { LocaleSync } from './i18n/LocaleSync';
import { NON_DEFAULT_LOCALES } from './i18n/config';
import { MessageDialogHost } from './components/ui/MessageDialogHost';
import './App.css';

const ROUTES: { path: string; element: ReactElement; index?: boolean }[] = [
  { path: '/', element: <Navigate to="/editor" replace />, index: true },
  { path: 'editor', element: <EditorPage /> },
  { path: 'examples', element: <ExamplesPage /> },
  { path: 'examples/:exampleId', element: <ExampleDetailPage /> },
  { path: 'example/:exampleId', element: <ExampleEditorPage /> },
  { path: 'project/:id', element: <ProjectByIdPage /> },
];

function EnPrefixRedirect() {
  const { pathname, search, hash } = useLocation();
  const stripped = pathname.replace(/^\/en(?=\/|$)/, '');
  return <Navigate to={(stripped || '/') + search + hash} replace />;
}

function App() {
  useEffect(() => {
    document.getElementById('root-seo')?.remove();
  }, []);

  return (
    <Router>
      <LocaleSync>
        <Routes>
          {ROUTES.map((route) =>
            route.index ? (
              <Route key="root" path="/" element={route.element} />
            ) : (
              <Route key={route.path} path={`/${route.path}`} element={route.element} />
            ),
          )}
          {NON_DEFAULT_LOCALES.map((locale) => (
            <Route key={`locale-${locale}`} path={`/${locale}`}>
              {ROUTES.map((route) =>
                route.index ? (
                  <Route key={`${locale}-root`} index element={route.element} />
                ) : (
                  <Route key={`${locale}-${route.path}`} path={route.path} element={route.element} />
                ),
              )}
            </Route>
          ))}
          <Route path="/en/*" element={<EnPrefixRedirect />} />
        </Routes>
      </LocaleSync>
      <MessageDialogHost />
    </Router>
  );
}

export default App;
