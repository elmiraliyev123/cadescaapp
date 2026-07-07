"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { demoModeEnabled } from "@/lib/appConfig";

import { ScreenHeader } from "@/components/screens/ScreenHeader";
import { StatCard } from "@/components/cards/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  canCancelRestaurantCheckIn,
  getCurrentMerchantRestaurant,
  getCurrentMerchant,
  getRestaurantCheckIns,
  getRestaurantSalesSummary,
  hasStudentUsedAccessToday,
  resolveCadescaQrToken,
  useDemoState,
  extractQrToken
} from "@/lib/demoStore";
import { useLanguage } from "@/lib/i18n";
import type { Restaurant, RestaurantMenuItem, StudentCheckIn, User } from "@/lib/demoData";
import jsQR from "jsqr";

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function useMerchantContext() {
  const { state } = useDemoState();
  const merchantUser = getCurrentMerchant(state);
  const restaurant = getCurrentMerchantRestaurant(state);
  return { state, merchantUser, restaurant };
}

function MissingRestaurant() {
  const { t } = useLanguage();
  return (
    <section>
      <ScreenHeader title={t("merchant.restaurantProfile")} description={t("merchant.restaurantNotAssigned")} />
      <div className="premium-card p-6">
        <Badge tone="warning">{t("common.pending")}</Badge>
        <p className="mt-4 max-w-xl text-body-md text-secondary">{t("merchant.restaurantNotAssigned")}</p>
      </div>
    </section>
  );
}

function SalesTable({
  rows,
  restaurant,
  onCancel
}: {
  rows: StudentCheckIn[];
  restaurant: Restaurant;
  onCancel: (row: StudentCheckIn) => void;
}) {
  const { t } = useLanguage();

  return (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      columns={[
        { header: t("common.user"), cell: (row) => row.userName },
        { header: t("common.type"), cell: (row) => "Student Menu" },
        { header: t("merchant.menu"), cell: (row) => row.menuItemName || "Student Menu" },
        {
          header: t("common.status"),
          cell: (row) => <Badge tone={row.status === "confirmed" ? "success" : "warning"}>{row.status === "confirmed" ? t("student.confirmed") : t("student.cancelled")}</Badge>
        },
        { header: t("common.created"), cell: (row) => formatDateTime(row.createdAt) },
        { header: t("common.cancel"), cell: (row) => row.cancelledAt ? formatDateTime(row.cancelledAt) : "-" },
        {
          header: t("common.actions"),
          cell: (row) =>
            row.status === "confirmed" ? (
              <Button size="sm" variant="secondary" icon="cancel" disabled={!canCancelRestaurantCheckIn(row, restaurant.id)} onClick={() => onCancel(row)}>
                {canCancelRestaurantCheckIn(row, restaurant.id) ? t("student.cancelCheckIn") : t("merchant.cancellationWindowExpired")}
              </Button>
            ) : (
              <span className="text-caption font-semibold text-secondary">{t("student.cancelled")}</span>
            )
        }
      ]}
    />
  );
}

