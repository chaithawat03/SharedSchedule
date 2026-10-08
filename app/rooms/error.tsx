"use client";
import { RouteError } from "../../components/ui/RouteError";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <RouteError
      title="Rooms are unavailable"
      reset={reset}
      backHref="/"
      backLabel="Home"
    />
  );
}
