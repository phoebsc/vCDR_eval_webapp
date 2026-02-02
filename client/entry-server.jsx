import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import App from "./components/App";
import ResultsPage from "./pages/ResultsPage";
import RunDetailPage from "./pages/RunDetailPage";

export function render(url = '/') {
  let Component;
  let props = {};

  // Simple routing based on URL patterns
  if (url === '/results') {
    Component = ResultsPage;
  } else if (url.startsWith('/results/')) {
    // Extract run ID from URL like /results/abc-123-def
    const runId = url.split('/results/')[1];
    Component = RunDetailPage;
    props = { runId };
  } else {
    Component = App;
  }

  const html = renderToString(
    <StrictMode>
      <Component {...props} />
    </StrictMode>,
  );
  return { html };
}
