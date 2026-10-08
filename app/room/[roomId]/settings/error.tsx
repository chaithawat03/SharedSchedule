"use client";
import { RouteError } from "../../../../components/ui/RouteError";
export default function Error({ reset }: { reset: () => void }) {
  return <RouteError title="Room settings are unavailable" reset={reset} />;
}
