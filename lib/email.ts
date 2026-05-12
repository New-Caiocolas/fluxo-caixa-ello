import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL = process.env.APP_URL || "https://fluxo-caixa-ello.vercel.app";
const FROM_EMAIL = process.env.FROM_EMAIL || "Grupo ELLO <onboarding@resend.dev>";

export async function sendWelcomeEmail({
  name,
  email,
  password,
  role,
}: {
  name: string;
  email: string;
  password: string;
  role: string;
}) {
  const roleLabel: Record<string, string> = {
    ADMIN: "Administrador",
    GESTOR: "Gestor",
    OPERADOR: "Operador",
  };

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bem-vindo ao Grupo ELLO</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#10b981;border-radius:16px;padding:16px 20px;text-align:center;">
                    <span style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">ELLO</span>
                  </td>
                </tr>
              </table>
              <div style="margin-top:12px;font-size:14px;color:#6b7280;">Sistema de Fluxo de Caixa · Grupo ELLO</div>
            </td>
          </tr>

          <!-- Card principal -->
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow:hidden;">

              <!-- Faixa verde -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#059669,#10b981);padding:32px 40px;">
                    <div style="font-size:24px;font-weight:700;color:#ffffff;margin-bottom:6px;">
                      Olá, ${name}! 👋
                    </div>
                    <div style="font-size:15px;color:#d1fae5;">
                      Seu acesso ao sistema foi criado com sucesso.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Corpo -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:32px 40px;">

                    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                      Você foi cadastrado no <strong>Sistema de Fluxo de Caixa do Grupo ELLO</strong> com o perfil de
                      <strong>${roleLabel[role] ?? role}</strong>. Use as credenciais abaixo para acessar o sistema.
                    </p>

                    <!-- Credenciais -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:28px;">
                      <tr>
                        <td style="padding:20px 24px;">
                          <div style="font-size:12px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:16px;">
                            Suas credenciais de acesso
                          </div>

                          <!-- E-mail -->
                          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                            <tr>
                              <td style="padding-bottom:4px;font-size:12px;color:#6b7280;font-weight:500;">E-mail</td>
                            </tr>
                            <tr>
                              <td style="background-color:#ffffff;border:1px solid #d1d5db;border-radius:8px;padding:10px 14px;font-size:15px;color:#111827;font-family:'Courier New',monospace;">
                                ${email}
                              </td>
                            </tr>
                          </table>

                          <!-- Senha -->
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding-bottom:4px;font-size:12px;color:#6b7280;font-weight:500;">Senha temporária</td>
                            </tr>
                            <tr>
                              <td style="background-color:#ffffff;border:1px solid #d1d5db;border-radius:8px;padding:10px 14px;font-size:15px;color:#111827;font-family:'Courier New',monospace;letter-spacing:0.1em;">
                                ${password}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Aviso de troca de senha -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin-bottom:28px;">
                      <tr>
                        <td style="padding:14px 18px;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="font-size:18px;padding-right:10px;vertical-align:top;">⚠️</td>
                              <td>
                                <div style="font-size:13px;font-weight:600;color:#92400e;margin-bottom:3px;">Troca de senha obrigatória</div>
                                <div style="font-size:13px;color:#b45309;line-height:1.5;">
                                  No primeiro acesso, você será direcionado para criar uma senha pessoal. A senha temporária acima não poderá ser usada novamente.
                                </div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Botão CTA -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                      <tr>
                        <td align="center">
                          <a href="${APP_URL}/login"
                             style="display:inline-block;background-color:#10b981;color:#ffffff;font-size:15px;font-weight:600;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.01em;">
                            Acessar o Sistema →
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Link de texto -->
                    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
                      Ou acesse diretamente:
                      <a href="${APP_URL}/login" style="color:#10b981;text-decoration:none;">${APP_URL}/login</a>
                    </p>

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 8px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                Este e-mail foi enviado automaticamente pelo sistema do <strong>Grupo ELLO</strong>.<br/>
                Não responda a este e-mail.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Bem-vindo ao Sistema de Fluxo de Caixa · Grupo ELLO",
    html,
  });

  if (error) {
    console.error("[sendWelcomeEmail] Erro ao enviar e-mail:", error);
    return { ok: false, error };
  }

  return { ok: true, data };
}
