import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AppTree } from "../src/routes";
import { SessionProvider } from "../src/lib/session";
import { PUBLIC_PAGES, headTagsFor } from "../src/lib/seo";
import { SITE } from "../src/lib/site";

/** Renders a public route to static HTML for the prerender step. */
export function renderPage(path: string): string {
  return renderToString(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <AppTree />
      </SessionProvider>
    </MemoryRouter>,
  );
}

export { PUBLIC_PAGES, headTagsFor, SITE };
