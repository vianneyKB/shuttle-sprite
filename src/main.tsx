// import { createRoot } from "react-dom/client";
// import App from "./App.tsx";
// import "leaflet/dist/leaflet.css";
// import "./index.css";
// import { BrowserRouter } from "react-router-dom";

// createRoot(document.getElementById("root")!).render(
//     <BrowserRouter basename="/shuttle-sprite">
//       <App />
//     </BrowserRouter>);

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AppProvider } from "@/context/AppContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename="/shuttle-sprite">
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
);

const redirect = sessionStorage.redirect;

delete sessionStorage.redirect;

if (redirect && redirect !== location.href) {
  history.replaceState(null, "", redirect);
}