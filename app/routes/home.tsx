import type { Route } from "./+types/home";
import { cloudflareContext } from "../context";

const foundations = [
  {
    marker: "01",
    title: "Memória organizada",
    description: "Campeonatos, equipes, atletas e jogos conectados em uma linha histórica única.",
  },
  {
    marker: "02",
    title: "Estatística confiável",
    description: "Cálculos e registros serão validados no servidor e reforçados no banco de dados.",
  },
  {
    marker: "03",
    title: "Origem verificável",
    description: "Importações rastreáveis e auditoria essencial para preservar cada resultado.",
  },
] as const;

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Base do Basquete — O jogo fica na história" },
    {
      name: "description",
      content: "Arquivo vivo de campeonatos, equipes, atletas, jogos e estatísticas do basquete.",
    },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);

  return {
    environment: String(env.APP_ENV),
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Base do Basquete — página inicial">
          <span className="brand-mark" aria-hidden="true">
            BB
          </span>
          <span>Base do Basquete</span>
        </a>
        <span className="environment-pill">
          <span className="status-dot" aria-hidden="true" />
          {loaderData.environment === "production" ? "Produção" : "Preview ativo"}
        </span>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="court-lines" aria-hidden="true">
          <span className="court-circle" />
          <span className="court-arc" />
        </div>
        <div className="hero-copy">
          <p className="eyebrow">Arquivo vivo do basquete</p>
          <h1 id="hero-title">
            O jogo passa.
            <span>A história fica.</span>
          </h1>
          <p className="hero-intro">
            Uma base confiável para reunir campeonatos, equipes, atletas, partidas e estatísticas —
            com contexto, origem e memória.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#fundamentos">
              Conhecer a base
            </a>
            <a className="button button-ghost" href="/health">
              Ver saúde do sistema
            </a>
          </div>
        </div>
        <aside className="score-card" aria-label="Placar conceitual da plataforma">
          <div className="score-card-topline">
            <span>Temporada inaugural</span>
            <span>Q1</span>
          </div>
          <div className="score">
            <div>
              <span className="score-label">Dados dispersos</span>
              <strong>00</strong>
            </div>
            <span className="score-divider">—</span>
            <div>
              <span className="score-label">Memória preservada</span>
              <strong>24</strong>
            </div>
          </div>
          <div className="score-footer">
            <span>Infraestrutura online</span>
            <span className="live-mark">AO VIVO</span>
          </div>
        </aside>
      </section>

      <section className="foundations" id="fundamentos" aria-labelledby="foundations-title">
        <div className="section-heading">
          <p className="eyebrow">Fundamentos</p>
          <h2 id="foundations-title">Construída para dados que precisam durar.</h2>
        </div>
        <div className="foundation-grid">
          {foundations.map((foundation) => (
            <article className="foundation-card" key={foundation.marker}>
              <span className="card-marker">{foundation.marker}</span>
              <h3>{foundation.title}</h3>
              <p>{foundation.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <span>Base do Basquete</span>
        <span>Dados com contexto. História com fundamento.</span>
      </footer>
    </main>
  );
}
