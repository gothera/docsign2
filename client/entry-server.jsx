import { StrictMode } from "react";
import {StaticRouter} from "react-router-dom/server.mjs";
import { renderToString } from "react-dom/server";
import Router from "./router";

export function render(url) {  // Make sure url parameter is used
  const html = renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <Router />
      </StaticRouter>
    </StrictMode>,
  );
  return { html };
}