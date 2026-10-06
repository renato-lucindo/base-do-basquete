import { useEffect, useRef, useState } from "react";
import { Form, Link, useNavigation } from "react-router";
import {
  categoryLabel,
  disputeName,
  masterAges,
  type AgeKind,
  type DisputeNavigationOrder,
  type DisputeWorkflowInput,
  type EditionBatchWorkflowInput,
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
    description: string | null;
    suggested_starts_on: string | null;
    suggested_ends_on: string | null;
    dispute_navigation_order: string;
  }[];
  divisionTypes: { id: number; season_id: number; name: string }[];
  divisions: {
    id: number;
    season_id: number;
    competitive_division_type_id: number;
    name: string;
    sort_order: number;
  }[];
  contexts: {
    competition_id: number | null;
    season_id: number | null;
    category_id: number | null;
    gender_division: string | null;
    competitive_division_value_id: number | null;
  }[];
}

export interface EditionResult {
  error: string | null;
  field: string | null;
  existingSeasonId: number | null;
  existingCompetitionId: number | null;
  review: {
    input: EditionBatchWorkflowInput;
    disputes: {
      input: DisputeWorkflowInput;
      name: string;
      summary: { rounds: number; matchups: number; byes: number };
    }[];
  } | null;
}

interface DisputeDraft {
  id: string;
  kind: AgeKind;
  age: string;
  gender: string;
  startsOn: string;
  endsOn: string;
  divisionMode: "none" | "existing" | "new";
  divisionId: string;
  divisionTypeName: string;
  divisionValueName: string;
  source: string;
  preset: string;
  entryCount: string;
  reason: string;
}

function draftForSeason(
  startsOn = "",
  endsOn = "",
  divisionTypeName = "",
  id = "initial",
): DisputeDraft {
  return {
    id,
    kind: "adult",
    age: "",
    gender: "",
    startsOn,
    endsOn,
    divisionMode: "none",
    divisionId: "",
    divisionTypeName,
    divisionValueName: "",
    source: "",
    preset: "",
    entryCount: "",
    reason: "",
  };
}

const numberOrNull = (value: string) => (/^[1-9]\d*$/.test(value) ? Number(value) : null);
const fieldId = (field: string, index: number) => (index === 0 ? field : `${field}-${index}`);

