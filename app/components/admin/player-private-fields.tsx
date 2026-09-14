import type { Ref } from "react";

export type PlayerEligibilitySex = "male" | "female";

interface PlayerEligibilitySexFieldProps {
  currentValue?: PlayerEligibilitySex | null;
  editionGender?: string | null;
  errorId?: string;
  inputRef?: Ref<HTMLSelectElement>;
}

function editionGenderLabel(value: string | null | undefined) {
  if (value === "male") return "Masculino";
  if (value === "female") return "Feminino";
  return "Pendente de revisão";
}

export function PlayerEligibilitySexField({
  currentValue,
  editionGender,
  errorId,
  inputRef,
}: PlayerEligibilitySexFieldProps) {
  return (
    <label>
      Sexo para elegibilidade
      <select
        ref={inputRef}
        name="sex"
        required
        defaultValue={currentValue ?? ""}
        aria-describedby={errorId}
      >
        <option value="" disabled>
          Selecione sem inferir
        </option>
        <option value="female">Feminino</option>
        <option value="male">Masculino</option>
      </select>
      {editionGender !== undefined ? (
        <small>Naipe da edição: {editionGenderLabel(editionGender)}.</small>
      ) : null}
    </label>
  );
}
