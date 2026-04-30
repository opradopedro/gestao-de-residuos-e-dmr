import { useEffect, useState } from "react";
import { getImportJob, subscribeImportJob, type ImportJobState } from "@/lib/import-job";

export function useImportJob(): ImportJobState | null {
  const [s, setS] = useState<ImportJobState | null>(getImportJob());
  useEffect(() => subscribeImportJob(setS), []);
  return s;
}
