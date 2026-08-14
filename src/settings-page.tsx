// Colocated setup page for the
// `/connectors/cinatra-ai/youtube-connector/setup` dispatch route.
//
// Per the extended connector setup-page spec (design/specs/app-connectors.html
// §II), this single-connection connector composes the shared connector-setup
// shell + primitives (it does NOT hand-roll the chrome):
//
//   • ConnectorSetupPage  — header + content in ONE centered Wide column
//     (max-w-3xl · 768px), so the header's left edge aligns with the content
//     frame; renders no divider (the tab row owns the section rule).
//   • Tabs + TabsListRow  — the design-system underline tablist; TabsListRow
//     draws the etched paired-line section rule to the RIGHT of the last tab
//     out to the column edge and drops its own bottom hairline.
//   • ConnectorSetupColumns — the two-column Setup body (wider left = the
//     account connect action; narrower 236px right = the Connection status
//     card).
//   • ConnectionStatusCard — the status badge in the right column. This
//     connector has no live re-probe RPC wired yet (unlike google-calendar's
//     Check), matching its actual connection model today (see the Reconnect
//     note below) — the card renders the badge only, no `action`. Adding Check
//     is tracked as connector-setup-tabs epic follow-up scope, not this issue.
//   • SearchParamToast — the codes-only flash island (unchanged from before
//     this migration).
//
// Tab order: Setup, then the reserved Help tab LAST (issue #44) — this
// connector has no extra per-connector config beyond connecting, so per the
// spec ("a connector that only needs to explain itself may carry Help and no
// other tab") the tablist is exactly these two. One Google account's YouTube
// scope per user (single connection, app-scoped OAuth client).

import { Suspense } from "react";
import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { Link } from "./components/ui/link";
import { ConnectorSetupPage } from "@cinatra-ai/sdk-ui/connector-setup-page";
import { ConnectorSetupColumns } from "@cinatra-ai/sdk-ui/connector-setup-columns";
import { ConnectionStatusCard } from "@cinatra-ai/sdk-ui/connection-status-card";
import { Tabs, TabsContent, TabsListRow, TabsTrigger } from "@cinatra-ai/sdk-ui/tabs";
import { SearchParamToast } from "@cinatra-ai/sdk-ui/search-param-toast";
import { NangoUserConnectButton } from "@cinatra-ai/sdk-ui/nango";
import { YOUTUBE_FLASH_TOASTS } from "./settings-flash";
import { getYouTubeDeps } from "./deps";

type SettingsYouTubePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  ctx: ExtensionHostContext;
};

