import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = env.smtp.user && env.smtp.pass
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    })
  : null;

if (!transporter) {
  console.warn('[CipherVault] SMTP no configurado: los códigos de verificación se mostrarán en esta consola (solo desarrollo).');
}

/** Envía el código de verificación en dos pasos al correo del usuario. */
export async function sendMfaCode(to: string, name: string, code: string): Promise<void> {
  if (!transporter) {
    console.log(`[CipherVault][DEV] Código de verificación para ${to}: ${code}`);
    return;
  }

  await transporter.sendMail({
    from: `"CipherVault" <${env.smtp.from}>`,
    to,
    subject: `Tu código de verificación de CipherVault: ${code}`,
    text:
      `Hola ${name},\n\n` +
      `Tu código para entrar a CipherVault es: ${code}\n\n` +
      `Vence en ${env.mfaCodeMinutes} minutos. Si no fuiste tú, cambia tu contraseña y avisa al administrador.\n`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px">
        <h2 style="color:#f97316;margin-top:0">CipherVault</h2>
        <p>Hola ${escapeHtml(name)}, tu código de verificación es:</p>
        <p style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#fff;text-align:center">${code}</p>
        <p style="font-size:13px;color:#94a3b8">Vence en ${env.mfaCodeMinutes} minutos. Si no intentaste iniciar sesión, cambia tu contraseña y avisa al administrador.</p>
      </div>`,
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
