import * as React from "react";

// shadcn link wrapper. This is the design-system primitive for inline text
// links — it renders the raw <a> here, inside the components/ui carve-out
// where the ui-design-system gate's raw-JSX block does not apply (the
// wrappers themselves render the raw elements). Consumers import <Link>
// instead of writing raw <a>, which the gate enforces at error severity.
//
// No base styling is injected here (unlike the cn()-merged version other
// connectors ship) — this connector doesn't carry the shadcn cva/tailwind-
// merge toolchain yet, and full visual-design conformance vs
// design/specs/app-connectors.html is verified in a later render lane (see
// the connector-setup-tabs PR), not by this wrapper. Callers pass their own
// complete className, same as the raw <a> this replaces.
export function Link({ ...props }: React.ComponentProps<"a">) {
  return <a data-slot="link" {...props} />;
}
