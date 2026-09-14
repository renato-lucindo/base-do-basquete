export function InlineFieldError({ id, message }: { id?: string; message?: string | null }) {
  return message ? (
    <span className="inline-field-error" id={id} role="alert">
      <span aria-hidden="true">!</span>
      {message}
    </span>
  ) : null;
}
