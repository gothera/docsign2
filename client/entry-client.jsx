import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import App from "./components/App";
import "./base.css";
import { BrowserRouter } from "react-router-dom";

import Router from './router';

ReactDOM.hydrateRoot(
  document.getElementById("root"),
  <StrictMode>
    <BrowserRouter>
      <Router />
    </BrowserRouter>
  </StrictMode>,
);