"use client";
import { RouteError } from "../../../components/ui/RouteError";
export default function Error({ reset }: { reset: () => void }) {
  return <RouteError title="Invitation is unavailable" reset={reset} />;
}
