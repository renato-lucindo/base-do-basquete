import { useEffect, useRef, useState } from "react";
import { Form, Link, useNavigation } from "react-router";
import {
  categoryLabel,
  disputeName,
  masterAges,
  type AgeKind,
  type EditionWorkflowInput,
} from "../../modules/competition/edition-workflow";
import { AdminWizardSteps } from "./admin-wizard-steps";

export interface EditionChoices {
  available: boolean;
  selectedSeasonId: number | null;
  csrfToken: string;
  requestId: string;
  currentYear: number;
  series: { id: number; name: string }[];
  categories: { id: number; name: string; age_kind: string; age_value: number | null }[];
  profiles: {
    id: number;
    series_id: number;
    category_id: number;
    gender_division: string;
    primary_source: string;
    version: number;
  }[];
  seasons: {
    id: number;
    series_id: number;
    name: string;
    year: number;
    gender_division: string;
    description: string | null;
    suggested_starts_on: string | null;
    suggested_ends_on: string | null;
  }[];
  divisionTypes: { id: number; season_id: number; name: string }[];
  divisions: {
    id: number;
    season_id: number;
    competitive_division_type_id: number;
    name: string;
    sort_order: number;
  }[];
}
export interface EditionResult {
  error: string | null;
  field: string | null;
  existingSeasonId: number | null;
  review: {
    input: EditionWorkflowInput;
    name: string;
    summary: { rounds: number; matchups: number; byes: number };
  } | null;
}
export function EditionWizard({
  choices,
  result,
}: {
  choices: EditionChoices;
  result?: EditionResult;
}) {
  const season = choices.seasons.find((item) => item.id === choices.selectedSeasonId);
  const [step, setStep] = useState(1);
  const [requestId] = useState(choices.requestId);
  const [seriesId, setSeriesId] = useState(season ? String(season.series_id) : "");
  const [championshipName, setChampionshipName] = useState("");
  const [kind, setKind] = useState<AgeKind>("adult");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState(season?.gender_division ?? "");
  const [divisionMode, setDivisionMode] = useState("none");
  const [divisionId, setDivisionId] = useState("");
  const [divisionValueName, setDivisionValueName] = useState("");
  const type = choices.divisionTypes.find((item) => item.season_id === season?.id);
  const [divisionTypeName, setDivisionTypeName] = useState(type?.name ?? "");
  const [sourceOverride, setSourceOverride] = useState("");
  const region = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const error = useRef<HTMLParagraphElement>(null);
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const category = choices.categories.find(
    (item) => item.age_kind === kind && item.age_value === (kind === "adult" ? null : Number(age)),
  );
  const profile = choices.profiles.find(
    (item) =>
      item.series_id === Number(seriesId) &&
      item.category_id === category?.id &&
      item.gender_division === gender,
  );
  const selectedDivision = choices.divisions.find((item) => item.id === Number(divisionId));
  const preview = disputeName(
    season?.name ??
      choices.series.find((item) => item.id === Number(seriesId))?.name ??
      championshipName,
    kind,
    kind === "adult" ? null : age ? Number(age) : null,
    divisionMode === "new" && divisionValueName
      ? `${divisionTypeName} ${divisionValueName}`
      : divisionMode === "existing" && selectedDivision
        ? `${type?.name} ${selectedDivision.name}`
        : undefined,
  );
  const invalid = (field: string) => ({
    "aria-invalid": result?.field === field || undefined,
    "aria-describedby": result?.field === field ? "edition-error" : undefined,
  });
  useEffect(() => {
    if (result?.error && !result.review)
      setStep(["source", "entryCount", "reason"].includes(result.field ?? "") ? 2 : 1);
    else if (result?.review) setStep(3);
  }, [result]);
  useEffect(() => {
    if (result?.error) error.current?.focus();
    else if (step === 3) heading.current?.focus();
    else
      region.current?.querySelector<HTMLFieldSetElement>(`fieldset[data-step="${step}"]`)?.focus();
  }, [step, result]);
  return (
    <>
      <p>
        {season
          ? "A disputa herda a edição; equipes, formato e resultados permanecem independentes."
          : "Crie uma edição com sua primeira disputa. Campeonato, ano e naipe identificam a edição."}{" "}
        Tudo começa como rascunho privado.
      </p>
      {!choices.available ? (
        <p role="status">
          O novo fluxo aguarda aplicação autorizada da migration. A criação está indisponível;
          nenhum dado será alterado.
        </p>
      ) : null}
      <AdminWizardSteps
        current={step}
        labels={["Identificação", "Dados e formato", "Revisão"]}
        onSelect={(value) => {
          if (value < 3 || result?.review) setStep(value);
        }}
      />
      {result?.error ? (
        <p id="edition-error" ref={error} tabIndex={-1} role="alert" className="form-error">
          {result.error}
        </p>
      ) : null}
      {result?.existingSeasonId ? (
        <Link to={`/admin/competitions/new?seasonId=${result.existingSeasonId}`}>
          Adicionar disputa à edição existente
        </Link>
      ) : null}
      <div ref={region}>
        <Form
          method="post"
          noValidate
          className="compact-admin-form edition-wizard-form"
          hidden={step === 3 && Boolean(result?.review)}
        >
          <input type="hidden" name="csrfToken" value={choices.csrfToken} />
          <input type="hidden" name="intent" value="review" />
          <input type="hidden" name="seasonId" value={season?.id ?? ""} />
          <input type="hidden" name="expectedProfileId" value={profile?.id ?? ""} />
          <fieldset
            tabIndex={-1}
            data-step="1"
            hidden={step !== 1}
            disabled={!choices.available || busy}
          >
            <legend>Identificação {season ? "da disputa" : "da edição"}</legend>
            {season ? (
              <p>
                Campeonato: {choices.series.find((item) => item.id === season.series_id)?.name} ·
                Edição: {season.name}
              </p>
            ) : (
              <>
                <label htmlFor="seriesId">Campeonato</label>
                <select
                  id="seriesId"
                  name="seriesId"
                  value={seriesId}
                  onChange={(event) => {
                    setSeriesId(event.target.value);
                    setSourceOverride("");
                  }}
                  required
                  {...invalid("seriesId")}
                >
                  <option value="">Selecione</option>
                  <option value="new">Novo campeonato</option>
                  {choices.series.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <label htmlFor="championshipName">Nome</label>
                <input
                  id="championshipName"
                  name="championshipName"
                  value={
                    seriesId === "new"
                      ? championshipName
                      : (choices.series.find((item) => item.id === Number(seriesId))?.name ?? "")
                  }
                  readOnly={seriesId !== "new"}
                  onChange={(event) => setChampionshipName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={120}
                  {...invalid("championshipName")}
                />
                <p className="field-hint">
                  O nome é compartilhado pela edição. Categoria e divisão são acrescentadas
                  automaticamente à disputa.
                </p>
              </>
            )}
            <div className="edition-identification-row">
              <div>
                <label htmlFor="categoryKind">Categoria</label>
                <select
                  id="categoryKind"
                  name="categoryKind"
                  value={kind}
                  onChange={(event) => {
                    setKind(event.target.value as AgeKind);
                    setAge("");
                    setSourceOverride("");
                  }}
                  {...invalid("categoryKind")}
                >
                  <option value="adult">Adulto</option>
                  <option value="base">Base</option>
                  <option value="master">Master</option>
                </select>
                {kind !== "adult" ? (
                  <>
                    <label htmlFor="categoryAge">
                      {kind === "base" ? "Idade da categoria" : "Idade mínima"}
                    </label>
                    {kind === "base" ? (
                      <input
                        id="categoryAge"
                        name="categoryAge"
                        type="number"
                        min={12}
                        max={23}
                        step={1}
                        required
                        value={age}
                        onChange={(event) => {
                          setAge(event.target.value);
                        }}
                        {...invalid("categoryAge")}
                      />
                    ) : (
                      <select
                        id="categoryAge"
                        name="categoryAge"
                        required
                        value={age}
                        onChange={(event) => {
                          setAge(event.target.value);
                        }}
                        {...invalid("categoryAge")}
                      >
                        <option value="">Selecione</option>
                        {masterAges.map((value) => (
                          <option key={value} value={value}>
                            {value}+
                          </option>
                        ))}
                      </select>
                    )}
                  </>
                ) : null}
              </div>
              <div>
                <label htmlFor="gender">Naipe</label>
                <select
                  id="gender"
                  name="gender"
                  value={gender}
                  disabled={Boolean(season)}
                  onChange={(event) => {
                    setGender(event.target.value);
                    setSourceOverride("");
                  }}
                  required
                  {...invalid("gender")}
                >
                  <option value="">Selecione sem inferir</option>
                  <option value="male">Masculino</option>
                  <option value="female">Feminino</option>
                </select>
                {season ? <input type="hidden" name="gender" value={gender} /> : null}
              </div>
            </div>
            <div className="edition-period-row">
              <label>
                Ano
                <input
                  id="year"
                  name="year"
                  type="number"
                  min={1900}
                  max={choices.currentYear + 1}
                  required
                  readOnly={Boolean(season)}
                  defaultValue={season?.year ?? choices.currentYear}
                  {...invalid("year")}
                />
              </label>
              <label>
                Início (opcional)
                <input
                  id="startsOn"
                  name="startsOn"
                  type="date"
                  defaultValue={season?.suggested_starts_on ?? ""}
                  {...invalid("startsOn")}
                />
              </label>
              <label>
                Término (opcional)
                <input
                  id="endsOn"
                  name="endsOn"
                  type="date"
                  defaultValue={season?.suggested_ends_on ?? ""}
                  {...invalid("endsOn")}
                />
              </label>
            </div>
            <label>
              Descrição compartilhada (opcional)
              <textarea
                id="description"
                name="description"
                maxLength={2000}
                defaultValue={season?.description ?? ""}
                readOnly={Boolean(season)}
                {...invalid("description")}
              />
            </label>
            <details>
              <summary>Divisão competitiva (opcional)</summary>
              <div>
                <label htmlFor="divisionMode">Divisão</label>
                <select
                  id="divisionMode"
                  name="divisionMode"
                  value={divisionMode}
                  onChange={(event) => setDivisionMode(event.target.value)}
                  {...invalid("divisionMode")}
                >
                  <option value="none">Sem divisão</option>
                  {season && choices.divisions.some((item) => item.season_id === season.id) ? (
                    <option value="existing">Usar divisão existente</option>
                  ) : null}
                  <option value="new">Criar divisão</option>
                </select>
              </div>
              {divisionMode === "existing" ? (
                <div>
                  <label htmlFor="divisionValueId">Valor</label>
                  <select
                    id="divisionValueId"
                    name="divisionValueId"
                    value={divisionId}
                    onChange={(event) => setDivisionId(event.target.value)}
                    required
                    {...invalid("divisionValueId")}
                  >
                    <option value="">Selecione</option>
                    {choices.divisions
                      .filter((item) => item.season_id === season?.id)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {type?.name} {item.name}
                        </option>
                      ))}
                  </select>
                </div>
              ) : null}
              {divisionMode === "new" ? (
                <div className="edition-identification-row">
                  <label>
                    Tipo
                    <input
                      name="divisionTypeName"
                      value={divisionTypeName}
                      readOnly={Boolean(type)}
                      onChange={(event) => setDivisionTypeName(event.target.value)}
                      required
                      minLength={2}
                      maxLength={80}
                    />
                  </label>
                  <label>
                    Valor
                    <input
                      id="divisionValueName"
                      name="divisionValueName"
                      value={divisionValueName}
                      onChange={(event) => setDivisionValueName(event.target.value)}
                      required
                      maxLength={80}
                      {...invalid("divisionValueName")}
                    />
                  </label>
                </div>
              ) : null}
            </details>
            <p aria-live="polite">
              Nome da disputa: {preview || "selecione ou informe o campeonato"}
            </p>
            <button type="button" className="button" onClick={() => setStep(2)}>
              Continuar
            </button>
          </fieldset>
          <fieldset
            tabIndex={-1}
            data-step="2"
            hidden={step !== 2}
            disabled={!choices.available || busy}
          >
            <legend>Dados e formato</legend>
            <p>
              {profile
                ? `Perfil ativo: versão ${profile.version}.`
                : "Sem perfil ativo. Escolha explicitamente a fonte para a primeira disputa dessa categoria e naipe."}
            </p>
            <label>
              Fonte primária
              <select
                id="source"
                name="source"
                value={sourceOverride || profile?.primary_source || ""}
                onChange={(event) => setSourceOverride(event.target.value)}
                required
                {...invalid("source")}
              >
                <option value="">Selecione</option>
                <option value="manual_scoresheet">Súmula manual</option>
                <option value="fiba_boxscore">Boxscore PDF</option>
              </select>
            </label>
            <label>
              Justificativa para mudar a fonte (se aplicável)
              <textarea
                id="reason"
                name="reason"
                minLength={10}
                maxLength={500}
                {...invalid("reason")}
              />
            </label>
            <p>
              Mudar a fonte cria uma versão para futuras disputas; o histórico mantém sua versão
              anterior.
            </p>
            <div>
              <label htmlFor="preset">Formato</label>
              <select id="preset" name="preset" required defaultValue="">
                <option value="">Selecione</option>
                <option value="single_group">Grupo único — turno único</option>
                <option value="single_elimination">Eliminatória simples — jogo único</option>
              </select>
            </div>
            <label>
              Quantidade de equipes
              <input
                id="entryCount"
                name="entryCount"
                type="number"
                min={2}
                max={16}
                required
                {...invalid("entryCount")}
              />
            </label>
            <p>
              As posições serão reservadas. Nenhuma equipe, jogo ou publicação será criado
              automaticamente.
            </p>
            <div className="inline-admin-form">
              <button type="button" className="button button-ghost" onClick={() => setStep(1)}>
                Voltar
              </button>
              <button type="submit" className="button" disabled={busy}>
                {busy ? "Validando…" : "Revisar estrutura"}
              </button>
            </div>
          </fieldset>
        </Form>
      </div>
      {step === 3 && result?.review ? (
        <section aria-label="Revisão da criação">
          <h2 ref={heading} tabIndex={-1}>
            {result.review.name}
          </h2>
          <p>
            {result.review.input.year} ·{" "}
            {result.review.input.gender === "male" ? "Masculino" : "Feminino"} ·{" "}
            {categoryLabel(result.review.input.categoryKind, result.review.input.categoryAge)} ·
            Rascunho privado
          </p>
          <p>{result.review.input.description}</p>
          <p>
            {result.review.input.startsOn ?? "Início pendente"} a{" "}
            {result.review.input.endsOn ?? "término pendente"}
          </p>
          <p>
            {result.review.input.source === "manual_scoresheet" ? "Súmula manual" : "Boxscore PDF"}{" "}
            ·{" "}
            {result.review.input.preset === "single_group" ? "Grupo único" : "Eliminatória simples"}
          </p>
          <p>
            {result.review.input.entryCount} equipes · {result.review.summary.rounds} rodadas ·{" "}
            {result.review.summary.matchups} confrontos · {result.review.summary.byes} folgas
          </p>
          <Form method="post" className="compact-admin-form">
            <input type="hidden" name="csrfToken" value={choices.csrfToken} />
            <input type="hidden" name="intent" value="create" />
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="payload" value={JSON.stringify(result.review.input)} />
            <label>
              <input
                id="reviewed"
                type="checkbox"
                name="reviewed"
                required
                {...invalid("reviewed")}
              />{" "}
              Revisei a edição, o naipe, a categoria, a divisão, a fonte e o formato. Confirmo a
              criação privada.
            </label>
            <div className="inline-admin-form">
              <button type="button" className="button button-ghost" onClick={() => setStep(1)}>
                Editar
              </button>
              <button type="submit" className="button" disabled={busy || !choices.available}>
                {busy ? "Criando…" : season ? "Criar disputa privada" : "Criar edição privada"}
              </button>
            </div>
          </Form>
        </section>
      ) : null}
      <Link to="/admin/competitions">Voltar às competições</Link>
    </>
  );
}