export function MerchantQrVerificationPage() {
  const { state, merchantUser, restaurant } = useMerchantContext();
  const { dispatch } = useDemoState();
  const { t, language } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [qrToken, setQrToken] = useState("");
  const [verifiedUser, setVerifiedUser] = useState<User | null>(null);
  const [verifiedToken, setVerifiedToken] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scannerState, setScannerState] = useState<"idle" | "requesting_permission" | "scanning" | "detected" | "verifying" | "error">("idle");
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      try {
        detectorRef.current = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      } catch (e) {
        console.error("BarcodeDetector init error", e);
      }
    }
    return () => {
      stopCamera();
    };
  }, []);

  if (!merchantUser || !restaurant) return <MissingRestaurant />;
  const restaurantId = restaurant.id;

  const rows = getRestaurantCheckIns(state, restaurant.id);
  const usedToday = verifiedUser ? hasStudentUsedAccessToday(state, verifiedUser.id) : false;
  const isEligible = Boolean(verifiedUser?.studentStatus === "verified" && verifiedUser.studentMenuAccess);
  const activeStudentItem = restaurant.menuItems.find((item) => item.studentMenuEligible && item.status === "active");

  async function startCamera() {
    setCameraError("");
    setScannerState("requesting_permission");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
      }
      setScannerState("scanning");
      scanFrame();
    } catch {
      setScannerState("error");
      setCameraError(language === "az" ? "QR skan üçün kamera icazəsi lazımdır." : language === "ru" ? "Для сканирования QR требуется доступ к камере." : "Camera permission is required to scan QR codes.");
    }
  }

  function stopCamera(newState: "idle" | "error" | "verifying" | "detected" = "idle") {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScannerState(newState);
  }

  function scanFrame() {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    
    // Safety check - avoid scanning if not actively supposed to
    if (streamRef.current === null) return;

    const video = videoRef.current;
    
    if (detectorRef.current) {
      detectorRef.current.detect(video).then((barcodes: any[]) => {
        if (barcodes.length > 0) {
          handleQrDetected(barcodes[0].rawValue);
        } else {
          animationFrameRef.current = requestAnimationFrame(scanFrame);
        }
      }).catch((err: any) => {
        runJsQr(video);
      });
    } else {
      runJsQr(video);
    }
  }

  function runJsQr(video: HTMLVideoElement) {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        handleQrDetected(code.data);
        return;
      }
    }
    animationFrameRef.current = requestAnimationFrame(scanFrame);
  }

  function handleQrDetected(rawValue: string) {
    const token = extractQrToken(rawValue);
    if (!token) {
      stopCamera("error");
      setVerifyError(language === "az" ? "Yanlış Cadesca QR." : language === "ru" ? "Неверный QR-код Cadesca." : "Invalid Cadesca QR.");
      return;
    }
    
    stopCamera("verifying");
    // Do not overwrite manual input if the user was typing something, but for camera, fill it.
    setQrToken(token);
    setTimeout(() => {
      handleVerifyQrWithToken(rawValue);
    }, 500);
  }

  async function handleVerifyQrWithToken(rawQrContent: string) {
    let result: any;
    
    setVerifiedUser(null);
    setVerifiedToken("");

    if (!demoModeEnabled) {
      try {
        const token = extractQrToken(rawQrContent);
        if (!token) throw new Error("invalid_format");

        const res = await fetch("/api/merchant/verify-qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });
        
        const data = await res.json();
        if (!res.ok) {
          result = { invalid: true, reason: data.error };
        } else {
          result = { invalid: false, user: data.user, qrToken: data.qrToken };
        }
      } catch (err: any) {
        result = { invalid: true, reason: err.message || "internal_server_error" };
      }
    } else {
      result = resolveCadescaQrToken(state, rawQrContent, now);
    }

    if (result.invalid) {
      setScannerState("error");
      if (result.reason === "invalid_format") {
        setVerifyError(language === "az" ? "Yanlış Cadesca QR." : language === "ru" ? "Неверный QR-код Cadesca." : "Invalid Cadesca QR.");
      } else if (result.reason === "token_not_found") {
        setVerifyError(language === "az" ? "Cadesca QR tapılmadı." : language === "ru" ? "QR-код Cadesca не найден." : "Cadesca QR not found.");
      } else if (result.reason === "token_expired") {
        setVerifyError(language === "az" ? "QR kodun vaxtı bitib. İstifadəçidən yeni QR göstərməsini istəyin." : language === "ru" ? "Срок действия QR-кода истёк. Попросите пользователя показать новый QR." : "QR code expired. Ask the user to show a new QR.");
      } else if (result.reason === "user_not_found") {
        setVerifyError(language === "az" ? "İstifadəçi tapılmadı." : language === "ru" ? "Пользователь не найден." : "User not found.");
      } else if (result.reason === "user_suspended" || result.reason === "account_inactive") {
        setVerifyError(language === "az" ? "Bu hesab aktiv deyil." : language === "ru" ? "Этот аккаунт не активен." : "This account is not active.");
      } else if (result.reason === "not_student_eligible") {
        setVerifyError(language === "az" ? "Bu hesab üçün Student Menu girişi aktiv deyil." : language === "ru" ? "Для этого аккаунта доступ к Student Menu не включён." : "Student Menu access is not enabled for this account.");
      } else if (result.reason === "already_used_today") {
        setVerifyError(language === "az" ? "Bu tələbə Student Menu girişini bu gün artıq istifadə edib." : language === "ru" ? "Этот студент уже использовал доступ к Student Menu сегодня." : "This student has already used Student Menu access today.");
      } else {
        setVerifyError("Verification failed.");
      }
      return;
    }

    if (!result.user || !result.qrToken) {
      setVerifyError(t("student.studentQrNotRecognized"));
      setScannerState("error");
      return;
    }

    setVerifiedUser(result.user);
    setVerifiedToken(result.qrToken.token);

    if (result.user.studentStatus !== "verified" || !result.user.studentMenuAccess) {
      setVerifyError(language === "az" ? "Bu hesab üçün Student Menu girişi aktiv deyil." : language === "ru" ? "Для этого аккаунта доступ к Student Menu не включён." : "Student Menu access is not enabled for this account.");
      setScannerState("error");
      return;
    }
    if (hasStudentUsedAccessToday(state, result.user.id)) {
      setVerifyError(language === "az" ? "Bu tələbə Student Menu girişini bu gün artıq istifadə edib." : language === "ru" ? "Этот студент уже использовал доступ к Student Menu сегодня." : "This student has already used Student Menu access today.");
      setScannerState("error");
      return;
    }

    setVerifyError("");
    setScannerState("idle");
    setConfirmOpen(true);
  }

  function handleVerifyQr(eventOrToken?: React.MouseEvent | string) {
    if (typeof eventOrToken === "string") {
      handleVerifyQrWithToken(eventOrToken);
    } else {
      handleVerifyQrWithToken(qrToken);
    }
  }



  async function handleConfirmCheckIn() {
    if (!verifiedUser || !verifiedToken || !merchantUser || !restaurant || usedToday || !isEligible) return;
    
    if (!demoModeEnabled) {
      try {
        const res = await fetch("/api/merchant/confirm-check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: verifiedToken,
            userId: verifiedUser.id,
            restaurantId: restaurant.id,
            menuItemId: activeStudentItem?.id
          })
        });
        
        if (!res.ok) {
          const data = await res.json();
          setVerifyError(data.error || "Failed to confirm check-in");
          return;
        }
      } catch (e: any) {
        setVerifyError("Network error: " + e.message);
        return;
      }
    } else {
      dispatch({
        type: "CONFIRM_STUDENT_MENU_CHECK_IN",
        payload: {
          userId: verifiedUser.id,
          restaurantId: restaurant.id,
          merchantUserId: merchantUser.id,
          token: verifiedToken,
          menuItemId: activeStudentItem?.id
        }
      });
    }

    setConfirmOpen(false);
    setQrToken("");
    setVerifiedUser(null);
    setVerifiedToken("");
  }

  return (
    <section>
      <ScreenHeader
        title={t("merchant.qrScan")}
        description={t("student.cadescaQrVerificationDescription")}
        action={<Badge tone="inverse">{restaurant.name}</Badge>}
      />

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="space-y-5">
          <div className="premium-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-headline-md font-semibold text-primary">{t("merchant.qrScan")}</h2>
                <p className="mt-2 text-body-md text-secondary">{t("merchant.directPaymentNote")}</p>
              </div>
              <Badge>{restaurant.status === "open" ? t("restaurants.open") : t("restaurants.closed")}</Badge>
            </div>
            <div className="mt-5 overflow-hidden rounded-xl border border-outline-variant/70 bg-surface-container-low relative">
              <video ref={videoRef} className={`aspect-[4/3] w-full object-cover ${scannerState === "idle" || scannerState === "error" ? "bg-primary/5" : ""}`} muted playsInline />
              {(scannerState === "idle" || scannerState === "error") && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-container-low">
                  <span className="material-symbols-outlined text-[48px] text-secondary" aria-hidden="true">qr_code_scanner</span>
                  <p className="text-label-md font-semibold text-primary">{t("merchant.qrScan")}</p>
                  <p className="max-w-[240px] text-center text-caption font-medium text-secondary">{t("merchant.enterQrManually")}</p>
                </div>
              )}
              {(scannerState === "scanning" || scannerState === "detected" || scannerState === "verifying") && (
                <div className="absolute inset-0 border-4 border-primary/50 bg-black/10 flex items-center justify-center">
                   <div className="w-48 h-48 border-2 border-primary rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
                </div>
              )}
            </div>
            {(scannerState === "scanning" || scannerState === "detected" || scannerState === "verifying") && (
              <p className="mt-3 text-label-md font-semibold text-primary text-center">
                {scannerState === "scanning" ? (language === "az" ? "Kamera aktivdir. Cadesca QR kodunu kameraya göstərin." : language === "ru" ? "Камера активна. Покажите QR-код Cadesca в камеру." : "Camera is active. Show the Cadesca QR to the camera.") : (language === "az" ? "QR tapıldı. Yoxlanılır..." : language === "ru" ? "QR найден. Проверяется..." : "QR detected. Verifying...")}
              </p>
            )}
            {cameraError ? <p className="mt-3 text-caption font-semibold text-secondary text-center">{cameraError}</p> : null}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button variant="secondary" icon="photo_camera" onClick={startCamera} disabled={scannerState === "scanning" || scannerState === "requesting_permission"}>
                {t("merchant.startCamera")}
              </Button>
              <Button variant="secondary" icon="videocam_off" onClick={() => stopCamera("idle")} disabled={scannerState === "idle" || scannerState === "error"}>
                {t("merchant.stopCamera")}
              </Button>
            </div>
          </div>

          <div className="premium-card p-5">
            <Input
              label={t("merchant.enterQrManually")}
              icon="qr_code_scanner"
              value={qrToken}
              onChange={(event) => {
                setQrToken(event.target.value);
                setVerifyError("");
                setVerifiedUser(null);
              }}
              placeholder="https://app.cadesca.com/verify?t=..."
            />
            {verifyError ? <p className="mt-3 rounded-lg border border-outline-variant/70 bg-surface-container-low p-3 text-caption font-semibold text-secondary">{verifyError}</p> : null}
            <Button className="mt-4 w-full" size="lg" icon="verified" onClick={handleVerifyQr} disabled={!qrToken.trim()}>
              {t("merchant.verifyQr")}
            </Button>
          </div>
        </div>

        <div className="premium-card p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-headline-md font-semibold text-primary">{t("merchant.checkInHistory")}</h2>
            <Badge>{rows.filter((row) => row.status === "confirmed").length} {t("student.confirmed")}</Badge>
          </div>
          {rows.length ? (
            <SalesTable rows={rows.slice(0, 8)} restaurant={restaurant} onCancel={(row) => dispatch({ type: "CANCEL_STUDENT_CHECK_IN", payload: { checkInId: row.id, restaurantId: restaurant.id } })} />
          ) : (
            <p className="text-label-md font-semibold text-secondary">{t("merchant.noSalesYet")}</p>
          )}
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmCheckIn}
        title={t("student.confirmStudentMenuCheckInQuestion")}
        description={t("merchant.directPaymentNote")}
        confirmLabel={t("student.confirmCheckIn")}
        cancelLabel={t("common.cancel")}
      >
        <div className="grid gap-3">
          {[
            [t("common.user"), verifiedUser?.name],
            [t("admin.universityName"), verifiedUser?.universityName || "-"],
            [t("common.status"), isEligible ? t("student.verifiedStudent") : t("student.notVerified")],
            [t("merchant.restaurantProfile"), restaurant.name],
            [t("student.dailyUsageStatus"), usedToday ? t("merchant.alreadyUsedToday") : t("student.availableToday")]
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-3">
              <p className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{label}</p>
              <p className="mt-1 text-label-md font-semibold text-primary">{value}</p>
            </div>
          ))}
        </div>
      </Modal>
    </section>
  );
}

