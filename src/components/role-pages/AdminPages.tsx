"use client";

import { useMemo, useState } from "react";

import {
  getCancelledStudentCheckIns,
  getConfirmedStudentCheckInsToday,
  getPendingMerchantApprovals,
  getVerifiedStudentUsers,
  normalizeEmailExtension,
  useDemoState
} from "@/lib/demoStore";
import { useLanguage } from "@/lib/i18n";
import type { MerchantUser, Restaurant, StudentCheckIn, User } from "@/lib/demoData";
import { AdminOverviewScreen } from "@/components/screens/AdminOverviewScreen";
import { ScreenHeader } from "@/components/screens/ScreenHeader";
import { StatCard } from "@/components/cards/StatCard";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { demoModeEnabled } from "@/lib/appConfig";
import { EmptyState } from "@/components/ui/EmptyState";

type UserFormState = {
  name: string;
  email: string;
  password: string;
  emailVerified: boolean;
  studentVerified: boolean;
  universityName: string;
  universityDomain: string;
  status: User["status"];
};

type MerchantFormState = {
  restaurantName: string;
  merchantOwnerName: string;
  merchantOwnerEmail: string;
  initialPassword: string;
  bio: string;
  address: string;
  city: string;
  country: string;
  lat: string;
  lng: string;
  phone: string;
  openingHours: string;
  studentMenuEligible: boolean;
  restaurantStatus: Restaurant["status"];
};

type ActivityRow = {
  id: string;
  merchant: string;
  user: string;
  detail: string;
  action?: string;
  status: string;
  createdAt: string;
  kind: "checkin" | "audit";
};

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function emptyUserForm(): UserFormState {
  return {
    name: "",
    email: "",
    password: "",
    emailVerified: true,
    studentVerified: false,
    universityName: "",
    universityDomain: "",
    status: "active"
  };
}

function userToForm(user: User): UserFormState {
  return {
    name: user.name,
    email: user.email,
    password: "",
    emailVerified: user.emailVerified,
    studentVerified: user.studentStatus === "verified" && user.studentMenuAccess,
    universityName: user.universityName || "",
    universityDomain: user.universityDomain || "",
    status: user.status
  };
}

function emptyMerchantForm(): MerchantFormState {
  return {
    restaurantName: "",
    merchantOwnerName: "",
    merchantOwnerEmail: "",
    initialPassword: "",
    bio: "",
    address: "",
    city: "",
    country: "Azerbaijan",
    lat: "",
    lng: "",
    phone: "",
    openingHours: "09:00-18:00",
    studentMenuEligible: false,
    restaurantStatus: "open"
  };
}

function merchantToForm(merchant: MerchantUser, restaurant?: Restaurant | null): MerchantFormState {
  return {
    restaurantName: restaurant?.name || "",
    merchantOwnerName: merchant.name,
    merchantOwnerEmail: merchant.email,
    initialPassword: "",
    bio: restaurant?.bio || "",
    address: restaurant?.address || "",
    city: restaurant?.city || "",
    country: restaurant?.country || "Azerbaijan",
    lat: restaurant?.lat == null ? "" : String(restaurant.lat),
    lng: restaurant?.lng == null ? "" : String(restaurant.lng),
    phone: restaurant?.phone || "",
    openingHours: restaurant?.openingHours || "",
    studentMenuEligible: Boolean(restaurant?.studentMenuEligible),
    restaurantStatus: restaurant?.status || "open"
  };
}



