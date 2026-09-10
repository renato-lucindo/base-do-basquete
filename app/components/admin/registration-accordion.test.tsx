import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RegistrationAccordion } from "./registration-accordion";

function render(open: boolean) {
  return renderToStaticMarkup(
    <RegistrationAccordion
      id={42}
      name="Equipe exemplo"
      status="confirmed"
      playerCount={12}
      open={open}
      onToggle={() => {}}
      roster={<input name="jersey" defaultValue="10" />}
      situation={<p>Alterar situação</p>}
      result={<p>Confirmar resultado</p>}
    />,
  );
}

describe("registration accordion", () => {
  it("hides the panel while retaining its form and accessible heading relationship", () => {
    const html = render(false);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="registration-panel-42"');
    expect(html).toContain('aria-labelledby="registration-toggle-42" hidden=""');
    expect(html).toContain('name="jersey"');
    expect(html).toContain("Confirmada · 12 atletas ativos");
  });

  it("opens the roster alone and keeps the other sections hidden", () => {
    const html = render(true);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('<section id="registration-42-roster">');
    expect(html).toContain('<section id="registration-42-situation" hidden="">');
    expect(html).toContain('<section id="registration-42-result" hidden="">');
  });
});
