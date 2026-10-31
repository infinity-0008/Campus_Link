import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router.jsx";
import Providers from "@/app/providers.jsx";
import "@/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Providers><RouterProvider router={router} /></Providers>
  </React.StrictMode>,
);
