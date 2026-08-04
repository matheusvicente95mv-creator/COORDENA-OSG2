import { headers } from "next/headers";
import SG2Workspace from "./sg2-workspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const encodedName = requestHeaders.get("oai-authenticated-user-full-name");
  const encoding = requestHeaders.get("oai-authenticated-user-full-name-encoding");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const displayName =
    encodedName && encoding === "percent-encoded-utf-8"
      ? decodeURIComponent(encodedName)
      : email?.split("@")[0] || "Matheus";

  return <SG2Workspace displayName={displayName} />;
}