export function MerchantSalesPage() {
  const { state, merchantUser, restaurant } = useMerchantContext();
  const { dispatch } = useDemoState();
  const { t } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "cancelled">("all");
  const [periodFilter, setPeriodFilter] = useState<"today" | "week" | "month" | "year">("today");

  if (!merchantUser || !restaurant) return <MissingRestaurant />;

  const summary = getRestaurantSalesSummary(state, restaurant.id);
  const now = new Date();
  const filteredRows = summary.rows.filter((row) => {
    if (statusFilter !== "all" && row.status !== statusFilter) return false;
    const created = new Date(row.createdAt);
    if (periodFilter === "today") return row.dateKey === now.toISOString().slice(0, 10);
    if (periodFilter === "week") return created >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    if (periodFilter === "month") return created >= new Date(now.getFullYear(), now.getMonth(), 1);
    return created >= new Date(now.getFullYear(), 0, 1);
  });

  return (
    <section>
      <ScreenHeader title={t("merchant.sales")} description={restaurant.name} action={<Badge tone="inverse">{merchantUser.email}</Badge>} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label={t("merchant.totalToday")} value={`${summary.totalToday}`} detail={t("merchant.directPaymentNote")} icon="today" />
        <StatCard label={t("merchant.confirmedToday")} value={`${summary.confirmedToday}`} detail={t("student.confirmed")} icon="verified" />
        <StatCard label={t("merchant.cancelledToday")} value={`${summary.cancelledToday}`} detail={t("student.cancelled")} icon="cancel" />
        <StatCard label={t("merchant.weeklyTotal")} value={`${summary.weeklyTotal}`} detail={restaurant.name} icon="calendar_view_week" />
        <StatCard label={t("merchant.monthlyTotal")} value={`${summary.monthlyTotal}`} detail={restaurant.name} icon="calendar_month" />
        <StatCard label={t("merchant.yearlyTotal")} value={`${summary.yearlyTotal}`} detail={restaurant.name} icon="bar_chart" />
      </div>
      <div className="mt-5 premium-card p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {(["today", "week", "month", "year"] as const).map((period) => (
            <Button key={period} size="sm" variant={periodFilter === period ? "primary" : "secondary"} onClick={() => setPeriodFilter(period)}>
              {period === "today" ? t("common.today") : period === "week" ? t("merchant.weeklyTotal") : period === "month" ? t("merchant.monthlyTotal") : t("merchant.yearlyTotal")}
            </Button>
          ))}
          {(["all", "confirmed", "cancelled"] as const).map((status) => (
            <Button key={status} size="sm" variant={statusFilter === status ? "primary" : "secondary"} onClick={() => setStatusFilter(status)}>
              {status === "all" ? t("common.all") : status === "confirmed" ? t("student.confirmed") : t("student.cancelled")}
            </Button>
          ))}
        </div>
        {filteredRows.length ? (
          <SalesTable rows={filteredRows} restaurant={restaurant} onCancel={(row) => dispatch({ type: "CANCEL_STUDENT_CHECK_IN", payload: { checkInId: row.id, restaurantId: restaurant.id } })} />
        ) : (
          <p className="text-label-md font-semibold text-secondary">{t("merchant.noSalesYet")}</p>
        )}
      </div>
    </section>
  );
}

