"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  apiFetch,
  ApiError,
} from "@/lib/api";
import type {
  AuthUser,
  Cart,
} from "@/lib/types";

interface RegisterResult {
  verificationRequired: boolean;
  emailSent: boolean;
}

interface StoreContextValue {
  user: AuthUser | null;
  authLoading: boolean;
  cartCount: number;

  refreshUser:
    () => Promise<void>;

  refreshCart:
    () => Promise<void>;

  login: (
    email: string,
    password: string,
  ) => Promise<void>;

  register: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<RegisterResult>;

  logout:
    () => Promise<void>;
}

const StoreContext =
  createContext<StoreContextValue | null>(
    null,
  );

export function StoreProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] =
    useState<AuthUser | null>(
      null,
    );

  const [
    authLoading,
    setAuthLoading,
  ] = useState(true);

  const [
    cartCount,
    setCartCount,
  ] = useState(0);

  const refreshUser =
    useCallback(async () => {
      try {
        const response =
          await apiFetch<{
            user: AuthUser;
          }>("/api/auth/me");

        setUser(
          response.user,
        );
      } catch (error) {
        if (
          error instanceof
            ApiError &&
          error.status === 401
        ) {
          setUser(null);
          return;
        }

        throw error;
      }
    }, []);

  const refreshCart =
    useCallback(async () => {
      try {
        const response =
          await apiFetch<{
            cart: Cart;
          }>("/api/cart");

        setCartCount(
          response.cart
            .totalItemCount,
        );
      } catch (error) {
        if (
          error instanceof
            ApiError &&
          error.status === 401
        ) {
          setCartCount(0);
          return;
        }

        throw error;
      }
    }, []);

  useEffect(() => {
    let cancelled =
      false;

    async function initialize() {
      try {
        const authResponse =
          await apiFetch<{
            user: AuthUser;
          }>("/api/auth/me");

        if (cancelled) {
          return;
        }

        setUser(
          authResponse.user,
        );

        try {
          const cartResponse =
            await apiFetch<{
              cart: Cart;
            }>("/api/cart");

          if (!cancelled) {
            setCartCount(
              cartResponse.cart
                .totalItemCount,
            );
          }
        } catch (error) {
          if (
            !(
              error instanceof
                ApiError &&
              error.status === 401
            )
          ) {
            throw error;
          }
        }
      } catch (error) {
        if (
          error instanceof
            ApiError &&
          error.status === 401
        ) {
          if (!cancelled) {
            setUser(null);
            setCartCount(0);
          }

          return;
        }

        console.error(
          "Could not initialize store session.",
          error,
        );
      } finally {
        if (!cancelled) {
          setAuthLoading(
            false,
          );
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  async function login(
    email: string,
    password: string,
  ) {
    const response =
      await apiFetch<{
        user: AuthUser;
      }>("/api/auth/login", {
        method: "POST",

        body: JSON.stringify({
          email,
          password,
        }),
      });

    setUser(
      response.user,
    );

    try {
      const cartResponse =
        await apiFetch<{
          cart: Cart;
        }>("/api/cart");

      setCartCount(
        cartResponse.cart
          .totalItemCount,
      );
    } catch (error) {
      if (
        !(
          error instanceof
            ApiError &&
          error.status === 401
        )
      ) {
        throw error;
      }

      setCartCount(0);
    }
  }

  async function register(
    fullName: string,
    email: string,
    password: string,
  ): Promise<RegisterResult> {
    const result =
      await apiFetch<
        RegisterResult
      >(
        "/api/auth/register",
        {
          method: "POST",

          body:
            JSON.stringify({
              fullName,
              email,
              password,
            }),
        },
      );

    if (
      !result
        .verificationRequired
    ) {
      await login(
        email,
        password,
      );
    }

    return result;
  }

  async function logout() {
    await apiFetch(
      "/api/auth/logout",
      {
        method: "POST",
      },
    );

    setUser(null);
    setCartCount(0);
  }

  return (
    <StoreContext.Provider
      value={{
        user,
        authLoading,
        cartCount,
        refreshUser,
        refreshCart,
        login,
        register,
        logout,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context =
    useContext(StoreContext);

  if (!context) {
    throw new Error(
      "useStore must be used inside StoreProvider.",
    );
  }

  return context;
}
