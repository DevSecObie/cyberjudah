import { createFileRoute, redirect } from "@tanstack/react-router";

// Easton's Bible Dictionary was retired for the glossary; a word's old address lands on the
// glossary entry of the same name when there is one.
export const Route = createFileRoute("/dictionary/$slug")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/glossary", hash: params.slug.toLowerCase(), statusCode: 301 }); },
});
