import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [{ rel: "icon", href: "/favicon.svg" }];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#08110d" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Algo saiu do compasso";
  let detail = "Não foi possível concluir esta jogada.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Página fora de quadra" : `Erro ${error.status}`;
    detail =
      error.status === 404
        ? "O endereço informado não existe. Volte para a página inicial."
        : error.statusText || detail;
  }

  return (
    <main className="error-shell">
      <div className="error-card">
        <span className="eyebrow">Base do Basquete</span>
        <h1>{title}</h1>
        <p>{detail}</p>
        <a className="button button-primary" href="/">
          Voltar ao início
        </a>
      </div>
    </main>
  );
}
