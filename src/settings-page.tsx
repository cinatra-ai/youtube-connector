import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { Main, PageHeader, PageContent, NangoUserConnectButton } from "@cinatra-ai/sdk-ui/marketplace";
import { getYouTubeDeps } from "./deps";

type SettingsYouTubePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  ctx: ExtensionHostContext;
};

function pickSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function YouTubeSettingsPage({ searchParams, ctx }: SettingsYouTubePageProps) {
  const [resolvedSearchParams, actor] = await Promise.all([
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
    ctx.authSession.getActor(),
  ]);
  if (!actor?.userId) {
    // Dispatch route already gated via enforceConnectorPolicy; defensive null
    // check so a misconfigured port never silently mis-scopes user data.
    throw new Error("[youtube-connector] settings-page: no userId on actor");
  }
  const errorMessage = pickSearchParam(resolvedSearchParams.error);
  // Nango data via the host-injected `ctx.nango` port — the connector no
  // longer imports `@cinatra-ai/nango-connector`.
  // Pass the explicit user scope: the host getter forwards opts straight to
  // getPrimarySavedNangoConnections, so omitting them would mis-scope user data.
  const nangoFrontendConfig = (await ctx.nango.getFrontendConfig?.()) ?? {};
  const connections =
    (await ctx.nango.getPrimarySavedConnections?.({ scope: "user", userId: actor.userId })) ?? {};
  const connection = connections.youtube;

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
    <Main className="min-h-screen">
      <PageHeader
        title="YouTube"
        description="Connect the YouTube account Cinatra should use for transcript discovery and video workflows."
      />
      <PageContent className="flex flex-col gap-6 pb-8">
        {errorMessage ? (
          <div className="rounded-control border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        <section className="soft-panel rounded-card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">YouTube account</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {connection ? `Connected${connection.email ? ` as ${connection.email}` : ""}` : "Not connected"}
            </p>
          </div>
          {/* NangoUserConnectButton handles both first-time connect and reconnect
              (Nango's flow revokes + re-issues on reconnect), so a separate
              disconnect control is not needed here — matching the proven
              user-scoped YouTube connect surface. */}
          <NangoUserConnectButton
            connectorKey="youtube"
            reconnectConnectionId={connection?.connectionId}
            connected={Boolean(connection)}
            connectLabel="Connect YouTube"
            reconnectLabel="Reconnect"
            nangoFrontendConfig={nangoFrontendConfig}
            disabled={!oauthConfigured}
            prerequisiteErrorMessage={
              oauthConfigured
                ? undefined
                : "Save your Google OAuth client ID and secret in Google OAuth configuration first."
            }
          />
        </section>

        {oauthConfigured ? null : (
          <p className="-mt-3 text-sm leading-6 text-muted-foreground">
            Connecting requires shared Google OAuth credentials. Save your client
            ID and secret in{" "}
            <a
              href="/connectors/cinatra-ai/google-oauth-connector/setup"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Google OAuth configuration
            </a>{" "}
            first — create them in the{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Google Cloud Console
            </a>
            .
          </p>
        )}
      </PageContent>
    </Main>
  );
}