export async function YouTubeSettingsPage({ searchParams, ctx }: SettingsYouTubePageProps) {
  const [, actor] = await Promise.all([
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
    ctx.authSession.getActor(),
  ]);
  if (!actor?.userId) {
    // Dispatch route already gated via enforceConnectorPolicy; defensive null
    // check so a misconfigured port never silently mis-scopes user data.
    throw new Error("[youtube-connector] settings-page: no userId on actor");
  }
  // Nango data via the host-injected `ctx.nango` port — the connector no
  // longer imports `@cinatra-ai/nango-connector`.
  // Pass the explicit user scope: the host getter forwards opts straight to
  // getPrimarySavedNangoConnections, so omitting them would mis-scope user data.
  const nangoFrontendConfig = (await ctx.nango.getFrontendConfig?.()) ?? {};
  const connections =
    (await ctx.nango.getPrimarySavedConnections?.({ scope: "user", userId: actor.userId })) ?? {};
  const connection = connections.youtube;
  const connected = Boolean(connection);

  // Connecting YouTube requires the shared Google OAuth client (clientId +
  // secret, configured in the google-oauth connector) to exist first. Read the
  // connector-level status through the host-injected google-oauth port
  // (deps.oauth.getStatus reports "connected" once the client is configured,
  // independent of any user connection). Fail CLOSED: if the host google-oauth
  // service is unavailable or the manifest predates this connector's
  // `capabilities` port request (the granted-port proxy fail-louds), treat the
  // client as UNCONFIGURED and keep the button disabled rather than send the
  // user into a guaranteed-fail flow.
  let oauthConfigured = false;
  try {
    oauthConfigured = (await getYouTubeDeps().oauth.getStatus()).status === "connected";
  } catch {
    oauthConfigured = false;
  }

  return (
    // `divider={false}` — the section rule is the tab row's etched rule.
    <ConnectorSetupPage
      title="YouTube"
      description="Connect the YouTube account Cinatra should use for transcript discovery and video workflows."
      divider={false}
      className="flex flex-col gap-6 pb-8"
    >
      {/* Codes-only flash island (unchanged by this migration). */}
      <Suspense fallback={null}>
        <SearchParamToast toasts={YOUTUBE_FLASH_TOASTS} />
      </Suspense>

      <Tabs defaultValue="setup" className="w-full">
        <TabsListRow aria-label="YouTube connector setup">
          <TabsTrigger value="setup">Setup</TabsTrigger>
          {/* Help is RESERVED and ALWAYS LAST (issue #44). */}
          <TabsTrigger value="help">Help</TabsTrigger>
        </TabsListRow>

        {/* SETUP — the single-connection two-column body. Stays Wide. */}
        <TabsContent
          value="setup"
          forceMount
          className="mt-6 data-[state=inactive]:hidden"
        >
          <ConnectorSetupColumns
            conformanceId="connector-setup"
            state="ready"
            fields={
              <div className="flex flex-col gap-6">
                {connection ? (
                  <section className="soft-panel rounded-panel p-5">
                    <p className="text-sm font-medium text-foreground">
                      YouTube account
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {`Connected${connection.email ? ` as ${connection.email}` : ""}`}
                    </p>
                  </section>
                ) : oauthConfigured ? null : (
                  // Not-connected + OAuth-not-configured card (hint gating
                  // restored, #61): holds only the OAuth-credentials
                  // prerequisite line — the full how-to prose lives on the
                  // Help tab. Gated on `oauthConfigured` (not on `!connection`
                  // alone) so it never shows once the shared client is already
                  // configured, mirroring the gmail-connector setup page.
                  <section className="soft-panel rounded-panel p-5">
                    <p className="text-sm leading-6 text-muted-foreground">
                      Connecting requires shared{" "}
                      <Link
                        href="/connectors/cinatra-ai/google-oauth-connector/setup"
                        className="underline underline-offset-4 hover:text-foreground"
                      >
                        Google OAuth credentials
                      </Link>
                      .
                    </p>
                  </section>
                )}

                {/* Connect / Reconnect only (spec §II item 7 for a
                    single-connection form). NangoUserConnectButton handles
                    first-time connect AND reconnect (Nango's flow revokes +
                    re-issues on reconnect), so a separate Disconnect control
                    is not needed here — matching the proven user-scoped
                    YouTube connect surface this connector has always used. */}
                <div className="flex flex-wrap items-center gap-3">
                  <NangoUserConnectButton
                    connectorKey="youtube"
                    reconnectConnectionId={connection?.connectionId}
                    connected={connected}
                    connectLabel="Connect"
                    reconnectLabel="Reconnect"
                    nangoFrontendConfig={nangoFrontendConfig}
                    disabled={!oauthConfigured}
                    prerequisiteErrorMessage={
                      oauthConfigured
                        ? undefined
                        : "Save your Google OAuth client ID and secret in Google OAuth configuration first."
                    }
                  />
                </div>
              </div>
            }
            aside={
              /* Connection status card (spec §II items 10-14): heading over a
                 divider + a status badge. No Check action — this connector has
                 no live re-probe RPC wired yet (see the module comment). */
              <ConnectionStatusCard status={connected ? "connected" : "disconnected"} />
            }
          />
        </TabsContent>

        {/* HELP — reserved, always LAST, read-only (no form, no Save). Narrow. */}
        <TabsContent
          value="help"
          forceMount
          className="mt-6 flex max-w-xl flex-col gap-5 data-[state=inactive]:hidden"
        >
          <p className="text-sm leading-6 text-muted-foreground">
            Cinatra uses your connected YouTube account for transcript
            discovery and video workflows — finding and reading video
            transcripts an agent can work with. It does not post, upload, or
            manage videos on your behalf.
          </p>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-foreground">Prerequisite</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Connecting requires a shared Google OAuth client. Save its client
              ID and secret in{" "}
              <Link
                href="/connectors/cinatra-ai/google-oauth-connector/setup"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Google OAuth configuration
              </Link>{" "}
              first — create them in the{" "}
              <Link
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Google Cloud Console
              </Link>
              .
            </p>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-foreground">Connect your account</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              On the Setup tab, sign in with Google. This confirms which
              account's YouTube data the connector reads. Use Reconnect any
              time to sign in again — Nango revokes and re-issues the
              connection, so a fresh sign-in always replaces the old one.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </ConnectorSetupPage>
  );
}
