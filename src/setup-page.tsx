// Dispatch-route entry.
import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { YouTubeSettingsPage } from "./settings-page";

type ConnectorSetupPageProps = {
  packageId: string;
  slug: string;
  searchParams: Record<string, string | string[] | undefined>;
  ctx: ExtensionHostContext;
};

export default async function YouTubeConnectorSetupPage({
  searchParams,
  ctx,
}: ConnectorSetupPageProps) {
  return YouTubeSettingsPage({ searchParams: Promise.resolve(searchParams), ctx });
}
