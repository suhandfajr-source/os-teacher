import { prisma } from "@/lib/auth";
import { BugReportCategory, BugReportPriority, BugReportStatus } from "@prisma/client";

export interface CreateBugReportInput {
  userId?: string | null;
  reporterEmail?: string | null;
  title: string;
  description: string;
  category?: BugReportCategory;
  pageUrl?: string | null;
  deviceInfo?: string | null;
  attachmentUrls?: string[];
}

export interface UpdateBugReportInput {
  status?: BugReportStatus;
  priority?: BugReportPriority;
  adminNotes?: string | null;
}

/**
 * Generate nomor tiket berurutan unik, misal: TICK-2610-0001
 */
async function generateTicketNumber(): Promise<string> {
  const now = new Date();
  const yearSuffix = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const prefix = `TICK-${yearSuffix}${month}-`;

  const lastTicket = await prisma.bugReport.findFirst({
    where: { ticketNumber: { startsWith: prefix } },
    orderBy: { createdAt: "desc" },
    select: { ticketNumber: true },
  });

  let nextSequence = 1;
  if (lastTicket?.ticketNumber) {
    const parts = lastTicket.ticketNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSequence = lastSeq + 1;
    }
  }

  return `${prefix}${nextSequence.toString().padStart(4, "0")}`;
}

export async function createBugReport(input: CreateBugReportInput) {
  const ticketNumber = await generateTicketNumber();

  return await prisma.bugReport.create({
    data: {
      ticketNumber,
      userId: input.userId,
      reporterEmail: input.reporterEmail,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category || BugReportCategory.FEATURE_ERROR,
      pageUrl: input.pageUrl,
      deviceInfo: input.deviceInfo,
      attachmentUrls: input.attachmentUrls || [],
      status: BugReportStatus.OPEN,
      priority: BugReportPriority.MEDIUM,
    },
  });
}

export async function listBugReports(params?: {
  status?: BugReportStatus;
  category?: BugReportCategory;
  userId?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, params?.page || 1);
  const limit = Math.max(1, Math.min(100, params?.limit || 20));
  const skip = (page - 1) * limit;

  const where: any = {};
  if (params?.status) where.status = params.status;
  if (params?.category) where.category = params.category;
  if (params?.userId) where.userId = params.userId;

  if (params?.search) {
    where.OR = [
      { ticketNumber: { contains: params.search, mode: "insensitive" } },
      { title: { contains: params.search, mode: "insensitive" } },
      { description: { contains: params.search, mode: "insensitive" } },
      { reporterEmail: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.bugReport.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    }),
    prisma.bugReport.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getBugReportById(id: string) {
  return await prisma.bugReport.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });
}

export async function updateBugReport(id: string, input: UpdateBugReportInput) {
  const data: any = { ...input };
  if (input.status === BugReportStatus.RESOLVED || input.status === BugReportStatus.CLOSED) {
    data.resolvedAt = new Date();
  } else if (input.status) {
    data.resolvedAt = null;
  }

  return await prisma.bugReport.update({
    where: { id },
    data,
  });
}
