# Browser evidence matrix

| Change | Required evidence |
| --- | --- |
| Interactive control | Native role or justified ARIA, accessible name, keyboard activation, visible focus, comfortable target |
| Form | Associated label, instructions, validation timing, text error, programmatic error link, focus after submit |
| Navigation, modal, drawer, menu | Logical order, current state, open/close keyboard behavior, focus placement and restoration |
| Table or statistics grid | Headers and relationships, horizontal/reflow behavior, readable order, non-color status cues |
| Async state | Loading, empty, error, retry, success announcement where needed, no focus loss |
| Responsive layout | Affected mobile width, representative desktop width, 200% zoom/reflow, no hidden required action |
| Motion | `prefers-reduced-motion` behavior and no essential information conveyed only by animation |

Record route, viewport, input method, observed behavior, and limitation. Reuse recent evidence only when the relevant artifact has not changed.
