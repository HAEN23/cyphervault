"use client";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

const ALIVE_KEY = "cv-tab-alive";
const CHANNEL = "cv-session";
const PING_TIMEOUT_MS = 400;

type SessionStatus = "loading" | "authenticated" | "unauthenticated";
export type TabSessionState = "checking" | "ok";

function readAlive(): boolean {
  try {
    return sessionStorage.getItem(ALIVE_KEY) === "1";
  } catch {
    return false;
  }
}

function markAlive() {
  try {
    sessionStorage.setItem(ALIVE_KEY, "1");
  } catch {
    /* sin sessionStorage: el guardián simplemente no aplica */
  }
}

/**
 * Cierra la sesión cuando se cierra la ventana o pestaña de CipherVault.
 *
 * - `sessionStorage` vive solo mientras la pestaña está abierta (sobrevive a recargar la
 *   página, pero se borra al cerrarla). Esta pestaña queda "marcada" cuando el usuario
 *   inicia sesión en ella.
 * - Si se abre CipherVault con una sesión activa en una pestaña SIN marca, significa que la
 *   ventana anterior se cerró: antes de mostrar nada se pregunta por BroadcastChannel si otra
 *   pestaña de CipherVault sigue abierta. Si alguna responde, se comparte la sesión; si
 *   ninguna responde, se cierra la sesión y se pide iniciar sesión de nuevo.
 */
export function useTabSession(status: SessionStatus): TabSessionState {
  const [state, setState] = useState<TabSessionState>("checking");

  // Responder a otras pestañas que preguntan si CipherVault sigue abierto
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event) => {
      if (event.data === "ping" && readAlive()) channel.postMessage("pong");
    };
    return () => channel.close();
  }, []);

  useEffect(() => {
    if (status === "loading") return;

    // Sin sesión: esta pestaña es donde el usuario va a iniciar sesión
    if (status === "unauthenticated") {
      markAlive();
      queueMicrotask(() => setState("ok"));
      return;
    }

    // Con sesión y esta pestaña ya estaba abierta (recarga o navegación): todo bien
    if (readAlive()) {
      queueMicrotask(() => setState("ok"));
      return;
    }

    // Con sesión pero pestaña nueva: ¿hay otra pestaña de CipherVault abierta?
    if (typeof BroadcastChannel === "undefined") {
      signOut({ callbackUrl: "/" });
      return;
    }
    const channel = new BroadcastChannel(CHANNEL);
    let answered = false;
    channel.onmessage = (event) => {
      if (event.data === "pong" && !answered) {
        answered = true;
        markAlive();
        setState("ok");
      }
    };
    channel.postMessage("ping");
    const timer = setTimeout(() => {
      if (!answered) {
        // Nadie respondió: la ventana anterior se cerró, así que la sesión termina
        signOut({ callbackUrl: "/" });
      }
    }, PING_TIMEOUT_MS);

    return () => {
      clearTimeout(timer);
      channel.close();
    };
  }, [status]);

  return state;
}
