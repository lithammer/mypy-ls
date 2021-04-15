import { spawn, SpawnOptionsWithoutStdio } from "child_process";

interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export const spawnAsync = async (
  command: string,
  args?: readonly string[],
  options?: SpawnOptionsWithoutStdio
): Promise<SpawnResult> => {
  const child = spawn(command, args, options);

  let stdout = "";
  let stderr = "";

  if (child.stdout) {
    for await (const chunk of child.stdout) {
      stdout += chunk;
    }
  }

  if (child.stderr) {
    for await (const chunk of child.stderr) {
      stderr += chunk;
    }
  }

  const promise = new Promise<SpawnResult>((resolve, reject) => {
    child.on("error", reject);

    child.on("close", (code) => {
      resolve({
        stdout: stdout,
        stderr: stderr,
        exitCode: code,
      });
    });
  });

  return promise;
};
