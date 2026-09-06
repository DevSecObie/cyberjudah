import React from "react";
import Heading from "@theme/Heading";
import type { Props } from "@theme/MDXComponents/Heading";

// The stock component strips the id from every h1 on the theory that h1s never appear in
// the table of contents. The study notes use h1 for each chapter after the first
// ("# Genesis 2: Adam, the Chosen of the Most High"), and the 4 Chapters a Day index links
// to those chapters, so the id has to survive. Everything else goes through the theme.
export default function MDXHeading(props: Props): React.ReactElement {
  if (props.as === "h1" && props.id) {
    const { as: _as, id, ...rest } = props;
    return <h1 {...rest} id={id} className={["anchor", rest.className].filter(Boolean).join(" ")} />;
  }
  return <Heading {...props} />;
}
