"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  createParentInvitation,
  getTeacherParentAccessList,
  getTeacherParentInvitationList,
  revokeParentTeachingAccess,
  cancelParentInvitation,
  getPublicInvitationInfo,
  getAuthenticatedInvitationDetail,
  acceptParentInvitationAtomic,
  getParentAuthorizedContexts,
  getParentContextDetail,
} from "./parent.service";
import { verifyTeachingContextAccess, verifyParentSession } from "@/lib/authorization";

async function requireSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

// -------------------------------------------------
// TEACHER ACTIONS
// -------------------------------------------------

export async function createParentInvitationAction(data: {
  teachingContextId: string;
  studentId: string;
  recipientEmail: string;
  relationshipLabel?: string;
}) {
  const { profile } = await verifyTeachingContextAccess(data.teachingContextId);

  const result = await createParentInvitation(profile.id, {
    teachingContextId: data.teachingContextId,
    studentId: data.studentId,
    recipientEmail: data.recipientEmail,
    relationshipLabel: data.relationshipLabel,
  });

  revalidatePath(`/kelas/${data.teachingContextId}/orang-tua`);
  return {
    success: true,
    invitation: result.invitation,
    rawToken: result.rawToken,
  };
}

export async function getTeacherParentAccessListAction(teachingContextId: string) {
  return await getTeacherParentAccessList(teachingContextId);
}

export async function getTeacherParentInvitationListAction(teachingContextId: string) {
  return await getTeacherParentInvitationList(teachingContextId);
}

export async function revokeParentTeachingAccessAction(teachingContextId: string, accessId: string) {
  const result = await revokeParentTeachingAccess(teachingContextId, accessId);
  revalidatePath(`/kelas/${teachingContextId}/orang-tua`);
  return result;
}

export async function cancelParentInvitationAction(teachingContextId: string, invitationId: string) {
  const result = await cancelParentInvitation(teachingContextId, invitationId);
  revalidatePath(`/kelas/${teachingContextId}/orang-tua`);
  return result;
}

// -------------------------------------------------
// PUBLIC / PARENT ACTIONS
// -------------------------------------------------

export async function getPublicInvitationInfoAction(token: string) {
  return await getPublicInvitationInfo(token);
}

export async function getAuthenticatedInvitationDetailAction(token: string) {
  const session = await requireSession();
  return await getAuthenticatedInvitationDetail(token, session.user.email);
}

export async function acceptParentInvitationAction(token: string) {
  const session = await requireSession();
  const result = await acceptParentInvitationAtomic(token, session.user.id, session.user.email);
  revalidatePath("/parent");
  return result;
}

export async function getParentAuthorizedContextsAction() {
  const { parentProfile } = await verifyParentSession();
  if (!parentProfile) {
    return [];
  }
  return await getParentAuthorizedContexts(parentProfile.id);
}

export async function getParentContextDetailAction(studentId: string, teachingContextId: string) {
  return await getParentContextDetail(studentId, teachingContextId);
}
