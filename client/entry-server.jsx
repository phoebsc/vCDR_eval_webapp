import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import App from "./components/App";
import ResultsPage from "./pages/ResultsPage";

export function render(url = '/') {
  let Component;

  // Simple routing based on URL
  if (url === '/results') {
    Component = ResultsPage;
  } else {
    Component = App;
  }

  const html = renderToString(
    <StrictMode>
      <Component />
    </StrictMode>,
  );
  return { html };
}