function SelectField<T extends string>({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-11 w-full rounded-lg border border-outline-variant/80 bg-surface-container-lowest px-4 text-body-md text-on-surface outline-none transition-colors focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex h-11 items-center gap-3 rounded-lg border border-outline-variant/70 bg-surface-container-low px-3 text-label-md font-semibold text-primary">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function statusTone(status: string) {
  return status === "active" || status === "open" || status === "confirmed" ? "success" : status === "deleted" || status === "suspended" ? "warning" : "default";
}

function studentStatusLabel(user: User, t: ReturnType<typeof useLanguage>["t"]) {
  if (user.studentStatus === "verified" && user.studentMenuAccess) return t("management.studentVerified");
  if (user.studentStatus === "rejected") return t("management.rejected");
  if (user.studentStatus === "pending") return t("common.pending");
  return t("management.notVerified");
}

function buildActivityRows(checkIns: StudentCheckIn[], auditLogs: Array<{ id: string; action: string; targetType: string; targetId: string; details?: string; createdAt: string }>): ActivityRow[] {
  return [
    ...checkIns.map((checkIn) => ({
      id: checkIn.id,
      merchant: checkIn.merchantName,
      user: checkIn.userName || checkIn.studentName,
      detail: checkIn.menuItemName || "Student Menu",
      status: checkIn.status,
      createdAt: checkIn.createdAt,
      kind: "checkin" as const
    })),
    ...auditLogs.map((log) => ({
      id: log.id,
      merchant: "Cadesca",
      user: "Admin",
      detail: log.details || log.targetId,
      action: log.action,
      status: "active",
      createdAt: log.createdAt,
      kind: "audit" as const
    }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function activityDetailLabel(row: ActivityRow, t: ReturnType<typeof useLanguage>["t"]) {
  if (row.kind === "checkin") return row.detail;
  if (row.action === "ADMIN_CREATE_USER") return t("management.userCreated");
  if (row.action === "ADMIN_UPDATE_USER") return t("management.userUpdated");
  if (row.action === "MANUAL_VERIFY_STUDENT") return `${t("management.userVerifiedAsStudent")} ${row.detail}`;
  if (row.action === "REMOVE_STUDENT_VERIFICATION") return t("management.studentVerificationRemoved");
  if (row.action === "SUSPEND_USER") return t("management.userSuspended");
  if (row.action === "REACTIVATE_USER") return t("management.userReactivated");
  if (row.action === "DELETE_USER") return t("management.userDeleted");
  if (row.action === "ADMIN_CREATE_MERCHANT_ACCOUNT") return t("management.merchantCreated");
  if (row.action === "ADMIN_UPDATE_MERCHANT_ACCOUNT") return t("management.merchantUpdated");
  if (row.action === "SUSPEND_MERCHANT") return t("management.merchantSuspended");
  if (row.action === "REACTIVATE_MERCHANT") return t("management.merchantReactivated");
  if (row.action === "DELETE_MERCHANT") return t("management.merchantDeleted");
  if (row.action === "DELETE_RESTAURANT") return t("management.restaurantDeleted");
  return row.detail;
}

function UserForm({
  form,
  setForm,
  editing
}: {
  form: UserFormState;
  setForm: (updater: (current: UserFormState) => UserFormState) => void;
  editing: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="grid gap-4 p-1">
      <Input label={t("common.fullName")} icon="person" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
      <Input label={t("common.email")} icon="mail" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
      <Input
        label={editing ? `${t("common.password")} (${t("common.update")})` : t("management.initialPassword")}
        icon="lock"
        type="password"
        value={form.password}
        onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
        required={!editing}
      />
      <SelectField
        label={t("common.status")}
        value={form.status}
        onChange={(status) => setForm((current) => ({ ...current, status }))}
        options={[
          { value: "active", label: t("common.active") },
          { value: "suspended", label: t("common.suspended") },
          { value: "deleted", label: t("common.deleted") }
        ]}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <CheckboxField label={t("management.emailVerified")} checked={form.emailVerified} onChange={(emailVerified) => setForm((current) => ({ ...current, emailVerified }))} />
        <CheckboxField label={t("management.verifyAsStudent")} checked={form.studentVerified} onChange={(studentVerified) => setForm((current) => ({ ...current, studentVerified }))} />
      </div>
      {form.studentVerified ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Input label={t("management.universityName")} icon="school" value={form.universityName} onChange={(event) => setForm((current) => ({ ...current, universityName: event.target.value }))} required />
          <Input label={t("management.universityDomain")} icon="language" value={form.universityDomain} onChange={(event) => setForm((current) => ({ ...current, universityDomain: event.target.value }))} />
        </div>
      ) : null}
    </div>
  );
}

function MerchantForm({
  form,
  setForm,
  editing
}: {
  form: MerchantFormState;
  setForm: (updater: (current: MerchantFormState) => MerchantFormState) => void;
  editing: boolean;
}) {
  const { t } = useLanguage();
  const [coordinatesOpen, setCoordinatesOpen] = useState(false);
  return (
    <div className="grid gap-4 p-1">
      <section className="grid gap-4">
        <h3 className="text-label-lg font-semibold text-primary">{t("management.accountInformation")}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label={t("management.merchantOwnerName")} icon="person" value={form.merchantOwnerName} onChange={(event) => setForm((current) => ({ ...current, merchantOwnerName: event.target.value }))} required />
          <Input label={t("management.merchantOwnerEmail")} icon="mail" type="email" value={form.merchantOwnerEmail} onChange={(event) => setForm((current) => ({ ...current, merchantOwnerEmail: event.target.value }))} required />
          <Input
            label={editing ? `${t("management.resetPassword")} (${t("common.update")})` : t("management.initialPassword")}
            icon="lock"
            type="password"
            value={form.initialPassword}
            onChange={(event) => setForm((current) => ({ ...current, initialPassword: event.target.value }))}
            required={!editing}
          />
        </div>
      </section>

      <section className="grid gap-4 border-t border-outline-variant/70 pt-4">
        <h3 className="text-label-lg font-semibold text-primary">{t("management.restaurantInformation")}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label={t("management.restaurantName")} icon="storefront" value={form.restaurantName} onChange={(event) => setForm((current) => ({ ...current, restaurantName: event.target.value }))} required />
        <Input label={t("common.bio")} icon="notes" value={form.bio} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} />
        <Input label={t("common.phone")} icon="call" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
        <Input label={t("merchant.openingHours")} icon="schedule" value={form.openingHours} onChange={(event) => setForm((current) => ({ ...current, openingHours: event.target.value }))} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <SelectField
          label={t("management.restaurantStatus")}
          value={form.restaurantStatus}
          onChange={(restaurantStatus) => setForm((current) => ({ ...current, restaurantStatus }))}
          options={[
            { value: "open", label: t("common.open") },
            { value: "closed", label: t("common.closed") },
            { value: "suspended", label: t("common.suspended") },
            { value: "deleted", label: t("common.deleted") }
          ]}
        />
        <CheckboxField label={t("management.studentMenuEnabled")} checked={form.studentMenuEligible} onChange={(studentMenuEligible) => setForm((current) => ({ ...current, studentMenuEligible }))} />
      </div>
      </section>

      <section className="grid gap-4 border-t border-outline-variant/70 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-label-lg font-semibold text-primary">{t("management.addressAndLocation")}</h3>
          <Button size="sm" variant="secondary" icon="map" onClick={() => undefined}>{t("common.chooseOnMap")}</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Input label={t("common.address")} icon="location_on" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
          <Input label={t("common.city")} icon="location_city" value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} required />
          <Input label={t("common.country")} icon="public" value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} />
        </div>
        <button
          type="button"
          className="text-left text-caption font-semibold text-secondary transition-colors hover:text-primary"
          onClick={() => setCoordinatesOpen((open) => !open)}
        >
          {coordinatesOpen ? t("common.close") : t("common.advancedCoordinates")}
        </button>
        {coordinatesOpen ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Input label={t("common.latitude")} icon="pin_drop" value={form.lat} onChange={(event) => setForm((current) => ({ ...current, lat: event.target.value }))} />
            <Input label={t("common.longitude")} icon="pin_drop" value={form.lng} onChange={(event) => setForm((current) => ({ ...current, lng: event.target.value }))} />
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function AdminOverviewPage() {
  return <AdminOverviewScreen />;
}

export function AdminCompaniesPage() {
  return <AdminOverviewScreen />;
}

export function AdminUsersPage() {
  const { state, dispatch } = useDemoState();
  const { t } = useLanguage();
  const [showDeleted, setShowDeleted] = useState(false);
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm());
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [removeVerifyOpen, setRemoveVerifyOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [universityName, setUniversityName] = useState("");
  const [universityDomain, setUniversityDomain] = useState("");

  const users = (state.users || []).filter((user) => showDeleted || user.status !== "deleted");

  function openAddUser() {
    setEditingUser(null);
    setUserForm(emptyUserForm());
    setUserFormOpen(true);
  }

  function openEditUser(user: User) {
    setEditingUser(user);
    setUserForm(userToForm(user));
    setUserFormOpen(true);
  }

  function validateUserForm() {
    if (!userForm.name.trim()) return "management.nameRequired";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email.trim())) return "management.emailRequired";
    if (!editingUser && !userForm.password.trim()) return "management.passwordRequired";
    if (userForm.studentVerified && !userForm.universityName.trim()) return "management.universityNameRequired";
    const duplicate = (state.users || []).some((user) => user.email.toLowerCase() === userForm.email.trim().toLowerCase() && user.id !== editingUser?.id);
    if (duplicate) return "management.duplicateEmail";
    return "";
  }

  function saveUser() {
    const error = validateUserForm();
    if (error) {
      dispatch({ type: "SHOW_TOAST", payload: { message: error } });
      return;
    }

    if (editingUser) {
      dispatch({
        type: "ADMIN_UPDATE_USER",
        payload: {
          userId: editingUser.id,
          name: userForm.name,
          email: userForm.email,
          password: userForm.password,
          emailVerified: userForm.emailVerified,
          studentVerified: userForm.studentVerified,
          universityName: userForm.universityName,
          universityDomain: userForm.universityDomain,
          status: userForm.status
        }
      });
    } else {
      dispatch({
        type: "ADMIN_CREATE_USER",
        payload: {
          name: userForm.name,
          email: userForm.email,
          password: userForm.password,
          emailVerified: userForm.emailVerified,
          studentVerified: userForm.studentVerified,
          universityName: userForm.universityName,
          universityDomain: userForm.universityDomain,
          status: userForm.status
        }
      });
    }
    setUserFormOpen(false);
  }

  function openUserAction(user: User, setter: (open: boolean) => void) {
    setSelectedUser(user);
    setter(true);
  }

  function openVerifyUser(user: User) {
    setSelectedUser(user);
    setUniversityName(user.universityName || "");
    setUniversityDomain(user.universityDomain || "");
    setVerifyOpen(true);
  }

  function handleVerify() {
    if (!selectedUser) return;
    if (!universityName.trim()) {
      dispatch({ type: "SHOW_TOAST", payload: { message: "management.universityNameRequired" } });
      return;
    }
    dispatch({ type: "MANUAL_VERIFY_STUDENT", payload: { userId: selectedUser.id, universityName, universityDomain } });
    setVerifyOpen(false);
  }

  return (
    <section>
      <ScreenHeader
        title={t("common.users")}
        description={t("admin.usersDescription")}
        action={<Button icon="person_add" onClick={openAddUser}>{t("management.addUser")}</Button>}
      />
      <div className="mb-4 flex justify-end">
        <CheckboxField label={t("common.showDeleted")} checked={showDeleted} onChange={setShowDeleted} />
      </div>
      {users.length ? (
        <DataTable
          rows={users}
          getRowKey={(row) => row.id}
          columns={[
            { header: t("common.fullName"), cell: (row) => row.name },
            { header: t("common.email"), cell: (row) => row.email },
            { header: t("common.status"), cell: (row) => <Badge tone={statusTone(row.status) as any}>{t(`common.${row.status}` as any)}</Badge> },
            { header: t("management.studentStatus"), cell: (row) => <Badge tone={row.studentStatus === "verified" ? "success" : "warning"}>{studentStatusLabel(row, t)}</Badge> },
            { header: t("management.universityName"), cell: (row) => row.universityName || "-" },
            { header: t("management.emailVerified"), cell: (row) => row.emailVerified ? t("common.yes") : t("common.no") },
            { header: t("common.createdAt"), cell: (row) => formatDate(row.createdAt) },
            {
              header: t("common.actions"),
              cell: (row) => (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" icon="edit" onClick={() => openEditUser(row)}>{t("common.edit")}</Button>
                  {row.studentStatus === "verified" ? (
                    <Button size="sm" variant="secondary" icon="school" onClick={() => openUserAction(row, setRemoveVerifyOpen)}>{t("management.removeStudentVerification")}</Button>
                  ) : (
                    <Button size="sm" variant="secondary" icon="school" onClick={() => openVerifyUser(row)}>{t("management.verifyAsStudent")}</Button>
                  )}
                  {row.status === "active" ? (
                    <Button size="sm" variant="secondary" icon="block" onClick={() => openUserAction(row, setSuspendOpen)}>{t("management.suspendUser")}</Button>
                  ) : row.status === "suspended" ? (
                    <Button size="sm" variant="secondary" icon="check_circle" onClick={() => openUserAction(row, setReactivateOpen)}>{t("management.reactivateUser")}</Button>
                  ) : null}
                  {row.status !== "deleted" ? (
                    <Button size="sm" variant="secondary" icon="delete" onClick={() => openUserAction(row, setDeleteOpen)}>{t("common.delete")}</Button>
                  ) : null}
                </div>
              )
            }
          ]}
        />
      ) : (
        <EmptyState icon="people" text={t("management.noUsersYetSentence")} />
      )}

      <Modal open={userFormOpen} onClose={() => setUserFormOpen(false)} onConfirm={saveUser} title={editingUser ? t("management.editUser") : t("management.addUser")} confirmLabel={editingUser ? t("common.update") : t("common.create")} cancelLabel={t("common.cancel")}>
        <UserForm form={userForm} setForm={setUserForm} editing={Boolean(editingUser)} />
      </Modal>
      <Modal open={verifyOpen} onClose={() => setVerifyOpen(false)} onConfirm={handleVerify} title={t("management.verifyAsStudent")} confirmLabel={t("common.confirm")} cancelLabel={t("common.cancel")}>
        <div className="grid gap-3 p-1">
          <p className="text-body-md text-secondary">{t("management.confirmVerifyStudent")}</p>
          <Input label={t("management.universityName")} icon="school" value={universityName} onChange={(event) => setUniversityName(event.target.value)} required />
          <Input label={t("management.universityDomain")} icon="language" value={universityDomain} onChange={(event) => setUniversityDomain(event.target.value)} />
        </div>
      </Modal>
      <Modal open={removeVerifyOpen} onClose={() => setRemoveVerifyOpen(false)} onConfirm={() => { if (selectedUser) dispatch({ type: "REMOVE_STUDENT_VERIFICATION", payload: { userId: selectedUser.id } }); setRemoveVerifyOpen(false); }} title={t("management.removeStudentVerification")} confirmLabel={t("common.confirm")} cancelLabel={t("common.cancel")}>
        <p className="text-body-md text-secondary">{t("management.confirmRemoveStudentVerification")}</p>
      </Modal>
      <Modal open={suspendOpen} onClose={() => setSuspendOpen(false)} onConfirm={() => { if (selectedUser) dispatch({ type: "SUSPEND_USER", payload: { userId: selectedUser.id } }); setSuspendOpen(false); }} title={t("management.suspendUser")} confirmLabel={t("common.confirm")} cancelLabel={t("common.cancel")}>
        <p className="text-body-md text-secondary">{t("management.confirmSuspendUser")}</p>
      </Modal>
      <Modal open={reactivateOpen} onClose={() => setReactivateOpen(false)} onConfirm={() => { if (selectedUser) dispatch({ type: "REACTIVATE_USER", payload: { userId: selectedUser.id } }); setReactivateOpen(false); }} title={t("management.reactivateUser")} confirmLabel={t("common.confirm")} cancelLabel={t("common.cancel")}>
        <p className="text-body-md text-secondary">{t("management.confirmReactivateUser")}</p>
      </Modal>
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={() => { if (selectedUser) dispatch({ type: "DELETE_USER", payload: { userId: selectedUser.id } }); setDeleteOpen(false); }} title={t("management.deleteUser")} confirmLabel={t("common.delete")} cancelLabel={t("common.cancel")}>
        <p className="text-body-md text-secondary">{t("management.confirmDeleteUser")}</p>
      </Modal>
    </section>
  );
}

export function AdminMerchantsPage() {
  const { state, dispatch } = useDemoState();
  const { t } = useLanguage();
  const [showDeleted, setShowDeleted] = useState(false);
  const [merchantFormOpen, setMerchantFormOpen] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<MerchantUser | null>(null);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [merchantForm, setMerchantForm] = useState<MerchantFormState>(emptyMerchantForm());
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantUser | null>(null);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [password, setPassword] = useState("");

  const merchants = (state.merchantUsers || []).filter((merchant) => showDeleted || merchant.status !== "deleted");

  function restaurantFor(merchant: MerchantUser | null) {
    if (!merchant) return null;
    return (state.restaurants || []).find((restaurant) => restaurant.id === merchant.restaurantId) || null;
  }

  function openAddMerchant() {
    setEditingMerchant(null);
    setEditingRestaurant(null);
    setMerchantForm(emptyMerchantForm());
    setMerchantFormOpen(true);
  }

  function openEditMerchant(merchant: MerchantUser) {
    const restaurant = restaurantFor(merchant);
    setEditingMerchant(merchant);
    setEditingRestaurant(restaurant);
    setMerchantForm(merchantToForm(merchant, restaurant));
    setMerchantFormOpen(true);
  }

  function validateMerchantForm() {
    if (!merchantForm.restaurantName.trim()) return "management.restaurantNameRequired";
    if (!merchantForm.merchantOwnerName.trim()) return "management.ownerNameRequired";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(merchantForm.merchantOwnerEmail.trim())) return "management.emailRequired";
    if (!editingMerchant && !merchantForm.initialPassword.trim()) return "management.passwordRequired";
    if (!merchantForm.city.trim()) return "management.cityRequired";
    const duplicate = (state.merchantUsers || []).some((merchant) => merchant.email.toLowerCase() === merchantForm.merchantOwnerEmail.trim().toLowerCase() && merchant.id !== editingMerchant?.id);
    if (duplicate) return "management.duplicateMerchantEmail";
    return "";
  }

  function merchantPayload() {
    const parsedLat = merchantForm.lat.trim() ? Number.parseFloat(merchantForm.lat) : null;
    const parsedLng = merchantForm.lng.trim() ? Number.parseFloat(merchantForm.lng) : null;
    return {
      restaurantName: merchantForm.restaurantName,
      merchantOwnerName: merchantForm.merchantOwnerName,
      merchantOwnerEmail: merchantForm.merchantOwnerEmail,
      initialPassword: merchantForm.initialPassword,
      bio: merchantForm.bio,
      address: merchantForm.address,
      city: merchantForm.city,
      country: merchantForm.country,
      lat: parsedLat !== null && Number.isFinite(parsedLat) ? parsedLat : null,
      lng: parsedLng !== null && Number.isFinite(parsedLng) ? parsedLng : null,
      phone: merchantForm.phone,
      openingHours: merchantForm.openingHours,
      studentMenuEligible: merchantForm.studentMenuEligible,
      restaurantStatus: merchantForm.restaurantStatus
    };
  }

  async function saveMerchant() {
    const error = validateMerchantForm();
    if (error) {
      dispatch({ type: "SHOW_TOAST", payload: { message: error } });
      return;
    }
    
    try {
      const payload = merchantPayload();
      const tempMerchantId = editingMerchant ? editingMerchant.id : `merchant_${Math.random().toString(36).slice(2, 8)}`;
      const tempRestaurantId = editingRestaurant ? editingRestaurant.id : `rest_${Math.random().toString(36).slice(2, 8)}`;

      const apiPayload = {
        ...payload,
        id: tempMerchantId,
        email: payload.merchantOwnerEmail,
        password: payload.initialPassword,
        restaurantId: tempRestaurantId,
        status: editingMerchant ? editingMerchant.status : "active",
        isUpdate: Boolean(editingMerchant)
      };

      const res = await fetch("/api/admin/merchants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiPayload)
      });
      if (!res.ok) throw new Error("Failed to save merchant to database");
      const saved = await res.json().catch(() => ({}));
      const savedMerchantId = saved?.merchant?.id || tempMerchantId;
      const savedRestaurantId = saved?.restaurant?.id || tempRestaurantId;

      if (editingMerchant && editingRestaurant) {
        dispatch({
          type: "ADMIN_UPDATE_MERCHANT_ACCOUNT",
          payload: {
            ...payload,
            merchantId: savedMerchantId,
            restaurantId: savedRestaurantId
          }
        });
        if (payload.initialPassword.trim()) {
          dispatch({ type: "RESET_MERCHANT_PASSWORD", payload: { merchantId: savedMerchantId, password: payload.initialPassword } });
        }
      } else {
        dispatch({ 
          type: "ADMIN_CREATE_MERCHANT_ACCOUNT", 
          payload: { 
            ...payload, 
            merchantId: savedMerchantId,
            restaurantId: savedRestaurantId,
            initialPassword: merchantForm.initialPassword 
          } 
        });
      }
      setMerchantFormOpen(false);
    } catch (err) {
      dispatch({ type: "SHOW_TOAST", payload: { message: "Error saving to database" } });
    }
  }

  async function persistMerchantStatus(merchant: MerchantUser, status: MerchantUser["status"]) {
    try {
      const res = await fetch("/api/admin/merchants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: merchant.id,
          email: merchant.email,
          restaurantId: merchant.restaurantId,
          status,
          isUpdate: true
        })
      });

      if (!res.ok) throw new Error("Failed to update merchant status");
      return true;
    } catch {
      dispatch({ type: "SHOW_TOAST", payload: { message: "Error saving to database" } });
      return false;
    }
  }

  function openMerchantAction(merchant: MerchantUser, setter: (open: boolean) => void) {
    setSelectedMerchant(merchant);
    setter(true);
  }

  const selectedRestaurant = restaurantFor(selectedMerchant);
  const selectedSales = selectedRestaurant ? (state.studentCheckIns || []).filter((row) => row.restaurantId === selectedRestaurant.id) : [];

  return (
    <section>
      <ScreenHeader
        title={t("admin.merchantAccounts")}
        description={t("admin.merchantAccountsDescription")}
        action={<Button icon="add_business" onClick={openAddMerchant}>{t("management.addMerchantAccount")}</Button>}
      />
      <div className="mb-4 flex justify-end">
        <CheckboxField label={t("common.showDeleted")} checked={showDeleted} onChange={setShowDeleted} />
      </div>
      {merchants.length ? (
        <DataTable
          rows={merchants}
          getRowKey={(row) => row.id}
          columns={[
            { header: t("management.restaurantName"), cell: (row) => restaurantFor(row)?.name || t("management.unassignedOwner") },
            { header: t("management.merchantOwnerEmail"), cell: (row) => row.email },
            { header: t("common.city"), cell: (row) => restaurantFor(row)?.city || "-" },
            { header: t("common.status"), cell: (row) => <Badge tone={statusTone(row.status) as any}>{t(`common.${row.status}` as any)}</Badge> },
            { header: "Student Menu", cell: (row) => restaurantFor(row)?.studentMenuEligible ? t("common.active") : t("common.inactive") },
            { header: t("merchant.openingHours"), cell: (row) => restaurantFor(row)?.openingHours || "-" },
            { header: t("common.createdAt"), cell: (row) => formatDate(row.createdAt) },
            {
              header: t("common.actions"),
              cell: (row) => (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" icon="edit" onClick={() => openEditMerchant(row)}>{t("common.edit")}</Button>
                  {row.status === "active" ? (
                    <Button size="sm" variant="secondary" icon="block" onClick={() => openMerchantAction(row, setSuspendOpen)}>{t("management.suspendMerchant")}</Button>
                  ) : row.status === "suspended" ? (
                    <Button size="sm" variant="secondary" icon="check_circle" onClick={() => openMerchantAction(row, setReactivateOpen)}>{t("management.reactivateMerchant")}</Button>
                  ) : null}
                  <Button size="sm" variant="secondary" icon="lock_reset" onClick={() => { setPassword(""); openMerchantAction(row, setResetOpen); }}>{t("management.resetPassword")}</Button>
                  <Button size="sm" variant="secondary" icon="bar_chart" onClick={() => openMerchantAction(row, setSalesOpen)}>{t("management.viewSalesCheckIns")}</Button>
                  {row.status !== "deleted" ? (
                    <Button size="sm" variant="secondary" icon="delete" onClick={() => openMerchantAction(row, setDeleteOpen)}>{t("common.delete")}</Button>
                  ) : null}
                </div>
              )
            }
          ]}
        />
      ) : (
        <EmptyState icon="storefront" text={t("management.noMerchantAccountsYet")} />
      )}

      <Modal open={merchantFormOpen} onClose={() => setMerchantFormOpen(false)} onConfirm={saveMerchant} title={editingMerchant ? t("management.editMerchantAccount") : t("management.addMerchantAccount")} confirmLabel={editingMerchant ? t("common.update") : t("common.create")} cancelLabel={t("common.cancel")}>
        <MerchantForm form={merchantForm} setForm={setMerchantForm} editing={Boolean(editingMerchant)} />
      </Modal>
      <Modal open={suspendOpen} onClose={() => setSuspendOpen(false)} onConfirm={async () => {
        if (selectedMerchant && await persistMerchantStatus(selectedMerchant, "suspended")) {
          dispatch({ type: "SUSPEND_MERCHANT", payload: { merchantId: selectedMerchant.id } });
          setSuspendOpen(false);
        }
      }} title={t("management.suspendMerchant")} confirmLabel={t("common.confirm")} cancelLabel={t("common.cancel")}>
        <p className="text-body-md text-secondary">{t("management.confirmSuspendMerchant")}</p>
      </Modal>
      <Modal open={reactivateOpen} onClose={() => setReactivateOpen(false)} onConfirm={async () => {
        if (selectedMerchant && await persistMerchantStatus(selectedMerchant, "active")) {
          dispatch({ type: "REACTIVATE_MERCHANT", payload: { merchantId: selectedMerchant.id } });
          setReactivateOpen(false);
        }
      }} title={t("management.reactivateMerchant")} confirmLabel={t("common.confirm")} cancelLabel={t("common.cancel")}>
        <p className="text-body-md text-secondary">{t("management.confirmReactivateMerchant")}</p>
      </Modal>
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={async () => {
        if (selectedMerchant && await persistMerchantStatus(selectedMerchant, "deleted")) {
          dispatch({ type: "DELETE_MERCHANT", payload: { merchantId: selectedMerchant.id } });
          setDeleteOpen(false);
        }
      }} title={t("management.deleteMerchant")} confirmLabel={t("common.delete")} cancelLabel={t("common.cancel")}>
        <p className="text-body-md text-secondary">{t("management.confirmDeleteMerchant")}</p>
      </Modal>
      <Modal open={resetOpen} onClose={() => setResetOpen(false)} onConfirm={async () => { 
        if (selectedMerchant) {
          try {
            const res = await fetch("/api/admin/merchants/reset-password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: selectedMerchant.id, password })
            });
            if (!res.ok) throw new Error();
            dispatch({ type: "RESET_MERCHANT_PASSWORD", payload: { merchantId: selectedMerchant.id, password } });
          } catch {
            dispatch({ type: "SHOW_TOAST", payload: { message: "Error resetting password in DB" } });
          }
        }
        setResetOpen(false); 
      }} title={t("management.resetPassword")} confirmLabel={t("common.update")} cancelLabel={t("common.cancel")}>
        <Input label={t("common.password")} icon="lock_reset" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </Modal>
      <Modal open={salesOpen} onClose={() => setSalesOpen(false)} title={t("management.viewSalesCheckIns")} confirmLabel={t("common.close")} cancelLabel={t("common.cancel")}>
        {selectedSales.length ? (
          <DataTable
            rows={selectedSales}
            getRowKey={(row) => row.id}
            columns={[
              { header: t("common.user"), cell: (row) => row.userName },
              { header: t("admin.detail"), cell: (row) => row.menuItemName || "Student Menu" },
              { header: t("common.status"), cell: (row) => <Badge tone={statusTone(row.status) as any}>{row.status === "confirmed" ? t("student.confirmed") : t("student.cancelled")}</Badge> },
              { header: t("common.time"), cell: (row) => formatDateTime(row.createdAt) }
            ]}
          />
        ) : (
          <EmptyState icon="point_of_sale" text={t("management.noSalesYet")} />
        )}
      </Modal>
    </section>
  );
}

