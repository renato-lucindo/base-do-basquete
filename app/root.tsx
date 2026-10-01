import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import type { Route } from "./+types/root";
import { PublicFooter } from "./components/public-navigation";
import { SiennaAccessibility } from "./components/sienna-accessibility";
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
        <a className="skip-link" href="#main-content">
          Pular para o conteúdo principal
        </a>
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
        <SiennaAccessibility />
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
  const location = useLocation();
  let title = "Algo saiu do compasso";
  let detail = "Não foi possível concluir esta jogada.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Página fora de quadra" : `Erro ${error.status}`;
    detail =
      error.status === 404
        ? "O endereço informado não existe. Volte para a página inicial."
        : error.statusText || detail;
  }

  const content = (
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

  if (location.pathname.startsWith("/admin") || location.pathname.startsWith("/api/")) {
    return content;
  }

  return (
    <div className="public-shell public-error-page">
      {content}
      <PublicFooter />
    </div>
  );
}