export function EditionWizard({
  choices,
  result,
}: {
  choices: EditionChoices;
  result?: EditionResult;
}) {
  const season = choices.seasons.find((item) => item.id === choices.selectedSeasonId);
  const existingDivisionType = choices.divisionTypes.find((item) => item.season_id === season?.id);
  const [step, setStep] = useState(1);
  const [requestId] = useState(choices.requestId);
  const [seriesId, setSeriesId] = useState(season ? String(season.series_id) : "");
  const [championshipName, setChampionshipName] = useState("");
  const [year, setYear] = useState(String(season?.year ?? choices.currentYear));
  const [description, setDescription] = useState(season?.description ?? "");
  const [navigationOrder, setNavigationOrder] = useState<DisputeNavigationOrder>(
    season?.dispute_navigation_order === "division_category"
      ? "division_category"
      : "category_division",
  );
  const [disputes, setDisputes] = useState<DisputeDraft[]>([
    draftForSeason(
      season?.suggested_starts_on ?? "",
      season?.suggested_ends_on ?? "",
      existingDivisionType?.name ?? "",
    ),
  ]);
  const region = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const error = useRef<HTMLParagraphElement>(null);
  const focusedResponse = useRef<EditionResult | undefined>(undefined);
  const nextDraftId = useRef(1);
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const seriesNumber = season?.series_id ?? numberOrNull(seriesId);

  const categoryFor = (draft: DisputeDraft) =>
    choices.categories.find(
      (item) =>
        item.age_kind === draft.kind &&
        item.age_value === (draft.kind === "adult" ? null : Number(draft.age)),
    );
  const profileFor = (draft: DisputeDraft) => {
    const category = categoryFor(draft);
    return choices.profiles.find(
      (item) =>
        item.series_id === seriesNumber &&
        item.category_id === category?.id &&
        item.gender_division === draft.gender,
    );
  };
  const updateDispute = (index: number, patch: Partial<DisputeDraft>) =>
    setDisputes((current) =>
      current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, ...patch } : draft)),
    );
  const invalid = (field: string) => ({
    "aria-invalid": result?.field === field || undefined,
    "aria-describedby": result?.field === field ? "edition-error" : undefined,
  });
  const invalidDispute = (index: number, field: string) => invalid(`disputes.${index}.${field}`);

  const payload: EditionBatchWorkflowInput = {
    seriesId: season ? null : seriesId === "new" ? null : numberOrNull(seriesId),
    championshipName: !season && seriesId === "new" ? championshipName.trim() || null : null,
    seasonId: season?.id ?? null,
    year: Number(year),
    description: description.trim() || null,
    navigationOrder,
    disputes: disputes.map((draft) => {
      const profile = profileFor(draft);
      return {
        categoryKind: draft.kind,
        categoryAge: draft.kind === "adult" ? null : numberOrNull(draft.age),
        gender: draft.gender as "male" | "female",
        startsOn: draft.startsOn || null,
        endsOn: draft.endsOn || null,
        divisionMode: draft.divisionMode,
        divisionValueId: draft.divisionMode === "existing" ? numberOrNull(draft.divisionId) : null,
        divisionTypeName:
          draft.divisionMode === "new" ? draft.divisionTypeName.trim() || null : null,
        divisionValueName:
          draft.divisionMode === "new" ? draft.divisionValueName.trim() || null : null,
        source: (draft.source || profile?.primary_source || "") as
          | "manual_scoresheet"
          | "fiba_boxscore",
        preset: draft.preset as "single_group" | "single_elimination",
        entryCount: Number(draft.entryCount),
        expectedProfileId: profile?.id ?? null,
        reason: draft.reason.trim() || null,
      };
    }),
    reviewed: false,
  };

  useEffect(() => {
    if (result?.error && !result.review)
      setStep(result.field?.startsWith("disputes.") || result.field === "disputes" ? 2 : 1);
    else if (result?.review) setStep(3);
  }, [result]);
  useEffect(() => {
    if (result?.error && focusedResponse.current !== result) {
      const targetStep = result.review
        ? 3
        : result.field?.startsWith("disputes.") || result.field === "disputes"
          ? 2
          : 1;
      if (step !== targetStep) return;
      focusedResponse.current = result;
      error.current?.focus();
    } else if (step === 3) heading.current?.focus();
    else
      region.current?.querySelector<HTMLFieldSetElement>(`fieldset[data-step="${step}"]`)?.focus();
  }, [step, result]);

  return (
    <>
      <p>
        {season
          ? "A nova disputa herda campeonato, ano, descrição e ordem de navegação da edição."
          : "Campeonato e ano identificam a edição. Configure uma ou mais disputas antes da revisão."}{" "}
        Equipes, formato e resultados permanecem independentes por disputa.
      </p>
      {!choices.available ? (
        <p role="status">
          O novo fluxo aguarda aplicação autorizada da migration. A criação está indisponível;
          nenhum dado será alterado.
        </p>
      ) : null}
      <AdminWizardSteps
        current={step}
        labels={["Identificação", "Configuração das disputas", "Revisão"]}
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
      {result?.existingCompetitionId ? (
        <Link to={`/admin/competitions/${result.existingCompetitionId}`}>
          Abrir disputa existente
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
          <input type="hidden" name="payload" value={JSON.stringify(payload)} />
          <fieldset
            tabIndex={-1}
            data-step="1"
            hidden={step !== 1}
            disabled={!choices.available || busy}
          >
            <legend>Identificação da edição</legend>
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
                  value={seriesId}
                  onChange={(event) => setSeriesId(event.target.value)}
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
              </>
            )}
            <label htmlFor="year">Ano</label>
            <input
              id="year"
              type="number"
              min={1900}
              max={choices.currentYear + 1}
              required
              readOnly={Boolean(season)}
              value={year}
              onChange={(event) => setYear(event.target.value)}
              {...invalid("year")}
            />
            <label htmlFor="description">Descrição compartilhada (opcional)</label>
            <textarea
              id="description"
              maxLength={2000}
              value={description}
              readOnly={Boolean(season)}
              onChange={(event) => setDescription(event.target.value)}
              {...invalid("description")}
            />
            <label htmlFor="navigationOrder">Ordem da navegação</label>
            <select
              id="navigationOrder"
              value={navigationOrder}
              disabled={Boolean(season)}
              onChange={(event) => setNavigationOrder(event.target.value as DisputeNavigationOrder)}
              {...invalid("navigationOrder")}
            >
              <option value="category_division">Categoria → Divisão</option>
              <option value="division_category">Divisão → Categoria</option>
            </select>
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
            <legend>Configuração das disputas</legend>
            {disputes.map((draft, index) => {
              const profile = profileFor(draft);
              const selectedDivision = choices.divisions.find(
                (item) => item.id === Number(draft.divisionId),
              );
              const type = choices.divisionTypes.find(
                (item) => item.id === selectedDivision?.competitive_division_type_id,
              );
              const preview = disputeName(
                season?.name ??
                  choices.series.find((item) => item.id === Number(seriesId))?.name ??
                  championshipName,
                draft.kind,
                draft.kind === "adult" ? null : draft.age ? Number(draft.age) : null,
                draft.divisionMode === "new" && draft.divisionValueName
                  ? `${draft.divisionTypeName} ${draft.divisionValueName}`
                  : draft.divisionMode === "existing" && selectedDivision
                    ? `${type?.name} ${selectedDivision.name}`
                    : undefined,
              );
              return (
                <fieldset key={draft.id} className="edition-dispute-config">
                  <legend>Disputa {index + 1}</legend>
                  <div className="edition-identification-row">
                    <div>
                      <label htmlFor={fieldId("categoryKind", index)}>Categoria</label>
                      <select
                        id={fieldId("categoryKind", index)}
                        value={draft.kind}
                        onChange={(event) =>
                          updateDispute(index, {
                            kind: event.target.value as AgeKind,
                            age: "",
                            source: "",
                            reason: "",
                          })
                        }
                        {...invalidDispute(index, "categoryKind")}
                      >
                        <option value="adult">Adulto</option>
                        <option value="base">Base</option>
                        <option value="master">Master</option>
                      </select>
                      {draft.kind !== "adult" ? (
                        <>
                          <label htmlFor={fieldId("categoryAge", index)}>
                            {draft.kind === "base" ? "Idade da categoria" : "Idade mínima"}
                          </label>
                          {draft.kind === "base" ? (
                            <input
                              id={fieldId("categoryAge", index)}
                              type="number"
                              min={12}
                              max={23}
                              step={1}
                              required
                              value={draft.age}
                              onChange={(event) =>
                                updateDispute(index, {
                                  age: event.target.value,
                                  source: "",
                                  reason: "",
                                })
                              }
                              {...invalidDispute(index, "categoryAge")}
                            />
                          ) : (
                            <select
                              id={fieldId("categoryAge", index)}
                              required
                              value={draft.age}
                              onChange={(event) =>
                                updateDispute(index, {
                                  age: event.target.value,
                                  source: "",
                                  reason: "",
                                })
                              }
                              {...invalidDispute(index, "categoryAge")}
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
                      <label htmlFor={fieldId("gender", index)}>Naipe</label>
                      <select
                        id={fieldId("gender", index)}
                        value={draft.gender}
                        onChange={(event) =>
                          updateDispute(index, {
                            gender: event.target.value,
                            source: "",
                            reason: "",
                          })
                        }
                        required
                        {...invalidDispute(index, "gender")}
                      >
                        <option value="">Selecione sem inferir</option>
                        <option value="male">Masculino</option>
                        <option value="female">Feminino</option>
                      </select>
                    </div>
                  </div>

                  <div className="edition-period-row">
                    <label>
                      Início (opcional)
                      <input
                        id={fieldId("startsOn", index)}
                        type="date"
                        value={draft.startsOn}
                        onChange={(event) => updateDispute(index, { startsOn: event.target.value })}
                        {...invalidDispute(index, "startsOn")}
                      />
                    </label>
                    <label>
                      Término (opcional)
                      <input
                        id={fieldId("endsOn", index)}
                        type="date"
                        value={draft.endsOn}
                        onChange={(event) => updateDispute(index, { endsOn: event.target.value })}
                        {...invalidDispute(index, "endsOn")}
                      />
                    </label>
                  </div>

                  <div>
                    <label htmlFor={fieldId("divisionMode", index)}>Divisão competitiva</label>
                    <select
                      id={fieldId("divisionMode", index)}
                      value={draft.divisionMode}
                      onChange={(event) =>
                        updateDispute(index, {
                          divisionMode: event.target.value as DisputeDraft["divisionMode"],
                          divisionId: "",
                          divisionValueName: "",
                        })
                      }
                      {...invalidDispute(index, "divisionMode")}
                    >
                      <option value="none">Sem divisão</option>
                      {season && choices.divisions.some((item) => item.season_id === season.id) ? (
                        <option value="existing">Usar divisão existente</option>
                      ) : null}
                      <option value="new">Criar divisão</option>
                    </select>
                  </div>
                  {draft.divisionMode === "existing" ? (
                    <div>
                      <label htmlFor={fieldId("divisionValueId", index)}>Valor</label>
                      <select
                        id={fieldId("divisionValueId", index)}
                        value={draft.divisionId}
                        onChange={(event) =>
                          updateDispute(index, { divisionId: event.target.value })
                        }
                        required
                        {...invalidDispute(index, "divisionValueId")}
                      >
                        <option value="">Selecione</option>
                        {choices.divisions
                          .filter((item) => item.season_id === season?.id)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {existingDivisionType?.name} {item.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : null}
                  {draft.divisionMode === "new" ? (
                    <div className="edition-identification-row">
                      <label>
                        Tipo
                        <input
                          id={fieldId("divisionTypeName", index)}
                          value={draft.divisionTypeName}
                          readOnly={Boolean(existingDivisionType)}
                          onChange={(event) =>
                            updateDispute(index, { divisionTypeName: event.target.value })
                          }
                          required
                          minLength={2}
                          maxLength={80}
                          {...invalidDispute(index, "divisionTypeName")}
                        />
                      </label>
                      <label>
                        Valor
                        <input
                          id={fieldId("divisionValueName", index)}
                          value={draft.divisionValueName}
                          onChange={(event) =>
                            updateDispute(index, { divisionValueName: event.target.value })
                          }
                          required
                          maxLength={80}
                          {...invalidDispute(index, "divisionValueName")}
                        />
                      </label>
                    </div>
                  ) : null}

                  <p aria-live="polite">
                    Nome da disputa: {preview || "selecione ou informe o campeonato"}
                  </p>
                  <p>
                    {profile
                      ? `Perfil ativo: versão ${profile.version}.`
                      : "Sem perfil ativo. Escolha explicitamente a fonte para esta categoria e naipe."}
                  </p>
                  <label htmlFor={fieldId("source", index)}>Fonte primária</label>
                  <select
                    id={fieldId("source", index)}
                    value={draft.source || profile?.primary_source || ""}
                    onChange={(event) => updateDispute(index, { source: event.target.value })}
                    required
                    {...invalidDispute(index, "source")}
                  >
                    <option value="">Selecione</option>
                    <option value="manual_scoresheet">Súmula manual</option>
                    <option value="fiba_boxscore">Boxscore PDF</option>
                  </select>
                  <label htmlFor={fieldId("reason", index)}>
                    Justificativa para mudar a fonte (se aplicável)
                  </label>
                  <textarea
                    id={fieldId("reason", index)}
                    minLength={10}
                    maxLength={500}
                    value={draft.reason}
                    onChange={(event) => updateDispute(index, { reason: event.target.value })}
                    {...invalidDispute(index, "reason")}
                  />
                  <label htmlFor={fieldId("preset", index)}>Formato</label>
                  <select
                    id={fieldId("preset", index)}
                    required
                    value={draft.preset}
                    onChange={(event) => updateDispute(index, { preset: event.target.value })}
                    {...invalidDispute(index, "preset")}
                  >
                    <option value="">Selecione</option>
                    <option value="single_group">Grupo único — turno único</option>
                    <option value="single_elimination">Eliminatória simples — jogo único</option>
                  </select>
                  <label htmlFor={fieldId("entryCount", index)}>Quantidade de equipes</label>
                  <input
                    id={fieldId("entryCount", index)}
                    type="number"
                    min={2}
                    max={16}
                    required
                    value={draft.entryCount}
                    onChange={(event) => updateDispute(index, { entryCount: event.target.value })}
                    {...invalidDispute(index, "entryCount")}
                  />
                  {!season && disputes.length > 1 ? (
                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={() =>
                        setDisputes((current) => current.filter((_, item) => item !== index))
                      }
                    >
                      Remover disputa {index + 1}
                    </button>
                  ) : null}
                </fieldset>
              );
            })}
            {!season && disputes.length < 12 ? (
              <button
                type="button"
                className="button button-ghost"
                onClick={() => {
                  const template = disputes.at(-1) ?? draftForSeason();
                  setDisputes((current) => [
                    ...current,
                    {
                      ...template,
                      id: `draft-${nextDraftId.current++}`,
                      kind: "adult",
                      age: "",
                      gender: "",
                      divisionMode: "none",
                      divisionId: "",
                      divisionValueName: "",
                      source: "",
                      reason: "",
                    },
                  ]);
                }}
              >
                Adicionar outra disputa
              </button>
            ) : null}
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
            Revisão da criação
          </h2>
          <p>
            {season?.name ??
              choices.series.find((item) => item.id === result.review?.input.seriesId)?.name ??
              result.review.input.championshipName}{" "}
            · {result.review.input.year} · {result.review.disputes.length}{" "}
            {result.review.disputes.length === 1 ? "disputa" : "disputas"}
          </p>
          <p>
            Navegação:{" "}
            {result.review.input.navigationOrder === "category_division"
              ? "Categoria → Divisão"
              : "Divisão → Categoria"}
          </p>
          <ol>
            {result.review.disputes.map((item) => (
              <li
                key={`${item.input.categoryKind}-${item.input.categoryAge ?? "adult"}-${item.input.gender}-${item.input.divisionMode}-${item.input.divisionValueId ?? item.input.divisionValueName ?? "none"}`}
              >
                <strong>{item.name}</strong>
                <p>
                  {item.input.gender === "male" ? "Masculino" : "Feminino"} ·{" "}
                  {categoryLabel(item.input.categoryKind, item.input.categoryAge)} · Rascunho
                  privado
                </p>
                <p>
                  {item.input.startsOn ?? "Início pendente"} a{" "}
                  {item.input.endsOn ?? "término pendente"}
                </p>
                <p>
                  {item.input.source === "manual_scoresheet" ? "Súmula manual" : "Boxscore PDF"} ·{" "}
                  {item.input.preset === "single_group" ? "Grupo único" : "Eliminatória simples"}
                </p>
                <p>
                  {item.input.entryCount} equipes · {item.summary.rounds} rodadas ·{" "}
                  {item.summary.matchups} confrontos · {item.summary.byes} folgas
                </p>
              </li>
            ))}
          </ol>
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
              Revisei a edição e todas as disputas. Confirmo a criação privada e transacional.
            </label>
            <div className="inline-admin-form">
              <button type="button" className="button button-ghost" onClick={() => setStep(1)}>
                Editar
              </button>
              <button type="submit" className="button" disabled={busy || !choices.available}>
                {busy
                  ? "Criando…"
                  : season
                    ? "Criar disputa privada"
                    : result.review.disputes.length === 1
                      ? "Criar edição privada"
                      : `Criar ${result.review.disputes.length} disputas privadas`}
              </button>
            </div>
          </Form>
        </section>
      ) : null}
      <Link to="/admin/competitions">Voltar às competições</Link>
    </>
  );
}
