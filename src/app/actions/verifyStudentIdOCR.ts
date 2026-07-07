"use server";

import { randomUUID } from "node:crypto";
import {
  parseStudentIdImagePayload,
  verifyStudentIdWithGemini,
  type StudentIdOcrData
} from "@/lib/server/studentIdReview";

type OCRResult = {
  success: boolean;
  data?: StudentIdOcrData;
  error?: string;
  /** When true, OCR failed gracefully and the user should be routed to manual review. */
  manualReview?: boolean;
};

export async function verifyStudentIdOCR(base64Image: string): Promise<OCRResult> {
  const requestId = randomUUID();
  console.info("[student_id_ocr]", {
    stage: "upload_precheck",
    event: "received",
    requestId,
    inputLength: base64Image.length
  });

  const payload = parseStudentIdImagePayload(base64Image, {
    requestId,
    source: "upload_precheck"
  });
  if (!payload) {
    return { success: false, error: "Please upload a supported Student ID image under 1MB after compression." };
  }

  if (process.env.NODE_ENV === "development" && !process.env.GEMINI_API_KEY) {
    return {
      success: true,
      data: {
        fullName: "Elmir Demo",
        firstName: "Elmir",
        lastName: "Demo",
        universityName: "Baku State University",
        studentNumber: "123456",
        expiryDate: "2099-12-31",
        issueDate: null,
        facultyOrDepartment: null,
        isCurrentlyValid: true,
        isStudentId: true,
        confidence: {
          studentName: 1,
          universityName: 1,
          studentNumber: 1,
          dates: 1,
          overall: 1
        },
        validationFailureReasons: []
      }
    };
  }

  try {
    const data = await verifyStudentIdWithGemini(payload, {
      requestId,
      source: "upload_precheck"
    });
    return { success: true, data };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    console.info("[student_id_ocr]", {
      stage: "upload_precheck",
      event: "manual_review_fallback",
      requestId,
      reason
    });

    return {
      success: false,
      manualReview: true,
      error: "We couldn't read your Student ID automatically. Your account will be reviewed manually by our team."
    };
  }
}
