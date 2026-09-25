import { createFileRoute, redirect } from "@tanstack/react-router";

// Easton's Bible Dictionary was retired for the glossary, which defines words as the classes
// use them. Old links land there.
export const Route = createFileRoute("/dictionary/")({
  beforeLoad: () => { throw redirect({ to: "/glossary", statusCode: 301 }); },
});
