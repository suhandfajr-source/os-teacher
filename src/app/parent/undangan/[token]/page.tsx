import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getPublicInvitationInfo, getAuthenticatedInvitationDetail } from "@/modules/parent/parent.service";
import { InvitationAcceptClient } from "./InvitationAcceptClient";

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function InvitationPage({ params }: PageProps) {
  const { token } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    // Unauthenticated: Public info only (masked email, validity)
    const publicInfo = await getPublicInvitationInfo(token);
    return (
      <InvitationAcceptClient
        token={token}
        isAuthenticated={false}
        publicInfo={publicInfo}
      />
    );
  }

  // Authenticated: try fetching authenticated preview
  let detail = null;
  let errorMessage: string | null = null;
  let isEmailMismatch = false;

  try {
    detail = await getAuthenticatedInvitationDetail(token, session.user.email);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat undangan";
    isEmailMismatch = message.includes("tidak sesuai dengan email penerima undangan");
    errorMessage = isEmailMismatch ? null : message;
  }

  return (
    <InvitationAcceptClient
      token={token}
      isAuthenticated={true}
      authenticatedDetail={detail}
      emailMismatch={isEmailMismatch}
      currentEmail={session.user.email}
      errorMessage={errorMessage}
    />
  );
}
