import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "@/lib/server/userSession";
import { getReadyPool } from "@/lib/server/users";
import { getUserTotpSecretBase64 } from "@/lib/server/totp";
import { PKPass } from "passkit-generator";

export const runtime = "nodejs";

type AppleRotatingBarcode = {
  format: "PKBarcodeFormatQR";
  message: string;
  messageEncoding: "iso-8859-1";
  altText: string;
  totp: {
    sharedSecret: string;
    period: number;
    algorithm: "SHA1";
  };
};

type PKPassWithRotatingBarcode = PKPass & {
  props: {
    rotatingBarcode?: AppleRotatingBarcode;
  };
};

function decodeBase64Utf8(value: string) {
  return Buffer.from(value, "base64").toString("utf-8").trim();
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET;

  if (!token || !secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const session = await verifyUserSessionToken(token, secret);
  if (!session || session.role !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const pool = await getReadyPool();
    const userResult = await pool.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [session.id]);
    const user = userResult.rows[0];

    if (!user || user.status !== "active") {
      return NextResponse.json({ error: "account_inactive" }, { status: 401 });
    }

    // Ensure all required environment variables for Apple Wallet are present
    const teamId = process.env.APPLE_WALLET_TEAM_ID;
    const passTypeId = process.env.APPLE_WALLET_PASS_TYPE_ID;
    const certBase64 = process.env.APPLE_WALLET_CERT;
    const keyBase64 = process.env.APPLE_WALLET_KEY;
    const keyPassword = process.env.APPLE_WALLET_KEY_PASSWORD || ""; // Optional
    const wwdrBase64 = process.env.APPLE_WALLET_WWDR;

    if (!teamId || !passTypeId || !certBase64 || !keyBase64 || !wwdrBase64) {
      if (process.env.NODE_ENV === "development") {
        const headers = new Headers();
        headers.set("Content-Type", "text/plain");
        headers.set("Content-Disposition", `attachment; filename="MOCK_cadesca_pass.pkpass.txt"`);
        return new NextResponse("This is a mock pass file for local development. In production, this will be a valid .pkpass file signed by Apple.", { headers });
      }

      return new NextResponse(
        JSON.stringify({ error: "Wallet generation is not configured on this server." }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const cert = decodeBase64Utf8(certBase64);
    const key = decodeBase64Utf8(keyBase64);
    const wwdr = decodeBase64Utf8(wwdrBase64);
    if (!cert || !key || !wwdr) {
      console.error("[apple_wallet] invalid_certificate_configuration");
      return NextResponse.json({ error: "wallet_configuration_invalid" }, { status: 503 });
    }

    // Initialize Pass
    const pass = new PKPass(
      {
        "icon.png": Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"),
        "icon@2x.png": Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"),
        "logo.png": Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"),
        "logo@2x.png": Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"),
      },
      {
        signerCert: cert,
        signerKey: key,
        signerKeyPassphrase: keyPassword,
        wwdr: wwdr
      },
      {
        formatVersion: 1,
        teamIdentifier: teamId,
        passTypeIdentifier: passTypeId,
        organizationName: "Cadesca",
        description: "Cadesca Student Meal Pass",
        serialNumber: user.id,
        foregroundColor: "rgb(255, 255, 255)",
        backgroundColor: "rgb(0, 0, 0)",
        labelColor: "rgb(255, 255, 255)"
      }
    );

    pass.type = "storeCard";

    pass.primaryFields.push({
      key: "student",
      label: "STUDENT",
      value: user.name
    });

    pass.secondaryFields.push({
      key: "university",
      label: "UNIVERSITY",
      value: user.university_name || "N/A"
    });

    const userSecretBase64 = getUserTotpSecretBase64(user.id);

    // Provide standard barcode as a fallback for old iOS versions
    pass.setBarcodes({
      format: "PKBarcodeFormatQR",
      message: `${user.id}`,
      messageEncoding: "iso-8859-1",
      altText: "Scan at the terminal"
    });

    // Inject rotatingBarcode into the internal props for iOS 15+ native TOTP support
    (pass as PKPassWithRotatingBarcode).props.rotatingBarcode = {
      format: "PKBarcodeFormatQR",
      message: `${user.id}`,
      messageEncoding: "iso-8859-1",
      altText: "Scan at the terminal",
      totp: {
        sharedSecret: userSecretBase64,
        period: 300,
        algorithm: "SHA1"
      }
    };

    const buffer = pass.getAsBuffer();

    const headers = new Headers();
    headers.set("Content-Type", "application/vnd.apple.pkpass");
    headers.set("Content-Disposition", `attachment; filename="cadesca_pass.pkpass"`);

    return new NextResponse(new Uint8Array(buffer), { headers });
  } catch (error) {
    console.error("[apple_wallet] generation_failed", { reason: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
