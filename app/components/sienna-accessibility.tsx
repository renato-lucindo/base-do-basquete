import { useEffect } from "react";

import { ensureSiennaScript } from "./sienna-loader";

export function SiennaAccessibility() {
  useEffect(() => {
    ensureSiennaScript();
  }, []);

  return null;
}
