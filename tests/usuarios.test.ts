import { describe, expect, it } from "vitest";
import { deixariaSemAdmin } from "@/lib/usuarios";

describe("deixariaSemAdmin", () => {
  describe("rebaixamento (PATCH)", () => {
    it("bloqueia rebaixar o único ADMIN", () => {
      expect(
        deixariaSemAdmin({ alvoEhAdmin: true, papelNovo: "OPERADOR", totalAdmins: 1 })
      ).toBe(true);
    });

    it("bloqueia também quando o novo papel é GESTOR", () => {
      expect(
        deixariaSemAdmin({ alvoEhAdmin: true, papelNovo: "GESTOR", totalAdmins: 1 })
      ).toBe(true);
    });

    it("permite rebaixar um ADMIN quando existe outro", () => {
      expect(
        deixariaSemAdmin({ alvoEhAdmin: true, papelNovo: "OPERADOR", totalAdmins: 2 })
      ).toBe(false);
    });

    it("permite editar o único ADMIN mantendo o papel ADMIN", () => {
      // Trocar nome/e-mail/senha do único ADMIN é legítimo — só o papel é restrito.
      expect(
        deixariaSemAdmin({ alvoEhAdmin: true, papelNovo: "ADMIN", totalAdmins: 1 })
      ).toBe(false);
    });

    it("permite promover um não-ADMIN a ADMIN", () => {
      expect(
        deixariaSemAdmin({ alvoEhAdmin: false, papelNovo: "ADMIN", totalAdmins: 1 })
      ).toBe(false);
    });

    it("permite editar um não-ADMIN mesmo havendo um só ADMIN", () => {
      expect(
        deixariaSemAdmin({ alvoEhAdmin: false, papelNovo: "OPERADOR", totalAdmins: 1 })
      ).toBe(false);
    });
  });

  describe("exclusão (DELETE)", () => {
    it("bloqueia excluir o único ADMIN", () => {
      expect(
        deixariaSemAdmin({ alvoEhAdmin: true, papelNovo: null, totalAdmins: 1 })
      ).toBe(true);
    });

    it("permite excluir um ADMIN quando existe outro", () => {
      expect(
        deixariaSemAdmin({ alvoEhAdmin: true, papelNovo: null, totalAdmins: 2 })
      ).toBe(false);
    });

    it("permite excluir um não-ADMIN", () => {
      expect(
        deixariaSemAdmin({ alvoEhAdmin: false, papelNovo: null, totalAdmins: 1 })
      ).toBe(false);
    });
  });

  describe("bordas", () => {
    it("bloqueia quando a contagem chega zerada (base já sem ADMIN)", () => {
      // Não deve 'liberar' por a contagem ser menor que 1 — o <= 1 cobre isso.
      expect(
        deixariaSemAdmin({ alvoEhAdmin: true, papelNovo: "OPERADOR", totalAdmins: 0 })
      ).toBe(true);
    });

    it("a regra não depende de o alvo ser quem executa a ação", () => {
      // Rebaixar o último ADMIN é igualmente fatal vindo de terceiro; por isso a
      // função nem recebe 'quem executa'.
      const rebaixarOutro = deixariaSemAdmin({
        alvoEhAdmin: true,
        papelNovo: "OPERADOR",
        totalAdmins: 1,
      });
      expect(rebaixarOutro).toBe(true);
    });
  });
});
