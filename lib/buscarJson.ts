/**
 * Busca JSON tratando os dois modos de falha que as telas ignoravam.
 *
 * Antes, `if (res.ok)` cobria só o caso do servidor responder com erro — e
 * silenciosamente: a tela ficava vazia sem explicar nada. Falha de rede era
 * pior, virava rejeição não tratada e o `finally` nunca rodava, deixando o
 * "carregando" girando para sempre.
 *
 * Devolve um resultado em vez de lançar, para a tela decidir o que mostrar.
 */
export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string };

const ERRO_REDE =
  "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";

export async function buscarJson<T>(url: string, init?: RequestInit): Promise<Resultado<T>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return { ok: false, erro: ERRO_REDE };
  }

  if (!res.ok) {
    // A API responde { error } nos casos previstos; fora deles sobra o status.
    let mensagem = `Erro ${res.status} ao carregar os dados.`;
    try {
      const corpo = await res.json();
      if (corpo?.error) mensagem = corpo.error;
    } catch {
      /* resposta sem corpo JSON — fica a mensagem por status */
    }
    if (res.status === 401) {
      mensagem = "Sua sessão expirou. Entre novamente para continuar.";
    }
    return { ok: false, erro: mensagem };
  }

  try {
    return { ok: true, dados: (await res.json()) as T };
  } catch {
    return { ok: false, erro: "O servidor devolveu uma resposta inválida." };
  }
}