export function MerchantMenuPage() {
  const { merchantUser, restaurant } = useMerchantContext();
  const { dispatch } = useDemoState();
  const { t } = useLanguage();
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<RestaurantMenuItem | null>(null);
  const [itemName, setItemName] = useState("Student Lunch Set");
  const [description, setDescription] = useState("Daily Student Menu meal.");
  const [price, setPrice] = useState("0");
  const [currency, setCurrency] = useState<"AZN" | "EUR" | "TRY">("AZN");
  const [category, setCategory] = useState("Lunch");
  const [studentEligible, setStudentEligible] = useState(true);
  const [status, setStatus] = useState<"active" | "inactive">("active");

  if (!merchantUser || !restaurant) return <MissingRestaurant />;
  const restaurantId = restaurant.id;
  const visibleMenuItems = restaurant.menuItems.filter((item) => item.status !== "deleted");

  function openEdit(item?: RestaurantMenuItem) {
    setEditItem(item || null);
    setMenuModalOpen(true);
    setItemName(item?.name || "");
    setDescription(item?.description || "");
    setPrice(String(item?.price ?? 0));
    setCurrency(item?.currency || "AZN");
    setCategory(item?.category || "Lunch");
    setStudentEligible(item?.studentMenuEligible ?? true);
    setStatus(item?.status === "inactive" ? "inactive" : "active");
  }

  function saveItem() {
    const payload = {
      restaurantId,
      name: itemName,
      description,
      price: Number.parseFloat(price),
      currency,
      category,
      studentMenuEligible: studentEligible
    };
    if (editItem) {
      dispatch({ type: "UPDATE_RESTAURANT_MENU_ITEM", payload: { ...payload, itemId: editItem.id, status } });
    } else {
      dispatch({ type: "ADD_RESTAURANT_MENU_ITEM", payload });
    }
    setEditItem(null);
    setMenuModalOpen(false);
  }

  return (
    <section>
      <ScreenHeader title={t("merchant.menu")} description={restaurant.name} action={<Button icon="add" onClick={() => openEdit()}>{t("merchant.addMenuItem")}</Button>} />
      <div className="premium-card p-5">
        <DataTable
          rows={visibleMenuItems}
          getRowKey={(row) => row.id}
          columns={[
            { header: t("merchant.menu"), cell: (row) => row.name },
            { header: t("common.description"), cell: (row) => row.description },
            { header: t("merchant.price"), cell: (row) => row.priceText },
            { header: t("common.category"), cell: (row) => row.category },
            { header: "Student Menu", cell: (row) => <Badge tone={row.studentMenuEligible ? "success" : "default"}>{row.studentMenuEligible ? t("common.active") : t("common.inactive")}</Badge> },
            { header: t("common.status"), cell: (row) => <Badge tone={row.status === "active" ? "success" : "warning"}>{row.status === "active" ? t("common.active") : t("common.inactive")}</Badge> },
            {
              header: t("common.actions"),
              cell: (row) => (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" icon="edit" onClick={() => openEdit(row)}>{t("common.save")}</Button>
                  <Button size="sm" variant="secondary" icon="power_settings_new" onClick={() => dispatch({ type: "TOGGLE_RESTAURANT_MENU_ITEM", payload: { restaurantId, itemId: row.id } })}>
                    {row.status === "active" ? t("common.inactive") : t("common.active")}
                  </Button>
                  <Button size="sm" variant="secondary" icon="delete" onClick={() => dispatch({ type: "DELETE_RESTAURANT_MENU_ITEM", payload: { restaurantId, itemId: row.id } })}>{t("common.delete")}</Button>
                </div>
              )
            }
          ]}
        />
      </div>
      <Modal open={menuModalOpen} onClose={() => setMenuModalOpen(false)} onConfirm={saveItem} title={editItem ? t("merchant.editMenuItem") : t("merchant.addMenuItem")} description={t("merchant.visibleInUserApp")} confirmLabel={t("common.save")}>
        <div className="grid gap-4 p-1">
          <Input label={t("merchant.menu")} icon="restaurant_menu" value={itemName} onChange={(event) => setItemName(event.target.value)} />
          <Input label={t("common.description")} icon="notes" value={description} onChange={(event) => setDescription(event.target.value)} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("merchant.price")} icon="payments" value={price} onChange={(event) => setPrice(event.target.value)} />
            <label className="block">
              <span className="mb-2 block text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{t("common.currency")}</span>
              <select value={currency} onChange={(event) => setCurrency(event.target.value as "AZN" | "EUR" | "TRY")} className="h-11 w-full rounded-lg border border-outline-variant/80 bg-surface-container-lowest px-4 text-body-md text-on-surface outline-none focus:border-primary">
                <option value="AZN">AZN</option>
                <option value="EUR">EUR</option>
                <option value="TRY">TRY</option>
              </select>
            </label>
          </div>
          <Input label={t("common.category")} icon="category" value={category} onChange={(event) => setCategory(event.target.value)} />
          <label className="flex items-center gap-3 rounded-lg border border-outline-variant/70 bg-surface-container-low p-3 text-label-md font-semibold text-primary">
            <input type="checkbox" checked={studentEligible} onChange={(event) => setStudentEligible(event.target.checked)} />
            Student Menu
          </label>
          {editItem ? (
            <label className="block">
              <span className="mb-2 block text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{t("common.status")}</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as "active" | "inactive")} className="h-11 w-full rounded-lg border border-outline-variant/80 bg-surface-container-lowest px-4 text-body-md text-on-surface outline-none focus:border-primary">
                <option value="active">{t("common.active")}</option>
                <option value="inactive">{t("common.inactive")}</option>
              </select>
            </label>
          ) : null}
        </div>
      </Modal>
    </section>
  );
}