export function AdminActivityPage() {
  const { state } = useDemoState();
  const { t } = useLanguage();
  const rows = useMemo(() => buildActivityRows(state.studentCheckIns || [], state.adminAuditLogs || []), [state.adminAuditLogs, state.studentCheckIns]);

  return (
    <section>
      <ScreenHeader title={t("common.activity")} description={t("admin.activityDescription")} action={<Badge tone="inverse">{rows.length} {t("admin.events")}</Badge>} />
      {rows.length ? (
        <DataTable
          rows={rows}
          getRowKey={(row) => row.id}
          columns={[
            { header: t("admin.merchant"), cell: (row) => row.merchant },
            { header: t("common.user"), cell: (row) => row.user },
            { header: t("admin.detail"), cell: (row) => activityDetailLabel(row, t) },
            {
              header: t("common.status"),
              cell: (row) => (
                <Badge tone={statusTone(row.status) as any}>
                  {row.status === "confirmed" ? t("student.confirmed") : row.status === "cancelled" ? t("student.cancelled") : t("common.active")}
                </Badge>
              )
            },
            { header: t("common.time"), cell: (row) => formatDateTime(row.createdAt) }
          ]}
        />
      ) : (
        <EmptyState icon="receipt_long" text={t("management.noActivityYet")} />
      )}
    </section>
  );
}

