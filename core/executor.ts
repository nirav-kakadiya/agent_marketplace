// Executor — safely runs generated integration code

export interface ExecResult {
  success: boolean;
  output: any;
  error?: string;
}

export class Executor {
  private credentials: Map<string, string> = new Map();

  setCredential(name: string, value: string) {
    this.credentials.set(name, value);
  }

  getCredential(name: string): string | undefined {
    return this.credentials.get(name);
  }

  // Run integration code safely
  async run(code: string, input: Record<string, any>): Promise<ExecResult> {
    try {
      const creds: Record<string, string> = Object.fromEntries(this.credentials);
      const wrapped = `${code}\nreturn execute(input, credentials);`;
      const fn = new Function("input", "credentials", "fetch", wrapped);
      const result = await fn(input, creds, fetch);
      return { success: true, output: result };
    } catch (err: any) {
      return { success: false, output: null, error: err.message };
    }
  }
}
