import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import App from "./components/App";
import ResultsPage from "./pages/ResultsPage";
import "./base.css";

// Simple client-side routing
function getComponent() {
  const pathname = window.location.pathname;

  if (pathname === '/results') {
    return ResultsPage;
  } else {
    return App;
  }
}

const Component = getComponent();

ReactDOM.hydrateRoot(
  document.getElementById("root"),
  <StrictMode>
    <Component />
  </StrictMode>,
);