export function MerchantRestaurantProfilePage() {
  const { merchantUser, restaurant } = useMerchantContext();
  const { dispatch } = useDemoState();
  const { t, language, setLanguage } = useLanguage();
  const [name, setName] = useState(restaurant?.name || "");
  const [bio, setBio] = useState(restaurant?.bio || "");
  const [address, setAddress] = useState(restaurant?.address || "");
  const [city, setCity] = useState(restaurant?.city || "");
  const [country, setCountry] = useState(restaurant?.country || "");
  const [lat, setLat] = useState(restaurant?.lat == null ? "" : String(restaurant.lat));
  const [lng, setLng] = useState(restaurant?.lng == null ? "" : String(restaurant.lng));
  const [phone, setPhone] = useState(restaurant?.phone || "");
  const [openingHours, setOpeningHours] = useState(restaurant?.openingHours || "");
  const [status, setStatus] = useState<"open" | "closed">((restaurant?.status === "open" || restaurant?.status === "closed") ? restaurant.status : "closed");
  const [studentMenuEligible, setStudentMenuEligible] = useState(Boolean(restaurant?.studentMenuEligible));
  const [password, setPassword] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [coordinatesOpen, setCoordinatesOpen] = useState(false);

  useEffect(() => {
    if (!restaurant) return;
    setName(restaurant.name);
    setBio(restaurant.bio);
    setAddress(restaurant.address);
    setCity(restaurant.city);
    setCountry(restaurant.country);
    setLat(restaurant.lat == null ? "" : String(restaurant.lat));
    setLng(restaurant.lng == null ? "" : String(restaurant.lng));
    setPhone(restaurant.phone);
    setOpeningHours(restaurant.openingHours);
    setStatus((restaurant.status === "open" || restaurant.status === "closed") ? restaurant.status : "closed");
    setStudentMenuEligible(restaurant.studentMenuEligible);
  }, [restaurant?.id]);

  if (!merchantUser || !restaurant) return <MissingRestaurant />;
  const restaurantId = restaurant.id;
  function saveProfile() {
    const parsedLat = lat.trim() ? Number.parseFloat(lat) : null;
    const parsedLng = lng.trim() ? Number.parseFloat(lng) : null;
    dispatch({
      type: "UPDATE_RESTAURANT_PROFILE",
      payload: {
        restaurantId,
        name,
        bio,
        address,
        city,
        country,
        lat: parsedLat !== null && Number.isFinite(parsedLat) ? parsedLat : null,
        lng: parsedLng !== null && Number.isFinite(parsedLng) ? parsedLng : null,
        phone,
        openingHours,
        status,
        studentMenuEligible,
        profilePasswordOrMockPassword: password || undefined
      }
    });
  }

  return (
    <section>
      <ScreenHeader title={t("merchant.restaurantProfile")} description={t("merchant.visibleInUserApp")} action={<Button icon="save" onClick={saveProfile}>{t("common.save")}</Button>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="premium-card p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label={t("merchant.restaurantProfile")} icon="storefront" value={name} onChange={(event) => setName(event.target.value)} />
            <Input label={t("common.phone")} icon="call" value={phone} onChange={(event) => setPhone(event.target.value)} />
            <Input label={t("common.bio")} icon="notes" value={bio} onChange={(event) => setBio(event.target.value)} />
            <Input label={t("common.city")} icon="location_city" value={city} onChange={(event) => setCity(event.target.value)} />
            <Input label={t("common.country")} icon="public" value={country} onChange={(event) => setCountry(event.target.value)} />
            <Input label={t("merchant.openingHours")} icon="schedule" value={openingHours} onChange={(event) => setOpeningHours(event.target.value)} />
          </div>
          <div className="mt-4 rounded-lg border border-outline-variant/70 bg-surface-container-low p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0 flex-1">
                <Input label={t("common.location")} icon="location_on" value={address} onChange={(event) => setAddress(event.target.value)} placeholder={t("common.locationNotAdded")} />
              </div>
              <Button variant="secondary" icon="map" onClick={() => undefined}>{t("common.chooseOnMap")}</Button>
            </div>
            <button
              type="button"
              className="mt-3 text-caption font-semibold text-secondary transition-colors hover:text-primary"
              onClick={() => setCoordinatesOpen((open) => !open)}
            >
              {coordinatesOpen ? t("common.close") : t("common.advancedCoordinates")}
            </button>
            {coordinatesOpen ? (
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <Input label={t("common.latitude")} icon="pin_drop" value={lat} onChange={(event) => setLat(event.target.value)} />
                <Input label={t("common.longitude")} icon="pin_drop" value={lng} onChange={(event) => setLng(event.target.value)} />
              </div>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{t("common.status")}</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as "open" | "closed")} className="h-11 w-full rounded-lg border border-outline-variant/80 bg-surface-container-lowest px-4 text-body-md text-on-surface outline-none focus:border-primary">
                <option value="open">{t("restaurants.open")}</option>
                <option value="closed">{t("restaurants.closed")}</option>
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-outline-variant/70 bg-surface-container-low p-3 text-label-md font-semibold text-primary">
              <input type="checkbox" checked={studentMenuEligible} onChange={(event) => setStudentMenuEligible(event.target.checked)} />
              Student Menu
            </label>
          </div>
          <div className="mt-4 rounded-lg border border-outline-variant/70 bg-surface-container-low p-4">
            <Button variant="secondary" icon="lock_reset" onClick={() => setPasswordOpen((open) => !open)}>
              {t("merchant.changePassword")}
            </Button>
            {passwordOpen ? (
              <div className="mt-4">
                <Input label={t("login.password")} icon="lock" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>
            ) : null}
          </div>
        </div>
        <div className="premium-card p-5">
          <h2 className="text-headline-md font-semibold text-primary">{restaurant.name}</h2>
          <p className="mt-2 text-body-md text-secondary">{restaurant.bio}</p>
          <div className="mt-4 divide-y divide-outline-variant/70">
            <p className="py-3 text-label-md font-semibold text-primary">{restaurant.address || t("common.locationNotAdded")}</p>
            <p className="py-3 text-label-md font-semibold text-primary">{restaurant.openingHours}</p>
            <p className="py-3 text-label-md font-semibold text-primary">{restaurant.phone}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 max-w-xl">
        <div className="premium-card p-6">
          <h2 className="text-headline-md font-semibold text-primary">{t("common.language")}</h2>
          <div className="mt-4 flex flex-col gap-2">
            {[
              { code: "az", label: "Azərbaycanca" },
              { code: "en", label: "English" },
              { code: "ru", label: "Русский" }
            ].map((option) => (
              <button
                key={option.code}
                onClick={() => setLanguage(option.code as any)}
                className={"flex items-center justify-between rounded-xl border p-4 text-left transition-colors " + (language === option.code ? "border-primary bg-surface-container-highest" : "border-outline-variant/70 bg-surface-container-low hover:border-primary/50")}
              >
                <span className={"text-label-md font-semibold " + (language === option.code ? "text-primary" : "text-secondary")}>{option.label}</span>
                {language === option.code && <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">check</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function MerchantReportsPage() {
  const { state, merchantUser, restaurant } = useMerchantContext();
  const { t } = useLanguage();

  if (!merchantUser || !restaurant) return <MissingRestaurant />;

  const summary = getRestaurantSalesSummary(state, restaurant.id);
  const topItems = new Map<string, number>();
  for (const row of summary.rows) {
    topItems.set(row.menuItemName || "Student Menu", (topItems.get(row.menuItemName || "Student Menu") || 0) + 1);
  }
  const reportRows = summary.rows.slice(0, 20);

  function exportPdf() {
    window.print();
  }

  return (
    <section>
      <ScreenHeader title={t("merchant.reports")} description={restaurant.name} action={<Button icon="picture_as_pdf" onClick={exportPdf}>{t("merchant.exportPdf")}</Button>} />
      <div className="grid gap-5 md:grid-cols-4">
        <StatCard label={t("student.confirmed")} value={`${summary.rows.filter((row) => row.status === "confirmed").length}`} detail={t("merchant.directPaymentNote")} icon="verified" />
        <StatCard label={t("student.cancelled")} value={`${summary.rows.filter((row) => row.status === "cancelled").length}`} detail={t("merchant.cancellationWindowExpired")} icon="cancel" />
        <StatCard label={t("merchant.net")} value={`${summary.rows.filter((row) => row.status === "confirmed").length}`} detail={restaurant.name} icon="bar_chart" />
        <StatCard label={t("merchant.generated")} value={formatDate(new Date().toISOString())} detail="Cadesca" icon="event" />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="premium-card p-5 print:border-0">
          <div className="mb-5">
            <h2 className="text-headline-md font-semibold text-primary">Cadesca {t("merchant.reports")}</h2>
            <p className="mt-1 text-body-md text-secondary">{restaurant.name} · {formatDate(new Date().toISOString())}</p>
            <p className="mt-2 text-caption font-semibold text-secondary">{t("merchant.reportDisclaimer")}</p>
          </div>
          {reportRows.length ? (
            <SalesTable rows={reportRows} restaurant={restaurant} onCancel={() => undefined} />
          ) : (
            <p className="text-label-md font-semibold text-secondary">{t("merchant.noSalesYet")}</p>
          )}
        </div>
        <div className="premium-card p-5">
          <h2 className="text-headline-md font-semibold text-primary">{t("merchant.topMenuItems")}</h2>
          <div className="mt-4 divide-y divide-outline-variant/70">
            {[...topItems.entries()].map(([name, count]) => (
              <div key={name} className="flex items-center justify-between py-3">
                <span className="text-label-md font-semibold text-primary">{name}</span>
                <Badge>{count}</Badge>
              </div>
            ))}
            {topItems.size === 0 ? <p className="text-label-md font-semibold text-secondary">{t("merchant.noSalesYet")}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
