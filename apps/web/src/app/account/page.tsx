"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useStore } from "@/components/store-provider";
import { apiFetch } from "@/lib/api";
import type {
  Address,
  CustomerProfile,
} from "@/lib/types";

type AccountType =
  | "INDIVIDUAL"
  | "BUSINESS";

function formatPhone(
  value: string | null,
): string {
  if (!value) {
    return "Not provided";
  }

  const digits = value.replace(
    /\D/g,
    "",
  );

  if (digits.length === 11) {
    return `(${digits.slice(
      0,
      2,
    )}) ${digits.slice(
      2,
      7,
    )}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(
      0,
      2,
    )}) ${digits.slice(
      2,
      6,
    )}-${digits.slice(6)}`;
  }

  return value;
}

export default function AccountPage() {
  const router = useRouter();

  const {
    user,
    authLoading,
    logout,
  } = useStore();

  const [profile, setProfile] =
    useState<CustomerProfile | null>(
      null,
    );

  const [addresses, setAddresses] =
    useState<Address[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [
    loggingOut,
    setLoggingOut,
  ] = useState(false);

  const [
    editingProfile,
    setEditingProfile,
  ] = useState(false);

  const [
    editingAccountType,
    setEditingAccountType,
  ] =
    useState<AccountType>(
      "INDIVIDUAL",
    );

  const fetchAccount =
    useCallback(async () => {
      const [
        profileResponse,
        addressResponse,
      ] = await Promise.all([
        apiFetch<{
          profile:
            | CustomerProfile
            | null;
        }>("/api/account/profile"),

        apiFetch<{
          addresses: Address[];
        }>(
          "/api/account/addresses",
        ),
      ]);

      setProfile(
        profileResponse.profile,
      );

      setAddresses(
        addressResponse.addresses,
      );

      if (profileResponse.profile) {
        setEditingAccountType(
          profileResponse.profile
            .accountType,
        );
      }

      return profileResponse.profile;
    }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const loadedProfile =
          await fetchAccount();

        if (!cancelled) {
          setEditingProfile(
            !loadedProfile,
          );

          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load account.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    user,
    router,
    fetchAccount,
  ]);

  async function saveProfile(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form =
      new FormData(
        event.currentTarget,
      );

    const payload = {
      accountType:
        editingAccountType,

      taxId: String(
        form.get("taxId") ?? "",
      ),

      phone:
        String(
          form.get("phone") ?? "",
        ) || undefined,

      ...(editingAccountType ===
      "INDIVIDUAL"
        ? {
            fullName: String(
              form.get(
                "fullName",
              ) ?? "",
            ),
          }
        : {
            legalName: String(
              form.get(
                "legalName",
              ) ?? "",
            ),

            tradeName:
              String(
                form.get(
                  "tradeName",
                ) ?? "",
              ) || undefined,
          }),
    };

    setMessage(null);
    setError(null);

    try {
      await apiFetch(
        "/api/account/profile",
        {
          method: "PUT",
          body: JSON.stringify(
            payload,
          ),
        },
      );

      await fetchAccount();

      setEditingProfile(false);

      setMessage(
        "Customer profile saved.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save profile.",
      );
    }
  }

  function cancelProfileEdit() {
    if (!profile) {
      return;
    }

    setEditingAccountType(
      profile.accountType,
    );

    setEditingProfile(false);
    setError(null);
    setMessage(null);
  }

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    setError(null);

    try {
      await logout();

      router.replace("/");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not sign out.",
      );
    } finally {
      setLoggingOut(false);
    }
  }

  async function addAddress(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const formElement =
      event.currentTarget;

    const form =
      new FormData(formElement);

    const payload = {
      label:
        String(
          form.get("label") ?? "",
        ) || undefined,

      recipientName: String(
        form.get("recipientName") ??
          "",
      ),

      street: String(
        form.get("street") ?? "",
      ),

      number: String(
        form.get("number") ?? "",
      ),

      complement:
        String(
          form.get("complement") ??
            "",
        ) || undefined,

      neighborhood:
        String(
          form.get(
            "neighborhood",
          ) ?? "",
        ) || undefined,

      city: String(
        form.get("city") ?? "",
      ),

      state: String(
        form.get("state") ?? "",
      ),

      postalCode: String(
        form.get("postalCode") ??
          "",
      ),

      country: String(
        form.get("country") ??
          "BR",
      ),

      isDefault:
        form.get("isDefault") ===
        "on",
    };

    setMessage(null);
    setError(null);

    try {
      await apiFetch(
        "/api/account/addresses",
        {
          method: "POST",
          body: JSON.stringify(
            payload,
          ),
        },
      );

      formElement.reset();

      await fetchAccount();

      setMessage("Address added.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not add address.",
      );
    }
  }

  async function removeAddress(
    id: string,
  ) {
    setMessage(null);
    setError(null);

    try {
      await apiFetch(
        `/api/account/addresses/${id}`,
        {
          method: "DELETE",
        },
      );

      await fetchAccount();

      setMessage(
        "Address deleted.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not delete address.",
      );
    }
  }

  if (
    authLoading ||
    loading
  ) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <p className="text-slate-500">
          Loading account...
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            Your account
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Customer profile
          </h1>

          <p className="mt-2 text-slate-600">
            {user?.email}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/account/orders"
            prefetch={false}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold transition hover:border-blue-300 hover:text-blue-600"
          >
            View orders
          </Link>

          <button
            type="button"
            onClick={() =>
              void handleLogout()
            }
            disabled={loggingOut}
            className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loggingOut
              ? "Signing out..."
              : "Sign out"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">
              Customer information
            </h2>

            {profile &&
              !editingProfile && (
                <button
                  type="button"
                  onClick={() => {
                    setMessage(null);
                    setError(null);

                    setEditingAccountType(
                      profile.accountType,
                    );

                    setEditingProfile(
                      true,
                    );
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold transition hover:border-blue-300 hover:text-blue-600"
                >
                  Edit profile
                </button>
              )}
          </div>

          {profile &&
          !editingProfile ? (
            <div className="mt-6">
              <div className="rounded-xl bg-slate-50 p-5">
                <p className="text-lg font-semibold text-slate-900">
                  {profile.accountType ===
                  "INDIVIDUAL"
                    ? profile.fullName
                    : profile.tradeName ??
                      profile.legalName}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {profile.accountType ===
                  "INDIVIDUAL"
                    ? "Individual account"
                    : "Business account"}
                </p>
              </div>

              <dl className="mt-6 divide-y divide-slate-200">
                {profile.accountType ===
                "INDIVIDUAL" ? (
                  <div className="grid gap-1 py-4 sm:grid-cols-[150px_1fr]">
                    <dt className="text-sm text-slate-500">
                      Full name
                    </dt>

                    <dd className="text-sm font-medium text-slate-900">
                      {profile.fullName}
                    </dd>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-1 py-4 sm:grid-cols-[150px_1fr]">
                      <dt className="text-sm text-slate-500">
                        Legal name
                      </dt>

                      <dd className="text-sm font-medium text-slate-900">
                        {profile.legalName}
                      </dd>
                    </div>

                    <div className="grid gap-1 py-4 sm:grid-cols-[150px_1fr]">
                      <dt className="text-sm text-slate-500">
                        Trade name
                      </dt>

                      <dd className="text-sm font-medium text-slate-900">
                        {profile.tradeName ??
                          "Not provided"}
                      </dd>
                    </div>
                  </>
                )}

                <div className="grid gap-1 py-4 sm:grid-cols-[150px_1fr]">
                  <dt className="text-sm text-slate-500">
                    {profile.accountType ===
                    "INDIVIDUAL"
                      ? "CPF"
                      : "CNPJ"}
                  </dt>

                  <dd className="text-sm font-medium text-slate-900">
                    {
                      profile.taxIdMasked
                    }
                  </dd>
                </div>

                <div className="grid gap-1 py-4 sm:grid-cols-[150px_1fr]">
                  <dt className="text-sm text-slate-500">
                    Phone
                  </dt>

                  <dd className="text-sm font-medium text-slate-900">
                    {formatPhone(
                      profile.phone,
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <form
              onSubmit={saveProfile}
              className="mt-6 grid gap-5"
            >
              <label>
                <span className="text-sm font-medium">
                  Account type
                </span>

                <select
                  name="accountType"
                  value={
                    editingAccountType
                  }
                  onChange={(event) =>
                    setEditingAccountType(
                      event.target
                        .value ===
                        "BUSINESS"
                        ? "BUSINESS"
                        : "INDIVIDUAL",
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
                >
                  <option value="INDIVIDUAL">
                    Individual
                  </option>

                  <option value="BUSINESS">
                    Business
                  </option>
                </select>
              </label>

              {editingAccountType ===
              "INDIVIDUAL" ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Account holder
                  </p>

                  <p className="mt-1 font-semibold text-slate-950">
                    {user?.fullName ??
                      profile?.fullName ??
                      "Not provided"}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Name and email are linked
                    to your BLX account.
                  </p>
                </div>
              ) : (
                <>
                  <label>
                    <span className="text-sm font-medium">
                      Legal name
                    </span>

                    <input
                      name="legalName"
                      required
                      defaultValue={
                        profile?.accountType ===
                        "BUSINESS"
                          ? profile.legalName ??
                            ""
                          : ""
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                    />

                    <span className="mt-2 block text-xs leading-5 text-slate-500">
                      The company&apos;s
                      registered legal name.
                    </span>
                  </label>

                  <label>
                    <span className="text-sm font-medium">
                      Trade name
                    </span>

                    <input
                      name="tradeName"
                      defaultValue={
                        profile?.accountType ===
                        "BUSINESS"
                          ? profile.tradeName ??
                            ""
                          : ""
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                    />

                    <span className="mt-2 block text-xs leading-5 text-slate-500">
                      Optional public or
                      commercial name.
                    </span>
                  </label>
                </>
              )}

              <label>
                <span className="text-sm font-medium">
                  {editingAccountType ===
                  "INDIVIDUAL"
                    ? "CPF"
                    : "CNPJ"}
                </span>

                <input
                  name="taxId"
                  required
                  inputMode="numeric"
                  placeholder={
                    editingAccountType ===
                    "INDIVIDUAL"
                      ? "Enter full CPF, digits only"
                      : "Enter full CNPJ, digits only"
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                />

                {profile && (
                  <span className="mt-2 block text-xs leading-5 text-slate-500">
                    Stored tax IDs are
                    masked for security.
                    Re-enter the complete{" "}
                    {editingAccountType ===
                    "INDIVIDUAL"
                      ? "CPF"
                      : "CNPJ"}{" "}
                    to save profile
                    changes.
                  </span>
                )}
              </label>

              <label>
                <span className="text-sm font-medium">
                  Phone
                </span>

                <input
                  name="phone"
                  inputMode="tel"
                  defaultValue={
                    profile?.phone ?? ""
                  }
                  placeholder="Digits only"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
                >
                  Save profile
                </button>

                {profile && (
                  <button
                    type="button"
                    onClick={
                      cancelProfileEdit
                    }
                    className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
        </section>

        <section>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold">
              Shipping addresses
            </h2>

            <div className="mt-5 space-y-3">
              {addresses.length ===
              0 ? (
                <p className="text-sm text-slate-500">
                  No shipping addresses
                  added yet.
                </p>
              ) : (
                addresses.map(
                  (address) => (
                    <div
                      key={address.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <p className="font-semibold">
                            {address.label ??
                              "Address"}

                            {address.isDefault &&
                              " · Default"}
                          </p>

                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {
                              address.recipientName
                            }
                            <br />

                            {
                              address.street
                            }
                            ,{" "}
                            {
                              address.number
                            }

                            {address.complement
                              ? ` · ${address.complement}`
                              : ""}
                            <br />

                            {address.neighborhood
                              ? `${address.neighborhood} · `
                              : ""}

                            {address.city},{" "}
                            {address.state}{" "}
                            {
                              address.postalCode
                            }
                            <br />

                            {
                              address.country
                            }
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            void removeAddress(
                              address.id,
                            )
                          }
                          className="h-fit text-xs font-semibold text-rose-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ),
                )
              )}
            </div>
          </div>

          <form
            onSubmit={addAddress}
            className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2"
          >
            <h2 className="text-xl font-semibold sm:col-span-2">
              Add address
            </h2>

            <input
              name="label"
              placeholder="Label, e.g. Home"
              className="rounded-xl border border-slate-300 px-4 py-3 sm:col-span-2"
            />

            <input
              name="recipientName"
              required
              placeholder="Recipient name"
              className="rounded-xl border border-slate-300 px-4 py-3 sm:col-span-2"
            />

            <input
              name="street"
              required
              placeholder="Street"
              className="rounded-xl border border-slate-300 px-4 py-3"
            />

            <input
              name="number"
              required
              placeholder="Number"
              className="rounded-xl border border-slate-300 px-4 py-3"
            />

            <input
              name="complement"
              placeholder="Complement"
              className="rounded-xl border border-slate-300 px-4 py-3"
            />

            <input
              name="neighborhood"
              placeholder="Neighborhood"
              className="rounded-xl border border-slate-300 px-4 py-3"
            />

            <input
              name="city"
              required
              placeholder="City"
              className="rounded-xl border border-slate-300 px-4 py-3"
            />

            <input
              name="state"
              required
              placeholder="State"
              className="rounded-xl border border-slate-300 px-4 py-3"
            />

            <input
              name="postalCode"
              required
              placeholder="Postal code"
              className="rounded-xl border border-slate-300 px-4 py-3"
            />

            <input
              name="country"
              required
              defaultValue="BR"
              maxLength={2}
              className="rounded-xl border border-slate-300 px-4 py-3"
            />

            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                name="isDefault"
              />

              Make this my default address
            </label>

            <button
              type="submit"
              disabled={!profile}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:bg-slate-300 sm:col-span-2"
            >
              Add address
            </button>

            {!profile && (
              <p className="text-xs text-slate-500 sm:col-span-2">
                Save your customer profile
                before adding an address.
              </p>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}