export function AdminTransactionsPage() {
  return <AdminActivityPage />;
}

export function AdminApprovalsPage() {
  const { state, dispatch } = useDemoState();
  const { t } = useLanguage();
  const approvals = getPendingMerchantApprovals(state);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);
  const selectedApproval = approvals.find((merchant) => merchant.id === selectedMerchantId) || null;

  return (
    <section>
      <ScreenHeader title={t("admin.approvals")} description={t("admin.approvalsDescription")} action={<Badge tone="inverse">{approvals.length} {t("admin.applications")}</Badge>} />
      {approvals.length ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {approvals.map((merchant) => (
            <button key={merchant.id} type="button" onClick={() => setSelectedMerchantId(merchant.id)} className="premium-card p-5 text-left transition-colors hover:bg-surface-container-low">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-label-md font-semibold text-primary">{merchant.name}</p>
                  <p className="mt-1 text-caption font-medium text-secondary">{merchant.approval?.market || merchant.city}</p>
                </div>
                <Badge tone="warning">{merchant.availability}</Badge>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState icon="fact_check" text={t("management.noApprovalRequestsYet")} />
      )}
      <Modal
        open={Boolean(selectedApproval)}
        title={t("admin.approvalRequests")}
        description={selectedApproval?.name || ""}
        confirmLabel={t("admin.approveMerchant")}
        cancelLabel={t("common.cancel")}
        onClose={() => setSelectedMerchantId(null)}
        onConfirm={() => {
          if (selectedApproval) dispatch({ type: "APPROVE_MERCHANT", payload: { merchantId: selectedApproval.id } });
          setSelectedMerchantId(null);
        }}
      >
        {selectedApproval ? (
          <div className="space-y-3">
            <p className="text-label-md font-semibold text-primary">{selectedApproval.name}</p>
            <p className="text-body-md text-secondary">{selectedApproval.approval?.menuReviewStatus || selectedApproval.availability}</p>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}

export function AdminExtensionsPage() {
  const { state, dispatch } = useDemoState();
  const { t } = useLanguage();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [extension, setExtension] = useState("");
  const [universityName, setUniversityName] = useState("");
  const [checkInFilter, setCheckInFilter] = useState<"all" | "confirmed" | "cancelled" | "today">("all");
  const deleteTarget = state.approvedEmailExtensions.find((item) => item.id === deleteId) || null;
  const confirmedToday = getConfirmedStudentCheckInsToday(state);
  const cancelled = getCancelledStudentCheckIns(state);
  const verifiedStudents = getVerifiedStudentUsers(state);
  const checkIns = state.studentCheckIns.filter((checkIn) => {
    if (checkInFilter === "confirmed") return checkIn.status === "confirmed";
    if (checkInFilter === "cancelled") return checkIn.status === "cancelled";
    if (checkInFilter === "today") return checkIn.dateKey === new Date().toISOString().slice(0, 10);
    return true;
  });

  function handleAddExtension() {
    const normalizedExtension = normalizeEmailExtension(extension);
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(normalizedExtension)) {
      dispatch({ type: "SHOW_TOAST", payload: { message: t("admin.invalidExtensionFormat") } });
      return;
    }
    if (state.approvedEmailExtensions.some((item) => item.extension === normalizedExtension)) {
      dispatch({ type: "SHOW_TOAST", payload: { message: t("admin.thisExtensionAlreadyExists") } });
      return;
    }
    dispatch({ type: "ADD_EMAIL_EXTENSION", payload: { extension, universityName } });
    setAddOpen(false);
    setExtension("");
    setUniversityName("");
  }

  return (
    <section>
      <ScreenHeader title={t("admin.approvedExtensions")} description={t("admin.universityEmailDomains")} action={<Button icon="add" onClick={() => setAddOpen(true)}>{t("admin.addExtension")}</Button>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <DataTable
            rows={state.approvedEmailExtensions}
            getRowKey={(row) => row.id}
            columns={[
              { header: t("admin.extension"), cell: (row) => row.extension },
              { header: t("admin.universityName"), cell: (row) => row.universityName },
              { header: t("common.status"), cell: (row) => <Badge tone={row.status === "active" ? "success" : "warning"}>{row.status === "active" ? t("common.active") : t("common.inactive")}</Badge> },
              { header: t("common.created"), cell: (row) => row.createdAt },
              {
                header: t("common.actions"),
                cell: (row) => (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" icon={row.status === "active" ? "block" : "check_circle"} onClick={() => dispatch({ type: "TOGGLE_EMAIL_EXTENSION_STATUS", payload: { extensionId: row.id } })}>
                      {row.status === "active" ? t("admin.deactivate") : t("admin.activate")}
                    </Button>
                    <Button size="sm" variant="secondary" icon="delete" onClick={() => setDeleteId(row.id)}>{t("common.delete")}</Button>
                  </div>
                )
              }
            ]}
          />
          <div className="premium-card p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-headline-md font-semibold text-primary">{t("admin.studentCheckIns")}</h2>
              <Badge tone="inverse">{confirmedToday.length} {t("common.today")}</Badge>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {(["all", "confirmed", "cancelled", "today"] as const).map((filter) => (
                <Button key={filter} size="sm" variant={checkInFilter === filter ? "primary" : "secondary"} icon={filter === "cancelled" ? "cancel" : filter === "today" ? "today" : "verified"} onClick={() => setCheckInFilter(filter)}>
                  {filter === "all" ? t("common.all") : filter === "today" ? t("common.today") : filter === "confirmed" ? t("student.confirmed") : t("student.cancelled")}
                </Button>
              ))}
            </div>
            {checkIns.length ? (
              <DataTable
                rows={checkIns}
                getRowKey={(row) => row.id}
                columns={[
                  { header: t("common.user"), cell: (row) => row.studentName || row.userName },
                  { header: t("admin.universityName"), cell: (row) => row.universityName },
                  { header: t("admin.merchant"), cell: (row) => row.merchantName },
                  { header: t("common.date"), cell: (row) => row.dateKey },
                  { header: t("common.time"), cell: (row) => formatDateTime(row.createdAt) },
                  { header: t("common.status"), cell: (row) => <Badge tone={row.status === "confirmed" ? "success" : "warning"}>{row.status === "confirmed" ? t("student.confirmed") : t("student.cancelled")}</Badge> }
                ]}
              />
            ) : (
              <EmptyState icon="receipt_long" text={t("student.noCheckInsYet")} />
            )}
          </div>
        </div>
        <div className="space-y-5">
          <StatCard label={t("admin.students")} value={`${verifiedStudents.length}`} detail={`${state.users.length} ${t("common.user")}`} icon="school" />
          <StatCard label={t("admin.studentCheckIns")} value={`${confirmedToday.length}`} detail={t("student.latestConfirmedCheckIn")} icon="fact_check" />
          <StatCard label={t("student.cancelled")} value={`${cancelled.length}`} detail={t("student.cancelled")} icon="cancel" />
        </div>
      </div>
      <Modal open={addOpen} onClose={() => setAddOpen(false)} onConfirm={handleAddExtension} title={t("admin.addExtension")} description={t("admin.universityEmailDomains")} confirmLabel={t("admin.addExtension")} cancelLabel={t("common.cancel")}>
        <div className="grid gap-4 p-1">
          <Input label={t("admin.extension")} icon="alternate_email" value={extension} onChange={(event) => setExtension(event.target.value)} />
          <Input label={t("admin.universityName")} icon="school" value={universityName} onChange={(event) => setUniversityName(event.target.value)} />
        </div>
      </Modal>
      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteId(null)} onConfirm={() => { if (deleteTarget) dispatch({ type: "DELETE_EMAIL_EXTENSION", payload: { extensionId: deleteTarget.id } }); setDeleteId(null); }} title={t("common.delete")} description={deleteTarget?.extension || ""} confirmLabel={t("common.delete")} cancelLabel={t("common.cancel")}>
        <p className="text-body-md text-secondary">{deleteTarget?.universityName}</p>
      </Modal>
    </section>
  );
}

export function AdminSupportPage() {
  const { state, dispatch } = useDemoState();
  const { t } = useLanguage();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

  function handleNote() {
    if (!noteText.trim()) return;
    dispatch({ type: "ADD_SUPPORT_NOTE", payload: { text: noteText.trim() } });
    setNoteOpen(false);
    setNoteText("");
  }

  return (
    <section>
      <ScreenHeader
        title={t("admin.support")}
        description={t("admin.supportDescription")}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon="edit_note" onClick={() => setNoteOpen(true)}>{t("common.add")}</Button>
            {demoModeEnabled ? <Button variant="secondary" icon="restart_alt" onClick={() => dispatch({ type: "RESET_DEMO_DATA" })}>{t("common.resetDemoData")}</Button> : null}
          </div>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="premium-card p-5">
          <h2 className="text-headline-md font-semibold text-primary">{t("admin.supportNotes")}</h2>
          <div className="mt-4 space-y-3">
            {state.supportNotes.length ? state.supportNotes.map((note) => (
              <div key={note.id} className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-3">
                <p className="text-label-md font-semibold text-primary">{note.text}</p>
                <p className="mt-1 text-caption font-medium text-secondary">{note.source} - {formatDate(note.createdAt)}</p>
              </div>
            )) : <EmptyState icon="edit_note" text={t("admin.noRecords")} />}
          </div>
        </div>
        <div className="grid gap-5">
          <StatCard label={t("admin.supportNotes")} value={`${state.supportNotes.length}`} detail={t("admin.supportDescription")} icon="support_agent" />
          <StatCard label={t("common.activity")} value={`${(state.adminAuditLogs || []).length}`} detail={t("admin.activityDescription")} icon="history" />
        </div>
      </div>
      <Modal open={noteOpen} onClose={() => setNoteOpen(false)} onConfirm={handleNote} title={t("admin.supportNotes")} description={t("admin.supportDescription")} confirmLabel={t("common.save")} cancelLabel={t("common.cancel")}>
        <Input label={t("admin.detail")} icon="edit_note" value={noteText} onChange={(event) => setNoteText(event.target.value)} />
      </Modal>
    </section>
  );
}

export function AdminRestaurantsPage() {
  return <AdminMerchantsPage />;
}

export function AdminSettingsPage() {
  const { t, language, setLanguage } = useLanguage();

  return (
    <section>
      <ScreenHeader title={t("common.settings")} description={t("common.language")} />
      <div className="mt-6 max-w-xl">
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
                type="button"
                onClick={() => setLanguage(option.code as any)}
                className={`flex h-11 items-center justify-between rounded-lg border px-3 text-label-md font-semibold transition-colors ${language === option.code ? "border-primary bg-primary text-on-primary" : "border-outline-variant/70 bg-surface-container-lowest text-primary hover:bg-surface-container-low"}`}
              >
                <span className={language === option.code ? "" : "text-secondary"}>{option.label}</span>
                {language === option.code ? <span className="material-symbols-outlined text-[18px]" aria-hidden="true">check</span> : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
