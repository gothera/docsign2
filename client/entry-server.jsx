import { StrictMode } from "react";
import {StaticRouter} from "react-router-dom/server.mjs";
import { renderToString } from "react-dom/server";
import App from "./components/App";
import Router from "./router";

export function render() {
  const html = renderToString(
    <StrictMode>
      <StaticRouter>
        <Router />
      </StaticRouter>
    </StrictMode>,
  );
  return { html };
}
