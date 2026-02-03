import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import App from "./components/App";
import ResultsPage from "./pages/ResultsPage";
import RunDetailPage from "./pages/RunDetailPage";
import "./base.css";

// Simple client-side routing
function getComponentAndProps() {
  const pathname = window.location.pathname;

  if (pathname === '/results') {
    return { Component: ResultsPage, props: {} };
  } else if (pathname.startsWith('/results/')) {
    // Extract run ID from URL like /results/abc-123-def
    const runId = pathname.split('/results/')[1];
    return { Component: RunDetailPage, props: { runId } };
  } else {
    return { Component: App, props: {} };
  }
}

const { Component, props } = getComponentAndProps();

ReactDOM.hydrateRoot(
  document.getElementById("root"),
  <StrictMode>
    <Component {...props} />
  </StrictMode>,
);
