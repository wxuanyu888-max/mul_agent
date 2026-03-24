import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  // React.StrictMode 已移除，避免开发模式下重复调用 useEffect
  <App />
);
